// Test both PEM and DER key formats
import { createPrivateKey } from "crypto";

export default async function handler(req, res) {
  const log = [];
  const o = (m) => log.push(m);
  
  try {
    let pk = process.env.GCP_PRIVATE_KEY || "no-key";
    o("rawLen=" + pk.length);
    
    // Try 1: PEM with PKCS#8 header (-----BEGIN PRIVATE KEY-----)
    let content = pk.replace(/-----BEGIN.*PRIVATE KEY-----/g, "").trim();
    content = content.replace(/-----END.*PRIVATE KEY-----/g, "").trim();
    content = content.split("\n").filter(l => l.trim()).join("\n");
    
    const pemPkcs8 = "-----BEGIN PRIVATE KEY-----\n" + content + "\n-----END PRIVATE KEY-----";
    o("pemPkcs8Len=" + pemPkcs8.length + " starts=" + pemPkcs8.substring(0,35));
    
    try {
      const k1 = createPrivateKey(pemPkcs8);
      o("PEM PKCS#8: OK type=" + (k1.type || "?"));
    } catch (e1) {
      o("PEM PKCS#8: FAILED " + e1.message.substring(0,60));
    }
    
    // Try 2: PEM with PKCS#1 header (-----BEGIN RSA PRIVATE KEY-----)
    const pemPkcs1 = "-----BEGIN RSA PRIVATE KEY-----\n" + content + "\n-----END RSA PRIVATE KEY-----";
    
    try {
      const k2 = createPrivateKey(pemPkcs1);
      o("PEM PKCS#1: OK type=" + (k2.type || "?"));
    } catch (e2) {
      o("PEM PKCS#1: FAILED " + e2.message.substring(0,60));
    }
    
    // Try 3: DER format (base64 decode first)
    try {
      const derBuffer = Buffer.from(content.replace(/\n/g, ""), "base64");
      o("DER decoded: " + derBuffer.length + " bytes");
      const k3 = createPrivateKey({ key: derBuffer, format: "der", type: "pkcs8" });
      o("DER PKCS#8: OK type=" + (k3.type || "?"));
    } catch (e3) {
      o("DER PKCS#8: FAILED " + e3.message.substring(0,60));
    }
    
    // Try 4: DER PKCS#1
    try {
      const derBuffer = Buffer.from(content.replace(/\n/g, ""), "base64");
      const k4 = createPrivateKey({ key: derBuffer, format: "der", type: "pkcs1" });
      o("DER PKCS#1: OK type=" + (k4.type || "?"));
    } catch (e4) {
      o("DER PKCS#1: FAILED " + e4.message.substring(0,60));
    }
    
    o("DONE");
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(log.join("\n"));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("FATAL: " + e.message + "\n" + log.join("\n"));
  }
}