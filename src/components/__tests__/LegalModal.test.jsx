import { vi, describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LegalModal from '../LegalModal'

describe('LegalModal', () => {
  it('shows the privacy policy by default', () => {
    render(<LegalModal onClose={() => {}} />)
    expect(screen.getByText('1. Responsable del tratamiento')).toBeInTheDocument()
  })

  it('shows the legal notice when initialDoc is "legal"', () => {
    render(<LegalModal initialDoc="legal" onClose={() => {}} />)
    expect(screen.getByText('1. Datos identificativos')).toBeInTheDocument()
  })

  it('switches between the two documents via the tab buttons', async () => {
    const user = userEvent.setup()
    render(<LegalModal onClose={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Aviso legal' }))
    expect(screen.getByText('1. Datos identificativos')).toBeInTheDocument()
    expect(screen.queryByText('1. Responsable del tratamiento')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Política de privacidad' }))
    expect(screen.getByText('1. Responsable del tratamiento')).toBeInTheDocument()
  })

  it('closes on overlay click and on the Cerrar button, but not on a click inside the content', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { container } = render(<LegalModal onClose={onClose} />)

    await user.click(screen.getByText('1. Responsable del tratamiento'))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(container.querySelector('.modal-overlay'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
