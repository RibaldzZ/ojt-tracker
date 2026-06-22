import { createPrivateKey, createSign } from "crypto";
import { writeFileSync } from "fs";

export default function handler(req, res) {
  try {
    res.status(200).json({
      cryptoOk: true,
      hasCreatePrivateKey: typeof createPrivateKey === "function",
      hasCreateSign: typeof createSign === "function",
      hasWriteFileSync: typeof writeFileSync === "function",
      nodeVersion: process.version,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
