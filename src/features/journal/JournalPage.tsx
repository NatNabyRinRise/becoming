import { useMemo, useState } from 'react'
import { Plus, Search, Mic, Trash2 } from 'lucide-react'
import { PageHeader, Empty } from '../../components/ui/controls'
import { Sheet } from '../../components/ui/Sheet'
import { useStore } from '../../store/useStore'
import { MOODS } from '../morning-briefing/BriefingPage'
import { thaiShortDate } from '../../utils/date'
import type { JournalEntry, Mood } from '../../types'

const TYPES: { id: JournalEntry['type']; label: string }[] = [
  { id: 'reflection', label: 'สะท้อนคิด' },
  { id: 'insight', label: 'Business insight' },
  { id: 'idea', label: 'ไอเดีย' },
  { id: 'gratitude', label: 'ขอบคุณ' },
  { id: 'checkin', label: 'เช็กอินอารมณ์' },
  { id: 'lesson', label: 'บทเรียน' },
]

export function JournalPage() {
  const journal = useStore((s) => s.journal)
  const [q, setQ] = useState('')
  const [type, setType] = useState<JournalEntry['type'] | 'all'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [edit, setEdit] = useState<JournalEntry | 'new' | null>(null)

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return journal.filter(
      (j) =>
        (type === 'all' || j.type === type) &&
        (!from || j.localDate >= from) &&
        (!to || j.localDate <= to) &&
        (!qq || j.content.toLowerCase().includes(qq) || j.tags.some((t) => t.toLowerCase().includes(qq))),
    )
  }, [journal, q, type, from, to])

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Journal" title="บันทึกของฉัน" back right={<button className="btn btn-primary !px-4" onClick={() => setEdit('new')}><Plus size={16} /> เขียน</button>} />
      <div className="glass mb-4 space-y-3 rounded-[1.5rem] p-3">
        <label className="flex items-center gap-2">
          <Search size={16} className="text-soft" />
          <input className="w-full bg-transparent py-1 outline-none" placeholder="ค้นหาข้อความหรือแท็ก" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหา" />
        </label>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          <button className="chip !min-h-[32px] shrink-0 !py-1 text-xs" aria-pressed={type === 'all'} onClick={() => setType('all')}>ทั้งหมด</button>
          {TYPES.map((t) => <button key={t.id} className="chip !min-h-[32px] shrink-0 !py-1 text-xs" aria-pressed={type === t.id} onClick={() => setType(t.id)}>{t.label}</button>)}
        </div>
        <div className="flex items-center gap-2 text-xs text-soft">
          <input type="date" className="field !w-auto !px-2 !py-1.5 text-xs" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="จากวันที่" />–
          <input type="date" className="field !w-auto !px-2 !py-1.5 text-xs" value={to} onChange={(e) => setTo(e.target.value)} aria-label="ถึงวันที่" />
        </div>
      </div>

      {list.length === 0 ? <Empty>{journal.length ? 'ไม่พบบันทึกที่ตรงกัน' : 'ยังไม่มีบันทึก เขียนสั้น ๆ ก็พอ'}</Empty> : (
        <ul className="space-y-3">
          {list.map((j) => (
            <li key={j.id}>
              <button className="glass w-full rounded-[1.5rem] p-4 text-left" onClick={() => setEdit(j)}>
                <p className="text-[11px] text-soft">
                  {thaiShortDate(j.localDate)} · {TYPES.find((t) => t.id === j.type)?.label}
                  {j.mood && ` · ${MOODS.find((m) => m.id === j.mood)?.emoji}`}
                </p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap font-light leading-relaxed">{j.content}</p>
                {j.tags.length > 0 && <p className="mt-2 text-xs text-plum">{j.tags.map((t) => `#${t}`).join(' ')}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={edit !== null} onClose={() => setEdit(null)} title={edit === 'new' ? 'บันทึกใหม่' : 'แก้ไขบันทึก'}>
        {edit !== null && <JournalForm key={edit === 'new' ? 'n' : edit.id} initial={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      </Sheet>
    </div>
  )
}

type SpeechRec = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void }

function JournalForm({ initial, onClose }: { initial: JournalEntry | null; onClose: () => void }) {
  const s = useStore()
  const [content, setContent] = useState(initial?.content ?? '')
  const [type, setType] = useState<JournalEntry['type']>(initial?.type ?? 'reflection')
  const [mood, setMood] = useState<Mood | null>(initial?.mood ?? null)
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [listening, setListening] = useState(false)
  const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
  const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition
  const voiceOk = s.settings.voiceInput && !!SR

  const dictate = () => {
    if (!SR) return
    const rec = new SR()
    rec.lang = 'th-TH'
    rec.interimResults = false
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join(' ')
      setContent((c) => (c ? c + ' ' : '') + text)
    }
    rec.onend = () => setListening(false)
    setListening(true)
    rec.start()
  }

  const save = () => {
    if (!content.trim()) return
    const data = { content: content.trim(), type, mood, tags: tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean) }
    if (initial) s.updateJournal(initial.id, data)
    else s.addJournal(data)
    onClose()
  }

  return (
    <div className="space-y-3">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {TYPES.map((t) => <button key={t.id} className="chip !min-h-[32px] shrink-0 !py-1 text-xs" aria-pressed={type === t.id} onClick={() => setType(t.id)}>{t.label}</button>)}
      </div>
      <textarea className="field min-h-[160px] font-light leading-relaxed" placeholder="วันนี้คิดอะไรอยู่…" value={content} onChange={(e) => setContent(e.target.value)} aria-label="เนื้อหา" autoFocus />
      {voiceOk && (
        <button className="btn btn-soft" onClick={dictate} disabled={listening}><Mic size={16} /> {listening ? 'กำลังฟัง…' : 'พูดแทนพิมพ์'}</button>
      )}
      <div className="flex flex-wrap gap-1.5">
        {MOODS.map((m) => <button key={m.id} className="chip !min-h-[34px] !py-1 text-sm" aria-pressed={mood === m.id} onClick={() => setMood(mood === m.id ? null : m.id)}>{m.emoji}</button>)}
      </div>
      <input className="field" placeholder="แท็ก คั่นด้วย , เช่น ธุรกิจ, ลูก" value={tags} onChange={(e) => setTags(e.target.value)} aria-label="แท็ก" />
      <div className="flex gap-2">
        {initial && <button className="btn btn-ghost text-[#a0465a]" onClick={() => { if (confirm('ลบบันทึกนี้?')) { s.deleteJournal(initial.id); onClose() } }}><Trash2 size={16} /></button>}
        <button className="btn btn-primary flex-1" onClick={save}>บันทึก</button>
      </div>
    </div>
  )
}
