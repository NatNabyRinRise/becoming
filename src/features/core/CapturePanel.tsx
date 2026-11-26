import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Check } from 'lucide-react'
import { Card, Empty } from '../../components/ui/controls'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { useCore } from '../../intelligence/useCore'
import { useAuth } from '../../sync/useAuth'
import { extractFromImage, type CaptureItem, type CaptureResult } from '../../sync/capture'

const TYPE_TH: Record<CaptureItem['type'], string> = { task: 'งาน', journal: 'Journal', idea: 'ไอเดีย', revenue: 'รายได้', memory: 'ความจำ' }

const label = (i: CaptureItem) =>
  i.type === 'task' ? `${i.title} · ${i.estimatedMinutes} นาที${i.scheduledDate ? ` · ${i.scheduledDate}` : ''}`
  : i.type === 'journal' ? i.content
  : i.type === 'idea' ? i.text
  : i.type === 'revenue' ? `${i.amount.toLocaleString('th-TH')} บาท · ${i.source}`
  : i.content

/** Read data from a photo/screenshot. Nothing is saved until the user ticks and confirms (Human Approval). */
export function CapturePanel() {
  const auth = useAuth((a) => a.status)
  const s = useStore()
  const core = useCore()
  const toast = useUI((u) => u.showToast)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<CaptureResult | null>(null)
  const [picked, setPicked] = useState<boolean[]>([])

  if (auth !== 'signedIn') {
    return <Card><Empty>การอ่านข้อมูลจากภาพต้อง <Link className="underline" to="/account">เข้าสู่ระบบ</Link> ก่อน เพราะภาพจะถูกส่งไปให้ AI อ่านผ่านเซิร์ฟเวอร์ของเธอ</Empty></Card>
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setErr(null)
    setResult(null)
    setPreview(URL.createObjectURL(f))
    setBusy(true)
    try {
      const r = await extractFromImage(f, { today: s.today(), timezone: s.settings.timezone, note })
      setResult(r)
      setPicked(r.items.map(() => true))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'อ่านภาพไม่สำเร็จ')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const apply = () => {
    if (!result) return
    const chosen = result.items.filter((_, i) => picked[i])
    for (const it of chosen) {
      if (it.type === 'task') s.addTask({ title: it.title, missionId: it.missionId, estimatedMinutes: Math.max(5, it.estimatedMinutes), scheduledDate: it.scheduledDate })
      else if (it.type === 'journal') s.addJournal({ content: it.content, type: it.journalType, tags: ['จากภาพ'] })
      else if (it.type === 'idea') s.addIdea(it.text)
      else if (it.type === 'revenue') s.addRevenue({ localDate: it.date ?? s.today(), amount: it.amount, source: it.source, recurring: false })
      else if (it.type === 'memory') core.addMemory({ content: it.content, kind: it.kind, source: 'capture', status: 'active' })
    }
    core.logEvent('capture.imported', { items: chosen.length })
    toast(`เพิ่ม ${chosen.length} รายการแล้ว`)
    setResult(null)
    setPreview(null)
    setNote('')
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <p className="text-sm text-soft">ถ่ายรูปหรือเลือกภาพหน้าจอ เช่น โน้ต แชต ใบเสร็จ ตาราง ทีมจะอ่านแล้วเสนอเป็นงาน บันทึก ไอเดีย รายได้ หรือความจำ ให้เธอเลือกก่อนบันทึก ภาพไม่ถูกเก็บไว้</p>
        <input className="field" placeholder="บอกทีมเพิ่มเติม (ไม่บังคับ) เช่น นี่คือ to-do พรุ่งนี้" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn-primary w-full" disabled={busy} onClick={() => input.current?.click()}><Camera size={16} /> {busy ? 'กำลังอ่านภาพ…' : 'เลือกภาพ / ถ่ายรูป'}</button>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="เลือกภาพ" />
        {preview && <img src={preview} alt="ภาพที่เลือก" className="max-h-56 w-full rounded-2xl object-contain" />}
        {err && <p className="rounded-2xl bg-[#f6d6d6]/70 p-3 text-sm">{err}</p>}
      </Card>
      {result && (
        <Card className="space-y-2">
          <p className="text-sm text-soft">{result.summary}</p>
          {result.items.length === 0 ? <Empty>ไม่พบข้อมูลที่บันทึกได้ในภาพนี้</Empty> : (
            <ul className="space-y-1.5">
              {result.items.map((it, i) => (
                <li key={i}>
                  <label className="flex items-start gap-2 rounded-2xl bg-white/40 p-2.5 text-sm">
                    <input type="checkbox" className="mt-1" checked={picked[i] ?? false} onChange={(e) => setPicked(picked.map((v, j) => (j === i ? e.target.checked : v)))} />
                    <span><span className="text-[11px] text-soft">{TYPE_TH[it.type]}</span><br />{label(it)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {result.items.length > 0 && <button className="btn btn-primary w-full" disabled={!picked.some(Boolean)} onClick={apply}><Check size={16} /> บันทึกที่เลือก ({picked.filter(Boolean).length})</button>}
        </Card>
      )}
    </div>
  )
}
