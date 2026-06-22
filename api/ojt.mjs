// Test: does createPrivateKey work at all on Vercel?
import { generateKeyPairSync, createPrivateKey, createSign } from "crypto";

export default async function handler(req, res) {
  const log = [];
  const o = (m) => log.push(m);
  
  try {
    o("node=" + process.version);
    
    // Test 1: Can we generate a key pair?
    try {
      const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
      o("generateKeyPair: OK");
      
      // Can we sign with it?
      const sign = createSign("RSA-SHA256");
      sign.update("test");
      sign.end();
      const sig = sign.sign(privateKey, "base64");
      o("sign with generated key: OK len=" + sig.length);
    } catch (e) {
      o("generateKeyPair: FAILED " + e.message.substring(0,120));
    }
    
    // Test 2: Create from a known-good PEM string (embedded in code)
    const testKeyPem = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCzTkvrAmvc/X0f\nNTQDG2WRcZDK4dOmBsmJBqFmePuLlleE/c4AlWTWofR7YoT3B/90kRguFCMyb7ZO\nndz0VT4q8/ffa8UkcZPtzMuYaG0/8VqYec+eG7hrpqtjl465Fe+61irfOj1+dzKW\nIWe+HZbbyrAbZQ40Fpm7tC0fFFTSx0Xkg75G/NmYn7m3gYKMAzZkx2hzy25/n/m7\n4piNMU+NpeT4AFoZQ/zS/fHobh8EFGnBEBpQVuwkyi+wvIxmcSLLUVK3acUx9IUO\nRL8VNLIyaG9P9x/lfwcmsQoQ7WTgxGMv3kJjCwsRjOgF3XQsSKQfUCuovmKqY5B7\nKia6My/JAgMBAAECggEAFaKcKvhxEup8Qzx8cOaIoB7ToYNTsiwN+8xyw6ZT9dEX\ncNreFThxgStsEEpAMH2Ez6glQoQYBiEwHnbSXyH8/RpQfaMnl8DjoFUueM6a5hUF\ngTHrgRCntUeYVQ1HwaH5ufHXHPXOTzjrP+26cphn6E/h5YBRUSwr8xfnvOELZh5F\nFQ5IiT4Yz6Lep1a7jTPxw1UKfR8nchayLzKsNiOlee+9EEr8i8o7GOba/hZcjAyl\nCkg2U6Q8mL4s7GsR4yo7uxL9EOBf33e7ko+kkYZ1Nlop+ghMkJDxymkNxOEusGFk\nQbktTigD2bQBQU0HFBEglPtCEf9vSe82rprltfbdwQKBgQDhpP7vBSMVgqCtntvP\nqTyn7SHUY9TRNysQ/vKV4qUS9/CLuHV2fgb+A0r9BXX2UAjmAI3NRF9dfqIdHfl/\nKp1S/ZjnA+cVRDZU4uDNequkJJlBmrz06YwBsukiluAmNXKor8j0qMog6ySXoG9B\nGVCaE1Fq42Irp+slB9KLVLqeKQKBgQDLbW/Dk+V/4k5zF+HPu4f89OOm4dW4jsqL\nOy6O/o+l9x7tEmFRomJAqZS9UdYjbej8UhVkxeSYThejQTCDGvsTadNRgeqhPH7j\nkqVsNDoObJ5XQsMxX8nMbF1E0bpypo7JyO7yy9zEgk3E8DSm2qpB75OYf5RTIU5O\nbwrGYm74oQKBgFYCg55ucdogKckkdZspYlKMREnmJ9f71HGtDKDvfIbHdax8imG5\nVkb60Fmz/CwAg/PQID0vI77Kp1a79z9u6fsZaXAdf7cOgjtHI/OPH9/4h2aHaiFc\n6J45KT6jDhviYatFHi+MK0fy+cbGQ8InuR6R4IYC2IfVgP9jhPDRQjVJAoGAYttD\nvN9aX9MyHGw2qCSR6TN4jdiha5a4hwCzl3nNhPGabcrI0EsBRDsktPvX/E+lMTkS\nfG5OsFUC16sOUCgEa2K59poT01b6sszI5tRagjf2mqEvCgdqoZTnnlHtMVoPea/T\nrtmy5ywLbvDsJUmOA4zRRQJ6qgs9apA7xDyBgQECgYEAi+4oCKbWri89ZbgRlGhG\nOg4BbsEuPvHpnR5RC6dKu6SyjPQsKfV518ZP5eIYj2TSFjzsjEbzGO/GTkOmixXr\nqWkzNksNTVnpkgRxY66PgzNdge5vwqW0mes6XdP11JMoxIGRtJj69ya1K6OGaBkm\nOkwevc0YBZShsbBqJOIUgP4=\n-----END PRIVATE KEY-----`;

    try {
      const k = createPrivateKey(testKeyPem);
      o("createPrivateKey from literal PEM: OK type=" + (k.type || "?"));
      
      const sign2 = createSign("RSA-SHA256");
      sign2.update("test");
      sign2.end();
      const sig2 = sign2.sign(k, "base64");
      o("sign with literal key: OK len=" + sig2.length);
    } catch (e) {
      o("createPrivateKey from literal PEM: FAILED " + e.message.substring(0,120));
    }
    
    // Test 3: Now try with env var key
    let pk = process.env.GCP_PRIVATE_KEY || "no-key";
    o("envKeyLen=" + pk.length);
    
    pk = pk.replace(/-----BEGIN.*PRIVATE KEY-----/g, "").trim();
    pk = pk.replace(/-----END.*PRIVATE KEY-----/g, "").trim();
    pk = pk.split("\n").filter(l => l.trim()).join("\n");
    const envPem = "-----BEGIN PRIVATE KEY-----\n" + pk + "\n-----END PRIVATE KEY-----";
    
    try {
      const k3 = createPrivateKey(envPem);
      o("createPrivateKey from env PEM: OK type=" + (k3.type || "?"));
    } catch (e) {
      o("createPrivateKey from env PEM: FAILED " + e.message.substring(0,120));
      o("  first 80 chars of key: " + envPem.substring(0,80));
      o("  last 80 chars of key: " + envPem.substring(envPem.length - 80));
    }
    
    o("DONE");
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(log.join("\n"));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("FATAL: " + e.message + "\n" + log.join("\n"));
  }
}