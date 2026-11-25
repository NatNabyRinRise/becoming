import { useMemo, useState } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { PageHeader, Card } from '../../components/ui/controls'
import { Avatar } from '../../components/companions/Avatar'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { useToday } from '../../hooks/useToday'
import { weekStats } from '../../engine/analytics'
import { recommend } from '../../engine/recommendations'
import { MISSION_META } from '../../data/seed'
import { thaiShortDate, weekStart } from '../../utils/date'
import type { CompanionId } from '../../types'
import { Bars } from '../analytics/charts'

export function WeeklyPage() {
  const s = useStore()
  const { date } = useToday()
  const toast = useUI((u) => u.showToast)
  const w = weekStats({ today: date, tasks: s.tasks, checkIns: s.checkIns, focusLog: s.focusLog, rescues: s.rescues, routines: s.routines, dayLogs: s.dayLogs })
  const wk = weekStart(date)
  const saved = s.weekly.find((x) => x.weekStart === wk)
  const top = useMemo(() => {
    const r = recommend({ tasks: s.tasks, availableMinutes: 120, energy: 70, thresholds: s.settings.energyThresholds, missionPriorities: s.profile.preferences.missionPriorities, primaryProjectId: s.projects.find((p) => p.isPrimaryBusiness)?.id ?? null })
    return r.kind === 'task' ? r.task.title : 'เลือกธุรกิจหลักและขั้นแรกที่ทดสอบได้'
  }, [s.tasks, s.settings.energyThresholds, s.profile.preferences.missionPriorities, s.projects])
  const [priority, setPriority] = useState(saved?.priority ?? top)
  const [editing, setEditing] = useState(false)

  const biz = w.tasksDone.filter((t) => t.missionId === 'empire' || t.missionId === 'freedom' || t.missionId === 'people').length
  const brand = w.tasksDone.filter((t) => t.kind === 'brand').length + s.content.filter((c) => c.publishedAt && c.publishedAt.slice(0, 10) >= w.from).length
  const recovery = w.routineByCategory.filter((r) => ['recovery', 'sleep', 'exercise', 'family'].includes(r.category)).reduce((a, r) => a + r.done, 0)

  const lines: [CompanionId, string][] = [
    ['j', w.tasksDone.length ? `สัปดาห์นี้ทำสำเร็จ ${w.tasksDone.length} งาน รวมโฟกัส ${w.focusMinutes} นาที${w.rescueCount ? ` และปรับแผนด้วย Rescue ${w.rescueCount} ครั้ง ซึ่งคือการปรับตัวที่ดี` : ''}` : 'สัปดาห์นี้ยังไม่มีงานที่บันทึกว่าเสร็จ ไม่เป็นไร เริ่มใหม่จากก้าวเล็ก ๆ'],
    ['atlas', biz ? `งานธุรกิจขยับ ${biz} ชิ้น${w.postponed.length ? ` แต่มี ${w.postponed.length} งานที่เลื่อนซ้ำ ลองลดขอบเขตหรือตัดออก` : ''}` : 'ยังไม่มีงานธุรกิจที่ปิดได้ สัปดาห์หน้าเลือกขั้นเดียวที่ทดสอบได้จริง'],
    ['muse', brand ? `ด้านการสื่อสารมี ${brand} ชิ้นงาน เสียงของเธอเริ่มชัดขึ้น` : 'ยังไม่มีคอนเทนต์สัปดาห์นี้ ลองเก็บเรื่องเล่า 1 เรื่องจากชีวิตจริง'],
    ['bloom', w.avgEnergy !== null ? `พลังงานเฉลี่ย ${w.avgEnergy}% และบันทึกกิจกรรมพักฟื้น/ครอบครัว ${recovery} ครั้ง${w.avgEnergy < 45 ? ' สัปดาห์หน้าเพิ่มเวลาพักนะ' : ''}` : 'ยังไม่มีข้อมูลพลังงาน ลองเช็กอินตอนเช้าดูนะ'],
    ['spark', w.oneThingsDone ? `One Thing สำเร็จ ${w.oneThingsDone} ครั้ง! ฉลองหน่อย 🎉` : 'สัปดาห์หน้าลองท้าทาย One Thing แค่ 5 นาทีต่อวันไหม'],
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader eyebrow={`Weekly Board Meeting · ${thaiShortDate(w.from)} – ${thaiShortDate(w.to)}`} title="ประชุมทีมประจำสัปดาห์" back />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="งานที่สำเร็จ" value={w.tasksDone.length} />
        <Metric label="One Thing" value={w.oneThingsDone} />
        <Metric label="นาทีโฟกัส" value={w.focusMinutes} />
        <Metric label="ใช้ Rescue" value={w.rescueCount} />
      </div>
      <Card>
        <p className="label mb-2">ความคืบหน้าตามภารกิจ (งานที่เสร็จ)</p>
        <Bars data={(Object.keys(w.missionActivity) as (keyof typeof w.missionActivity)[]).map((k) => ({ label: MISSION_META[k].title.split(' ').pop()!, value: w.missionActivity[k] }))} unit="" />
      </Card>
      <Card className="space-y-3">
        {lines.map(([id, text]) => (
          <div key={id} className="flex items-start gap-3">
            <Avatar id={id} size={40} />
            <p className="pt-1 text-sm">{text}</p>
          </div>
        ))}
      </Card>
      {w.tasksDone.length > 0 && (
        <Card>
          <p className="label mb-2">ความสำเร็จที่มีความหมาย</p>
          <ul className="space-y-1 text-sm">{w.tasksDone.slice(0, 8).map((t) => <li key={t.id}>✦ {t.title}</li>)}</ul>
        </Card>
      )}
      {w.postponed.length > 0 && (
        <Card>
          <p className="label mb-2">งานที่เลื่อนซ้ำ</p>
          <ul className="space-y-1 text-sm">{w.postponed.map((t) => <li key={t.id}>{t.title} · {t.postponementCount}×</li>)}</ul>
        </Card>
      )}
      <Card>
        <p className="label">สิ่งสำคัญอันดับหนึ่งของสัปดาห์หน้า</p>
        {editing ? (
          <input className="field mt-2" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="สิ่งสำคัญสัปดาห์หน้า" autoFocus />
        ) : (
          <p className="mt-1 text-lg">{saved?.status === 'rejected' ? <span className="text-soft line-through">{saved.priority}</span> : priority}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => { s.saveWeekly({ weekStart: wk, priority, status: editing ? 'edited' : 'accepted' }); setEditing(false); toast('บันทึกแล้ว') }}><Check size={16} /> ตกลง</button>
          <button className="btn btn-soft" onClick={() => setEditing((v) => !v)}><Pencil size={16} /> แก้ไข</button>
          <button className="btn btn-ghost" onClick={() => { s.saveWeekly({ weekStart: wk, priority, status: 'rejected' }); toast('ไม่เป็นไร เธอเป็นคนตัดสินใจ') }}><X size={16} /> ไม่เอา</button>
        </div>
        {saved && <p className="mt-2 text-xs text-soft">สถานะ: {{ accepted: 'ตกลงแล้ว', edited: 'แก้ไขแล้ว', rejected: 'ไม่รับ' }[saved.status]}</p>}
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-[1.5rem] p-4">
      <p className="big-num text-3xl">{value}</p>
      <p className="mt-1 text-xs text-soft">{label}</p>
    </div>
  )
}
