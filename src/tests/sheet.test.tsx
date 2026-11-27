import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Sheet } from '../components/ui/Sheet'

describe('Sheet', () => {
  it('keeps focus in a field when the parent re-renders with a new onClose', () => {
    const view = (
      <Sheet open onClose={() => {}} title="บันทึกใหม่">
        <textarea aria-label="เนื้อหา" />
      </Sheet>
    )
    const { getByLabelText, rerender } = render(view)
    const field = getByLabelText('เนื้อหา')
    field.focus()
    expect(document.activeElement).toBe(field)
    // parent re-renders (store sync, clock) and passes a fresh inline onClose
    rerender(
      <Sheet open onClose={() => {}} title="บันทึกใหม่">
        <textarea aria-label="เนื้อหา" />
      </Sheet>,
    )
    expect(document.activeElement).toBe(field)
  })
})
