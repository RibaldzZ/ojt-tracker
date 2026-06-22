// Ultra minimal - test if handler runs at all
import { createPrivateKey, createSign } from "crypto";

export default async function handler(req, res) {
  const output = [];
  const log = (msg) => output.push(msg);
  
  try {
    log("handler started");
    log("node=" + process.version);
    
    let pk = process.env.GCP_PRIVATE_KEY || "no-key";
    log("pkLen=" + pk.length);
    
    // Wrap with PEM
    pk = pk.replace(/-----BEGIN.*PRIVATE KEY-----/g, "").trim();
    pk = pk.replace(/-----END.*PRIVATE KEY-----/g, "").trim();
    pk = pk.split("\n").filter(l => l.trim()).join("\n");
    pk = "-----BEGIN PRIVATE KEY-----\n" + pk + "\n-----END PRIVATE KEY-----";
    log("wrappedLen=" + pk.length);
    log("starts=" + pk.substring(0,30));
    
    log("about to createPrivateKey");
    const key = createPrivateKey(pk);
    log("createPrivateKey OK type=" + key.type);
    
    log("about to createSign");
    const sign = createSign("RSA-SHA256");
    sign.update("test");
    sign.end();
    log("about to sign");
    const sig = sign.sign(key, "base64");
    log("sign OK len=" + sig.length);
    
    output.push("ALL OK");
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(output.join("\n"));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("FAILED: " + (e.message || e) + "\n" + output.join("\n") + "\n" + (e.stack || "").substring(0,500));
  }
}