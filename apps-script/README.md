# Application intake (Google Sheet + email)

The three application forms post to a Google Apps Script web app. It appends one row
per application to a Sheet and emails you a notification with the applicant's address
as reply-to.

`Code.gs` is the script. Apps Script projects live in Google Drive, not in this repo —
this copy is the source of truth, so edit it here and paste it over.

## First-time setup

1. Create a Google Sheet in the account that should receive the notifications. Name it
   something like `FIRST LIGHT — Applications`. Leave it empty; the script creates and
   formats its own `Applications` tab on the first submission.
2. In that Sheet: **Extensions → Apps Script**. Delete the stub `myFunction`, paste in
   all of `Code.gs`, and save. Creating the script this way is what binds it to the
   Sheet — a standalone script has no Sheet to write to and will error.
3. Optional: set `NOTIFY_EMAIL` at the top if notifications should go somewhere other
   than the account that owns the script.
4. **Deploy → New deployment → ⚙ → Web app**, then:
   - Description: anything (`v1`)
   - Execute as: **Me**
   - Who has access: **Anyone**  ← must be "Anyone", not "Anyone with a Google account",
     or applicants get a login page instead of a submission.
5. Deploy, then authorise. An unverified personal script warns "Google hasn't verified
   this app" — **Advanced → Go to (project name) (unsafe)** is the expected path for a
   script you wrote yourself.
6. Copy the **Web app URL** (ends in `/exec`). Paste it into `FORM_ENDPOINT` at the top
   of `nav.js`, and deploy the site.

## Checking it works

- Open the `/exec` URL in a browser. `{"ok":true,"service":"FIRST LIGHT application
  intake"}` means it is deployed and public.
- Submit a real application on the site. Within a couple of seconds the button should
  be replaced by "Application received", a row should appear in the Sheet, and the mail
  should arrive. If the button comes back with an error instead, the row was not
  written — check **Executions** in the Apps Script editor for the reason.

## Changing the script later

Editing and saving `Code.gs` does **not** change what the live site talks to. After
editing: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. That
keeps the same URL. Using "New deployment" instead mints a *different* URL and the site
keeps talking to the old code.

## Worth knowing

- **Email limits.** A consumer Gmail account can send 100 mails a day from Apps Script
  (Workspace: 1500). Past that the row is still written to the Sheet and the failure is
  logged — the Sheet, not your inbox, is the durable record.
- **The URL is public.** It has to be, for the forms to reach it. Anyone who reads the
  page source can post to it, so the script drops anything that fills the hidden
  `company` honeypot field. If real spam starts landing, add a shared token: a hidden
  field on the forms and a matching check in `doPost`.
- **Where the data lives.** In your Drive, under whichever Google account owns the
  Sheet. Applicants' names, emails and socials are personal data — keep the Sheet
  private and share it deliberately.
- **The forms are useless until `FORM_ENDPOINT` is set.** They refuse to submit and say
  so, rather than pretending an application went through.

## Adding or reordering columns

`HEADERS` and the row built in `doPost` are zipped together for the notification email,
so they must stay in the same order — a field added to one and not the other mislabels
every column after it. The header row is only written when the tab is first created, so
after changing `HEADERS` on a Sheet that already has data, add the matching column to
the existing header row by hand (or rename the tab and let the script make a fresh one).
