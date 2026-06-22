/**
 * Creates OJT Tracker Google Sheet using the service account.
 * The service account owns the sheet, so no sharing needed.
 */
import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "fs";

const CREDENTIALS_PATH = "C:\\Users\\ribaldz\\Desktop\\Shadow Stack\\scripts\\gradesheet-creds.json";

async function main() {
  const creds = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8"));
  const auth = new GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  // Different versions of the library have different APIs
  let token;
  if (typeof auth.getAccessToken === "function") {
    token = await auth.getAccessToken();
  } else {
    const tr = await client.getAccessToken();
    token = tr?.token || tr;
  }
  console.log("Token obtained:", token ? token.substring(0, 20) + "..." : "FAILED");
  if (!token) throw new Error("Could not get access token");

  // Create the spreadsheet
  console.log("Creating Google Sheet...");
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: "OJT Requirements Tracker",
      },
      sheets: [
        {
          properties: { title: "Masterlist" },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Create failed: ${err}`);
  }

  const sheet = await createRes.json();
  const sheetId = sheet.spreadsheetId;
  console.log(`✅ Sheet created!`);
  console.log(`Sheet ID: ${sheetId}`);
  console.log(`URL: https://docs.google.com/spreadsheets/d/${sheetId}`);

  // Add headers
  const headers = [
    "Timestamp", "SRCode", "Name", "Section", "Semester", "Course",
    "PreOJT", "PostOJT", "VerifiedPre", "VerifiedPost",
  ];

  const headerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Masterlist!A1:J1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [headers],
      }),
    }
  );

  if (!headerRes.ok) {
    const err = await headerRes.text();
    throw new Error(`Header write failed: ${err}`);
  }

  console.log("✅ Headers written!");
  console.log(`\nUse this Sheet ID for env: ${sheetId}`);
}

main().catch(console.error);
