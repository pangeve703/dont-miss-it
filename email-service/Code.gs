/**
 * Don't Miss It: optional email reminders.
 *
 * A free backend that runs on Google Apps Script. It stores subscribers in the
 * Google Sheet this script is attached to, checks every hour, and sends at most
 * one digest email per subscriber per day through the owner's Gmail account.
 *
 * Only people who turn on email reminders in the app send anything here: their
 * email address, time zone, and the title and date of their active reminders.
 * Amounts and notes are never sent.
 *
 * Setup instructions: see email-service/README.md.
 */

const CONFIG = {
  /** Local hour (in each subscriber's time zone) after which the daily email goes out. */
  SEND_HOUR: 8,
  /** Most reminders stored per subscriber. */
  MAX_REMINDERS: 100,
  /** Verification emails allowed per hour across everyone (abuse protection). */
  MAX_VERIFY_PER_HOUR: 20,
  /** Minimum minutes between verification emails to the same subscriber. */
  VERIFY_COOLDOWN_MINUTES: 10,
  /** Unconfirmed sign-ups are deleted after this many days. */
  PENDING_TTL_DAYS: 7,
  /** Allowed "days before" values. 0 means "on the day only". */
  DAYS_BEFORE: [0, 1, 3, 7],
  APP_NAME: "Don't Miss It",
  APP_URL: 'https://pangeve703.github.io/dont-miss-it/',
}

const SHEET_NAME = 'subscribers'
const HEADERS = [
  'token', 'email', 'status', 'code', 'unsubKey', 'daysBefore', 'timeZone',
  'reminders', 'sent', 'lastSentDate', 'verifySentAt', 'createdAt', 'updatedAt',
]

// ---------------------------------------------------------------------------
// One-time setup: run this function once from the Apps Script editor.

function setup() {
  getSheet_()
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === 'sendDueReminders') ScriptApp.deleteTrigger(trigger)
  }
  ScriptApp.newTrigger('sendDueReminders').timeBased().everyHours(1).create()
}

// ---------------------------------------------------------------------------
// Web endpoints

/** API used by the app. The body is JSON sent as text/plain to avoid CORS preflight. */
function doPost(e) {
  let request
  try {
    request = JSON.parse(e.postData.contents)
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' })
  }
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    return json_(handleRequest_(request, new Date()))
  } catch (err) {
    console.error(err)
    return json_({ ok: false, error: 'server_error' })
  } finally {
    lock.releaseLock()
  }
}

/** Links opened from emails: confirm an address, or unsubscribe. */
function doGet(e) {
  const p = (e && e.parameter) || {}
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    if (p.action === 'verify') return page_(verify_(p.token, p.code))
    if (p.action === 'unsubscribe') return page_(unsubscribeByKey_(p.token, p.key))
    return page_({ title: CONFIG.APP_NAME, message: 'Nothing to see here.' })
  } finally {
    lock.releaseLock()
  }
}

