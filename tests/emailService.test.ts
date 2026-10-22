/**
 * Runs the real Google Apps Script code (email-service/Code.gs) in Node, with
 * small in-memory stand-ins for the Google services it uses.
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import vm from 'node:vm'
import { beforeEach, describe, expect, it } from 'vitest'

const CODE = readFileSync(new URL('../email-service/Code.gs', import.meta.url), 'utf8')
const SERVICE_URL = 'https://script.google.com/macros/s/test/exec'
const TOKEN = 'tok_abcdefghijklmnopqrstuvwxyz'

interface SentMail {
  to: string
  subject: string
  body: string
  htmlBody: string
}

function formatDate(date: Date, timeZone: string, pattern: string): string {
  const part = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone, ...opts }).format(date)
  switch (pattern) {
    case 'yyyy-MM-dd':
      return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
    case 'H':
      return String(Number(part({ hour: '2-digit', hourCycle: 'h23' })))
    case 'yyyy':
      return part({ year: 'numeric' })
    case 'EEE d MMM yyyy':
      return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date).replace(',', '')
    default:
      throw new Error(`Unsupported pattern ${pattern}`)
  }
}

function createService() {
  // Sheets turns a leading apostrophe into "store as text" and doesn't return it.
  const clean = (row: unknown[]) => row.map((v) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v))
  let table: unknown[][] | null = null
  const sheet = {
    appendRow: (row: unknown[]) => void table!.push(clean(row)),
    setFrozenRows: () => {},
    getLastRow: () => table!.length,
    getDataRange: () => ({ getValues: () => table!.map((r) => [...r]) }),
    getRange: (row: number) => ({ setValues: (values: unknown[][]) => void (table![row - 1] = clean(values[0]!)) }),
    deleteRow: (row: number) => void table!.splice(row - 1, 1),
  }
  const mail: SentMail[] = []
  const props = new Map<string, string>()
  const quota = { remaining: 100 }
  const sandbox = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: () => (table ? sheet : null),
        insertSheet: () => {
          table = []
          return sheet
        },
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    MailApp: {
      sendEmail: (m: SentMail) => {
        mail.push(m)
        quota.remaining--
      },
      getRemainingDailyQuota: () => quota.remaining,
    },
    Utilities: { formatDate, getUuid: () => randomUUID() },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props.get(k) ?? null,
        setProperty: (k: string, v: string) => void props.set(k, v),
      }),
    },
    ScriptApp: { getService: () => ({ getUrl: () => SERVICE_URL }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text: string) => ({ text, setMimeType() { return this } }),
    },
    HtmlService: { createHtmlOutput: (html: string) => ({ html, setTitle() { return this } }) },
  }
  const context = vm.createContext(sandbox)
  vm.runInContext(CODE, context)
  const api = vm.runInContext('({ doPost, doGet, runDailyDigest_, CONFIG, HEADERS })', context) as {
    doPost: (e: unknown) => { text: string }
    doGet: (e: unknown) => { html: string }
    runDailyDigest_: (now: Date) => void
    CONFIG: { MAX_VERIFY_PER_HOUR: number }
    HEADERS: string[]
  }

  const post = (body: Record<string, unknown>) =>
    JSON.parse(api.doPost({ postData: { contents: JSON.stringify(body) } }).text) as { ok: boolean; status?: string; error?: string }
  const rows = () => {
    const [, ...data] = table ?? [[]]
    return data.map((r) => Object.fromEntries(api.HEADERS.map((h, i) => [h, String(r[i] ?? '')])) as Record<string, string>)
  }
  const linkFrom = (text: string, action: string) => new URL(text.match(new RegExp(`${SERVICE_URL}\\?action=${action}[^\\s"<]+`))![0].replace(/&amp;/g, '&'))
  const openLink = (url: URL) => api.doGet({ parameter: Object.fromEntries(url.searchParams) }).html

  return { api, post, rows, mail, quota, linkFrom, openLink }
}

const reminders = [
  { id: 'r1', title: 'Return shoes', deadline: '2026-10-25' },
  { id: 'r2', title: 'Cancel <trial> & save', deadline: '2026-10-22' },
  { id: 'r3', title: 'Warranty', deadline: '2027-06-01' },
]

function subscribe(s: ReturnType<typeof createService>, overrides: Record<string, unknown> = {}) {
  return s.post({
    action: 'subscribe',
    token: TOKEN,
    email: 'Person@Example.com',
    daysBefore: 3,
    timeZone: 'America/Los_Angeles',
    reminders,
    ...overrides,
  })
}

/** 9am on 22 Oct 2026 in Los Angeles. */
const MORNING_LA = new Date('2026-10-22T16:00:00Z')

