import type { Capacity, CompanyTask, SparkPlan } from '../types'

/**
 * Spark — Accountability Partner. Runs AFTER J picked the attention item.
 * Turns an existing Action into a start-now step. Never chooses business priority,
 * never invents new business work: steps are Micro / Execution Steps of the given task.
 */
export function activate(task: CompanyTask, windowMinutes: number, capacity: Capacity): SparkPlan {
  const source = task.steps && task.steps.length > 0 ? task.steps : ['เปิดงานนี้และอ่านสิ่งที่ต้องทำ', 'ทำส่วนที่ง่ายที่สุดก่อน', 'บันทึกว่าค้างตรงไหน']
  const light = capacity.level === 'recovery' || capacity.level === 'light'
  const sprintMinutes = Math.max(5, Math.min(windowMinutes || 5, task.estimatedMinutes, light ? 15 : 25))
  const per = Math.max(2, Math.round(task.estimatedMinutes / source.length))
  const steps = source.map((title, i) => ({
    title,
    minutes: i === 0 ? Math.min(5, per) : per,
    kind: (i === 0 ? 'micro_step' : 'execution_step') as 'micro_step' | 'execution_step',
  }))
  return {
    startNow: `${source[0]} (${steps[0].minutes} นาที)`,
    steps,
    sprintMinutes,
    challenge: task.estimatedMinutes > sprintMinutes ? `ลุย ${sprintMinutes} นาทีแรก แล้วค่อยดูว่าจะไปต่อไหม` : `ทำให้จบใน ${sprintMinutes} นาที`,
    reward: 'เสร็จแล้วได้ XP และพักฟังเพลงโปรด 1 เพลง',
  }
}

/** When nothing fits the window, Spark slices the top Action into a micro step that fits. */
export function microStepFor(task: CompanyTask, windowMinutes: number): { title: string; minutes: number } {
  const first = task.steps?.[0] ?? 'เปิดงานและเขียนว่าขั้นแรกคืออะไร'
  return { title: `ขั้นแรกของ "${task.title}": ${first}`, minutes: Math.max(5, Math.min(windowMinutes, 15)) }
}
