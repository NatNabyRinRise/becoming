// BECOMING — notion-bridge Edge Function (Supabase, Deno)
//
// The bridge between BECOMING and the AI Company workspace in Notion.
//   action "load"      → reads the 4 business sources and returns a BusinessContext
//   action "writeback" → writes Eve's answers back to the original Notion records
//   action "push"      → one-way send of a project / idea from Eve's sandbox (Founder Mode)
//                         into Idea Inbox & Lab. Nothing is synced back.
//
// BECOMING never creates committed business tasks. The only records this function
// creates are pages in Idea Inbox & Lab (Stage "💭 Inbox"), for the AI Company to judge.
//
// Secrets (set with `supabase secrets set ...`, never in the web app):
//   NOTION_TOKEN            required — internal integration secret (ntn_...)
//   NOTION_ALLOWED_EMAILS   required — comma-separated BECOMING login emails allowed to use it
//   NOTION_COMPANY_TASKS_DB optional — defaults to the ids below
//   NOTION_IDEA_LAB_DB, NOTION_LIFE_OS_DB, NOTION_CEO_REVIEW_PAGE  optional

import { createClient } from 'npm:@supabase/supabase-js@2.119.2'

const DB = {
  companyTasks: Deno.env.get('NOTION_COMPANY_TASKS_DB') ?? 'cfa769ee2e234088841df9ae465e32a6',
  ideaLab: Deno.env.get('NOTION_IDEA_LAB_DB') ?? 'ec4d976e9fe045cd89556722f8e2b5a7',
  lifeOs: Deno.env.get('NOTION_LIFE_OS_DB') ?? '67056f5570784417ac6175729cfc76e3',
  ceoReview: Deno.env.get('NOTION_CEO_REVIEW_PAGE') ?? '3e00e9d909cc81d9bc26d4f5bebb88f6',
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

function publicKey(): string {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>
    return keys.default ?? Object.values(keys)[0] ?? ''
  } catch {
    return ''
  }
}

// ── Notion REST ──────────────────────────────────────────────────────────────

const TOKEN = Deno.env.get('NOTION_TOKEN') ?? ''
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

/** Notion allows about 3 requests/second per integration. Space every call out so we stay under it. */
let nextSlot = 0
async function slot() {
  const now = Date.now()
  const at = Math.max(now, nextSlot)
  nextSlot = at + 350
  if (at > now) await sleep(at - now)
}

class RateLimited extends Error {}

