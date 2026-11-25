import { Link } from 'react-router-dom'
import { ChevronRight, CalendarCheck, FlaskConical } from 'lucide-react'
import { PageHeader, Card, Empty } from '../../components/ui/controls'
import { useStore } from '../../store/useStore'
import { useToday } from '../../hooks/useToday'
import { missionProgress, revenueByMonth, weekStats } from '../../engine/analytics'
import { level, totals } from '../../engine/rewards'
import { MISSION_META } from '../../data/seed'
import { thaiShortDate } from '../../utils/date'
import { Bars, EnergyWave, Planet } from './charts'
import { CATEGORY_META } from '../../engine/scheduling/day'

export function GrowthPage() {
  const s = useStore()
  const { date } = useToday()
  const w = weekStats({ today: date, tasks: s.tasks, checkIns: s.checkIns, focusLog: s.focusLog, rescues: s.rescues, routines: s.routines, dayLogs: s.dayLogs })
  const { xp, coins } = totals(s.transactions)
  const months = revenueByMonth(s.revenue).slice(-6)

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader eyebrow="Growth" title="การเติบโต" />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/weekly" className="glass flex items-center gap-3 rounded-[1.5rem] p-4">
          <CalendarCheck size={20} /> <span className="flex-1">Weekly Board Meeting</span> <ChevronRight size={16} />
        </Link>
        <Link to="/experiment" className="glass flex items-center gap-3 rounded-[1.5rem] p-4">
          <FlaskConical size={20} /> <span className="flex-1">ทดลองใช้ 7 วัน</span> <ChevronRight size={16} />
        </Link>
      </div>

      {/* 1. Real outcomes — mission targets the user records */}
      <Card>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="label">ภารกิจประจำปี · ผลลัพธ์จริงที่บันทึกเอง</p>
            <h2 className="text-lg">Build Trust. Build Business. Build Freedom.</h2>
          </div>
          <Link to="/missions" className="text-xs text-plum underline">แก้เป้าหมาย</Link>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {s.missions.map((m) => (
            <Planet key={m.id} color={MISSION_META[m.id].color} value={missionProgress(m)} label={m.title.replace('Build My ', '').replace('Find My ', '')} sub={m.titleTh} />
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 2. Self-reported wellbeing */}
        <Card>
          <p className="label">พลังงานที่ประเมินเอง · 7 วัน</p>
          <p className="mb-2 text-sm text-soft">
            {w.avgEnergy === null ? 'ยังไม่มีข้อมูล' : `เฉลี่ย ${w.avgEnergy}% · ${{ up: 'แนวโน้มดีขึ้น', down: 'แนวโน้มลดลง ดูแลตัวเองด้วยนะ', flat: 'ค่อนข้างคงที่', unknown: 'ข้อมูลยังน้อย' }[w.energyTrend]}`}
          </p>
          <EnergyWave data={w.energy} />
        </Card>

        {/* 3. Recorded activity */}
        <Card>
          <p className="label">เวลาโฟกัสที่บันทึกไว้ · 7 วัน</p>
          <p className="mb-2 text-sm text-soft">รวม {w.focusMinutes} นาที · One Thing สำเร็จ {w.oneThingsDone} ครั้ง</p>
          <Bars data={w.focusByDay.map((d) => ({ label: thaiShortDate(d.date).split(' ')[0], value: d.minutes }))} />
        </Card>
      </div>

      <Card>
        <p className="label mb-3">กิจวัตรตามหมวด · 7 วัน (สิ่งที่บันทึกว่าทำแล้ว)</p>
        {w.routineByCategory.length === 0 ? <Empty>ยังไม่มีข้อมูล</Empty> : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {w.routineByCategory.map((r) => (
              <li key={r.category} className="text-sm">
                <div className="flex justify-between"><span>{CATEGORY_META[r.category].emoji} {CATEGORY_META[r.category].label}</span><span className="text-soft">{r.done}/{r.planned}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-white/50"><div className="h-1.5 rounded-full bg-lavender" style={{ width: `${(r.done / Math.max(1, r.planned)) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <p className="label mb-3">รายได้จริงต่อเดือน</p>
        {months.length === 0 ? <Empty>ยังไม่มีรายได้ที่บันทึก บันทึกได้ใน Founder Mode</Empty> : <Bars data={months.map((m) => ({ label: m.month.slice(5), value: Math.round(m.amount) }))} unit="" color="#e9c27a" />}
      </Card>

      {/* 4. Gamification — kept separate on purpose */}
      <Card className="flex items-center justify-between">
        <div>
          <p className="label">Gamification (แยกจากผลลัพธ์จริง)</p>
          <p className="text-sm">Level {level(xp).level} · {xp} XP · {coins} เหรียญ</p>
        </div>
        <Link to="/rewards" className="btn btn-soft !px-4 text-xs">Reward Universe</Link>
      </Card>
      <p className="pb-2 text-center text-[11px] text-soft">ไม่มี "คะแนนชีวิต" รวม เพราะคุณค่าของเธอวัดเป็นตัวเลขเดียวไม่ได้</p>
    </div>
  )
}
