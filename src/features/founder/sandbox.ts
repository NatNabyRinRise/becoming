import type { MicroTaskText, Project, Task } from '../../types'

/** Founder Mode is Eve's own sandbox. Projects can be sent to Notion one way; nothing comes back. */
export const PIN_LIMIT = 5

const time = (s: string | null | undefined) => (s ? Date.parse(s) || 0 : 0)

/** Pinned first, then newest → oldest. */
export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const pa = a.pinnedAt ? 1 : 0
    const pb = b.pinnedAt ? 1 : 0
    if (pa !== pb) return pb - pa
    return time(b.createdAt) - time(a.createdAt)
  })
}

export function pinnedCount(projects: Project[]): number {
  return projects.filter((p) => p.pinnedAt).length
}

/** New pinnedAt for a toggle, or 'limit' when 5 are already pinned. */
export function nextPin(projects: Project[], id: string, now: string): string | null | 'limit' {
  const p = projects.find((x) => x.id === id)
  if (!p) return null
  if (p.pinnedAt) return null
  return pinnedCount(projects) >= PIN_LIMIT ? 'limit' : now
}

/** Text micro tasks. Projects made before the sandbox show their linked tasks' titles until first edit. */
export function microTasksOf(p: Project, tasks: Task[]): MicroTaskText[] {
  if (p.microTasks) return p.microTasks
  return tasks.filter((t) => t.projectId === p.id && t.status !== 'archived').map((t) => ({ id: `t:${t.id}`, title: t.title }))
}

export interface NotionPushItem {
  kind: 'project' | 'idea'
  title: string
  description: string
  milestones: { title: string; done: boolean }[]
  microTasks: string[]
}

export function projectPush(p: Project, micro: MicroTaskText[]): NotionPushItem {
  return {
    kind: 'project',
    title: p.title.trim(),
    description: p.description.trim(),
    milestones: p.milestones.filter((m) => m.title.trim()).map((m) => ({ title: m.title.trim(), done: m.done })),
    microTasks: micro.map((m) => m.title.trim()).filter(Boolean),
  }
}

export function ideaPush(text: string): NotionPushItem {
  const t = text.trim()
  const [first, ...rest] = t.split('\n')
  return { kind: 'idea', title: first.slice(0, 120), description: rest.join('\n').trim() || (first.length > 120 ? t : ''), milestones: [], microTasks: [] }
}

/** Edited since the last send? */
export function changedSinceSent(updatedAt: string, sent: { sentAt: string } | null | undefined): boolean {
  return !sent || time(updatedAt) - time(sent.sentAt) > 2000
}