async function notion(path: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await slot()
    const r = await fetch(`https://api.notion.com/v1${path}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: init.body ? JSON.stringify(init.body) : undefined,
    })
    if (r.status === 429) {
      // Notion says how long to wait (seconds); back everyone off, not just this call
      const wait = Math.min(10, Number(r.headers.get('Retry-After')) || attempt + 1) * 1000
      nextSlot = Math.max(nextSlot, Date.now() + wait)
      await r.body?.cancel()
      continue
    }
    const data = await r.json()
    if (!r.ok) throw new Error(`Notion ${r.status}: ${data?.message ?? 'error'}`)
    return data
  }
  throw new RateLimited('Notion rate limit')
}

async function queryAll(db: string, filter?: unknown): Promise<any[]> {
  const out: any[] = []
  let cursor: string | undefined
  do {
    const r = await notion(`/databases/${db}/query`, { method: 'POST', body: { page_size: 100, ...(filter ? { filter } : {}), ...(cursor ? { start_cursor: cursor } : {}) } })
    out.push(...r.results)
    cursor = r.has_more ? r.next_cursor : undefined
  } while (cursor && out.length < 500)
  return out
}

const text = (rt: any[] | undefined) => (rt ?? []).map((t) => t.plain_text).join('')
function prop(page: any, name: string): any {
  const p = page.properties?.[name]
  if (!p) return null
  switch (p.type) {
    case 'title': return text(p.title)
    case 'rich_text': return text(p.rich_text)
    case 'select': return p.select?.name ?? null
    case 'status': return p.status?.name ?? null
    case 'multi_select': return (p.multi_select ?? []).map((o: any) => o.name)
    case 'checkbox': return !!p.checkbox
    case 'number': return p.number
    case 'date': return p.date?.start?.slice(0, 10) ?? null
    case 'relation': return (p.relation ?? []).map((r: any) => r.id)
    case 'last_edited_time': return p.last_edited_time
    case 'created_time': return p.created_time
    default: return null
  }
}

interface Line { type: string; text: string; checked?: boolean }
async function pageLines(id: string, limit = 120): Promise<Line[]> {
  const r = await notion(`/blocks/${id}/children?page_size=100`)
  const lines: Line[] = []
  for (const b of r.results as any[]) {
    const body = b[b.type]
    const t = text(body?.rich_text)
    if (t.trim()) lines.push({ type: b.type, text: t.trim(), checked: b.type === 'to_do' ? !!body.checked : undefined })
    if (lines.length >= limit) break
  }
  return lines
}

/** Run promises a few at a time (Notion allows ~3 req/s). */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++
      out[k] = await fn(items[k])
    }
  }))
  return out
}

// ── Mapping (Notion → BECOMING model) ────────────────────────────────────────

const ref = (source: string, page: any) => ({ source, externalId: page.id, url: page.url ?? null, updatedAt: page.last_edited_time ?? null })

function workMode(page: any): 'action' | 'review' | 'decision' {
  const wm = prop(page, 'Work Mode')
  if (wm === 'Decision') return 'decision'
  if (wm === 'Review') return 'review'
  if (wm === 'Action') return 'action'
  const tt = prop(page, 'Task Type')
  if (tt === 'Decision') return 'decision'
  if (tt === 'Review' || tt === 'Research') return 'review'
  if (tt === 'Execution' || tt === 'Admin') return 'action'
  const title = String(prop(page, 'ชื่องาน') ?? '')
  if (/gate|go\s*\/\s*no-?go|approval|decision|ตัดสินใจ|อนุมัติ/i.test(title)) return 'decision'
  if (/review|ตรวจ/i.test(title)) return 'review'
  return 'action'
}

const PRIORITY: Record<string, string> = { 'P0 Critical': 'p1', 'P1 High': 'p1', 'P2 Normal': 'p2', 'P3 Low': 'p3' }
const STATUS: Record<string, string> = { 'เรียบร้อย': 'done', 'จัดเก็บถาวรแล้ว': 'cancelled', 'กำลังดำเนินการ': 'in_progress' }

function parseOptions(lines: Line[]) {
  const opts: { id: string; label: string; summary: string; pros: string[]; cons: string[] }[] = []
  for (const l of lines) {
    const m = l.text.match(/^(?:option|ตัวเลือก|ทางเลือก)\s*([A-Za-z0-9ก-ฮ]+)\s*[:：\-—.)]\s*(.+)$/i)
    if (m) opts.push({ id: m[1].toLowerCase(), label: m[2].split(/[—–:]/)[0].trim(), summary: m[2].trim(), pros: [], cons: [] })
  }
  if (opts.length >= 2) return opts
  return [
    { id: 'go', label: 'อนุมัติ / Go', summary: 'ให้ทีมเดินต่อตามที่เสนอ', pros: ['งานเดินต่อได้ทันที'], cons: [] },
    { id: 'revise', label: 'ขอแก้ก่อน', summary: 'ส่งกลับให้ทีมปรับตาม Decision Note', pros: ['ได้งานที่ตรงขึ้น'], cons: ['ช้าลง'] },
    { id: 'no-go', label: 'ยังไม่ไป / No-Go', summary: 'หยุดหรือเลื่อนเรื่องนี้', pros: ['ประหยัดเวลา'], cons: ['งานที่ทำมาหยุดรอ'] },
  ]
}

async function loadCompanyTasks() {
  const pages = await queryAll(DB.companyTasks, { property: 'Ready for BECOMING', checkbox: { equals: true } })
  // project names
  const projIds = [...new Set(pages.flatMap((p) => prop(p, 'Project') ?? []))].slice(0, 20)
  const projNames = new Map<string, string>()
  await pool(projIds, 3, async (id: string) => {
    try {
      const pg = await notion(`/pages/${id}`)
      const t = Object.values(pg.properties ?? {}).find((v: any) => v.type === 'title') as any
      projNames.set(id, text(t?.title) || 'AI Company')
    } catch { /* not shared with the integration */ }
  })
  const open = pages.filter((p) => !['เรียบร้อย', 'จัดเก็บถาวรแล้ว'].includes(prop(p, 'สถานะ')))
  const bodies = new Map<string, Line[]>()
  await pool(open.slice(0, 40), 3, async (p) => {
    try { bodies.set(p.id, await pageLines(p.id)) } catch { bodies.set(p.id, []) }
  })
  return pages.map((p) => {
    const mode = workMode(p)
    const title = String(prop(p, 'ชื่องาน') ?? 'ไม่มีชื่อ')
    const est = Number(prop(p, 'Estimate (min)') ?? 30) || 30
    const lines = bodies.get(p.id) ?? []
    const paras = lines.filter((l) => l.type === 'paragraph').map((l) => l.text)
    const bullets = lines.filter((l) => /list_item|to_do|heading/.test(l.type)).map((l) => l.text)
    const summary = paras[0] ?? prop(p, 'CEO Feedback / Decision') ?? ''
    const requestedBy = prop(p, 'Agent Role') ?? (prop(p, 'Executor') === 'Eve' ? 'Eve' : 'AI Company')
    const base: Record<string, unknown> = {
      ref: ref('company_tasks', p),
      mode,
      title,
      project: (prop(p, 'Project') ?? []).map((id: string) => projNames.get(id)).find(Boolean) ?? 'AI Company',
      summary: summary.slice(0, 300),
      priority: PRIORITY[prop(p, 'Priority')] ?? 'p2',
      status: STATUS[prop(p, 'สถานะ')] ?? 'ready',
      readyForBecoming: !!prop(p, 'Ready for BECOMING'),
      estimatedMinutes: est,
      effort: est >= 90 ? 'high' : est >= 30 ? 'medium' : 'low',
      dueDate: prop(p, 'กำหนดส่ง'),
      tags: /brand|marketing|content|แบรนด์/i.test(title + requestedBy) ? ['brand'] : [],
      requestedBy,
    }
    if (mode === 'action') base.steps = lines.filter((l) => l.type === 'to_do' && !l.checked).map((l) => l.text).slice(0, 6)
    if (mode === 'review') {
      base.output = {
        agent: requestedBy,
        title,
        summary: summary.slice(0, 300) || 'เปิดดูงานต้นฉบับใน Notion',
        original: lines.map((l) => (l.type.includes('list') || l.type === 'to_do' ? `• ${l.text}` : l.text)).join('\n').slice(0, 4000),
        highlights: bullets.slice(0, 3),
        createdAt: p.last_edited_time ?? null,
      }
    }
    if (mode === 'decision') {
      base.decision = {
        question: lines.find((l) => /\?|？|ไหม|หรือไม่/.test(l.text))?.text ?? `ตัดสินใจเรื่อง "${title}"`,
        context: summary.slice(0, 400),
        options: parseOptions(lines),
        agentRecommendation: null,
        affectsCapacity: est >= 60,
        next: 'ทีม AI Company จะเดินงานต่อตามคำตัดสินใน "CEO Feedback / Decision"',
      }
    }
    return base
  })
}

const STAGE: Record<string, string> = {
  '💭 Inbox': 'capture', '🔎 Expand': 'expand', '🧪 Validate': 'validate', '⭐ Promising': 'validate',
  '🚀 Committed': 'committed', '🅿️ Parked': 'parked', '🗑️ Dropped': 'killed',
}
async function loadIdeas() {
  const pages = await queryAll(DB.ideaLab)
  return pages.map((p) => ({
    ref: ref('idea_lab', p),
    title: String(prop(p, 'Idea') || prop(p, 'One-line Idea') || 'ไอเดีย'),
    note: [prop(p, 'One-line Idea'), prop(p, 'Problem'), prop(p, 'Next Test')].filter(Boolean).join(' · ').slice(0, 300),
    stage: STAGE[prop(p, 'Stage')] ?? 'capture',
    tags: ((prop(p, 'Theme') ?? []) as string[]).map((t) => (t === 'Content' ? 'creative' : t.toLowerCase())),
    capturedAt: prop(p, 'Created'),
  }))
}

const AREA_KIND: Record<string, string> = { Health: 'habit', Home: 'family', Personal: 'routine', Learning: 'habit', Business: 'commitment' }
async function loadLife(today: string) {
  const pages = await queryAll(DB.lifeOs, { property: 'Active', checkbox: { equals: true } })
  const daysSince = (d: string | null) => (d ? Math.round((Date.parse(today) - Date.parse(d)) / 86_400_000) : 999)
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay()
  const items = pages
    .filter((p) => {
      const f = prop(p, 'Frequency')
      const since = daysSince(prop(p, 'Last Reviewed'))
      if (f === 'Weekdays') return dow >= 1 && dow <= 5
      if (f === 'Weekly') return since >= 7
      if (f === 'Monthly') return since >= 28
      return true
    })
    .map((p) => {
      const min = String(prop(p, 'Minimum Standard') ?? '')
      const m = min.match(/(\d+)\s*(นาที|min)/i)
      return {
        ref: ref('life_os', p),
        kind: AREA_KIND[prop(p, 'Area')] ?? 'routine',
        title: String(prop(p, 'Practice') ?? ''),
        minutes: m ? Number(m[1]) : 10,
        time: null,
        essential: false,
        streak: 0,
        note: [min && `ขั้นต่ำ: ${min}`, prop(p, 'Why it matters')].filter(Boolean).join(' · '),
      }
    })
  return { items, constraints: [], defaultFocusMinutes: 60 }
}

async function loadCeoReview(today: string, tasks: any[]) {
  let lines: Line[] = []
  let page: any = null
  try {
    page = await notion(`/pages/${DB.ceoReview}`)
    lines = await pageLines(DB.ceoReview, 200)
  } catch { /* not shared */ }
  const after = (label: RegExp) => {
    const l = lines.find((x) => label.test(x.text))
    const v = l?.text.split(/[:：]/).slice(1).join(':').trim()
    return v ? [v] : []
  }
  const big3 = lines.filter((l) => l.type === 'to_do' && !/^Outcome #\d$/i.test(l.text)).map((l) => l.text)
  const recent = (d: string | null) => d && Date.parse(today) - Date.parse(d.slice(0, 10)) <= 7 * 86_400_000
  const moved = tasks.filter((t) => t.status === 'done' && recent(t.ref.updatedAt)).map((t) => t.title)
  const stalled = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled' && t.dueDate && t.dueDate < today).map((t) => `${t.title} (เลยกำหนด ${t.dueDate})`)
  const oneThing = after(/ONE THING/i)
  const monday = new Date(`${today}T00:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return {
    ref: { source: 'ceo_review', externalId: page?.id ?? DB.ceoReview, url: page?.url ?? null, updatedAt: page?.last_edited_time ?? null },
    weekStart: monday.toISOString().slice(0, 10),
    moved,
    stalled: stalled.slice(0, 6),
    needsDecision: tasks.filter((t) => t.mode === 'decision' && t.status !== 'done').map((t) => t.title).slice(0, 5),
    stop: after(/สิ่งที่จะหยุด/),
    continue: after(/สิ่งที่ทำต่อ/),
    priorities: [...oneThing, ...big3].slice(0, 3),
    strategicQuestion: oneThing.length ? null : "This week's ONE THING คืออะไร?",
    capacityNote: after(/Evidence I want/i)[0] ?? 'ยังไม่ได้บันทึก Capacity ของสัปดาห์นี้ใน Weekly CEO Review',
  }
}

// ── Write-back (BECOMING → Notion) ───────────────────────────────────────────

const rt = (s: string) => [{ type: 'text', text: { content: s.slice(0, 1900) } }]

async function appendFeedback(pageId: string, line: string) {
  const pg = await notion(`/pages/${pageId}`)
  const cur = prop(pg, 'CEO Feedback / Decision') ?? ''
  return (cur ? `${cur}\n${line}` : line).slice(-1900)
}

async function writeOne(e: any): Promise<void> {
  const p = e.payload
  const id = e.target?.externalId as string | undefined
  const tag = `[BECOMING ${e.localDate}]`
  if (p.kind === 'suggestion') {
    await notion('/pages', {
      method: 'POST',
      body: {
        parent: { database_id: DB.ideaLab },
        properties: {
          Idea: { title: rt(`[Suggestion] ${p.suggestion.title}`) },
          'One-line Idea': { rich_text: rt(p.suggestion.rationale || 'เสนอจาก BECOMING') },
          Stage: { select: { name: '💭 Inbox' } },
          Decision: { select: { name: 'Not reviewed' } },
        },
      },
    })
    return
  }
  if (!id || !/^[0-9a-f-]{32,36}$/i.test(id)) throw new Error('ไม่ใช่ระเบียนใน Notion')
  if (p.kind === 'action') {
    const label = { done: 'ทำเสร็จ', deferred: 'เลื่อน', blocked: 'ติดปัญหา' }[p.outcome as string]
    const fb = await appendFeedback(id, `${tag} ${label}${p.note ? `: ${p.note}` : ''}`)
    const props: any = { 'CEO Feedback / Decision': { rich_text: rt(fb) } }
    if (p.outcome === 'done') props['สถานะ'] = { status: { name: 'เรียบร้อย' } }
    if (p.outcome !== 'deferred') props['Ready for BECOMING'] = { checkbox: false }
    await notion(`/pages/${id}`, { method: 'PATCH', body: { properties: props } })
  } else if (p.kind === 'review') {
    const label = { approved: 'Approved', revise: 'Revise', rejected: 'Rejected' }[p.outcome as string]
    const fb = await appendFeedback(id, `${tag} Review ${label}${p.feedback ? `: ${p.feedback}` : ''}`)
    await notion(`/pages/${id}`, { method: 'PATCH', body: { properties: { 'CEO Feedback / Decision': { rich_text: rt(fb) }, 'Ready for BECOMING': { checkbox: false } } } })
  } else if (p.kind === 'decision') {
    const fb = await appendFeedback(id, `${tag} Decision (${p.decidedOn}): ${p.optionLabel}${p.note ? ` — ${p.note}` : ''}`)
    await notion(`/pages/${id}`, { method: 'PATCH', body: { properties: { 'CEO Feedback / Decision': { rich_text: rt(fb) }, 'Ready for BECOMING': { checkbox: false } } } })
  } else if (p.kind === 'idea') {
    // Commit stays with the AI Company: "commit" only records the CEO's Go.
    const props: any =
      p.outcome === 'commit' ? { Decision: { select: { name: 'Go' } } }
      : p.outcome === 'park' ? { Stage: { select: { name: '🅿️ Parked' } }, Decision: { select: { name: 'Park' } } }
      : p.outcome === 'kill' ? { Stage: { select: { name: '🗑️ Dropped' } }, Decision: { select: { name: 'No-Go' } } }
      : p.outcome === 'validate' ? { Stage: { select: { name: '🧪 Validate' } }, Decision: { select: { name: 'Test next' } } }
      : { Stage: { select: { name: '🔎 Expand' } } }
    await notion(`/pages/${id}`, { method: 'PATCH', body: { properties: props } })
  } else if (p.kind === 'life') {
    if (p.outcome === 'skipped') return
    await notion(`/pages/${id}`, { method: 'PATCH', body: { properties: { 'Last Reviewed': { date: { start: e.localDate } } } } })
  }
}

// ── Push (sandbox → Notion, one way) ─────────────────────────────────────────

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

async function pushOne(it: any): Promise<{ url: string | null }> {
  const title = str(it?.title, 200)
  if (!title) throw new Error('ต้องมีชื่อ')
  const kind = it?.kind === 'project' ? 'Project' : 'Idea'
  const description = str(it?.description, 1900)
  const milestones: { title: string; done: boolean }[] = (Array.isArray(it?.milestones) ? it.milestones : [])
    .map((m: any) => ({ title: str(m?.title, 1900), done: m?.done === true }))
    .filter((m: { title: string }) => m.title)
    .slice(0, 40)
  const micro: string[] = (Array.isArray(it?.microTasks) ? it.microTasks : []).map((m: unknown) => str(m, 1900)).filter(Boolean).slice(0, 40)
  const children: any[] = []
  if (description) children.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: rt(description) } })
  if (milestones.length) {
    children.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: rt('Milestones') } })
    for (const m of milestones) children.push({ object: 'block', type: 'to_do', to_do: { rich_text: rt(m.title), checked: m.done } })
  }
  if (micro.length) {
    children.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: rt('Micro Tasks') } })
    for (const m of micro) children.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(m) } })
  }
  children.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: rt('ส่งจากพื้นที่ทดข้อมูลใน BECOMING (ทางเดียว ไม่ sync กลับ)') } })
  const pg = await notion('/pages', {
    method: 'POST',
    body: {
      parent: { database_id: DB.ideaLab },
      properties: {
        Idea: { title: rt(`[${kind}] ${title}`) },
        'One-line Idea': { rich_text: rt(description.split('\n')[0] || `${kind} จาก BECOMING`) },
        Stage: { select: { name: '💭 Inbox' } },
        Decision: { select: { name: 'Not reviewed' } },
      },
      children: children.slice(0, 100),
    },
  })
  return { url: pg?.url ?? null }
}

