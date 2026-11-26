import { describe, expect, it } from 'vitest'
import { PIN_LIMIT, changedSinceSent, ideaPush, microTasksOf, nextPin, projectPush, sortProjects } from '../features/founder/sandbox'
import type { Project, Task } from '../types'

const proj = (id: string, createdAt: string, extra: Partial<Project> = {}): Project => ({
  id, missionId: 'empire', title: `P ${id}`, description: '', status: 'active', isPrimaryBusiness: false, priority: 'medium', milestones: [], createdAt, updatedAt: createdAt, ...extra,
})

describe('Founder sandbox', () => {
  it('sorts pinned first, then newest to oldest', () => {
    const ps = [proj('a', '2026-01-01T00:00:00Z'), proj('b', '2026-03-01T00:00:00Z'), proj('c', '2026-02-01T00:00:00Z', { pinnedAt: '2026-04-01T00:00:00Z' })]
    expect(sortProjects(ps).map((p) => p.id)).toEqual(['c', 'b', 'a'])
  })

  it('allows at most 5 pins and always allows unpinning', () => {
    const ps = Array.from({ length: 6 }, (_, i) => proj(`p${i}`, '2026-01-01T00:00:00Z', i < PIN_LIMIT ? { pinnedAt: '2026-01-02T00:00:00Z' } : {}))
    expect(nextPin(ps, 'p5', 'now')).toBe('limit')
    expect(nextPin(ps, 'p0', 'now')).toBeNull()
    expect(nextPin(ps.slice(1), 'p5', 'now')).toBe('now')
  })

  it('falls back to linked task titles until micro tasks are edited', () => {
    const p = proj('x', '2026-01-01T00:00:00Z')
    const tasks = [{ id: 't1', projectId: 'x', title: 'โทรหาลูกค้า', status: 'todo' }, { id: 't2', projectId: 'x', title: 'เก่า', status: 'archived' }] as unknown as Task[]
    expect(microTasksOf(p, tasks).map((m) => m.title)).toEqual(['โทรหาลูกค้า'])
    expect(microTasksOf({ ...p, microTasks: [] }, tasks)).toEqual([])
  })

  it('builds a plain-text push payload', () => {
    const p = proj('x', '2026-01-01T00:00:00Z', { title: ' Shop ', description: 'ขายของ', milestones: [{ id: 'm', title: 'เปิดร้าน', done: true }, { id: 'e', title: ' ', done: false }] })
    expect(projectPush(p, [{ id: '1', title: 'ถ่ายรูป' }, { id: '2', title: '' }])).toEqual({ kind: 'project', title: 'Shop', description: 'ขายของ', milestones: [{ title: 'เปิดร้าน', done: true }], microTasks: ['ถ่ายรูป'] })
    expect(ideaPush('หัวข้อ\nรายละเอียด')).toMatchObject({ kind: 'idea', title: 'หัวข้อ', description: 'รายละเอียด' })
  })

  it('notices edits made after the last send', () => {
    expect(changedSinceSent('2026-01-01T00:00:00Z', null)).toBe(true)
    expect(changedSinceSent('2026-01-01T00:00:01Z', { sentAt: '2026-01-01T00:00:00Z' })).toBe(false)
    expect(changedSinceSent('2026-01-02T00:00:00Z', { sentAt: '2026-01-01T00:00:00Z' })).toBe(true)
  })
})
