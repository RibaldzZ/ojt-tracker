"""
Creates OJT Tracker sheet tab within the existing Grade Engine spreadsheet.
The service account already has Editor access to this sheet.
"""
import json
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDS_PATH = os.path.expanduser(
    "~/Desktop/Shadow Stack/scripts/gradesheet-creds.json"
)
SHEET_ID = "1TELifh_DyzEQWd1OFQjPgFe_RYzrm0n0CogkScRoRC4"

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

HEADERS = [
    "Timestamp", "SRCode", "Name", "Section", "Semester", "Course",
    "PreOJT", "PostOJT", "VerifiedPre", "VerifiedPost",
]


def main():
    print("Setting up OJT Tracker sheet tab...")

    creds = service_account.Credentials.from_service_account_file(
        CREDS_PATH, scopes=SCOPES
    )
    service = build("sheets", "v4", credentials=creds)

    # Check if OJT tab already exists
    spreadsheet = service.spreadsheets().get(spreadsheetId=SHEET_ID).execute()
    sheet_names = [s["properties"]["title"] for s in spreadsheet.get("sheets", [])]
    print(f"Existing sheets: {sheet_names}")

    if "Masterlist" not in sheet_names:
        # Add new sheet tab
        requests = [{
            "addSheet": {
                "properties": {"title": "Masterlist"}
            }
        }]
        service.spreadsheets().batchUpdate(
            spreadsheetId=SHEET_ID, body={"requests": requests}
        ).execute()
        print("[OK] Added Masterlist sheet tab")
    else:
        print("[OK] Masterlist already exists")

    # Write headers
    body = {"values": [HEADERS]}
    result = (
        service.spreadsheets()
        .values()
        .update(
            spreadsheetId=SHEET_ID,
            range="Masterlist!A1:J1",
            valueInputOption="USER_ENTERED",
            body=body,
        )
        .execute()
    )
    print(f"[OK] Headers written! ({result.get('updatedCells')} cells)")

    print(f"\n{'='*60}")
    print(f"  Sheet tab: Masterlist")
    print(f"  Sheet ID:  {SHEET_ID}")
    print(f"  URL:       https://docs.google.com/spreadsheets/d/{SHEET_ID}")
    print(f"{'='*60}")

    # Print the env var value we'll set on Vercel
    print(f"\n  Use this for OJT_SHEET_ID env var: {SHEET_ID}")
    return SHEET_ID


if __name__ == "__main__":
    main()
