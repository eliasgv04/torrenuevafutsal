import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResetPasswordModal from '../ResetPasswordModal'

describe('ResetPasswordModal', () => {
  it('shows the account email', () => {
    render(<ResetPasswordModal account={{ email: 'ana@x.com' }} onSubmit={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('ana@x.com')).toBeInTheDocument()
  })

  it('fills the password field with a random value when clicking Generar', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordModal account={{ email: 'ana@x.com' }} onSubmit={() => {}} onCancel={() => {}} />)
    const passwordInput = screen.getByPlaceholderText('Nueva contraseña')
    expect(passwordInput).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Generar' }))
    expect(passwordInput.value.length).toBeGreaterThan(0)
  })

  it('shows an error and never calls onSubmit if the password is empty', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ResetPasswordModal account={{ email: 'ana@x.com' }} onSubmit={onSubmit} onCancel={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Restablecer' }))

    expect(screen.getByText('Escribe una contraseña')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the password and optional notify email', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => Promise.resolve())
    render(<ResetPasswordModal account={{ email: 'ana@x.com' }} onSubmit={onSubmit} onCancel={() => {}} />)

    await user.type(screen.getByPlaceholderText('Nueva contraseña'), 'nueva123')
    await user.type(screen.getByLabelText('Avisar por email (opcional)'), 'club@x.com')
    await user.click(screen.getByRole('button', { name: 'Restablecer' }))

    expect(onSubmit).toHaveBeenCalledWith({ password: 'nueva123', notifyEmail: 'club@x.com' })
  })

  it('shows the server error and re-enables the form when onSubmit rejects', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => Promise.reject(new Error('email inválido')))
    render(<ResetPasswordModal account={{ email: 'ana@x.com' }} onSubmit={onSubmit} onCancel={() => {}} />)

    await user.type(screen.getByPlaceholderText('Nueva contraseña'), 'nueva123')
    await user.click(screen.getByRole('button', { name: 'Restablecer' }))

    expect(await screen.findByText('email inválido')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restablecer' })).not.toBeDisabled()
  })

  it('disables both buttons while saving', async () => {
    const user = userEvent.setup()
    let resolveSubmit
    const onSubmit = vi.fn(() => new Promise((res) => { resolveSubmit = res }))
    render(<ResetPasswordModal account={{ email: 'ana@x.com' }} onSubmit={onSubmit} onCancel={() => {}} />)

    await user.type(screen.getByPlaceholderText('Nueva contraseña'), 'nueva123')
    await user.click(screen.getByRole('button', { name: 'Restablecer' }))

    expect(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()

    resolveSubmit()
  })
})