// ── Handler ──────────────────────────────────────────────────────────────────

const LOAD_TTL_MS = 60_000
const loadCache = new Map<string, { at: number; data: unknown }>()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (!TOKEN) return json({ error: 'not_configured' }, 503)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, publicKey(), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return json({ error: 'ต้องเข้าสู่ระบบก่อน' }, 401)
  const allowed = (Deno.env.get('NOTION_ALLOWED_EMAILS') ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  if (!allowed.includes((auth.user.email ?? '').toLowerCase())) return json({ error: 'บัญชีนี้ไม่ได้รับสิทธิ์อ่าน AI Company' }, 403)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad json' }, 400)
  }
  try {
    if (body.action === 'load') {
      const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10)
      // Several devices / reloads within a minute share one read of Notion.
      const hit = loadCache.get(today)
      if (hit && Date.now() - hit.at < LOAD_TTL_MS) return json(hit.data)
      const [companyTasks, ideas, life] = await Promise.all([loadCompanyTasks(), loadIdeas(), loadLife(today)])
      const ceoReview = await loadCeoReview(today, companyTasks)
      const data = { companyTasks, ideas, life, ceoReview, loadedAt: new Date().toISOString(), adapter: 'notion' }
      loadCache.clear()
      loadCache.set(today, { at: Date.now(), data })
      return json(data)
    }
    if (body.action === 'writeback') {
      loadCache.clear()
      const events = Array.isArray(body.events) ? body.events.slice(0, 50) : []
      const sent: string[] = []
      const failed: { id: string; error: string }[] = []
      for (const e of events) {
        try {
          await writeOne(e)
          sent.push(e.id)
        } catch (err) {
          failed.push({ id: e.id, error: err instanceof Error ? err.message : String(err) })
        }
      }
      return json({ sent, failed })
    }
    if (body.action === 'push') {
      loadCache.clear()
      return json(await pushOne(body.item))
    }
    return json({ error: 'unknown action' }, 400)
  } catch (err) {
    if (err instanceof RateLimited) return json({ error: 'rate_limited' }, 429)
    return json({ error: err instanceof Error ? err.message : String(err) }, 502)
  }
})
