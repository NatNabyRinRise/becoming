import { useState } from 'react'
import { Cloud, CloudOff, LogOut, RefreshCw, Mail, KeyRound } from 'lucide-react'
import { PageHeader, Card, Segmented } from '../../components/ui/controls'
import { Sheet } from '../../components/ui/Sheet'
import { useUI } from '../../store/useUI'
import { useAuth } from '../../sync/useAuth'
import { resolveConflict, sendMagicLink, signIn, signOut, signUp, syncNow } from '../../sync/engine'
import { buildConfig, checkConfig, getConfig, saveRuntimeConfig } from '../../sync/supabase'

const SYNC_TH = { idle: 'รอซิงก์', syncing: 'กำลังซิงก์…', synced: 'ซิงก์แล้ว', offline: 'ออฟไลน์ (จะซิงก์เมื่อออนไลน์)', error: 'ซิงก์ไม่สำเร็จ' } as const

export function AccountPage() {
  const a = useAuth()
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader eyebrow="Account" title="บัญชีและการซิงก์" back />
      {a.status === 'unconfigured' && <SetupCard />}
      {a.status === 'loading' && <Card><p className="text-sm text-soft">กำลังตรวจสอบการเข้าสู่ระบบ…</p></Card>}
      {a.status === 'signedOut' && <SignInCard />}
      {a.status === 'signedIn' && <SignedInCard />}
      <Card className="space-y-2 text-sm text-soft">
        <h2 className="text-base text-ink">ข้อมูลเก็บที่ไหน</h2>
        <p>แอปยังเก็บข้อมูลในเครื่องเสมอ ใช้งานได้แม้ออฟไลน์ เมื่อเข้าสู่ระบบ ข้อมูลจะสำรองขึ้นคลาวด์ (Supabase) ของเธอและซิงก์ไปทุกเครื่องที่ล็อกอินบัญชีเดียวกัน</p>
        <p>ข้อมูลของแต่ละบัญชีถูกล็อกด้วยกฎ Row Level Security คนอื่นอ่านไม่ได้</p>
      </Card>
    </div>
  )
}

function SetupCard() {
  const [url, setUrl] = useState(getConfig()?.url ?? '')
  const [key, setKey] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const save = () => {
    const e = checkConfig({ url, anonKey: key })
    setErr(e)
    if (e) return
    saveRuntimeConfig({ url, anonKey: key })
    location.reload()
  }
  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 text-base"><CloudOff size={18} /> ยังไม่ได้เชื่อม Supabase</h2>
      <p className="text-sm text-soft">ใส่ Project URL และ anon / publishable key จาก Supabase → Project Settings → API (ใส่ครั้งเดียวต่อเครื่อง หรือให้ทีมใส่ไว้ในแอปให้)</p>
      <label className="block"><span className="label">Project URL</span><input className="field mt-1" placeholder="https://xxxx.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
      <label className="block"><span className="label">anon / publishable key</span><input className="field mt-1" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" /></label>
      <p className="text-[11px] text-soft">ห้ามใส่ service_role / secret key</p>
      {err && <p className="rounded-2xl bg-[#f6d6d6]/70 p-3 text-sm">{err}</p>}
      <button className="btn btn-primary w-full" onClick={save} disabled={!url || !key}>เชื่อมต่อ</button>
    </Card>
  )
}

function SignInCard() {
  const toast = useUI((u) => u.showToast)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setErr(null)
    setInfo(null)
    if (mode === 'in') {
      const e = await signIn(email.trim(), pw)
      if (e) setErr(e)
      else toast('เข้าสู่ระบบแล้ว กำลังซิงก์ข้อมูล')
    } else {
      const r = await signUp(email.trim(), pw)
      if (r.error) setErr(r.error)
      else if (r.needsConfirm) setInfo('ส่งอีเมลยืนยันแล้ว เปิดลิงก์ในอีเมล แล้วกลับมาเข้าสู่ระบบ')
      else toast('สร้างบัญชีแล้ว')
    }
    setBusy(false)
  }
  const magic = async () => {
    setBusy(true)
    setErr(null)
    const e = await sendMagicLink(email.trim())
    if (e) setErr(e)
    else setInfo('ส่งลิงก์เข้าสู่ระบบไปที่อีเมลแล้ว เปิดลิงก์จากเครื่องนี้ได้เลย')
    setBusy(false)
  }
  const validEmail = /\S+@\S+\.\S+/.test(email)
  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 text-base"><Cloud size={18} /> เข้าสู่ระบบเพื่อใช้ข้อมูลเดียวกันทุกเครื่อง</h2>
      <p className="text-sm text-soft">ข้อมูลที่อยู่ในเครื่องนี้ตอนนี้จะถูกย้ายขึ้นบัญชีให้อัตโนมัติในครั้งแรก</p>
      <Segmented label="โหมด" value={mode} onChange={setMode} options={[{ id: 'in', label: 'เข้าสู่ระบบ' }, { id: 'up', label: 'สร้างบัญชี' }]} />
      <label className="block"><span className="label">อีเมล</span><input type="email" autoComplete="email" className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="block"><span className="label">รหัสผ่าน</span><input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} className="field mt-1" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && validEmail && pw && submit()} /></label>
      {err && <p className="rounded-2xl bg-[#f6d6d6]/70 p-3 text-sm">{err}</p>}
      {info && <p className="rounded-2xl bg-white/60 p-3 text-sm">{info}</p>}
      <button className="btn btn-primary w-full" disabled={busy || !validEmail || pw.length < 6} onClick={submit}><KeyRound size={16} /> {mode === 'in' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'}</button>
      <button className="btn btn-soft w-full" disabled={busy || !validEmail} onClick={magic}><Mail size={16} /> ส่งลิงก์เข้าสู่ระบบทางอีเมล (ไม่ต้องใช้รหัสผ่าน)</button>
    </Card>
  )
}

