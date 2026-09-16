import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import * as Icons from '../Icons'

const iconNames = Object.keys(Icons)

describe('Icons', () => {
  it('exports at least one icon component', () => {
    expect(iconNames.length).toBeGreaterThan(0)
  })

  it.each(iconNames)('%s renders an svg with the default size and default stroke color', (name) => {
    const Icon = Icons[name]
    const { container } = render(<Icon />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '16')
    expect(svg).toHaveAttribute('height', '16')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
  })

  it('applies a custom size, color and style, and forwards extra props', () => {
    const { container } = render(<Icons.XIcon size={32} color="#ff0000" style={{ opacity: 0.5 }} aria-label="close" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '32')
    expect(svg).toHaveAttribute('height', '32')
    expect(svg).toHaveAttribute('stroke', '#ff0000')
    expect(svg).toHaveAttribute('aria-label', 'close')
    expect(svg.style.opacity).toBe('0.5')
  })
})
