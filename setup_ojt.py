#!/usr/bin/env python3
"""
OJT Tracker - Admin Key & Setup Helper
Generates an admin key and prints setup instructions.
"""
import secrets
import string

def generate_key(length=32):
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

def main():
    key = generate_key()
    print("=" * 60)
    print("  OJT TRACKER - SETUP HELPER")
    print("=" * 60)
    print(f"\n==> Your Admin Key (save this):\n\n    {key}\n")
    print("-" * 60)
    print("  SETUP INSTRUCTIONS")
    print("-" * 60)
    print("""
1. Create a Google Sheet:
   - Go to https://sheets.new
   - Name it "OJT Requirements Tracker"
   - Share it with: gradesheet-bot@angular-glyph-498713-t5.iam.gserviceaccount.com
   - Give Editor permissions
   - Copy the Sheet ID from the URL (long string in /spreadsheets/d/...)

2. Deploy to Vercel:
   - cd ojt-tracker
   - npx vercel --prod

3. Set Environment Variables on Vercel:
   - OJT_SHEET_ID       = the sheet ID from step 1
   - OJT_ADMIN_KEY      = the key generated above
   - GOOGLE_SHEETS_CREDENTIALS = base64 of gradesheet-creds.json

   Tip: Use base64 encoding:
     powershell: [Convert]::ToBase64String([IO.File]::ReadAllBytes('gradesheet-creds.json'))
     bash:       base64 -w0 gradesheet-creds.json

4. Open the deployed URL:
   - Students use the "I'm a Student" tab to register and track
   - You use the "I'm a Coordinator" tab with your admin key
""")


if __name__ == "__main__":
    main()