function SignedInCard() {
  const a = useAuth()
  const [outOpen, setOutOpen] = useState(false)
  const toast = useUI((u) => u.showToast)
  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 text-base"><Cloud size={18} /> เข้าสู่ระบบแล้ว</h2>
      <p className="text-sm">{a.user?.email}</p>
      <p className="text-sm text-soft">
        สถานะ: {SYNC_TH[a.sync]}
        {a.lastSyncedAt && ` · ล่าสุด ${new Date(a.lastSyncedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`}
      </p>
      {a.error && <p className="rounded-2xl bg-[#f6d6d6]/70 p-3 text-sm">{a.error}{/relation|does not exist|schema cache/i.test(a.error) && ' — ยังไม่ได้รัน SQL schema ใน Supabase'}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-soft" onClick={() => void syncNow()} disabled={a.sync === 'syncing'}><RefreshCw size={16} /> ซิงก์ตอนนี้</button>
        <button className="btn btn-ghost" onClick={() => setOutOpen(true)}><LogOut size={16} /> ออกจากระบบ</button>
      </div>
      {!buildConfig() && <button className="text-[11px] text-soft underline" onClick={() => { saveRuntimeConfig(null); location.reload() }}>เปลี่ยนโปรเจกต์ Supabase</button>}
      <Sheet open={outOpen} onClose={() => setOutOpen(false)} title="ออกจากระบบ">
        <div className="space-y-2">
          <button className="btn btn-soft w-full" onClick={async () => { await signOut(false); setOutOpen(false); toast('ออกจากระบบแล้ว ข้อมูลยังอยู่ในเครื่องนี้') }}>ออกจากระบบ (เก็บข้อมูลในเครื่องไว้)</button>
          <button className="btn btn-ghost w-full text-[#a0465a]" onClick={async () => { await signOut(true); setOutOpen(false); toast('ออกจากระบบและล้างข้อมูลในเครื่องนี้แล้ว') }}>ออกจากระบบ และลบข้อมูลในเครื่องนี้ (เครื่องที่ใช้ร่วมกับคนอื่น)</button>
          <p className="text-[11px] text-soft">ข้อมูลบนคลาวด์ยังอยู่ครบ เข้าสู่ระบบใหม่เมื่อไหร่ก็กลับมา</p>
        </div>
      </Sheet>
    </Card>
  )
}

export function SyncConflictSheet() {
  const c = useAuth((s) => s.conflict)
  const set = useAuth((s) => s.set)
  const [busy, setBusy] = useState(false)
  if (!c) return null
  const when = new Date(c.remoteUpdatedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
  const pick = async (v: 'cloud' | 'device') => {
    setBusy(true)
    await resolveConflict(v)
    setBusy(false)
  }
  return (
    <Sheet open onClose={() => set({ conflict: null })} title={c.firstLogin ? 'บัญชีนี้มีข้อมูลบนคลาวด์อยู่แล้ว' : 'ข้อมูลถูกแก้จากอีกเครื่อง'}>
      <div className="space-y-3">
        <p className="text-sm">
          {c.firstLogin ? 'เครื่องนี้ก็มีข้อมูลของตัวเองด้วย' : 'ระหว่างที่เครื่องนี้ออฟไลน์ มีการแก้ไขจากเครื่องอื่น'} ข้อมูลบนคลาวด์อัปเดตล่าสุด {when} เลือกว่าจะใช้ชุดไหน
        </p>
        <button className="btn btn-primary w-full" disabled={busy} onClick={() => pick('cloud')}>ใช้ข้อมูลบนคลาวด์ (แนะนำ)</button>
        <button className="btn btn-soft w-full" disabled={busy} onClick={() => pick('device')}>ใช้ข้อมูลในเครื่องนี้ แทนที่บนคลาวด์</button>
        <p className="text-[11px] text-soft">ชุดที่ไม่ได้เลือกในเครื่องนี้จะถูกสำรองไว้ในเบราว์เซอร์ ความจำและบันทึกพฤติกรรมของ Intelligence Core จะถูกรวมกันทั้งสองฝั่ง ไม่หาย</p>
      </div>
    </Sheet>
  )
}
