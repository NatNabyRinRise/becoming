import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Pause, Play, Check, X, Gift } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { PageHeader, TimeChips } from '../../components/ui/controls'
import { Avatar } from '../../components/companions/Avatar'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { useNow } from '../../hooks/useNow'
import { elapsedSeconds, fmtClock, isOvertime } from '../../engine/focus'

export function FocusPage() {
  const s = useStore()
  const focus = s.focus
  const now = useNow(1000)
  const nav = useNavigate()
  const toast = useUI((u) => u.showToast)
  const setRescue = useUI((u) => u.setRescue)
  const [result, setResult] = useState<{ xp: number; gift: boolean; title: string } | null>(null)
  const [quickMin, setQuickMin] = useState<number | null>(25)

  // keep the document title informative while focusing
  useEffect(() => {
    if (!focus) return
    const left = focus.plannedMinutes * 60 - elapsedSeconds(focus, now.getTime())
    document.title = `${fmtClock(left)} · BECOMING`
    return () => {
      document.title = 'BECOMING'
    }
  }, [focus, now])

  if (result) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center pt-10 text-center">
        <div className="text-6xl" aria-hidden>✨</div>
        <h1 className="mt-4 text-2xl">สำเร็จแล้ว</h1>
        <p className="mt-1 text-soft">{result.title}</p>
        {result.xp > 0 && <p className="mt-4 rounded-full bg-gold/70 px-4 py-1.5 text-sm">+{result.xp} XP</p>}
        {result.gift && (
          <Link to="/rewards" className="btn btn-primary mt-6"><Gift size={16} /> เปิด Mystery Gift</Link>
        )}
        <button className="btn btn-ghost mt-3" onClick={() => nav('/')}>กลับหน้าหลัก</button>
      </div>
    )
  }

  if (!focus) {
    return (
      <div className="mx-auto max-w-md">
        <PageHeader title="Focus Mode" eyebrow="โฟกัส" back />
        <div className="glass space-y-4 rounded-[1.75rem] p-5">
          <p className="text-soft">ยังไม่มีเซสชันโฟกัส เลือกงานจาก Home / My Day หรือเริ่มโฟกัสแบบอิสระ</p>
          <TimeChips value={quickMin} onChange={setQuickMin} options={[5, 15, 25, 45, 60]} />
          <button className="btn btn-primary w-full" disabled={!quickMin} onClick={() => quickMin && s.startFocus(null, 'โฟกัสอิสระ', quickMin)}>
            <Play size={16} /> เริ่มโฟกัส
          </button>
        </div>
      </div>
    )
  }

  const el = elapsedSeconds(focus, now.getTime())
  const planned = focus.plannedMinutes * 60
  const left = planned - el
  const frac = Math.min(1, el / planned)
  const over = isOvertime(focus, now.getTime())
  const running = focus.status === 'running'

  const complete = () => {
    const title = focus.title
    const r = s.completeFocus()
    if (focus.taskId) setResult({ xp: r.xp, gift: r.giftUnlocked, title })
    else {
      toast(`บันทึกเวลาโฟกัส ${Math.round(el / 60)} นาที`)
      nav('/')
    }
  }

  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-md flex-col items-center justify-between py-4">
      <div className="w-full text-center">
        <p className="eyebrow">Focus Mode</p>
        <h1 className="mt-2 text-xl leading-snug">{focus.title}</h1>
      </div>

      <div className="relative my-6 flex items-center justify-center" style={{ width: 'min(78vw, 320px)', height: 'min(78vw, 320px)' }}>
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
          <circle cx="100" cy="100" r="94" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="94" fill="none" stroke="var(--c-plum)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={2 * Math.PI * 94} strokeDashoffset={2 * Math.PI * 94 * (1 - frac)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div className={`absolute inset-[9%] rounded-full ${running ? 'anim-breathe' : ''}`} style={{ background: 'radial-gradient(circle at 35% 30%, #fffaf0 0%, #e9d8b4 30%, #c8b8e0 65%, #8f7fbf 100%)', boxShadow: '0 30px 80px -30px rgba(100,91,124,0.6)' }} />
        <div className="absolute inset-[22%] rounded-full bg-white/25 backdrop-blur-sm" />
        <div className="relative text-center" role="timer" aria-live="off">
          <p className="big-num text-6xl text-ink">{fmtClock(left)}</p>
          <p className="mt-1 text-xs text-soft">{left >= 0 ? 'เหลือเวลา' : 'เกินเวลาที่วางไว้'} · {running ? 'กำลังโฟกัส' : 'พักอยู่'}</p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3">
        <div className="flex justify-center gap-3">
          {running ? (
            <button className="btn btn-soft h-14 w-14 !p-0" aria-label="หยุดชั่วคราว" onClick={s.pauseFocus}><Pause size={22} /></button>
          ) : (
            <button className="btn btn-soft h-14 w-14 !p-0" aria-label="ทำต่อ" onClick={s.resumeFocus}><Play size={22} /></button>
          )}
          <button className="btn btn-primary h-14 flex-1 max-w-[220px]" onClick={complete}><Check size={20} /> เสร็จแล้ว</button>
          <button className="btn btn-soft h-14 w-14 !p-0" aria-label="ออก (บันทึกเวลาไว้)" onClick={() => { s.exitFocus(); toast('บันทึกเวลาที่ทำไว้แล้ว'); nav('/') }}><X size={22} /></button>
        </div>
        <button className="btn btn-ghost text-xs" onClick={() => setRescue(true)}>มีอะไรแทรก? เปิด Rescue Mode</button>
      </div>

      <Sheet open={over} onClose={s.acknowledgeOvertime} title="ใช้เวลาเกินที่วางไว้แล้ว">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar id="atlas" size={44} />
            <p className="text-sm">งานนี้ใช้เวลาเกินที่วางไว้แล้ว ลองหยุดและทดสอบสิ่งที่มีอยู่ก่อนดีไหม?</p>
          </div>
          <button className="btn btn-primary w-full" onClick={s.acknowledgeOvertime}>ทำต่ออีกหน่อย</button>
          <button className="btn btn-soft w-full" onClick={() => { s.acknowledgeOvertime(); s.pauseFocus() }}>พักก่อน</button>
          {focus.taskId && (
            <button className="btn btn-soft w-full" onClick={() => { s.acknowledgeOvertime(); s.reduceScope(focus.taskId!); toast('ลดขอบเขตแล้ว ทำส่วนที่สำคัญที่สุดให้จบ') }}>ลดขอบเขตงาน</button>
          )}
          <button className="btn btn-ghost w-full" onClick={() => { s.stopAndReschedule(); toast('บันทึกความคืบหน้าและเลื่อนไปพรุ่งนี้แล้ว'); nav('/') }}>หยุดและเลื่อนไปวันอื่น</button>
        </div>
      </Sheet>
    </div>
  )
}
