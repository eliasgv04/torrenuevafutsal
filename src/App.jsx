import React, { useState, useEffect } from 'react'
import HomePage from './pages/HomePage'
import { supabase } from './lib/supabaseClient'
import { api } from './lib/api'
import ChangePasswordModal from './components/ChangePasswordModal'
import LandingPage from './components/LandingPage'
import PitchLines from './components/PitchLines'
import AdminPanel from './components/AdminPanel'
import ProfileMenu from './components/ProfileMenu'
import PlansSection from './components/PlansSection'
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

export default function App() {
  const [session, setSession] = useState(undefined)
  const [mode, setMode] = useState('landing') // 'landing' | 'login' | 'register' | 'register-sent'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTeam, setActiveTeam] = useState(null)
  const [showChangePassword, setShowChangePassword] = useState(false)

  // isAdmin/hasPlan are resolved together so the dashboard never flashes
  // before we know whether this account is allowed in — `checked` gates
  // that combined loading state.
  const [access, setAccess] = useState({ checked: false, isAdmin: false, hasPlan: false })
  const [confirmingPayment, setConfirmingPayment] = useState(false)

  const [registerForm, setRegisterForm] = useState({ email: '', password: '', confirm: '' })
  const [registerError, setRegisterError] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)

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
    if (!session) { setAccess({ checked: false, isAdmin: false, hasPlan: false }); return }
    let cancelled = false

    async function resolveAccess() {
      const isAdmin = await api.isAdmin()
      if (cancelled) return

      // Stripe redirects back here right after a successful payment, but the
      // webhook that actually activates the plan runs separately and can
      // land a beat later — poll briefly instead of bouncing a freshly-paid
      // coach back to the plan picker while it catches up.
      const justPaid = new URLSearchParams(window.location.search).get('checkout') === 'success'
      if (justPaid) window.history.replaceState({}, '', window.location.pathname)

      let hasPlan = await api.hasActivePlan()
      if (justPaid && !hasPlan && !isAdmin) {
        setConfirmingPayment(true)
        for (let i = 0; i < 6 && !hasPlan && !cancelled; i++) {
          await new Promise((r) => setTimeout(r, 1500))
          hasPlan = await api.hasActivePlan()
        }
      }

      if (!cancelled) {
        setConfirmingPayment(false)
        setAccess({ checked: true, isAdmin, hasPlan })
      }
    }

    resolveAccess()
    return () => { cancelled = true }
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

  function openRegister() {
    setRegisterForm({ email: '', password: '', confirm: '' })
    setRegisterError('')
    setMode('register')
  }

  async function handleRegister(e) {
    e.preventDefault()
    setRegisterError('')
    if (registerForm.password.length < 6) {
      setRegisterError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (registerForm.password !== registerForm.confirm) {
      setRegisterError('Las contraseñas no coinciden')
      return
    }
    setRegisterLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: registerForm.email.trim(),
      password: registerForm.password,
    })
    setRegisterLoading(false)
    if (error) {
      setRegisterError(error.message === 'User already registered' ? 'Ya existe una cuenta con ese email' : 'No se pudo crear la cuenta. Inténtalo de nuevo.')
      return
    }
    // If email confirmation is required, signUp returns no session yet —
    // the auth listener will pick it up automatically once confirmed and
    // logged in, landing them straight on the plan picker below.
    if (!data.session) setMode('register-sent')
  }

  async function handleChoosePlan(planId) {
    setRegisterError('')
    try {
      const { url } = await api.startCheckout(planId)
      window.location.href = url
    } catch (err) {
      console.error('No se pudo iniciar el pago:', err)
      setRegisterError('Los pagos todavía no están activos. Vuelve a intentarlo en unos días.')
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
      return (
        <LandingPage
          onLogin={() => setMode('login')}
          onRegister={openRegister}
          onSelectPlan={openRegister}
        />
      )
    }

    if (mode === 'register-sent') {
      return (
        <div className="login-shell">
          <PitchLines />
          <AuthBrand />
          <div className="login-card">
            <h2>Revisa tu email</h2>
            <p>
              Te hemos enviado un enlace de confirmación a <strong>{registerForm.email}</strong>.
              Confírmalo y vuelve aquí para elegir tu plan.
            </p>
            <button className="btn btn-primary login-btn" onClick={() => setMode('login')}>
              Volver al login
            </button>
          </div>
        </div>
      )
    }

    if (mode === 'register') {
      return (
        <div className="login-shell">
          <PitchLines />
          <AuthBrand />
          <div className="login-card">
            <button type="button" className="login-back" onClick={() => setMode('landing')}>
              <ArrowLeftIcon size={14} /> Inicio
            </button>
            <h2>Crear cuenta</h2>
            <p>Regístrate y a continuación elige tu plan para empezar.</p>
            <form onSubmit={handleRegister}>
              <label htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                autoComplete="email"
                required
              />
              <label htmlFor="reg-password">Contraseña</label>
              <input
                id="reg-password"
                type="password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                autoComplete="new-password"
                required
              />
              <label htmlFor="reg-confirm">Repite la contraseña</label>
              <input
                id="reg-confirm"
                type="password"
                value={registerForm.confirm}
                onChange={(e) => setRegisterForm({ ...registerForm, confirm: e.target.value })}
                autoComplete="new-password"
                required
              />
              {registerError && <p className="login-error">{registerError}</p>}
              <button type="submit" className="btn btn-primary login-btn" disabled={registerLoading}>
                {registerLoading ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>
            <p className="login-switch">
              <button type="button" className="login-link" onClick={() => setMode('login')}>
                Ya tengo cuenta, volver al login
              </button>
            </p>
          </div>
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

  if (!access.checked) {
    return (
      <div className="login-shell">
        <PitchLines />
        <AuthBrand />
        <div className="login-card">
          <p>{confirmingPayment ? 'Confirmando tu pago...' : 'Cargando...'}</p>
        </div>
      </div>
    )
  }

  if (!access.isAdmin && !access.hasPlan) {
    return (
      <div className="login-shell" style={{ height: 'auto', minHeight: '100dvh' }}>
        <PitchLines />
        <AuthBrand />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 640, padding: '0 12px' }}>
          <h2 style={{ color: '#fff', fontFamily: "'Poppins', sans-serif" }}>Elige tu plan para continuar</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)' }}>
            Sesión iniciada como <strong>{session.user.email}</strong>. Elige un plan para desbloquear tu cuenta.
          </p>
          {registerError && <p className="login-error" style={{ maxWidth: 420, margin: '0 auto' }}>{registerError}</p>}
        </div>
        <PlansSection
          ctaLabel="Pagar y activar"
          onSelectPlan={handleChoosePlan}
        />
        <button type="button" className="landing-footer-link" style={{ position: 'relative', zIndex: 1, marginTop: 8, fontSize: 13 }} onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    )
  }

  const bgStart = access.isAdmin ? '#172554' : (activeTeam?.gradient_start || '#172554')
  const bgEnd   = access.isAdmin ? '#2563EB' : (activeTeam?.gradient_end   || '#2563EB')
  const teamGradient = `linear-gradient(135deg, ${bgStart} 0%, ${bgEnd} 100%)`

  return (
    <div className="app-root" style={{ background: teamGradient }}>
      <header className="app-header">
        <img src="./futsalkit-icon.svg" alt="FutsalKit" className="logo" />
        <h1>FutsalKit{access.isAdmin ? ' · Admin' : ''}</h1>
        <div className="app-header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <ProfileMenu
            email={session.user.email}
            isAdmin={access.isAdmin}
            onChangePassword={() => setShowChangePassword(true)}
            onLogout={handleLogout}
          />
        </div>
      </header>
      <main>
        {access.isAdmin ? <AdminPanel /> : <HomePage onActiveTeamChange={setActiveTeam} />}
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
