import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApproveRequestModal from '../ApproveRequestModal'

const request = { team_name: 'CD Manchego', contact_name: 'Luis', contact_email: 'luis@x.com' }
const teams = [{ id: 't1', name: 'Torrenueva' }, { id: 't2', name: 'Juvenil' }]

describe('ApproveRequestModal', () => {
  // The "Email de acceso" <label> has no htmlFor/id pairing with its <input>
  // in the component, so getByLabelText can't find it — falling back to a
  // direct query instead of treating this as accessible.
  function getEmailInput(container) {
    return container.querySelector('input[type="email"]')
  }

  it('shows the request details and pre-fills the email field', () => {
    const { container } = render(<ApproveRequestModal request={request} teams={teams} onSubmit={() => {}} onCancel={() => {}} />)
    expect(screen.getByText(/CD Manchego/)).toBeInTheDocument()
    expect(screen.getByText(/Luis/)).toBeInTheDocument()
    expect(getEmailInput(container)).toHaveValue('luis@x.com')
  })

  it('requires both email and password before submitting', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const { container } = render(<ApproveRequestModal request={request} teams={teams} onSubmit={onSubmit} onCancel={() => {}} />)

    await user.clear(getEmailInput(container))
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(screen.getByText('Email y contraseña son obligatorios')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits with team_id null when no team is selected', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => Promise.resolve())
    render(<ApproveRequestModal request={request} teams={teams} onSubmit={onSubmit} onCancel={() => {}} />)

    await user.type(screen.getByPlaceholderText('Contraseña'), 'pass123')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(onSubmit).toHaveBeenCalledWith({ email: 'luis@x.com', password: 'pass123', team_id: null })
  })

  it('submits the selected team id', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => Promise.resolve())
    render(<ApproveRequestModal request={request} teams={teams} onSubmit={onSubmit} onCancel={() => {}} />)

    await user.type(screen.getByPlaceholderText('Contraseña'), 'pass123')
    await user.selectOptions(screen.getByLabelText('Equipo a vincular'), 't2')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(onSubmit).toHaveBeenCalledWith({ email: 'luis@x.com', password: 'pass123', team_id: 't2' })
  })

  it('shows the error message when creation fails', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => Promise.reject(new Error('ya existe una cuenta con ese email')))
    render(<ApproveRequestModal request={request} teams={teams} onSubmit={onSubmit} onCancel={() => {}} />)

    await user.type(screen.getByPlaceholderText('Contraseña'), 'pass123')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('ya existe una cuenta con ese email')).toBeInTheDocument()
  })

  it('calls onCancel when clicking Cancelar', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ApproveRequestModal request={request} teams={teams} onSubmit={() => {}} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
