import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gift, Plus, Trash2, Lock } from 'lucide-react'
import { PageHeader, Card, Empty } from '../../components/ui/controls'
import { ProgressRing } from '../../components/graphics/ProgressRing'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { useToday } from '../../hooks/useToday'
import { level, totals, unlockedSanctuary } from '../../engine/rewards'
import { GIFT_POOL } from '../../data/seed'
import { Sanctuary } from './Sanctuary'

export function RewardsPage() {
  const s = useStore()
  const { date } = useToday()
  const toast = useUI((u) => u.showToast)
  const { xp, coins } = totals(s.transactions)
  const lv = level(xp)
  const gift = s.gifts[date]
  const [revealing, setRevealing] = useState(false)
  const [title, setTitle] = useState('')
  const [cost, setCost] = useState(50)
  const revealed = gift?.revealedRewardId ? GIFT_POOL.find((g) => g.id === gift.revealedRewardId) : null
  const items = unlockedSanctuary(xp)
  const next = items.find((i) => !i.unlocked)
  const recent = [...s.transactions].filter((t) => t.rewardType === 'xp').reverse().slice(0, 8)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader eyebrow="Reward Universe" title="รางวัลของเธอ" back />

      <Card className="flex items-center gap-5">
        <ProgressRing value={lv.into / lv.span} size={88} stroke={6} label={`เลเวล ${lv.level}`}>
          <div><p className="big-num text-2xl">{lv.level}</p><p className="text-[10px] text-soft">LEVEL</p></div>
        </ProgressRing>
        <div className="grid flex-1 grid-cols-2 gap-3">
          <div><p className="label">XP</p><p className="big-num text-3xl">{xp}</p></div>
          <div><p className="label">เหรียญทอง</p><p className="big-num text-3xl">{coins}</p></div>
          <p className="col-span-2 text-[11px] text-soft">อีก {lv.span - lv.into} XP ถึงเลเวลถัดไป · XP ไม่มีวันลดลงเพราะพลาดวันไหน</p>
        </div>
      </Card>

      {/* Mystery gift */}
      <Card className="text-center">
        <p className="label">Mystery Gift วันนี้</p>
        <div className="my-4 flex justify-center">
          <AnimatePresence mode="wait">
            {revealed ? (
              <motion.div key="open" initial={{ scale: 0.6, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', damping: 12 }} className="max-w-xs">
                <p className="text-2xl">{revealed.title}</p>
                <p className="mt-2 text-sm text-soft">{revealed.text}</p>
              </motion.div>
            ) : (
              <motion.button
                key="box"
                disabled={!gift?.unlocked}
                onClick={() => {
                  setRevealing(true)
                  setTimeout(() => {
                    s.revealGift(date)
                    setRevealing(false)
                  }, 700)
                }}
                animate={revealing ? { rotate: [0, -6, 6, -4, 4, 0], scale: [1, 1.08, 1] } : {}}
                transition={{ duration: 0.7 }}
                className="relative flex h-28 w-28 items-center justify-center rounded-[2rem] disabled:opacity-60"
                style={{ background: 'linear-gradient(145deg, #f7f3ed, #e9d8b4 50%, #a99acb)', boxShadow: '0 20px 50px -20px rgba(100,91,124,.6)' }}
                aria-label={gift?.unlocked ? 'เปิดของขวัญ' : 'ของขวัญยังล็อกอยู่'}
              >
                {gift?.unlocked ? <Gift size={40} className="text-white" /> : <Lock size={34} className="text-white" />}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        {!gift?.unlocked && <p className="text-sm text-soft">ทำ One Thing ของวันนี้ให้เสร็จเพื่อปลดล็อก</p>}
        <p className="mt-2 text-[11px] text-soft">ไม่มีการสุ่มเพื่อจ่ายเงิน ไม่มีกล่องสุ่มแบบเสียเงิน แค่ของขวัญเล็ก ๆ สำหรับการลงมือทำ</p>
      </Card>

      {/* Sanctuary */}
      <Card>
        <div className="flex items-end justify-between">
          <div>
            <p className="label">My Sanctuary</p>
            <h2 className="text-lg">บ้านในอนาคตของเธอ</h2>
          </div>
          {next && <p className="text-xs text-soft">ถัดไป: {next.title} ({next.xp} XP)</p>}
        </div>
        <Sanctuary xp={xp} />
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {items.map((i) => (
            <li key={i.id} className={`rounded-full px-3 py-1 text-xs ${i.unlocked ? 'bg-white/70' : 'bg-white/25 text-soft'}`}>{i.unlocked ? '✦' : '○'} {i.title}</li>
          ))}
        </ul>
      </Card>

      {/* Personal rewards */}
      <Card>
        <h2 className="mb-3 text-base">รางวัลส่วนตัว</h2>
        <ul className="space-y-2">
          {s.rewards.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-2xl bg-white/40 p-3 text-sm">
              <span className="flex-1">{r.title}</span>
              <button
                className="btn btn-soft !min-h-0 !px-3 !py-1.5 text-xs"
                disabled={coins < r.cost}
                onClick={() => { if (s.redeemReward(r.id)) toast(`ขอให้สนุกกับ "${r.title}" นะ ☕`) }}
              >
                ใช้ {r.cost} เหรียญ
              </button>
              <button className="p-1.5 text-soft" aria-label="ลบรางวัล" onClick={() => confirm('ลบรางวัลนี้?') && s.deleteReward(r.id)}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (title.trim()) { s.addReward(title.trim(), cost); setTitle('') } }}>
          <input className="field" placeholder="รางวัลที่อยากให้ตัวเอง" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="ชื่อรางวัล" />
          <input className="field !w-24" type="number" min={1} value={cost} onChange={(e) => setCost(Math.max(1, Number(e.target.value)))} aria-label="ราคาเหรียญ" />
          <button className="btn btn-primary !px-4" aria-label="เพิ่มรางวัล"><Plus size={16} /></button>
        </form>
        <p className="mt-2 text-[11px] text-soft">การพัก การกิน และเวลากับลูก ไม่ต้องใช้แต้มแลก</p>
      </Card>

      <Card>
        <h2 className="mb-3 text-base">ความสำเร็จล่าสุด</h2>
        {recent.length === 0 ? <Empty>ยังไม่มี เริ่มจาก One Thing ของวันนี้</Empty> : (
          <ul className="space-y-1.5 text-sm">
            {recent.map((t) => (
              <li key={t.id} className="flex justify-between gap-2"><span className="truncate">{t.reason}</span><span className="shrink-0 text-soft">+{t.amount}</span></li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
