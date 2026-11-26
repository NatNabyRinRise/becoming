import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Orb } from '../../components/graphics/Orb'
import { TimeChips } from '../../components/ui/controls'
import { useStore } from '../../store/useStore'
import { MISSION_META, MISSION_ORDER } from '../../data/seed'
import type { MissionId, UserPreferences } from '../../types'

const FAMILY = ['ดูแลลูกเล็ก', 'ลูกงีบกลางวัน', 'มีคนช่วยดูลูกบางช่วง', 'รับส่งลูก', 'ดูแลผู้สูงอายุ']
const REWARDS = ['กาแฟแก้วโปรด', 'อ่านหนังสือ', 'ซีรีส์ 1 ตอน', 'ของหวาน', 'เดินเล่นคนเดียว', 'นวด/สปา']

export function OnboardingPage() {
  const s = useStore()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(s.profile.name)
  const [wake, setWake] = useState(s.profile.preferences.wakeTime)
  const [sleep, setSleep] = useState(s.profile.preferences.sleepTime)
  const [work, setWork] = useState(s.profile.preferences.typicalWorkMinutes)
  const [family, setFamily] = useState<string[]>([])
  const [business, setBusiness] = useState('')
  const [undecided, setUndecided] = useState(false)
  const [order, setOrder] = useState<MissionId[]>([...MISSION_ORDER])
  const [freq, setFreq] = useState<UserPreferences['reminderFrequency']>('gentle')
  const [rewards, setRewards] = useState<string[]>([])

  const finish = (skipped = false) => {
    s.completeOnboarding({
      name,
      skipped,
      prefs: { wakeTime: wake, sleepTime: sleep, typicalWorkMinutes: work, familyCommitments: family, primaryBusiness: undecided ? null : business.trim() || null, missionPriorities: order, reminderFrequency: freq, rewardPreferences: rewards },
    })
    nav('/', { replace: true })
  }
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const steps = 5

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 py-8">
      <div className="flex items-center justify-between">
        <p className="eyebrow">B E C O M I N G</p>
        {step > 0 && <button className="text-sm text-soft" onClick={() => finish(true)}>ข้ามไปก่อน</button>}
      </div>
      <div className="mt-3 flex gap-1" aria-hidden>
        {Array.from({ length: steps }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-plum' : 'bg-white/60'}`} />)}
      </div>

      <div className="flex flex-1 flex-col justify-center py-8">
        {step === 0 && (
          <div className="flex flex-col items-center text-center">
            <Orb size={220} progress={0.5} />
            <h1 className="mt-4 text-3xl font-light">Your personal universe</h1>
            <p className="mt-3 text-soft">You don't have to do everything.<br />Just become who you want to be.</p>
            <input className="field mt-8 text-center" placeholder="อยากให้เราเรียกเธอว่าอะไร" value={name} onChange={(e) => setName(e.target.value)} aria-label="ชื่อ" />
            <button className="mt-4 text-sm text-soft underline underline-offset-4" onClick={() => nav('/account')}>เคยใช้แล้ว? เข้าสู่ระบบเพื่อดึงข้อมูลเดิม</button>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-2xl">จังหวะชีวิตของเธอ</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">ตื่นนอนประมาณ</span><input type="time" className="field mt-1" value={wake} onChange={(e) => setWake(e.target.value)} /></label>
              <label className="block"><span className="label">เข้านอนประมาณ</span><input type="time" className="field mt-1" value={sleep} onChange={(e) => setSleep(e.target.value)} /></label>
            </div>
            <div>
              <p className="label mb-2">ปกติมีเวลาทำงานสำคัญวันละ</p>
              <TimeChips value={work} onChange={setWork} />
            </div>
            <div>
              <p className="label mb-2">ภาระครอบครัว (เลือกได้หลายข้อ)</p>
              <div className="flex flex-wrap gap-2">{FAMILY.map((f) => <button key={f} className="chip" aria-pressed={family.includes(f)} onClick={() => toggle(family, setFamily, f)}>{f}</button>)}</div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-2xl">ธุรกิจหลักของเธอ</h2>
            <p className="text-sm text-soft">ยังไม่ต้องตัดสินใจตอนนี้ก็ได้ เรามีโปรเจกต์ตัวอย่าง "AI Company" ให้เริ่มและแก้ไขได้</p>
            <input className="field" placeholder="เช่น คอร์สออนไลน์ด้านการสื่อสาร" value={business} disabled={undecided} onChange={(e) => setBusiness(e.target.value)} aria-label="ธุรกิจหลัก" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={undecided} onChange={(e) => setUndecided(e.target.checked)} /> ยังไม่ตัดสินใจ</label>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl">ภารกิจไหนสำคัญที่สุดปีนี้?</h2>
            <p className="text-sm text-soft">แตะเพื่อย้ายขึ้นเป็นอันดับแรก</p>
            <ol className="space-y-2">
              {order.map((m, i) => (
                <li key={m}>
                  <button className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left" onClick={() => setOrder([m, ...order.filter((x) => x !== m)])}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full text-sm" style={{ background: MISSION_META[m].color }}>{i + 1}</span>
                    <span><span className="block">{MISSION_META[m].title}</span><span className="block text-xs text-soft">{MISSION_META[m].titleTh}</span></span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-2xl">เกือบเสร็จแล้ว</h2>
            <div>
              <p className="label mb-2">อยากให้เตือนบ่อยแค่ไหน</p>
              <div className="flex gap-2">
                {([['gentle', 'เบา ๆ'], ['normal', 'ปกติ'], ['off', 'ไม่ต้องเตือน']] as const).map(([id, l]) => <button key={id} className="chip" aria-pressed={freq === id} onClick={() => setFreq(id)}>{l}</button>)}
              </div>
            </div>
            <div>
              <p className="label mb-2">รางวัลที่ทำให้เธอยิ้ม</p>
              <div className="flex flex-wrap gap-2">{REWARDS.map((r) => <button key={r} className="chip" aria-pressed={rewards.includes(r)} onClick={() => toggle(rewards, setRewards, r)}>{r}</button>)}</div>
            </div>
            <p className="rounded-2xl bg-white/50 p-3 text-xs text-soft">ข้อมูลทั้งหมดเก็บในเบราว์เซอร์ของเครื่องนี้เท่านั้น สำรองเป็นไฟล์ได้ในหน้าตั้งค่า</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>ย้อนกลับ</button>}
        {step < steps - 1 ? (
          <button className="btn btn-primary flex-1" onClick={() => setStep(step + 1)}>{step === 0 ? 'เริ่มต้น' : 'ต่อไป'} <ArrowRight size={16} /></button>
        ) : (
          <button className="btn btn-primary flex-1" onClick={() => finish(false)}>เข้าสู่จักรวาลของฉัน ✨</button>
        )}
      </div>
    </div>
  )
}
