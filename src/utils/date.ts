export const DEFAULT_TZ = 'Asia/Bangkok'

function parts(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const out: Record<string, string> = {}
  for (const p of fmt.formatToParts(d)) out[p.type] = p.value
  return out
}

/** YYYY-MM-DD in the given timezone. */
export function localDate(d: Date = new Date(), tz: string = DEFAULT_TZ): string {
  const p = parts(d, tz)
  return `${p.year}-${p.month}-${p.day}`
}

/** Minutes since local midnight in the timezone. */
export function minutesOfDay(d: Date = new Date(), tz: string = DEFAULT_TZ): number {
  const p = parts(d, tz)
  return Number(p.hour) * 60 + Number(p.minute)
}

export function hhmmToMin(t: string | null | undefined): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function minToHhmm(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Add days to a YYYY-MM-DD string (calendar arithmetic, tz-independent). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

export function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Monday of the week containing date. */
export function weekStart(date: string): string {
  const wd = weekday(date)
  return addDays(date, wd === 0 ? -6 : 1 - wd)
}

export function inQuietHours(nowMin: number, start: string, end: string): boolean {
  const s = hhmmToMin(start)
  const e = hhmmToMin(end)
  if (s === null || e === null || s === e) return false
  return s < e ? nowMin >= s && nowMin < e : nowMin >= s || nowMin < e
}

const TH_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

export function thaiShortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${TH_DAYS[weekday(date)]} ${d} ${TH_MONTHS[m - 1]}`
}

export function greeting(min: number): string {
  if (min < 11 * 60) return 'อรุณสวัสดิ์'
  if (min < 17 * 60) return 'สวัสดีตอนบ่าย'
  return 'สวัสดีตอนเย็น'
}
