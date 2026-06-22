/**
 * ARISE! OJT Tracker API
 * Vercel serverless — Google Sheets backed
 *
 * POST /api/ojt
 *   { action: "register", ... }  — Student self-registration
 *   { action: "verify", ... }    — Coordinator verifies submission
 *   { action: "update-post", ... } — Student updates post-OJT
 *   { action: "delete", ... }    — Coordinator deletes student
 * GET /api/ojt?action=get-all      — All students (coordinator)
 * GET /api/ojt?action=get&srcode=X — Single student
 * GET /api/ojt?action=export       — CSV-friendly data
 * POST /api/ojt?action=init        — Create sheet (first run)
 */

import { createHash } from "crypto";

// ─── Config ──────────────────────────────────────────────────
const SHEET_ID = process.env.OJT_SHEET_ID;
const CREDENTIALS_B64 = process.env.GOOGLE_SHEETS_CREDENTIALS; // base64 of service account JSON
const ADMIN_KEY = process.env.OJT_ADMIN_KEY || "";

// ─── Pre-OJT Requirements ────────────────────────────────────
const PRE_OJT = [
  "Parent's Guardian Consent for Internship Training",
  "Student Trainee's Personal History Statement",
  "On the Job Trainee Acceptance Form",
  "Internship Agreement",
  "OJT Endorsement Letter",
  "Registration Form",
  "Medical",
  "School ID",
];

// ─── Post-OJT Requirements ────────────────────────────────────
const POST_OJT = [
  "Student Trainee's Performance Appraisal Report",
  "Training Supervisor's Feedback Form",
  "Student Trainee's Feedback Form",
  "Technical Narrative Report",
  "Certificate of Completion",
  "Post Individual Interview & Career Counselling for OJT",
];

// ─── Auth helpers ────────────────────────────────────────────

function buildCredentials() {
  // Primary: Base64-encoded full service account JSON (immune to paste corruption)
  if (CREDENTIALS_B64) {
    try {
      return JSON.parse(Buffer.from(CREDENTIALS_B64, "base64").toString());
    } catch (e) {
      console.error("Failed to parse GOOGLE_SHEETS_CREDENTIALS:", e.message);
    }
  }

  // Fallback: Individual env vars
  if (process.env.GCP_PRIVATE_KEY && process.env.GCP_CLIENT_EMAIL) {
    let pk = process.env.GCP_PRIVATE_KEY;
    pk = pk.replace(/-----BEGIN PRIVATE KEY-----/g, "");
    pk = pk.replace(/-----END PRIVATE KEY-----/g, "");
    pk = pk.trim();
    pk = pk.replace(/\\n/g, "\n");
    pk = pk.replace(/\r\n/g, "\n");
    pk = pk.split("\n").filter(line => line.trim() !== "").join("\n");
    pk = "-----BEGIN PRIVATE KEY-----\n" + pk + "\n-----END PRIVATE KEY-----";

    return {
      type: "service_account",
      project_id: process.env.GCP_PROJECT_ID || "angular-glyph-498713-t5",
      private_key_id: process.env.GCP_PRIVATE_KEY_ID || "",
      private_key: pk,
      client_email: process.env.GCP_CLIENT_EMAIL,
      client_id: process.env.GCP_CLIENT_ID || "",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.GCP_CLIENT_CERT_URL || "",
      universe_domain: "googleapis.com",
    };
  }

  throw new Error(
    "No Google credentials found. Set GOOGLE_SHEETS_CREDENTIALS (base64) " +
    "OR GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY as env vars."
  );
}

function isAdmin(req) {
  const key = req.headers["x-admin-key"] || "";
  return ADMIN_KEY && key === ADMIN_KEY;
}

function getClientIP(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.headers["x-real-ip"]
    || "unknown";
}

// Simple rate limit — 50 submissions/day per IP
const RATE_LIMIT = 50;
const rateMap = new Map();

function checkRateLimit(req) {
  const ip = getClientIP(req);
  const today = new Date().toISOString().slice(0, 10);
  const key = `${ip}:${today}`;
  const count = rateMap.get(key) || 0;
  if (count >= RATE_LIMIT) return false;
  rateMap.set(key, count + 1);
  return true;
}