function handleRequest_(req, now) {
  if (!req || typeof req !== 'object' || !isToken_(req.token)) return { ok: false, error: 'bad_request' }
  const rows = readRows_()
  const row = rows.find((r) => r.token === req.token)

  switch (req.action) {
    case 'status':
      return { ok: true, status: row ? row.status : 'none' }

    case 'unsubscribe':
      if (row) deleteRow_(row)
      return { ok: true, status: 'none' }

    case 'sync': {
      if (!row) return { ok: true, status: 'none' }
      const fields = parseSettings_(req)
      if (!fields) return { ok: false, error: 'bad_request' }
      Object.assign(row, fields, { updatedAt: now.toISOString() })
      writeRow_(row)
      return { ok: true, status: row.status }
    }

    case 'subscribe': {
      const email = normaliseEmail_(req.email)
      const fields = parseSettings_(req)
      if (!email) return { ok: false, error: 'invalid_email' }
      if (!fields) return { ok: false, error: 'bad_request' }

      const target = row || {
        token: req.token,
        status: 'pending',
        code: '',
        unsubKey: randomKey_(),
        sent: '[]',
        lastSentDate: '',
        verifySentAt: '',
        createdAt: now.toISOString(),
      }
      Object.assign(target, fields, { updatedAt: now.toISOString() })

      // Same confirmed address: just save the new settings.
      if (row && row.status === 'active' && row.email === email) {
        writeRow_(target)
        return { ok: true, status: 'active' }
      }

      if (row && row.email !== email) target.status = 'pending'
      target.email = email
      const lastSent = target.verifySentAt ? new Date(target.verifySentAt).getTime() : 0
      const coolingDown = now.getTime() - lastSent < CONFIG.VERIFY_COOLDOWN_MINUTES * 60 * 1000
      if (!coolingDown) {
        if (!takeVerifySlot_(now)) return { ok: false, error: 'busy' }
        target.code = randomKey_()
        target.verifySentAt = now.toISOString()
        sendVerification_(target)
      }
      writeRow_(target)
      return { ok: true, status: 'pending' }
    }

    default:
      return { ok: false, error: 'bad_request' }
  }
}

function verify_(token, code) {
  const row = isToken_(token) ? readRows_().find((r) => r.token === token) : null
  if (!row || !code || row.code !== code) {
    return { title: 'Link expired', message: 'This confirmation link is no longer valid. Turn on email reminders again in the app to get a new one.' }
  }
  row.status = 'active'
  row.code = ''
  writeRow_(row)
  return { title: 'Email reminders are on', message: `You'll get an email at ${row.email} when a deadline is coming up. You can turn this off at any time.` }
}

function unsubscribeByKey_(token, key) {
  const row = isToken_(token) ? readRows_().find((r) => r.token === token) : null
  if (row && key && row.unsubKey === key) deleteRow_(row)
  // Same message either way, so the link can't be used to probe addresses.
  return { title: 'Unsubscribed', message: "You won't get any more reminder emails, and your email address and reminders have been deleted from the reminder service." }
}

// ---------------------------------------------------------------------------
// Hourly job

function sendDueReminders() {
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    runDailyDigest_(new Date())
  } finally {
    lock.releaseLock()
  }
}

function runDailyDigest_(now) {
  const rows = readRows_()
  // Delete from the bottom up so row numbers stay valid.
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]
    if (row.status === 'pending') {
      const age = now.getTime() - new Date(row.createdAt).getTime()
      if (age > CONFIG.PENDING_TTL_DAYS * 24 * 60 * 60 * 1000) deleteRow_(row)
      continue
    }
    if (row.status !== 'active') continue

    const today = Utilities.formatDate(now, row.timeZone, 'yyyy-MM-dd')
    const hour = Number(Utilities.formatDate(now, row.timeZone, 'H'))
    if (hour < CONFIG.SEND_HOUR || row.lastSentDate === today) continue

    const sent = new Set(parseJson_(row.sent, []))
    const due = dueItems_(parseJson_(row.reminders, []), today, Number(row.daysBefore), sent)
    if (due.length > 0) {
      if (MailApp.getRemainingDailyQuota() < 1) return // try again next hour
      sendDigest_(row, due, today)
      for (const item of due) sent.add(item.key)
    }
    // Forget keys for deadlines that have passed, so the list stays small.
    row.sent = JSON.stringify([...sent].filter((key) => key.split('|')[1] >= today))
    row.lastSentDate = today
    writeRow_(row)
  }
}

/**
 * Which reminders to include in today's email. Each reminder gets at most one
 * "coming up" email (once it's within `daysBefore` days, so reminders added
 * late still get one) and one "due today" email.
 */
