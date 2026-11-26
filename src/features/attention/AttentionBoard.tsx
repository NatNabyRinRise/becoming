import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Link2 } from 'lucide-react'
import { Avatar } from '../../components/companions/Avatar'
import { reloadSources, useAttention, useSources } from '../../orchestration/useOrchestration'
import { setSourcePreference } from '../../orchestration/sources'
import type { AttentionType } from '../../orchestration/types'
import { AttentionRow, TYPE_META } from './AttentionUI'

const ORDER: AttentionType[] = ['do', 'review', 'decide', 'think', 'life']
const LEVEL_TH = { recovery: 'ควรพัก', light: 'เบา ๆ', steady: 'พอดี', strong: 'เต็มที่' } as const

/** Home: what deserves Eve's attention now, by attention type. */
export function AttentionBoard() {
  const { queue, error } = useAttention()
  const status = useSources((x) => x.status)
  const [tab, setTab] = useState<AttentionType | null>(null)
  if (error) return <p className="glass mt-3 rounded-[1.75rem] p-4 text-sm text-soft">อ่านข้อมูลจาก AI Company ไม่สำเร็จ: {error}</p>
  if (status?.adapter === 'none') {
    return (
      <section className="glass mt-3 space-y-2 rounded-[1.75rem] p-4 text-sm" aria-label="สิ่งที่ควรได้รับความสนใจ">
        <p className="label">Attention · สิ่งที่ควรดูตอนนี้</p>
        <p>ยังอ่านงานจาก Notion ไม่ได้{status.fallback ? ` — ${status.fallback.message}` : ''}</p>
        {status.fallback?.reason === 'not_signed_in' && <p className="text-xs text-soft">ไปที่ Me → Account & Sync เพื่อเข้าสู่ระบบด้วยบัญชีเดียวกับเครื่องอื่น</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <button className="btn btn-soft !min-h-0 !px-3 !py-1.5 text-xs" onClick={() => void reloadSources()}>ลองใหม่</button>
          <Link to="/link" className="btn btn-ghost !min-h-0 !px-3 !py-1.5 text-xs underline"><Link2 size={12} /> สถานะการเชื่อม</Link>
          <button className="btn btn-ghost !min-h-0 !px-3 !py-1.5 text-xs text-soft underline" onClick={() => { setSourcePreference('mock'); void reloadSources() }}>ดูข้อมูลตัวอย่าง</button>
        </div>
      </section>
    )
  }
  if (!queue) return null
  const c = queue.capacity
  const first = ORDER.find((t) => queue.byType[t].length > 0) ?? 'do'
  const active = tab ?? (c.level === 'recovery' ? 'life' : first)
  const list = queue.byType[active]

  return (
    <section className="glass mt-3 rounded-[1.75rem] p-4" aria-label="สิ่งที่ควรได้รับความสนใจ">
      <div className="flex items-center justify-between gap-2">
        <p className="label">Attention · สิ่งที่ควรดูตอนนี้</p>
        <Link to="/link" className="flex items-center gap-1 text-[11px] text-soft underline"><Link2 size={12} /> {status?.adapter === 'mock' ? 'ข้อมูลตัวอย่าง' : 'AI Company'}</Link>
      </div>

      <div className="mt-2 flex items-center gap-2 rounded-2xl bg-white/40 px-3 py-2 text-xs">
        <Avatar id="bloom" size={26} />
        <span>Capacity <b>{c.score}</b> · {LEVEL_TH[c.level]} · โฟกัสได้ ~{c.focusMinutes} นาที · ไม่เกิน {c.workloadLimit} เรื่อง</span>
      </div>
      {status?.adapter === 'mock' && (
        <p className="mt-2 rounded-2xl bg-white/40 px-3 py-2 text-xs">
          นี่คือข้อมูลตัวอย่าง ไม่ใช่งานจริงจาก Notion ·{' '}
          <button className="underline" onClick={() => { setSourcePreference('auto'); void reloadSources() }}>ใช้ข้อมูลจาก Notion</button>
        </p>
      )}
      {c.warning && <p className="mt-2 text-xs text-soft">⚠️ {c.warning}</p>}

      <div role="tablist" aria-label="ประเภท" className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {ORDER.map((t) => (
          <button key={t} role="tab" aria-selected={active === t} aria-pressed={active === t} className="chip shrink-0 !px-3 !py-1.5 text-xs" onClick={() => setTab(t)}>
            <span aria-hidden>{TYPE_META[t].emoji}</span> {TYPE_META[t].label}
            <span className="ml-1 opacity-70">{queue.byType[t].length}</span>
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-soft">{TYPE_META[active].th}</p>

      {list.length === 0 ? (
        <p className="py-3 text-sm text-soft">ไม่มีอะไรรออยู่ในหมวดนี้</p>
      ) : (
        <ul className="mt-1">
          {list.slice(0, active === 'life' || active === 'think' ? 4 : Math.max(2, c.workloadLimit)).map((i) => (
            <li key={i.key}><AttentionRow item={i} /></li>
          ))}
        </ul>
      )}
      {queue.held > 0 && <p className="mt-1 text-[11px] text-soft">เลื่อนไว้ก่อน {queue.held} เรื่อง (กลับมาพรุ่งนี้)</p>}
    </section>
  )
}
