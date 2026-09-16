import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LandingPage from '../LandingPage'

vi.mock('../LegalModal', () => ({
  default: ({ initialDoc, onClose }) => (
    <div>
      legal-modal-{initialDoc}
      <button onClick={onClose}>cerrar-legal</button>
    </div>
  )
}))

describe('LandingPage', () => {
  it('calls onLogin and onRequestAccess from their respective buttons', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn()
    const onRequestAccess = vi.fn()
    render(<LandingPage onLogin={onLogin} onRequestAccess={onRequestAccess} />)

    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(onLogin).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Solicitar acceso para tu club' }))
    expect(onRequestAccess).toHaveBeenCalledTimes(1)
  })

  it('does not show the legal modal until a footer link is clicked', () => {
    render(<LandingPage onLogin={() => {}} onRequestAccess={() => {}} />)
    expect(screen.queryByText(/legal-modal-/)).not.toBeInTheDocument()
  })

  it('opens the privacy policy doc', async () => {
    const user = userEvent.setup()
    render(<LandingPage onLogin={() => {}} onRequestAccess={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Política de privacidad' }))
    expect(screen.getByText('legal-modal-privacy')).toBeInTheDocument()
  })

  it('opens the legal notice doc, and can be closed', async () => {
    const user = userEvent.setup()
    render(<LandingPage onLogin={() => {}} onRequestAccess={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Aviso legal' }))
    expect(screen.getByText('legal-modal-legal')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'cerrar-legal' }))
    expect(screen.queryByText(/legal-modal-/)).not.toBeInTheDocument()
  })
})
