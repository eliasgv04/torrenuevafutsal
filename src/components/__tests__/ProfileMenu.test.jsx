import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileMenu from '../ProfileMenu'

describe('ProfileMenu', () => {
  it('starts closed, without the dropdown in the DOM', () => {
    render(<ProfileMenu email="ana@x.com" isAdmin={false} onChangePassword={() => {}} onLogout={() => {}} />)
    expect(screen.queryByText('ana@x.com')).not.toBeInTheDocument()
  })

  it('opens on click, showing the email, and the Admin badge only for admins', async () => {
    const user = userEvent.setup()
    render(<ProfileMenu email="ana@x.com" isAdmin={true} onChangePassword={() => {}} onLogout={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Cuenta' }))

    expect(screen.getByText('ana@x.com')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('hides the Admin badge for a non-admin account', async () => {
    const user = userEvent.setup()
    render(<ProfileMenu email="ana@x.com" isAdmin={false} onChangePassword={() => {}} onLogout={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Cuenta' }))
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('calls onChangePassword and closes the dropdown', async () => {
    const user = userEvent.setup()
    const onChangePassword = vi.fn()
    render(<ProfileMenu email="ana@x.com" isAdmin={false} onChangePassword={onChangePassword} onLogout={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Cuenta' }))
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(onChangePassword).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('ana@x.com')).not.toBeInTheDocument()
  })

  it('calls onLogout when clicking Cerrar sesión', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    render(<ProfileMenu email="ana@x.com" isAdmin={false} onChangePassword={() => {}} onLogout={onLogout} />)

    await user.click(screen.getByRole('button', { name: 'Cuenta' }))
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('closes when clicking outside the menu', async () => {
    const user = userEvent.setup()
    render(<ProfileMenu email="ana@x.com" isAdmin={false} onChangePassword={() => {}} onLogout={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Cuenta' }))
    expect(screen.getByText('ana@x.com')).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.queryByText('ana@x.com')).not.toBeInTheDocument()
  })
})