// ─── Google Sheets helpers ────────────────────────────────────

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 300000) {
    return cachedToken;
  }

  const creds = buildCredentials();
  const { private_key, client_email } = creds;

  // Raw JWT assertion — bypasses ALL Google library PEM parsing
  const crypto = await import("crypto");

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const b64 = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const signatureInput = b64(header) + "." + b64(claim);

  // Normalize private key
  let pemKey = private_key;
  if (pemKey.includes("\\n")) pemKey = pemKey.replace(/\\n/g, "\n");
  pemKey = pemKey.replace(/\r\n/g, "\n");
  if (!pemKey.includes("-----BEGIN PRIVATE KEY-----")) {
    const content = pemKey
      .replace(/-----BEGIN RSA PRIVATE KEY-----/g, "")
      .replace(/-----END RSA PRIVATE KEY-----/g, "")
      .trim();
    pemKey = "-----BEGIN PRIVATE KEY-----\n" + content + "\n-----END PRIVATE KEY-----";
  }

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signatureInput);
  sign.end();
  const signature = sign.sign(pemKey, "base64");
  const signatureB64 = signature
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = signatureInput + "." + signatureB64;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(`Token exchange failed (${tokenRes.status}): ${errBody}`);
  }

  const tokenData = await tokenRes.json();
  cachedToken = tokenData.access_token;
  tokenExpiry = Date.now() + tokenData.expires_in * 1000;
  return cachedToken;
}

async function sheetsApi(method, path, body) {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets API error (${res.status}): ${err}`);
  }
  return res.json();
}

async function getValues(range) {
  const data = await sheetsApi("GET", `/${SHEET_ID}/values/${range}`);
  return data.values || [];
}

async function appendValues(range, values) {
  return sheetsApi("POST", `/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    values: [values],
  });
}

async function updateValues(range, values) {
  return sheetsApi("PUT", `/${SHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`, {
    values: [values],
  });
}

// ─── Sheet structure ───────────────────────────────────────

const MASTER_SHEET = "Masterlist";
const HEADERS = [
  "Timestamp",
  "SRCode",
  "Name",
  "Section",
  "Semester",
  "Course",
  "PreOJT",       // JSON: {"0":true, "1":false, ...}
  "PostOJT",      // JSON: {"0":false, "1":false, ...}
  "VerifiedPre",  // JSON: {"0":"2026-06-22", ...}
  "VerifiedPost", // JSON: {"0":"", ...}
];

async function ensureSheet() {
  try {
    const info = await sheetsApi("GET", `/${SHEET_ID}`);
    const sheets = info.sheets.map(s => s.properties.title);
    if (!sheets.includes(MASTER_SHEET)) {
      await sheetsApi("POST", `/${SHEET_ID}:batchUpdate`, {
        requests: [{
          addSheet: { properties: { title: MASTER_SHEET } }
        }]
      });
      await sheetsApi("PUT", `/${SHEET_ID}/values/${MASTER_SHEET}!A1:${String.fromCharCode(64 + HEADERS.length)}1?valueInputOption=USER_ENTERED`, {
        values: [HEADERS]
      });
    }
  } catch (e) {
    throw new Error(`Sheet not accessible. Share sheet with gradesheet-bot@angular-glyph-498713-t5.iam.gserviceaccount.com as Editor`);
  }
}

// ─── Data parsing ──────────────────────────────────────────

function rowToStudent(row) {
  if (!row || row.length < 6) return null;
  return {
    timestamp: row[0] || "",
    srcode: row[1] || "",
    name: row[2] || "",
    section: row[3] || "",
    semester: row[4] || "",
    course: row[5] || "",
    preOjt: safeParse(row[6]),
    postOjt: safeParse(row[7]),
    verifiedPre: safeParse(row[8]),
    verifiedPost: safeParse(row[9]),
  };
}

function safeParse(str) {
  if (!str || str === "") return {};
  try { return JSON.parse(str); } catch { return {}; }
}

// ─── Handlers ──────────────────────────────────────────────