let s: ReturnType<typeof createService>
beforeEach(() => {
  s = createService()
})

describe('email service: sign-up', () => {
  it('stores a pending subscription and sends one confirmation email', () => {
    expect(subscribe(s)).toEqual({ ok: true, status: 'pending' })
    expect(s.rows()).toHaveLength(1)
    expect(s.rows()[0]!.email).toBe('person@example.com')
    expect(s.mail).toHaveLength(1)
    expect(s.mail[0]!.subject).toMatch(/Confirm/)
  })

  it('stores values as text so Sheets cannot turn them into dates', () => {
    subscribe(s)
    expect(s.rows()[0]!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(JSON.parse(s.rows()[0]!.reminders!)).toEqual(reminders)
  })

  it('activates the subscription from the confirmation link', () => {
    subscribe(s)
    const html = s.openLink(s.linkFrom(s.mail[0]!.body, 'verify'))
    expect(html).toMatch(/Email reminders are on/)
    expect(s.post({ action: 'status', token: TOKEN })).toEqual({ ok: true, status: 'active' })
  })

  it('rejects a wrong confirmation code', () => {
    subscribe(s)
    const link = s.linkFrom(s.mail[0]!.body, 'verify')
    link.searchParams.set('code', 'wrong')
    expect(s.openLink(link)).toMatch(/Link expired/)
    expect(s.post({ action: 'status', token: TOKEN }).status).toBe('pending')
  })

  it('does not resend the confirmation within the cooldown', () => {
    subscribe(s)
    subscribe(s)
    expect(s.mail).toHaveLength(1)
  })

  it('rejects invalid input', () => {
    expect(subscribe(s, { email: 'nope' })).toEqual({ ok: false, error: 'invalid_email' })
    expect(subscribe(s, { token: 'short' }).ok).toBe(false)
    expect(subscribe(s, { daysBefore: 2 }).ok).toBe(false)
    expect(subscribe(s, { timeZone: 'Mars/Olympus' }).ok).toBe(false)
    expect(s.post({ action: 'drop tables', token: TOKEN }).ok).toBe(false)
    expect(JSON.parse(s.api.doPost({ postData: { contents: '{oops' } }).text).ok).toBe(false)
    expect(s.mail).toHaveLength(0)
  })

  it('limits confirmation emails per hour so the endpoint cannot be used for spam', () => {
    const limit = s.api.CONFIG.MAX_VERIFY_PER_HOUR
    for (let i = 0; i < limit + 5; i++) {
      subscribe(s, { token: `tok_${String(i).padStart(24, '0')}`, email: `p${i}@example.com` })
    }
    expect(s.mail).toHaveLength(limit)
  })
})

describe('email service: daily digest', () => {
  function activate() {
    subscribe(s)
    s.openLink(s.linkFrom(s.mail[0]!.body, 'verify'))
    s.mail.length = 0
  }

  it('emails due-today and coming-up reminders once, after 8am local time', () => {
    activate()
    s.api.runDailyDigest_(new Date('2026-10-22T14:00:00Z')) // 7am in LA: too early
    expect(s.mail).toHaveLength(0)

    s.api.runDailyDigest_(MORNING_LA)
    expect(s.mail).toHaveLength(1)
    const [mail] = s.mail
    expect(mail!.to).toBe('person@example.com')
    expect(mail!.subject).toBe('1 due today, 1 coming up')
    expect(mail!.body).toMatch(/Cancel <trial> & save: Today/)
    expect(mail!.body).toMatch(/Return shoes: In 3 days/)
    expect(mail!.body).not.toMatch(/Warranty/)

    // Hourly runs later the same day send nothing more.
    s.api.runDailyDigest_(new Date('2026-10-22T20:00:00Z'))
    expect(s.mail).toHaveLength(1)
  })

  it('escapes reminder titles in the HTML email', () => {
    activate()
    s.api.runDailyDigest_(MORNING_LA)
    expect(s.mail[0]!.htmlBody).toContain('Cancel &lt;trial&gt; &amp; save')
    expect(s.mail[0]!.htmlBody).not.toContain('<trial>')
  })

  it('sends "coming up" once and "due today" once per reminder', () => {
    activate()
    s.api.runDailyDigest_(MORNING_LA) // 22 Oct: shoes in 3 days
    s.api.runDailyDigest_(new Date('2026-10-23T16:00:00Z')) // 23 Oct: shoes in 2 days, already sent
    s.api.runDailyDigest_(new Date('2026-10-24T16:00:00Z'))
    s.api.runDailyDigest_(new Date('2026-10-25T16:00:00Z')) // 25 Oct: shoes due today
    expect(s.mail.map((m) => m.subject)).toEqual(['1 due today, 1 coming up', 'Due today: Return shoes'])
  })

  it('uses each subscriber\'s own time zone for "today"', () => {
    activate()
    // 06:30 UTC on 25 Oct is still 24 Oct (23:30) in Los Angeles: shoes are due tomorrow, not today.
    s.api.runDailyDigest_(new Date('2026-10-25T06:30:00Z'))
    expect(s.mail).toHaveLength(1)
    expect(s.mail[0]!.body).toMatch(/Return shoes: Tomorrow/)
    expect(s.mail[0]!.body).not.toMatch(/Return shoes: Today/)
  })

  it('still sends a heads-up for a reminder added after its usual notice day', () => {
    activate()
    // Daily notice is 3 days before, but this one is added with only 2 days to go.
    s.post({
      action: 'sync',
      token: TOKEN,
      daysBefore: 3,
      timeZone: 'America/Los_Angeles',
      reminders: [{ id: 'late', title: 'Added late', deadline: '2026-10-24' }],
    })
    s.api.runDailyDigest_(MORNING_LA)
    expect(s.mail.map((m) => m.subject)).toEqual(['Coming up: Added late'])
  })

  it('follows reminder changes synced from the app', () => {
    activate()
    expect(s.post({ action: 'sync', token: TOKEN, daysBefore: 0, timeZone: 'America/Los_Angeles', reminders: [] })).toEqual({
      ok: true,
      status: 'active',
    })
    s.api.runDailyDigest_(MORNING_LA)
    expect(s.mail).toHaveLength(0)
  })

  it('does not email unconfirmed subscriptions and deletes them after a week', () => {
    subscribe(s)
    s.mail.length = 0
    s.api.runDailyDigest_(MORNING_LA)
    expect(s.mail).toHaveLength(0)
    s.api.runDailyDigest_(new Date('2026-11-05T16:00:00Z'))
    expect(s.rows()).toHaveLength(0)
  })

  it('waits for the next hour when the Gmail quota is used up', () => {
    activate()
    s.quota.remaining = 0
    s.api.runDailyDigest_(MORNING_LA)
    expect(s.mail).toHaveLength(0)
    s.quota.remaining = 10
    s.api.runDailyDigest_(new Date('2026-10-22T17:00:00Z'))
    expect(s.mail).toHaveLength(1)
  })
})

describe('email service: leaving', () => {
  it('deletes everything via the unsubscribe link in each email', () => {
    subscribe(s)
    s.openLink(s.linkFrom(s.mail[0]!.body, 'verify'))
    s.api.runDailyDigest_(MORNING_LA)
    const html = s.openLink(s.linkFrom(s.mail.at(-1)!.body, 'unsubscribe'))
    expect(html).toMatch(/Unsubscribed/)
    expect(s.rows()).toHaveLength(0)
    expect(s.post({ action: 'status', token: TOKEN }).status).toBe('none')
  })

  it('ignores unsubscribe links with the wrong key', () => {
    subscribe(s)
    s.openLink(new URL(`${SERVICE_URL}?action=unsubscribe&token=${TOKEN}&key=guess`))
    expect(s.rows()).toHaveLength(1)
  })

  it('deletes everything when turned off in the app', () => {
    subscribe(s)
    expect(s.post({ action: 'unsubscribe', token: TOKEN })).toEqual({ ok: true, status: 'none' })
    expect(s.rows()).toHaveLength(0)
  })
})
