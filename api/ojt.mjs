import { createPrivateKey, createSign } from "crypto";

// Minimal test: build credentials and create a signed JWT
export default async function handler(req, res) {
  let result = { ok: false, error: "unknown" };
  
  try {
    const client_email = process.env.GCP_CLIENT_EMAIL || "test@test.com";
    let pk = process.env.GCP_PRIVATE_KEY || "";
    
    result.step1 = "rawLen=" + pk.length + " begin=" + pk.includes("-----BEGIN");

    // Step 2: Wrap key with PEM headers
    pk = pk.replace(/-----BEGIN.*PRIVATE KEY-----/g, "").trim();
    pk = pk.replace(/-----END.*PRIVATE KEY-----/g, "").trim();
    pk = pk.split("\n").filter(l => l.trim()).join("\n");
    pk = "-----BEGIN PRIVATE KEY-----\n" + pk + "\n-----END PRIVATE KEY-----";
    result.step2 = "wrappedLen=" + pk.length + " starts=" + pk.substring(0, 45);

    // Step 3: createPrivateKey
    const keyObject = createPrivateKey(pk);
    result.step3 = "OK";

    // Step 4: Sign
    const header = { alg: "RS256", typ: "JWT" };
    const claim = {
      iss: client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
    const signInput = b64(header) + "." + b64(claim);

    const sign = createSign("RSA-SHA256");
    sign.update(signInput);
    sign.end();
    const sig = sign.sign(keyObject, "base64");
    result.step4 = "sigLen=" + sig.length;

    // Step 5: Exchange token
    const jwt = signInput + "." + sig.replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    });
    const tokenData = await tokenRes.json();
    result.step5 = tokenRes.status + " " + (tokenData.access_token ? "OK" : JSON.stringify(tokenData).substring(0,200));

    result.ok = true;
  } catch (e) {
    result.error = e.message || String(e);
    result.stack = (e.stack || "").substring(0, 500);
  }
  
  // Always respond with JSON
  res.setHeader("Content-Type", "application/json");
  res.status(result.ok ? 200 : 500).end(JSON.stringify(result, null, 2));
}