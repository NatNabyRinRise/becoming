import { PageHeader, Card } from '../../components/ui/controls'
import { useStore } from '../../store/useStore'
import { daysBetween, addDays, thaiShortDate } from '../../utils/date'

const DAYS = [
  'Morning Briefing และตั้งค่าเริ่มต้น',
  'Adaptive Routine (My Day)',
  'Founder Mode',
  'Rescue Mode',
  'Opportunity Window และ Rewards',
  'Evening Debrief และ Journal',
  'Weekly Board Meeting',
]

const QUESTIONS = [
  ['reopen', 'อยากกลับมาเปิดแอปอีกไหม?'],
  ['fatigue', 'แอปช่วยลดการต้องตัดสินใจไหม?'],
  ['meaningful', 'ได้ทำงานที่มีความหมายจริงไหม?'],
  ['interrupt', 'ช่วยได้ตอนแผนถูกขัดจังหวะไหม?'],
  ['calm', 'หน้าตาแอปรู้สึกสงบไหม?'],
  ['companions', 'ข้อความจากทีมผู้ช่วยมีประโยชน์ไหม?'],
  ['reminders', 'การเตือนมากเกินไปไหม? (5 = กำลังดี)'],
] as const

export function ExperimentPage() {
  const s = useStore()
  const e = s.experiment
  const today = s.today()
  const dayIdx = e.startedAt ? Math.min(6, Math.max(0, daysBetween(e.startedAt, today))) : -1
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader eyebrow="7-Day Personal Experiment" title="ทดลองใช้จริง 7 วัน" back />
      {!e.startedAt ? (
        <Card>
          <p className="text-sm">ลองใช้ BECOMING ในชีวิตจริง 7 วัน แต่ละวันมีโฟกัสแนะนำ แต่ใช้ฟีเจอร์ไหนก็ได้ทุกวัน</p>
          <button className="btn btn-primary mt-4" onClick={s.startExperiment}>เริ่มการทดลองวันนี้</button>
        </Card>
      ) : (
        <Card>
          <ol className="space-y-2">
            {DAYS.map((d, i) => (
              <li key={d}>
                <label className={`flex items-center gap-3 rounded-2xl p-3 ${i === dayIdx ? 'bg-white/70' : 'bg-white/30'}`}>
                  <input type="checkbox" checked={e.doneDays.includes(i + 1)} onChange={() => s.toggleExperimentDay(i + 1)} />
                  <span className="flex-1 text-sm">วันที่ {i + 1}: {d}</span>
                  <span className="text-[11px] text-soft">{thaiShortDate(addDays(e.startedAt!, i))}</span>
                </label>
              </li>
            ))}
          </ol>
        </Card>
      )}
      <Card className="space-y-4">
        <h2 className="text-base">ความรู้สึกหลังใช้ (ไม่บังคับ)</h2>
        {QUESTIONS.map(([k, q]) => (
          <div key={k}>
            <p className="text-sm">{q}</p>
            <div className="mt-1.5 flex gap-1.5" role="radiogroup" aria-label={q}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} role="radio" aria-checked={e.feedback[k] === n} className="chip !min-h-[36px] !px-3.5 !py-1" onClick={() => s.setExperimentFeedback(k, n)}>{n}</button>
              ))}
            </div>
          </div>
        ))}
        <textarea className="field" rows={3} placeholder="โน้ตเพิ่มเติม" value={(e.feedback.note as string) ?? ''} onChange={(ev) => s.setExperimentFeedback('note', ev.target.value)} aria-label="โน้ตเพิ่มเติม" />
      </Card>
    </div>
  )
}
