# Connect the website to a Google Sheet in your Drive (about 5 minutes)

This sheet is where your "interested" marks, statuses, agent numbers, emails, viewing dates and
notes are saved, so you and your partner see the same thing on the website. You can also open the
sheet in Google Drive any time.

1. Go to https://sheets.new (signed in with your Google account). Name the sheet **Rental Hunt**.
2. In the sheet: **Extensions → Apps Script**. Delete the sample code and paste everything from
   `google-sheet/Code.gs`.
3. In the pasted code, find `const PASSCODE = 'change-me';` and change `change-me` to a passcode you'll
   share with your partner (not a password you use anywhere else).
4. Click the **Save** icon, choose the function **setup** in the dropdown next to Run, and click **Run**.
   Google asks you to authorise it: choose your account → *Advanced* → *Go to project (unsafe)* →
   *Allow*. (It says "unsafe" only because it's your own unpublished script.) A **track** tab appears
   in the sheet.
5. Click **Deploy → New deployment** → gear icon → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click **Deploy** and copy the **Web app URL** (ends in `/exec`).
6. Send Claude that Web app URL. Give your partner the passcode; you each type it once on the website.

The website only stores data in the sheet when the passcode matches, and the passcode never goes into
the GitHub repo.
