import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PitchLines from '../PitchLines'

describe('PitchLines', () => {
  it('renders as a purely decorative, hidden-from-screen-readers backdrop', () => {
    const { container } = render(<PitchLines />)
    const wrapper = container.querySelector('.pitch-lines')
    expect(wrapper).toHaveAttribute('aria-hidden', 'true')
  })

  it('draws the center circle/line and both goal areas', () => {
    const { container } = render(<PitchLines />)
    expect(container.querySelectorAll('circle')).toHaveLength(2)
    expect(container.querySelectorAll('line')).toHaveLength(1)
    expect(container.querySelectorAll('rect')).toHaveLength(2)
  })
})
