import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Lightbox from '../Lightbox'

describe('Lightbox', () => {
  it('renders the image with the given src and alt', () => {
    render(<Lightbox src="http://x/photo.png" alt="Rondo" onClose={() => {}} />)
    const img = screen.getByAltText('Rondo')
    expect(img).toHaveAttribute('src', 'http://x/photo.png')
  })

  it('closes when clicking the close button (fires twice: once from the button, once bubbled to the overlay, since the button does not stop propagation)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Lightbox src="x" alt="x" onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('closes when clicking the overlay background directly', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { container } = render(<Lightbox src="x" alt="x" onClose={onClose} />)

    await user.click(container.querySelector('.lightbox-overlay'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when clicking the image itself (click stops propagation)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Lightbox src="x" alt="foto" onClose={onClose} />)

    await user.click(screen.getByAltText('foto'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape, and stops listening once unmounted', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { unmount } = render(<Lightbox src="x" alt="x" onClose={onClose} />)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    unmount()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1) // no further calls after unmount
  })
})
