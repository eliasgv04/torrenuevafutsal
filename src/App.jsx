import React, { useState, useEffect } from 'react'
import HomePage from './pages/HomePage'
import { supabase } from './lib/supabaseClient'
import { api } from './lib/api'
import ChangePasswordModal from './components/ChangePasswordModal'
import LandingPage from './components/LandingPage'
import PitchLines from './components/PitchLines'
import AdminPanel from './components/AdminPanel'
import ProfileMenu from './components/ProfileMenu'
import LegalModal from './components/LegalModal'
import { ArrowLeftIcon } from './components/Icons'

function AuthBrand() {
  return (
    <div className="auth-brand">
      <img src="./futsalkit-icon.svg" alt="" />
      <span>FutsalKit</span>
    </div>
  )
}

// Accounts created before real-email login existed. New accounts (from
// approved access requests) use their real email directly and never need an
// entry here — this map only exists so the 3 original logins keep working.
const LEGACY_USERS = {
  'torrenuevafutsal': 'torrenuevafutsal@torrenuevafutsal.local',
  'rodrijimbee': 'rodrijimbee@torrenuevafutsal.local',
  'davidmanzanares': 'davidmanzanares@torrenuevafutsal.local',
  'admin': 'admin@torrenuevafutsal.local',
}

const EMPTY_REQUEST = { team_name: '', contact_name: '', contact_email: '', message: '', privacy_accepted: false }

