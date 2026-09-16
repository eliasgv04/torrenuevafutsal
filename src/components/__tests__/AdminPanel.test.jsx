import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminPanel from '../AdminPanel'
import { api } from '../../lib/api'

vi.mock('../../lib/api', () => ({
  api: {
    getAllTeamsAdmin: vi.fn(), getAccessRequests: vi.fn(), getAllAccounts: vi.fn(), getAppLogs: vi.fn(),
    adminCreateAccount: vi.fn(), rejectAccessRequest: vi.fn(), addTeamToAccount: vi.fn(), removeTeamFromAccount: vi.fn(),
    deleteAccount: vi.fn(), clearAppLogs: vi.fn(), resetAccountPassword: vi.fn()
  }
}))

vi.mock('../ApproveRequestModal', () => ({
  default: ({ request, onSubmit, onCancel }) => (
    <div>approve-{request.id}
      <button onClick={() => onSubmit({ email: 'new@x.com', password: 'p', team_id: null })}>submit-approve</button>
      <button onClick={onCancel}>cancel-approve</button>
    </div>
  )
}))
vi.mock('../ResetPasswordModal', () => ({
  default: ({ account, onSubmit, onCancel }) => (
    <div>reset-{account.id}
      <button onClick={() => onSubmit({ password: 'newpass', notifyEmail: '' })}>submit-reset</button>
      <button onClick={onCancel}>cancel-reset</button>
    </div>
  )
}))
vi.mock('../ConfirmModal', () => ({
  default: ({ title, message, onConfirm, onCancel }) => (
    <div>confirm-{title}: {message}
      <button onClick={onConfirm}>confirm-yes</button>
      <button onClick={onCancel}>confirm-no</button>
    </div>
  )
}))

function setDefaults({ teams = [], requests = [], accounts = [], logs = [] } = {}) {
  api.getAllTeamsAdmin.mockResolvedValue(teams)
  api.getAccessRequests.mockResolvedValue(requests)
  api.getAllAccounts.mockResolvedValue(accounts)
  api.getAppLogs.mockResolvedValue(logs)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('AdminPanel — loading and empty states', () => {
  it('shows a loading message, then the empty states for every section', async () => {
    setDefaults()
    render(<AdminPanel />)
    expect(screen.getByText('Cargando panel de administración...')).toBeInTheDocument()

    expect(await screen.findByText('Sin errores registrados. Bien.')).toBeInTheDocument()
    expect(screen.getByText('No hay solicitudes pendientes.')).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay equipos creados.')).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay cuentas creadas.')).toBeInTheDocument()
  })
})

describe('AdminPanel — error logs', () => {
  it('lists logs and only offers "Vaciar logs" when there is at least one', async () => {
    setDefaults({ logs: [{ id: 'l1', message: 'Fallo raro', code: 'X1', created_at: '2026-03-01', user_email: 'ana@x.com' }] })
    render(<AdminPanel />)
    expect(await screen.findByText('Fallo raro (X1)')).toBeInTheDocument()
    expect(screen.getByText('ana@x.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vaciar logs' })).toBeInTheDocument()
  })

  it('clears the logs after confirming, and reloads', async () => {
    const user = userEvent.setup()
    setDefaults({ logs: [{ id: 'l1', message: 'x', created_at: '2026-03-01' }] })
    api.clearAppLogs.mockResolvedValue()
    render(<AdminPanel />)
    await screen.findByText('x')

    await user.click(screen.getByRole('button', { name: 'Vaciar logs' }))
    expect(screen.getByText(/confirm-Vaciar logs/)).toBeInTheDocument()

    setDefaults({ logs: [] })
    await user.click(screen.getByText('confirm-yes'))
    expect(api.clearAppLogs).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Sin errores registrados. Bien.')).toBeInTheDocument()
  })
})

