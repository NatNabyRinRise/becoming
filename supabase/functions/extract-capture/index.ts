// BECOMING — extract-capture Edge Function (Supabase, Deno)
// Reads a photo/screenshot and returns suggested entries (tasks, journal, ideas,
// revenue, memories). The app shows them for the user to approve before saving.
//
// Secrets (set with `supabase secrets set ...`, never in the web app):
//   ANTHROPIC_API_KEY   required
//   CAPTURE_MODEL       optional, default claude-opus-5-5 (e.g. claude-haiku-5-5 is much cheaper)
//   CAPTURE_DAILY_LIMIT optional, default 20 images per user per day
// The image is not stored.

import Anthropic from 'npm:@anthropic-ai/sdk@1.14.0'
import { betaZodOutputFormat } from 'npm:@anthropic-ai/sdk@1.14.0/helpers/beta/zod'
import { createClient } from 'npm:@supabase/supabase-js@2.119.2'
import { z } from 'npm:zod@4.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const Item = z.object({
  type: z.enum(['task', 'journal', 'idea', 'revenue', 'memory']),
  text: z.string().describe('task title / journal content / idea / revenue source / memory sentence, in the language of the image (usually Thai)'),
  minutes: z.number().int().nullable().describe('task only: estimated minutes'),
  mission: z.enum(['influence', 'people', 'empire', 'freedom', 'life']).nullable().describe('task only'),
  date: z.string().nullable().describe('YYYY-MM-DD if the image states a date, else null'),
  amount: z.number().nullable().describe('revenue only: amount in THB'),
  subtype: z.string().nullable().describe('journal: reflection|insight|idea|gratitude|lesson; memory: fact|preference|goal|context'),
})
const Result = z.object({ summary: z.string(), items: z.array(Item) })

const SYSTEM = `You help a Thai founder and parent capture life data from images (screenshots of chats, notes, whiteboards, receipts, calendars, handwritten lists).
Extract only what is clearly in the image. Prefer fewer, accurate items over many guesses. Write item text in Thai unless the image text is in another language.
Missions: influence = personal brand/content, people = partners/team, empire = business/revenue, freedom = finance/time freedom, life = health/family/self.
Use "memory" only for durable facts about the user's life (people, goals, preferences), never for one-off tasks.
summary: one short Thai sentence describing the image.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  // the user's own session — RLS applies to every query below
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return json({ error: 'ต้องเข้าสู่ระบบก่อน' }, 401)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'ยังไม่ได้ตั้งค่า AI key บนเซิร์ฟเวอร์' }, 503)

  const limit = Number(Deno.env.get('CAPTURE_DAILY_LIMIT') ?? 20)
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await supabase.from('capture_log').select('id', { count: 'exact', head: true }).gte('created_at', since)
  if ((count ?? 0) >= limit) return json({ error: 'ใช้การอ่านภาพครบโควตาวันนี้แล้ว' }, 429)

  let body: { image?: string; mediaType?: string; today?: string; timezone?: string; note?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'ข้อมูลไม่ถูกต้อง' }, 400)
  }
  const mediaType = body.mediaType === 'image/png' ? 'image/png' : 'image/jpeg'
  if (!body.image || body.image.length > 7_000_000) return json({ error: 'ไม่มีภาพ หรือภาพใหญ่เกินไป' }, 400)

  const client = new Anthropic({ apiKey })
  try {
    const res = await client.beta.messages.parse({
      model: Deno.env.get('CAPTURE_MODEL') ?? 'claude-opus-5-5',
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(Result) },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: body.image } },
            { type: 'text', text: `Today is ${body.today ?? 'unknown'} (${body.timezone ?? 'Asia/Bangkok'}).${body.note ? `\nUser note: ${body.note}` : ''}\nExtract the entries.` },
          ],
        },
      ],
    })
    if (res.stop_reason === 'refusal') return json({ error: 'AI ไม่สามารถอ่านภาพนี้ได้' }, 422)
    const out = res.parsed_output
    if (!out) return json({ error: 'อ่านผลลัพธ์ไม่ได้ ลองใหม่อีกครั้ง' }, 502)

    const items = out.items.flatMap((i): Record<string, unknown>[] => {
      switch (i.type) {
        case 'task':
          return [{ type: 'task', title: i.text, estimatedMinutes: i.minutes ?? 30, missionId: i.mission ?? 'life', scheduledDate: i.date }]
        case 'journal':
          return [{ type: 'journal', content: i.text, journalType: ['reflection', 'insight', 'idea', 'gratitude', 'lesson'].includes(i.subtype ?? '') ? i.subtype : 'reflection' }]
        case 'idea':
          return [{ type: 'idea', text: i.text }]
        case 'revenue':
          return i.amount ? [{ type: 'revenue', amount: i.amount, source: i.text, date: i.date }] : []
        case 'memory':
          return [{ type: 'memory', content: i.text, kind: ['fact', 'preference', 'goal', 'context'].includes(i.subtype ?? '') ? i.subtype : 'fact' }]
      }
    })
    await supabase.from('capture_log').insert({ items: items.length })
    return json({ summary: out.summary, items })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'AI ไม่ว่างชั่วคราว ลองใหม่อีกครั้ง' }, 503)
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'AI key บนเซิร์ฟเวอร์ไม่ถูกต้อง' }, 503)
    if (e instanceof Anthropic.APIError) return json({ error: `AI error ${e.status}` }, 502)
    return json({ error: 'อ่านภาพไม่สำเร็จ' }, 500)
  }
})