function dueItems_(reminders, today, daysBefore, sent) {
  const due = []
  for (const r of reminders) {
    const days = daysBetween_(today, r.deadline)
    if (days === null || days < 0) continue
    let kind = null
    if (days === 0) kind = 'today'
    else if (daysBefore > 0 && days <= daysBefore) kind = 'soon'
    if (!kind) continue
    const key = `${r.id}|${r.deadline}|${kind}`
    if (!sent.has(key)) due.push({ key, kind, days, title: r.title, deadline: r.deadline })
  }
  return due.sort((a, b) => a.days - b.days || a.title.localeCompare(b.title))
}

function daysBetween_(from, to) {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from)
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to)
  if (!a || !b) return null
  const ms = (m) => Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Math.round((ms(b) - ms(a)) / 86400000)
}

// ---------------------------------------------------------------------------
// Emails

function sendVerification_(row) {
  const link = `${serviceUrl_()}?action=verify&token=${encodeURIComponent(row.token)}&code=${encodeURIComponent(row.code)}`
  MailApp.sendEmail({
    to: row.email,
    subject: `Confirm your ${CONFIG.APP_NAME} email reminders`,
    body:
      `Someone (hopefully you) asked ${CONFIG.APP_NAME} to email deadline reminders to this address.\n\n` +
      `Confirm here: ${link}\n\n` +
      `If this wasn't you, ignore this email. Nothing will be sent, and the request is deleted after ${CONFIG.PENDING_TTL_DAYS} days.`,
    htmlBody:
      `<p>Someone (hopefully you) asked ${escapeHtml_(CONFIG.APP_NAME)} to email deadline reminders to this address.</p>` +
      `<p><a href="${escapeHtml_(link)}">Confirm email reminders</a></p>` +
      `<p style="color:#666">If this wasn't you, ignore this email. Nothing will be sent, and the request is deleted after ${CONFIG.PENDING_TTL_DAYS} days.</p>`,
    name: CONFIG.APP_NAME,
  })
}

function sendDigest_(row, due, today) {
  const unsubscribe = `${serviceUrl_()}?action=unsubscribe&token=${encodeURIComponent(row.token)}&key=${encodeURIComponent(row.unsubKey)}`
  const todayCount = due.filter((d) => d.kind === 'today').length
  const subject =
    due.length === 1
      ? `${due[0].kind === 'today' ? 'Due today' : 'Coming up'}: ${due[0].title}`
      : todayCount > 0
        ? `${todayCount} due today, ${due.length - todayCount} coming up`
        : `${due.length} deadlines coming up`

  const when = (d) => (d.days === 0 ? 'Today' : d.days === 1 ? 'Tomorrow' : `In ${d.days} days`)
  const lines = due.map((d) => `• ${d.title}: ${when(d)} (${formatDate_(d.deadline, row.timeZone)})`)
  const footer = `You're getting this because you turned on email reminders in ${CONFIG.APP_NAME}.`

  MailApp.sendEmail({
    to: row.email,
    subject: subject,
    body: `${lines.join('\n')}\n\nOpen ${CONFIG.APP_NAME}: ${CONFIG.APP_URL}\n\n${footer}\nUnsubscribe: ${unsubscribe}`,
    htmlBody:
      `<ul>${due.map((d) => `<li><strong>${escapeHtml_(d.title)}</strong>: ${when(d)} (${escapeHtml_(formatDate_(d.deadline, row.timeZone))})</li>`).join('')}</ul>` +
      `<p><a href="${escapeHtml_(CONFIG.APP_URL)}">Open ${escapeHtml_(CONFIG.APP_NAME)}</a></p>` +
      `<p style="color:#666;font-size:12px">${escapeHtml_(footer)} <a href="${escapeHtml_(unsubscribe)}">Unsubscribe</a></p>`,
    name: CONFIG.APP_NAME,
  })
}

function formatDate_(deadline, timeZone) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadline)
  // Noon UTC keeps the calendar day stable in every time zone.
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12))
  return Utilities.formatDate(date, 'UTC', 'EEE d MMM yyyy')
}