async function handleRegister(body) {
  const { srcode, name, section, semester, course, preOjt } = body;

  if (!srcode || !name || !section || !semester || !course) {
    return { status: 400, json: { error: "Missing required fields: srcode, name, section, semester, course" } };
  }

  const rows = await getValues(`${MASTER_SHEET}!A:J`);
  const existing = rows.findIndex((r, i) => i > 0 && r[1]?.toUpperCase() === srcode.toUpperCase());

  const preOjtJson = JSON.stringify(preOjt || {});
  const postOjtJson = "{}";
  const verifiedPreJson = "{}";
  const verifiedPostJson = "{}";
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  if (existing > 0) {
    const student = rowToStudent(rows[existing]);
    const mergedPre = { ...student.preOjt, ...(preOjt || {}) };

    await updateValues(`${MASTER_SHEET}!A${existing + 1}:J${existing + 1}`, [
      [rows[existing][0], srcode, name, section, semester, course, JSON.stringify(mergedPre), postOjtJson, verifiedPreJson, verifiedPostJson]
    ]);
    return { status: 200, json: { ok: true, message: "Updated existing entry" } };
  }

  await appendValues(`${MASTER_SHEET}!A:J`, [
    [now, srcode, name, section, semester, course, preOjtJson, postOjtJson, verifiedPreJson, verifiedPostJson]
  ]);
  return { status: 200, json: { ok: true, message: "Registered successfully" } };
}

async function handleUpdatePost(body) {
  const { srcode, postOjt } = body;
  if (!srcode || !postOjt) {
    return { status: 400, json: { error: "Missing srcode or postOjt" } };
  }

  const rows = await getValues(`${MASTER_SHEET}!A:J`);
  const idx = rows.findIndex((r, i) => i > 0 && r[1]?.toUpperCase() === srcode.toUpperCase());
  if (idx <= 0) return { status: 404, json: { error: "Student not found" } };

  const student = rowToStudent(rows[idx]);
  const mergedPost = { ...student.postOjt, ...postOjt };

  await updateValues(`${MASTER_SHEET}!H${idx + 1}`, [[JSON.stringify(mergedPost)]]);
  return { status: 200, json: { ok: true, message: "Post-OJT updated" } };
}

async function handleVerify(body) {
  const { srcode, type, index, date } = body;
  if (!srcode || type === undefined || index === undefined) {
    return { status: 400, json: { error: "Missing srcode, type, or index" } };
  }

  const rows = await getValues(`${MASTER_SHEET}!A:J`);
  const idx = rows.findIndex((r, i) => i > 0 && r[1]?.toUpperCase() === srcode.toUpperCase());
  if (idx <= 0) return { status: 404, json: { error: "Student not found" } };

  const student = rowToStudent(rows[idx]);
  const verifiedDate = date || new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  if (type === "pre") {
    const verified = { ...student.verifiedPre, [index]: verifiedDate };
    await updateValues(`${MASTER_SHEET}!I${idx + 1}`, [[JSON.stringify(verified)]]);
  } else {
    const verified = { ...student.verifiedPost, [index]: verifiedDate };
    await updateValues(`${MASTER_SHEET}!J${idx + 1}`, [[JSON.stringify(verified)]]);
  }

  return { status: 200, json: { ok: true, message: `Verified ${type === "pre" ? PRE_OJT[index] : POST_OJT[index]}` } };
}

async function handleDelete(body) {
  const { srcode } = body;
  if (!srcode) return { status: 400, json: { error: "Missing srcode" } };

  const rows = await getValues(`${MASTER_SHEET}!A:J`);
  const idx = rows.findIndex((r, i) => i > 0 && r[1]?.toUpperCase() === srcode.toUpperCase());
  if (idx <= 0) return { status: 404, json: { error: "Student not found" } };

  const range = `${MASTER_SHEET}!A${idx + 1}:J${idx + 1}`;
  await sheetsApi("PUT", `/${SHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`, {
    values: [["DELETED", srcode, "", "", "", "", "", "", "", ""]]
  });
  return { status: 200, json: { ok: true, message: "Deleted" } };
}

