import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../sync/useAuth'
import { Download, Upload, RotateCcw } from 'lucide-react'
import { PageHeader, Card, Segmented } from '../../components/ui/controls'
import { Sheet } from '../../components/ui/Sheet'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { exportBackup, validateData, type ImportPreview } from '../../store/backup'
import { pickDomain } from '../../store/state'
import { INTEGRATIONS } from '../../services/integrations'
import type { RewardRules } from '../../types'

const RULE_LABELS: Record<keyof RewardRules, string> = {
  oneThing: 'ทำ One Thing สำเร็จ',
  health: 'กิจวัตรสุขภาพ',
  family: 'กิจกรรมครอบครัว',
  brand: 'งาน Personal brand',
  debrief: 'Evening Debrief',
  rescueBonus: 'โบนัสภารกิจหลัง Rescue',
  comeback: 'Comeback Bonus',
  taskDefault: 'งานอื่น ๆ',
}

export function SettingsPage() {
  const s = useStore()
  const auth = useAuth((a) => a.status)
  const toast = useUI((u) => u.showToast)
  const file = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetText, setResetText] = useState('')
  const notifSupported = typeof window !== 'undefined' && 'Notification' in window
  const p = s.profile.preferences

  const doExport = () => {
    const data = exportBackup(pickDomain(s))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `becoming-backup-${s.today()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    toast('ดาวน์โหลดไฟล์สำรองแล้ว')
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    const text = await f.text()
    setPreview(validateData(text))
    if (file.current) file.current.value = ''
  }

  const toggleBrowserNotif = async (on: boolean) => {
    if (!notifSupported) return
    if (on && Notification.permission !== 'granted') {
      const r = await Notification.requestPermission()
      if (r !== 'granted') {
        toast('เบราว์เซอร์ไม่อนุญาตการแจ้งเตือน', 'warn')
        return
      }
    }
    s.updateSettings({ notificationPreferences: { ...s.settings.notificationPreferences, browser: on } })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader eyebrow="Settings" title="ตั้งค่า" back />

      <Card className="space-y-3">
        <h2 className="text-base">โปรไฟล์</h2>
        <label className="block"><span className="label">ชื่อที่อยากให้เรียก</span>
          <input className="field mt-1" value={s.profile.name} onChange={(e) => s.updateProfile({ name: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">ตื่นนอน</span><input type="time" className="field mt-1" value={p.wakeTime} onChange={(e) => s.updatePreferences({ wakeTime: e.target.value })} /></label>
          <label className="block"><span className="label">เข้านอน</span><input type="time" className="field mt-1" value={p.sleepTime} onChange={(e) => s.updatePreferences({ sleepTime: e.target.value })} /></label>
        </div>
        <label className="block"><span className="label">ธุรกิจหลัก</span>
          <input className="field mt-1" placeholder="ยังไม่ตัดสินใจ" value={p.primaryBusiness ?? ''} onChange={(e) => s.updatePreferences({ primaryBusiness: e.target.value || null })} />
        </label>
        <label className="block"><span className="label">เขตเวลา</span>
          <input className="field mt-1" value={s.settings.timezone} onChange={(e) => s.updateSettings({ timezone: e.target.value })} onBlur={(e) => { try { new Intl.DateTimeFormat('en', { timeZone: e.target.value }) } catch { s.updateSettings({ timezone: 'Asia/Bangkok' }); toast('เขตเวลาไม่ถูกต้อง ใช้ Asia/Bangkok', 'warn') } }} />
        </label>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base">การเตือนและความเงียบ</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">ช่วงเงียบ เริ่ม</span><input type="time" className="field mt-1" value={s.settings.quietHours.start} onChange={(e) => s.updateSettings({ quietHours: { ...s.settings.quietHours, start: e.target.value } })} /></label>
          <label className="block"><span className="label">ถึง</span><input type="time" className="field mt-1" value={s.settings.quietHours.end} onChange={(e) => s.updateSettings({ quietHours: { ...s.settings.quietHours, end: e.target.value } })} /></label>
        </div>
        <Segmented label="ความถี่การเตือน" value={p.reminderFrequency} onChange={(v) => s.updatePreferences({ reminderFrequency: v })} options={[{ id: 'gentle', label: 'เบา ๆ' }, { id: 'normal', label: 'ปกติ' }, { id: 'off', label: 'ปิด' }]} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" disabled={!notifSupported} checked={s.settings.notificationPreferences.browser} onChange={(e) => toggleBrowserNotif(e.target.checked)} />
          <span>แจ้งเตือนผ่านเบราว์เซอร์<br /><span className="text-xs text-soft">{notifSupported ? 'ทำงานเฉพาะตอนเปิดแอปค้างไว้ ยังไม่รองรับการแจ้งเตือนเบื้องหลังเมื่อปิดแอป (โดยเฉพาะบน iPhone)' : 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน'}</span></span>
        </label>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base">เกณฑ์พลังงาน</h2>
        <label className="block"><span className="label">ต่ำกว่านี้ = แนะนำพักฟื้น: {s.settings.energyThresholds.recovery}</span>
          <input type="range" min={5} max={60} step={5} className="w-full" value={s.settings.energyThresholds.recovery} onChange={(e) => s.updateSettings({ energyThresholds: { ...s.settings.energyThresholds, recovery: Number(e.target.value) } })} />
        </label>
        <label className="block"><span className="label">ต่ำกว่านี้ = งานใช้แรงน้อย: {s.settings.energyThresholds.lowEffort}</span>
          <input type="range" min={20} max={90} step={5} className="w-full" value={s.settings.energyThresholds.lowEffort} onChange={(e) => s.updateSettings({ energyThresholds: { ...s.settings.energyThresholds, lowEffort: Math.max(Number(e.target.value), s.settings.energyThresholds.recovery + 5) } })} />
        </label>
        <label className="block"><span className="label">แสดง Welcome back หลังหายไป (วัน)</span>
          <input type="number" min={1} max={30} className="field mt-1 !w-24" value={s.settings.comebackAfterDays} onChange={(e) => s.updateSettings({ comebackAfterDays: Math.max(1, Number(e.target.value)) })} />
        </label>
      </Card>

      <Card>
        <h2 className="mb-3 text-base">กติกา XP</h2>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(RULE_LABELS) as (keyof RewardRules)[]).map((k) => (
            <label key={k} className="block"><span className="label">{RULE_LABELS[k]}</span>
              <input type="number" min={0} className="field mt-1 !py-2" value={s.settings.rewardRules[k]} onChange={(e) => s.updateSettings({ rewardRules: { ...s.settings.rewardRules, [k]: Math.max(0, Number(e.target.value)) } })} />
            </label>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base">การแสดงผล</h2>
        <Segmented label="ภาพเคลื่อนไหว" value={s.settings.reducedMotion} onChange={(v) => s.updateSettings({ reducedMotion: v })} options={[{ id: 'system', label: 'ตามระบบ' }, { id: 'on', label: 'ลดการเคลื่อนไหว' }, { id: 'off', label: 'เต็มที่' }]} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.settings.voiceInput} onChange={(e) => s.updateSettings({ voiceInput: e.target.checked })} /> เปิดการพูดแทนพิมพ์ใน Journal (ถ้าเบราว์เซอร์รองรับ)
        </label>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base">ข้อมูลและความเป็นส่วนตัว</h2>
        <p className="text-sm text-soft">
          {auth === 'signedIn'
            ? 'ข้อมูลเก็บในเครื่องนี้และซิงก์ขึ้นบัญชีของเธอบน Supabase ใช้ได้ทุกเครื่องที่เข้าสู่ระบบ'
            : 'ตอนนี้ข้อมูลเก็บในเบราว์เซอร์ของเครื่องนี้เท่านั้น เข้าสู่ระบบเพื่อสำรองขึ้นคลาวด์และใช้หลายเครื่อง'}{' '}
          <Link to="/account" className="underline">บัญชีและการซิงก์</Link>
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={doExport}><Download size={16} /> สำรองข้อมูล (JSON)</button>
          <button className="btn btn-soft" onClick={() => file.current?.click()}><Upload size={16} /> นำเข้าข้อมูล</button>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="เลือกไฟล์สำรอง" />
          <button className="btn btn-ghost text-[#a0465a]" onClick={() => setResetOpen(true)}><RotateCcw size={16} /> รีเซ็ตทั้งหมด</button>
        </div>
        {s.storageError && <p className="rounded-2xl bg-[#f6d6d6]/70 p-3 text-sm">{s.storageError}</p>}
      </Card>

      <Card>
        <h2 className="mb-2 text-base">การเชื่อมต่อในอนาคต</h2>
        <ul className="space-y-1.5 text-sm">
          {INTEGRATIONS.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2">
              <span>{i.name}</span>
              <span className="rounded-full bg-white/50 px-2.5 py-0.5 text-[11px] text-soft">{i.id === 'supabase' && auth === 'signedIn' ? 'เชื่อมต่อแล้ว' : i.id === 'ai' ? 'อ่านภาพ (ผ่าน Edge Function)' : 'ยังไม่เชื่อมต่อ'}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-soft">เตรียมโครงสร้างรองรับไว้แล้ว ยังไม่มีการเชื่อมต่อจริง และจะไม่เก็บ API key ไว้ในแอปฝั่งหน้าเว็บ</p>
      </Card>
      <p className="pb-4 text-center text-[11px] text-soft">BECOMING v0.4 · schema v{s.settings.schemaVersion}</p>

      <Sheet open={!!preview} onClose={() => setPreview(null)} title="ตรวจสอบก่อนนำเข้า">
        {preview && (
          <div className="space-y-3">
            {!preview.ok ? (
              <p className="rounded-2xl bg-[#f6d6d6]/70 p-3 text-sm">{preview.error}</p>
            ) : (
              <>
                {preview.exportedAt && <p className="text-sm text-soft">สำรองเมื่อ {new Date(preview.exportedAt).toLocaleString('th-TH')}</p>}
                <ul className="grid grid-cols-2 gap-1 text-sm">
                  {preview.counts.filter((c) => c.valid || c.invalid).map((c) => (
                    <li key={c.key}>{c.key}: {c.valid}{c.invalid > 0 && <span className="text-[#a0465a]"> (ข้าม {c.invalid})</span>}</li>
                  ))}
                </ul>
                <p className="text-sm">การนำเข้าจะ <b>แทนที่</b> ข้อมูลปัจจุบันทั้งหมดในเครื่องนี้ แนะนำให้สำรองข้อมูลปัจจุบันก่อน</p>
                <div className="flex gap-2">
                  <button className="btn btn-soft flex-1" onClick={doExport}>สำรองของเดิมก่อน</button>
                  <button className="btn btn-primary flex-1" onClick={() => { s.importData(preview.data!); setPreview(null); toast('นำเข้าข้อมูลแล้ว') }}>ยืนยันนำเข้า</button>
                </div>
              </>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title="รีเซ็ตข้อมูลทั้งหมด?">
        <div className="space-y-3">
          <p className="text-sm">ข้อมูลทุกอย่างในเครื่องนี้จะถูกลบและกลับไปเป็นข้อมูลตั้งต้น ย้อนกลับไม่ได้ พิมพ์คำว่า <b>รีเซ็ต</b> เพื่อยืนยัน</p>
          <input className="field" value={resetText} onChange={(e) => setResetText(e.target.value)} aria-label="พิมพ์ รีเซ็ต เพื่อยืนยัน" />
          <button className="btn btn-primary w-full" disabled={resetText.trim() !== 'รีเซ็ต'} onClick={() => { s.resetAll(); setResetOpen(false); setResetText(''); toast('รีเซ็ตแล้ว') }}>รีเซ็ตเลย</button>
        </div>
      </Sheet>
    </div>
  )
}
