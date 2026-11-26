import { getSupabase } from './supabase'

/** One item the AI found in a captured image. Nothing is saved until the user approves it. */
export type CaptureItem =
  | { type: 'task'; title: string; estimatedMinutes: number; missionId: 'influence' | 'people' | 'empire' | 'freedom' | 'life'; scheduledDate: string | null }
  | { type: 'journal'; content: string; journalType: 'reflection' | 'insight' | 'idea' | 'gratitude' | 'lesson' }
  | { type: 'idea'; text: string }
  | { type: 'revenue'; amount: number; source: string; date: string | null }
  | { type: 'memory'; content: string; kind: 'fact' | 'preference' | 'goal' | 'context' }

export interface CaptureResult {
  summary: string
  items: CaptureItem[]
}

/** Shrinks a photo/screenshot before upload (smaller = faster and cheaper). */
export async function prepareImage(file: File, maxSide = 1600): Promise<{ base64: string; mediaType: 'image/jpeg' | 'image/png' }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' }
}

/**
 * Sends the image to the `extract-capture` Supabase Edge Function.
 * The AI key lives only on the server (Supabase secret), never in this app.
 * The image is not stored anywhere.
 */
export async function extractFromImage(file: File, ctx: { today: string; timezone: string; note?: string }): Promise<CaptureResult> {
  const sb = getSupabase()
  if (!sb) throw new Error('ต้องตั้งค่า Supabase และเข้าสู่ระบบก่อน')
  const { data: s } = await sb.auth.getSession()
  if (!s.session) throw new Error('ต้องเข้าสู่ระบบก่อนใช้การอ่านภาพ')
  const img = await prepareImage(file)
  const { data, error } = await sb.functions.invoke<CaptureResult & { error?: string }>('extract-capture', {
    body: { image: img.base64, mediaType: img.mediaType, today: ctx.today, timezone: ctx.timezone, note: ctx.note ?? '' },
  })
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status
    if (status === 404) throw new Error('ยังไม่ได้เปิดใช้การอ่านภาพ (ต้อง deploy Edge Function "extract-capture" ก่อน)')
    if (status === 429) throw new Error('ใช้การอ่านภาพครบโควตาวันนี้แล้ว')
    let detail = ''
    try {
      detail = (await (error as { context?: Response }).context?.json())?.error ?? ''
    } catch {
      /* ignore */
    }
    throw new Error(detail || 'อ่านภาพไม่สำเร็จ ลองใหม่อีกครั้ง')
  }
  if (!data || data.error) throw new Error(data?.error ?? 'อ่านภาพไม่สำเร็จ')
  return { summary: data.summary ?? '', items: Array.isArray(data.items) ? data.items : [] }
}