describe('AdminPanel — access requests', () => {
  const req = { id: 'r1', team_name: 'CD Manchego', contact_name: 'Ana', contact_email: 'ana@x.com', created_at: '2026-03-01', status: 'pending' }

  it('separates pending from resolved requests, with a status label', async () => {
    setDefaults({ requests: [req, { id: 'r2', team_name: 'CD Y', contact_email: 'y@x.com', status: 'approved', created_at: '2026-03-01' }] })
    render(<AdminPanel />)
    expect(await screen.findByText('Solicitudes pendientes (1)')).toBeInTheDocument()
    expect(screen.getByText('Solicitudes resueltas (1)')).toBeInTheDocument()
    expect(screen.getByText('Aprobada')).toBeInTheDocument()
  })

  it('approves a request and shows a warning when the email failed to send', async () => {
    const user = userEvent.setup()
    setDefaults({ requests: [req] })
    api.adminCreateAccount.mockResolvedValue({ email: 'new@x.com', emailSent: false })
    render(<AdminPanel />)
    await screen.findByText('CD Manchego')

    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.getByText('approve-r1')).toBeInTheDocument()

    await user.click(screen.getByText('submit-approve'))
    expect(api.adminCreateAccount).toHaveBeenCalledWith({ email: 'new@x.com', password: 'p', team_id: null, request_id: 'r1' })
    expect(await screen.findByText(/No se pudo enviar el email/)).toBeInTheDocument()
  })

  it('rejects a request after confirming', async () => {
    const user = userEvent.setup()
    setDefaults({ requests: [req] })
    api.rejectAccessRequest.mockResolvedValue()
    render(<AdminPanel />)
    await screen.findByText('CD Manchego')

    await user.click(screen.getByRole('button', { name: 'Rechazar' }))
    await user.click(screen.getByText('confirm-yes'))
    expect(api.rejectAccessRequest).toHaveBeenCalledWith('r1')
  })
})

describe('AdminPanel — accounts', () => {
  const team1 = { id: 't1', name: 'Torrenueva' }
  const team2 = { id: 't2', name: 'Juvenil' }
  const account = { id: 'u1', email: 'ana@x.com', created_at: '2026-01-01', last_sign_in_at: null, is_admin: false, teams: [team1] }

  it('shows "Nunca ha entrado" for an account that never logged in, and an ADMIN badge when relevant', async () => {
    setDefaults({ teams: [team1, team2], accounts: [account, { ...account, id: 'u2', email: 'admin@x.com', is_admin: true, teams: [] }] })
    render(<AdminPanel />)
    expect(await screen.findAllByText('Nunca ha entrado')).toHaveLength(2) // both accounts share this fixture's null last_sign_in_at
    expect(screen.getByText('ADMIN')).toBeInTheDocument()
  })

  it('does not offer a delete button for an admin account', async () => {
    setDefaults({ teams: [], accounts: [{ ...account, is_admin: true }] })
    render(<AdminPanel />)
    await screen.findByText('ana@x.com')
    expect(screen.queryByRole('button', { name: 'Eliminar cuenta' })).not.toBeInTheDocument()
  })

  it('links the account to another team, and unlinks an existing one', async () => {
    const user = userEvent.setup()
    setDefaults({ teams: [team1, team2], accounts: [account] })
    api.addTeamToAccount.mockResolvedValue()
    api.removeTeamFromAccount.mockResolvedValue()
    render(<AdminPanel />)
    await screen.findByText('ana@x.com')

    await user.selectOptions(screen.getByRole('combobox'), 't2')
    await user.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(api.addTeamToAccount).toHaveBeenCalledWith('t2', 'u1')

    await user.click(screen.getByRole('button', { name: 'Quitar acceso a Torrenueva' }))
    expect(api.removeTeamFromAccount).toHaveBeenCalledWith('t1', 'u1')
  })

  it('deletes an account after confirming', async () => {
    const user = userEvent.setup()
    setDefaults({ teams: [team1], accounts: [account] })
    api.deleteAccount.mockResolvedValue()
    render(<AdminPanel />)
    await screen.findByText('ana@x.com')

    await user.click(screen.getByRole('button', { name: 'Eliminar cuenta' }))
    await user.click(screen.getByText('confirm-yes'))
    expect(api.deleteAccount).toHaveBeenCalledWith('u1')
  })

  it('resets a password and shows a plain confirmation when no notify email was set', async () => {
    const user = userEvent.setup()
    setDefaults({ teams: [team1], accounts: [account] })
    api.resetAccountPassword.mockResolvedValue({ email: 'ana@x.com', emailSent: false })
    render(<AdminPanel />)
    await screen.findByText('ana@x.com')

    await user.click(screen.getByRole('button', { name: 'Restablecer contraseña' }))
    await user.click(screen.getByText('submit-reset'))

    expect(api.resetAccountPassword).toHaveBeenCalledWith({ user_id: 'u1', new_password: 'newpass', notify_email: '' })
    expect(await screen.findByText('Contraseña restablecida para ana@x.com.')).toBeInTheDocument()
  })
})