export default function App() {
  const [session, setSession] = useState(undefined)
  const [mode, setMode] = useState('landing') // 'landing' | 'login' | 'request' | 'request-sent'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTeam, setActiveTeam] = useState(null)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [requestForm, setRequestForm] = useState(EMPTY_REQUEST)
  const [requestError, setRequestError] = useState('')
  const [requestLoading, setRequestLoading] = useState(false)
  const [legalDoc, setLegalDoc] = useState(null)

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) api.isAdmin().then(setIsAdmin)
    else setIsAdmin(false)
  }, [session])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!supabase) {
      setError('Supabase no configurado')
      setLoading(false)
      return
    }

    const identifier = username.trim()
    const email = LEGACY_USERS[identifier] || identifier

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Credenciales incorrectas')
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function openRequestForm() {
    setRequestForm(EMPTY_REQUEST)
    setRequestError('')
    setMode('request')
  }

  async function handleRequestAccess(e) {
    e.preventDefault()
    setRequestLoading(true)
    setRequestError('')
    try {
      await api.requestAccess(requestForm)
      setMode('request-sent')
    } catch (err) {
      console.error('Error enviando solicitud de acceso:', err)
      setRequestError('No se pudo enviar la solicitud. Inténtalo de nuevo.')
    } finally {
      setRequestLoading(false)
    }
  }

  if (session === undefined) {
    return (
      <div className="login-shell">
        <PitchLines />
        <AuthBrand />
        <div className="login-card"><p>Cargando...</p></div>
      </div>
    )
  }

  if (!session) {
    if (mode === 'landing') {
      return <LandingPage onLogin={() => setMode('login')} onRequestAccess={openRequestForm} />
    }

    if (mode === 'request-sent') {
      return (
        <div className="login-shell">
          <PitchLines />
          <AuthBrand />
          <div className="login-card">
            <h2>Solicitud enviada</h2>
            <p>
              Gracias, hemos recibido la solicitud de acceso para <strong>{requestForm.team_name}</strong>.
              Te contactaremos en breve a {requestForm.contact_email}.
            </p>
            <button className="btn btn-primary login-btn" onClick={() => setMode('login')}>
              Volver al login
            </button>
          </div>
        </div>
      )
    }

    if (mode === 'request') {
      return (
        <div className="login-shell">
          <PitchLines />
          <AuthBrand />
          <div className="login-card">
            <button type="button" className="login-back" onClick={() => setMode('landing')}>
              <ArrowLeftIcon size={14} /> Inicio
            </button>
            <h2>Solicitar acceso</h2>
            <p>Cuéntanos de tu club y te daremos acceso a FutsalKit.</p>
            <form onSubmit={handleRequestAccess}>
              <label htmlFor="req-team">Nombre del equipo/club</label>
              <input
                id="req-team"
                type="text"
                value={requestForm.team_name}
                onChange={(e) => setRequestForm({ ...requestForm, team_name: e.target.value })}
                required
              />
              <label htmlFor="req-name">Tu nombre</label>
              <input
                id="req-name"
                type="text"
                value={requestForm.contact_name}
                onChange={(e) => setRequestForm({ ...requestForm, contact_name: e.target.value })}
                required
              />
              <label htmlFor="req-email">Email de contacto</label>
              <input
                id="req-email"
                type="email"
                value={requestForm.contact_email}
                onChange={(e) => setRequestForm({ ...requestForm, contact_email: e.target.value })}
                required
              />
              <label htmlFor="req-message">Mensaje (opcional)</label>
              <textarea
                id="req-message"
                rows={2}
                value={requestForm.message}
                onChange={(e) => setRequestForm({ ...requestForm, message: e.target.value })}
                placeholder="Cuéntanos algo más si quieres..."
              />
              <label className="exercise-public-toggle" htmlFor="req-privacy" style={{ marginTop: 12 }}>
                <input
                  id="req-privacy"
                  type="checkbox"
                  checked={requestForm.privacy_accepted}
                  onChange={(e) => setRequestForm({ ...requestForm, privacy_accepted: e.target.checked })}
                  required
                />
                <span style={{ fontWeight: 400, fontSize: 13 }}>
                  He leído y acepto la{' '}
                  <button type="button" className="login-link" style={{ fontSize: 13 }} onClick={() => setLegalDoc('privacy')}>
                    política de privacidad
                  </button>
                </span>
              </label>
              {requestError && <p className="login-error">{requestError}</p>}
              <button type="submit" className="btn btn-primary login-btn" disabled={requestLoading}>
                {requestLoading ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </form>
            <p className="login-switch">
              <button type="button" className="login-link" onClick={() => setMode('login')}>
                Ya tengo cuenta, volver al login
              </button>
            </p>
          </div>
          {legalDoc && <LegalModal initialDoc={legalDoc} onClose={() => setLegalDoc(null)} />}
        </div>
      )
    }

    return (
      <div className="login-shell">
        <PitchLines />
        <AuthBrand />
        <div className="login-card">
          <button type="button" className="login-back" onClick={() => setMode('landing')}>
            <ArrowLeftIcon size={14} /> Inicio
          </button>
          <h2>Inicia sesión</h2>
          <p>Introduce tus credenciales para entrar a FutsalKit.</p>
          <form onSubmit={handleLogin}>
            <label htmlFor="login-user">Email</label>
            <input
              id="login-user"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <label htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const bgStart = isAdmin ? '#172554' : (activeTeam?.gradient_start || '#172554')
  const bgEnd   = isAdmin ? '#2563EB' : (activeTeam?.gradient_end   || '#2563EB')
  const teamGradient = `linear-gradient(135deg, ${bgStart} 0%, ${bgEnd} 100%)`

  return (
    <div className="app-root" style={{ background: teamGradient }}>
      <header className="app-header">
        <img src="./futsalkit-icon.svg" alt="FutsalKit" className="logo" />
        <h1>FutsalKit{isAdmin ? ' · Admin' : ''}</h1>
        <div className="app-header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <ProfileMenu
            email={session.user.email}
            isAdmin={isAdmin}
            onChangePassword={() => setShowChangePassword(true)}
            onLogout={handleLogout}
          />
        </div>
      </header>
      <main>
        {isAdmin ? <AdminPanel /> : <HomePage onActiveTeamChange={setActiveTeam} />}
      </main>
      {showChangePassword && (
        <ChangePasswordModal
          onDone={() => setShowChangePassword(false)}
          onCancel={() => setShowChangePassword(false)}
        />
      )}
    </div>
  )
}
