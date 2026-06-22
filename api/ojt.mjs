export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    node: process.version,
    env: {
      hasOjtSheet: !!process.env.OJT_SHEET_ID,
      hasAdminKey: !!process.env.OJT_ADMIN_KEY,
      hasBase64: !!process.env.GOOGLE_SHEETS_CREDENTIALS,
      hasPk: !!process.env.GCP_PRIVATE_KEY,
      hasEmail: !!process.env.GCP_CLIENT_EMAIL,
      pkLength: (process.env.GCP_PRIVATE_KEY || "").length,
      pkStartsWith: (process.env.GCP_PRIVATE_KEY || "").substring(0, 50),
      pkEndsWith: (process.env.GCP_PRIVATE_KEY || "").substring(-40),
      pkHasBegin: (process.env.GCP_PRIVATE_KEY || "").includes("-----BEGIN"),
      pkNewlines: ((process.env.GCP_PRIVATE_KEY || "").match(/\n/g) || []).length,
    }
  });
}