async function handleGetAll() {
  const rows = await getValues(`${MASTER_SHEET}!A:J`);
  const students = rows.slice(1).map(rowToStudent).filter(Boolean);
  
  const total = students.length;
  const completed = students.filter(s => {
    const preCount = Object.keys(s.verifiedPre).length;
    const postCount = Object.keys(s.verifiedPost).length;
    return preCount >= PRE_OJT.length && postCount >= POST_OJT.length;
  }).length;

  return {
    status: 200,
    json: {
      students,
      stats: {
        total,
        completed,
        inProgress: total - completed,
        preRequirements: PRE_OJT,
        postRequirements: POST_OJT,
      },
    },
  };
}

async function handleGet(query) {
  const { srcode } = query;
  if (!srcode) return { status: 400, json: { error: "Missing srcode" } };

  const rows = await getValues(`${MASTER_SHEET}!A:J`);
  const row = rows.find((r, i) => i > 0 && r[1]?.toUpperCase() === srcode.toUpperCase());
  if (!row) return { status: 404, json: { error: "Student not found" } };

  return { status: 200, json: { student: rowToStudent(row) } };
}

async function handleExport() {
  const rows = await getValues(`${MASTER_SHEET}!A:J`);
  const students = rows.slice(1).map(rowToStudent).filter(Boolean);

  const csvRows = [["SRCode", "Name", "Section", "Semester", "Course", "Status", "Missing Pre-OJT", "Missing Post-OJT", "Date Registered"]];

  students.forEach(s => {
    const preVerified = Object.keys(s.verifiedPre).length;
    const postVerified = Object.keys(s.verifiedPost).length;
    const missingPre = PRE_OJT.filter((_, i) => !s.verifiedPre?.[i]);
    const missingPost = POST_OJT.filter((_, i) => !s.verifiedPost?.[i]);
    const status = preVerified >= PRE_OJT.length && postVerified >= POST_OJT.length ? "COMPLETE" : "INCOMPLETE";

    csvRows.push([
      s.srcode, s.name, s.section, s.semester, s.course,
      status,
      missingPre.join("; "),
      missingPost.join("; "),
      s.timestamp,
    ]);
  });

  return {
    status: 200,
    json: { csv: csvRows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n") },
  };
}

async function handleInit() {
  await ensureSheet();
  return { status: 200, json: { ok: true, message: "Sheet ready", headers: HEADERS, preOjt: PRE_OJT, postOjt: POST_OJT } };
}

// ─── Main handler ──────────────────────────────────────────

export default async function handler(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (!SHEET_ID) {
      return res.status(200).json({
        needsSetup: true,
        message: "OJT Tracker needs setup. Create a Google Sheet, share with gradesheet-bot@angular-glyph-498713-t5.iam.gserviceaccount.com, then set OJT_SHEET_ID env var.",
      });
    }

    const query = req.query || {};
    const body = req.method === "POST" ? (req.body || {}) : {};
    const action = body.action || query.action || "";

    if (req.method === "GET") {
      if (action === "export") {
        const result = await handleExport();
        return res.status(result.status).json(result.json);
      }
      if (action === "get" || action === "get-student") {
        const result = await handleGet(query);
        return res.status(result.status).json(result.json);
      }
      const result = await handleGetAll();
      return res.status(result.status).json(result.json);
    }

    if (req.method === "POST") {
      if (action === "init") {
        const result = await handleInit();
        return res.status(result.status).json(result.json);
      }

      if (action === "register") {
        if (!checkRateLimit(req)) {
          return res.status(429).json({ error: "Too many submissions. Try again tomorrow." });
        }
        const result = await handleRegister(body);
        return res.status(result.status).json(result.json);
      }

      if (action === "update-post") {
        const result = await handleUpdatePost(body);
        return res.status(result.status).json(result.json);
      }

      if (!isAdmin(req)) {
        return res.status(401).json({ error: "Admin key required" });
      }

      if (action === "verify") {
        const result = await handleVerify(body);
        return res.status(result.status).json(result.json);
      }

      if (action === "delete") {
        const result = await handleDelete(body);
        return res.status(result.status).json(result.json);
      }

      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("OJT API Error:", error);
    return res.status(500).json({
      error: error.message,
      hint: "Make sure the sheet is shared with gradesheet-bot@angular-glyph-498713-t5.iam.gserviceaccount.com",
    });
  }
}
