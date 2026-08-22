/**
 * FIRST LIGHT — application intake.
 *
 * Receives the application forms on promotion.html, production.html and
 * commercial.html, appends one row per application to the bound Sheet, and
 * emails a notification so nothing depends on remembering to check the Sheet.
 *
 * Deploy steps and gotchas: see README.md next to this file.
 */

/** Where notifications go. Leave blank to use the Google account that owns this script. */
const NOTIFY_EMAIL = '';

/** Tab the applications are written to. Created automatically if missing. */
const SHEET_NAME = 'Applications';

// Promotion and Production ask for sport and country; Commercial asks for record and
// org instead. One superset of columns keeps every application in one tab, with the
// cells that don't apply left blank.
const HEADERS = ['Received', 'Service', 'Name', 'Email', 'Sports', 'Country', 'Record / level',
                 'Fight promotion', 'Socials', 'Sponsors', 'Message', 'Other fields', 'Submitted from'];

/** Fields the row below places by hand. Anything else a form sends lands in "Other fields". */
const MAPPED = ['tier', 'name', 'email', 'sports', 'country', 'record', 'promotion',
                'platform[]', 'handle[]', 'sponsors', 'message', 'page', 'company'];

/**
 * The site posts here. Anything that isn't a real application is dropped quietly.
 *
 * The row built below must stay in the same order as HEADERS — the notification email
 * zips the two together, so an extra field in one and not the other mislabels every
 * column after it.
 */
function doPost(e) {
  try {
    const p = (e && e.parameter) || {};

    // Honeypot: the `company` field is off-screen, so a human never fills it in.
    // Bots that fill every field get a success response and go away — telling them
    // they were caught only invites a retry with the field left blank.
    if (p.company) return json({ ok: true });

    const multi = (e && e.parameters) || {};
    const row = [
      new Date(),
      p.tier || '',
      p.name || '',
      p.email || '',
      p.sports || '',
      p.country || '',
      p.record || '',
      p.promotion || '',
      pairSocials(multi['platform[]'], multi['handle[]']),
      p.sponsors || '',
      p.message || '',
      unmapped(multi),
      p.page || ''
    ];

    sheet().appendRow(row);
    // The row is already saved by this point: a mail failure (quota, transient
    // Google error) must not fail the request and make the applicant retype
    // everything, so it is logged and swallowed rather than thrown.
    try {
      notify(row);
    } catch (mailErr) {
      console.error('Row saved but notification failed: ' + mailErr);
    }
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    // The site shows an error and keeps the applicant's answers on screen.
    return json({ ok: false, error: String(err) });
  }
}

/** Opening the web app URL in a browser — a quick "is it deployed?" check. */
function doGet() {
  return json({ ok: true, service: 'FIRST LIGHT application intake' });
}

function sheet() {
  const ss = SpreadsheetApp.getActive();
  if (!ss) throw new Error('No bound spreadsheet. Create this script from the Sheet via Extensions > Apps Script.');
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * The socials are a variable number of platform/handle pairs, so they arrive as
 * two parallel arrays. One cell of "Instagram — @name" lines keeps the sheet to a
 * fixed set of columns however many an applicant adds.
 */
function pairSocials(platforms, handles) {
  if (!platforms || !handles) return '';
  const lines = [];
  for (let i = 0; i < handles.length; i++) {
    const handle = (handles[i] || '').trim();
    if (!handle) continue;
    lines.push((platforms[i] || 'Other') + ' — ' + handle);
  }
  return lines.join('\n');
}

/**
 * Anything a form sends that this script doesn't have a column for. A field added to
 * the site and forgotten here then shows up in the Sheet instead of vanishing.
 */
function unmapped(multi) {
  const lines = [];
  Object.keys(multi).forEach(function (key) {
    if (MAPPED.indexOf(key) !== -1) return;
    const value = multi[key].join(', ').trim();
    if (value) lines.push(key + ': ' + value);
  });
  return lines.join('\n');
}

function notify(row) {
  const to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  const service = row[1] || 'application';
  const name = row[2] || 'Someone';
  const applicantEmail = row[3];

  const body = HEADERS.map(function (label, i) {
    const value = i === 0 ? Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm z') : row[i];
    return label + ': ' + (value || '—');
  }).join('\n\n');

  const options = { name: 'FIRST LIGHT applications' };
  // Reply-to the applicant, so answering within the promised 24 hours is one tap
  // from the notification itself.
  if (applicantEmail) options.replyTo = applicantEmail;

  MailApp.sendEmail(to, 'New ' + service + ' application — ' + name, body, options);
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
