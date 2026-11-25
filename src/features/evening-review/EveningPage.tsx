import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { PageHeader } from '../../components/ui/controls'
import { Avatar } from '../../components/companions/Avatar'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { useToday } from '../../hooks/useToday'
import { MOODS } from '../morning-briefing/BriefingPage'
import type { Mood } from '../../types'

/** Rule-based J summary for the evening debrief. */
export function debriefSummary(achievements: string[], mood: Mood, oneThingDone: boolean, tomorrow: string | null): string {
  const a = achievements.length
  const first = oneThingDone
    ? 'วันนี้ One Thing สำเร็จแล้ว นี่คือก้าวที่มีความหมาย'
    : a > 0
      ? `วันนี้มี ${a} อย่างที่ขยับไปข้างหน้า แม้ไม่ครบแผนก็นับว่าดี`
      : 'บางวันแค่ผ่านไปได้ก็พอแล้ว พรุ่งนี้เริ่มใหม่ได้เสมอ'
  const second = mood === 'tired' || mood === 'low' ? 'คืนนี้พักให้เต็มที่ก่อนนะ' : tomorrow ? `พรุ่งนี้เริ่มที่ "${tomorrow}"` : 'พรุ่งนี้ค่อยเลือก One Thing ตอนเช้า'
  return `${first} ${second}`
}

export function EveningPage() {
  const s = useStore()
  const { date, oneThing } = useToday()
  const nav = useNavigate()
  const toast = useUI((u) => u.showToast)
  const existing = s.reviews[date]
  const [step, setStep] = useState(0)
  const doneToday = useMemo(
    () => [
      ...s.tasks.filter((t) => t.completedAt && t.completedAt.slice(0, 10) === date).map((t) => t.title),
      ...Object.entries(s.dayLogs[date] ?? {}).filter(([, e]) => e.status === 'done').map(([id]) => s.routines.find((r) => r.id === id)?.title).filter((x): x is string => !!x),
    ],
    [s.tasks, s.dayLogs, s.routines, date],
  )
  const [achievements, setAchievements] = useState<string[]>(existing?.achievements ?? doneToday.slice(0, 3))
  const [extra, setExtra] = useState('')
  const [mood, setMood] = useState<Mood>(existing?.mood ?? 'okay')
  const [reflection, setReflection] = useState(existing?.reflection ?? '')
  const [tomorrowId, setTomorrowId] = useState<string | null>(existing?.tomorrowOneThingId ?? null)
  const candidates = s.tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')
  const tomorrowTitle = s.tasks.find((t) => t.id === tomorrowId)?.title ?? null
  const summary = debriefSummary(achievements, mood, oneThing?.status === 'done', tomorrowTitle)

  const finish = () => {
    s.saveDebrief({ achievements: [...achievements, ...(extra.trim() ? [extra.trim()] : [])], mood, reflection, tomorrowOneThingId: tomorrowId, summary })
    toast(`บันทึกแล้ว ฝันดีนะ 🌙`, 'xp')
    nav('/')
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader eyebrow={`Evening Debrief · ${step + 1}/3`} title={['อะไรขยับไปข้างหน้าวันนี้?', 'รู้สึกอย่างไร?', 'อะไรสำคัญสำหรับพรุ่งนี้?'][step]} back />
      {step === 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {doneToday.length === 0 && <p className="text-sm text-soft">ยังไม่มีอะไรที่บันทึกว่าเสร็จ เพิ่มเองได้ด้านล่าง การดูแลลูกทั้งวันก็นับนะ</p>}
            {doneToday.map((d) => (
              <button key={d} className="chip" aria-pressed={achievements.includes(d)} onClick={() => setAchievements((a) => (a.includes(d) ? a.filter((x) => x !== d) : [...a, d]))}>
                {d}
              </button>
            ))}
          </div>
          <input className="field" placeholder="อย่างอื่นที่ภูมิใจ (ไม่บังคับ)" value={extra} onChange={(e) => setExtra(e.target.value)} aria-label="ความสำเร็จเพิ่มเติม" />
          <button className="btn btn-primary w-full" onClick={() => setStep(1)}>ต่อไป <ArrowRight size={16} /></button>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="อารมณ์">
            {MOODS.map((m) => (
              <button key={m.id} role="radio" aria-checked={mood === m.id} className="chip" onClick={() => setMood(m.id)}>
                <span aria-hidden>{m.emoji}</span> {m.label}
              </button>
            ))}
          </div>
          <textarea className="field" rows={3} placeholder="อยากเล่าอะไรสั้น ๆ ไหม (ไม่บังคับ)" value={reflection} onChange={(e) => setReflection(e.target.value)} aria-label="สะท้อนคิด" />
          <button className="btn btn-primary w-full" onClick={() => setStep(2)}>ต่อไป <ArrowRight size={16} /></button>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <div className="glass max-h-60 overflow-y-auto rounded-3xl p-2">
            {candidates.map((t) => (
              <button key={t.id} className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm ${tomorrowId === t.id ? 'bg-plum text-white' : 'hover:bg-white/50'}`} onClick={() => setTomorrowId(tomorrowId === t.id ? null : t.id)}>
                <span>{t.title}</span>
                <span className="text-xs opacity-70">{t.estimatedMinutes}′</span>
              </button>
            ))}
          </div>
          <div className="glass flex items-start gap-3 rounded-[1.5rem] p-4">
            <Avatar id="j" size={44} />
            <p className="text-sm">{summary}</p>
          </div>
          <button className="btn btn-primary w-full" onClick={finish}><Check size={16} /> จบวันอย่างอ่อนโยน</button>
        </div>
      )}
    </div>
  )
}