// ---------------------------------------------------------------------------
// Validation

function isToken_(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(value)
}

function normaliseEmail_(value) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/.test(email)) return null
  return email
}

function isTimeZone_(value) {
  if (typeof value !== 'string' || value.length > 64) return false
  try {
    Utilities.formatDate(new Date(), value, 'yyyy')
    return true
  } catch (err) {
    return false
  }
}

/** Validates the settings and reminder list sent by the app. Returns null if invalid. */
function parseSettings_(req) {
  const daysBefore = Number(req.daysBefore)
  if (CONFIG.DAYS_BEFORE.indexOf(daysBefore) === -1) return null
  if (!isTimeZone_(req.timeZone)) return null
  if (!Array.isArray(req.reminders)) return null
  const reminders = []
  for (const r of req.reminders.slice(0, CONFIG.MAX_REMINDERS)) {
    if (!r || typeof r.id !== 'string' || typeof r.title !== 'string' || typeof r.deadline !== 'string') continue
    if (daysBetween_(r.deadline, r.deadline) === null) continue
    const title = r.title.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120)
    if (title && r.id.length <= 100) reminders.push({ id: r.id, title: title, deadline: r.deadline })
  }
  return { daysBefore: daysBefore, timeZone: req.timeZone, reminders: JSON.stringify(reminders) }
}

/** Global hourly cap on verification emails, so the endpoint can't be used to spam. */
function takeVerifySlot_(now) {
  const props = PropertiesService.getScriptProperties()
  const key = `verify:${now.toISOString().slice(0, 13)}`
  const count = Number(props.getProperty(key) || 0)
  if (count >= CONFIG.MAX_VERIFY_PER_HOUR) return false
  props.setProperty(key, String(count + 1))
  return true
}

// ---------------------------------------------------------------------------
// Sheet storage

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  let sheet = ss.getSheetByName(SHEET_NAME)
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME)
    sheet.appendRow(HEADERS)
    sheet.setFrozenRows(1)
  }
  return sheet
}

function readRows_() {
  const values = getSheet_().getDataRange().getValues()
  const rows = []
  for (let i = 1; i < values.length; i++) {
    const row = { _row: i + 1 }
    HEADERS.forEach((h, j) => (row[h] = values[i][j] === undefined ? '' : String(values[i][j])))
    if (row.token) rows.push(row)
  }
  return rows
}

function writeRow_(row) {
  const sheet = getSheet_()
  // A leading apostrophe stores the value as plain text, so Sheets doesn't turn
  // "2026-10-22" into a date or long tokens into numbers. It isn't read back.
  const values = [HEADERS.map((h) => (row[h] === undefined || row[h] === '' ? '' : `'${String(row[h])}`))]
  if (row._row) sheet.getRange(row._row, 1, 1, HEADERS.length).setValues(values)
  else {
    sheet.appendRow(values[0])
    row._row = sheet.getLastRow()
  }
}

function deleteRow_(row) {
  if (row._row) getSheet_().deleteRow(row._row)
}

// ---------------------------------------------------------------------------
// Helpers

function serviceUrl_() {
  return ScriptApp.getService().getUrl()
}

function randomKey_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '')
}

function parseJson_(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback
  } catch (err) {
    return fallback
  }
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)
}

function page_(content) {
  const html =
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeHtml_(content.title)}</title></head>` +
    `<body style="font-family:system-ui,sans-serif;max-width:520px;margin:48px auto;padding:0 16px;color:#1d2120;line-height:1.6">` +
    `<h1 style="font-size:1.5rem">${escapeHtml_(content.title)}</h1><p>${escapeHtml_(content.message)}</p>` +
    `<p><a href="${escapeHtml_(CONFIG.APP_URL)}" style="color:#0b5f58">Back to ${escapeHtml_(CONFIG.APP_NAME)}</a></p></body></html>`
  return HtmlService.createHtmlOutput(html).setTitle(content.title)
}
