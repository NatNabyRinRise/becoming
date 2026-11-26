import type { LabIdea } from '../types'

/**
 * Muse — Creative Partner. Expands ideas. Anything Muse proposes stays a Suggestion;
 * it never becomes a committed project or task by itself.
 */
export function expandIdea(idea: LabIdea): { expansion: string[]; angle: string; experiment: string; alternative: string } {
  const creative = idea.tags.some((t) => t === 'brand' || t === 'creative')
  return {
    expansion: [
      `ใครคือคนแรกที่ได้ประโยชน์จาก "${idea.title}"?`,
      'เวอร์ชันที่เล็กที่สุดที่ทำได้ในสัปดาห์เดียวหน้าตาเป็นอย่างไร?',
      creative ? 'เรื่องเล่าจริงของเธอเรื่องไหนเข้ากับไอเดียนี้ที่สุด?' : 'มีคนทำคล้าย ๆ แล้วหรือยัง ต่างกันตรงไหน?',
    ],
    angle: creative ? 'เล่าจากมุม "แม่ที่ทำธุรกิจจริง" ไม่ใช่ผู้เชี่ยวชาญ' : 'มองเป็นการทดลองเล็ก ไม่ใช่ธุรกิจใหม่',
    experiment: 'ถามลูกค้าจริง 3 คนว่าจะใช้/จ่ายไหม ก่อนลงแรงสร้าง',
    alternative: 'รวมเข้ากับสิ่งที่ทำอยู่แล้วแทนการเริ่มใหม่',
  }
}
