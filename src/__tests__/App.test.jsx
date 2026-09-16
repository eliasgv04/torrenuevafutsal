import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { api } from '../lib/api'

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    updateUser: vi.fn()
  }
}))

vi.mock('../lib/supabaseClient', () => ({ supabase: supabaseMock }))
vi.mock('../lib/api', () => ({ api: { isAdmin: vi.fn(() => Promise.resolve(false)), requestAccess: vi.fn() } }))
vi.mock('../pages/HomePage', () => ({ default: () => <div>home-page</div> }))
vi.mock('../components/AdminPanel', () => ({ default: () => <div>admin-panel</div> }))

beforeEach(() => {
  vi.clearAllMocks()
  supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } })
  supabaseMock.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  api.isAdmin.mockResolvedValue(false)
})

describe('App — logged out', () => {
  it('shows the landing page once the session resolves to null', async () => {
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('logs in with a legacy username mapped to its .local email', async () => {
    const user = userEvent.setup()
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ error: null })
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Entrar' }))

    await user.type(screen.getByLabelText('Email'), 'admin')
    await user.type(screen.getByLabelText('Contraseña'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@torrenuevafutsal.local', password: 'secret'
    })
  })

  it('passes a real email straight through on login', async () => {
    const user = userEvent.setup()
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ error: null })
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Entrar' }))
    await user.type(screen.getByLabelText('Email'), 'ana@club.com')
    await user.type(screen.getByLabelText('Contraseña'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@club.com', password: 'secret' })
  })

  it('shows an error on wrong credentials', async () => {
    const user = userEvent.setup()
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ error: { message: 'invalid' } })
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Entrar' }))
    await user.type(screen.getByLabelText('Email'), 'ana@club.com')
    await user.type(screen.getByLabelText('Contraseña'), 'bad')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Credenciales incorrectas')).toBeInTheDocument()
  })

  it('goes back from the login form to the landing page', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Entrar' }))
    await user.click(screen.getByRole('button', { name: /Inicio/ }))
    expect(screen.getByRole('button', { name: 'Solicitar acceso para tu club' })).toBeInTheDocument()
  })

  it('submits an access request and shows the confirmation screen', async () => {
    const user = userEvent.setup()
    api.requestAccess.mockResolvedValue()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Solicitar acceso para tu club' }))

    await user.type(screen.getByLabelText('Nombre del equipo/club'), 'CD Manchego')
    await user.type(screen.getByLabelText('Tu nombre'), 'Ana')
    await user.type(screen.getByLabelText('Email de contacto'), 'ana@club.com')
    await user.click(screen.getByLabelText(/He leído y acepto/))
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(api.requestAccess).toHaveBeenCalledWith(expect.objectContaining({
      team_name: 'CD Manchego', contact_name: 'Ana', contact_email: 'ana@club.com', privacy_accepted: true
    }))
    expect(await screen.findByText('Solicitud enviada')).toBeInTheDocument()
    expect(screen.getByText(/CD Manchego/)).toBeInTheDocument()
  })

  it('shows an error and stays on the form when the request fails', async () => {
    const user = userEvent.setup()
    api.requestAccess.mockRejectedValue(new Error('down'))
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Solicitar acceso para tu club' }))
    await user.type(screen.getByLabelText('Nombre del equipo/club'), 'CD Manchego')
    await user.type(screen.getByLabelText('Tu nombre'), 'Ana')
    await user.type(screen.getByLabelText('Email de contacto'), 'ana@club.com')
    await user.click(screen.getByLabelText(/He leído y acepto/))
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(await screen.findByText('No se pudo enviar la solicitud. Inténtalo de nuevo.')).toBeInTheDocument()
  })

  it('opens the privacy policy from the request form link', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Solicitar acceso para tu club' }))
    await user.click(screen.getByRole('button', { name: 'política de privacidad' }))
    expect(screen.getByText('1. Responsable del tratamiento')).toBeInTheDocument()
  })
})

describe('App — logged in', () => {
  it('shows the coach home page for a non-admin session', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: { user: { email: 'ana@club.com' } } } })
    render(<App />)
    expect(await screen.findByText('home-page')).toBeInTheDocument()
    expect(screen.queryByText('admin-panel')).not.toBeInTheDocument()
    expect(screen.getByText('FutsalKit')).toBeInTheDocument()
  })

  it('shows the admin panel and an "· Admin" suffix for an admin session', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: { user: { email: 'admin@x.com' } } } })
    api.isAdmin.mockResolvedValue(true)
    render(<App />)
    expect(await screen.findByText('admin-panel')).toBeInTheDocument()
    expect(screen.getByText('FutsalKit · Admin')).toBeInTheDocument()
  })

  it('logs out through the profile menu', async () => {
    const user = userEvent.setup()
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: { user: { email: 'ana@club.com' } } } })
    render(<App />)
    await screen.findByText('home-page')

    await user.click(screen.getByRole('button', { name: 'Cuenta' }))
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(supabaseMock.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('opens and closes the change-password modal from the profile menu', async () => {
    const user = userEvent.setup()
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: { user: { email: 'ana@club.com' } } } })
    render(<App />)
    await screen.findByText('home-page')

    await user.click(screen.getByRole('button', { name: 'Cuenta' }))
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(screen.getByText('Cambiar contraseña')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('Cambiar contraseña')).not.toBeInTheDocument()
  })
})
