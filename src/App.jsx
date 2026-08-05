import React, { useState, useEffect } from 'react'
import HomePage from './pages/HomePage'
import { supabase } from './lib/supabaseClient'

// Each authorized login maps to its own real Supabase Auth account (email).
// Registration stays disabled — new access is granted by adding an entry
// here plus creating the matching user directly in Supabase.
const VALID_USERS = {
  'torrenuevafutsal': 'torrenuevafutsal@torrenuevafutsal.local',
  'rodrijimbee': 'rodrijimbee@torrenuevafutsal.local',
  'davidmanzanares': 'davidmanzanares@torrenuevafutsal.local',
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTeam, setActiveTeam] = useState(null)

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

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!supabase) {
      setError('Supabase no configurado')
      setLoading(false)
      return
    }

    const email = VALID_USERS[username.trim()]
    if (!email) {
      setError('Credenciales incorrectas')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Credenciales incorrectas')
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (session === undefined) {
    return (
      <div className="login-shell">
        <div className="login-card"><p>Cargando...</p></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <h2>Acceso privado</h2>
          <p>Introduce tus credenciales para entrar a FutsalKit.</p>
          <form onSubmit={handleLogin}>
            <label htmlFor="login-user">Usuario</label>
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

  const bgStart = activeTeam?.gradient_start || '#172554'
  const bgEnd = activeTeam?.gradient_end || '#2563EB'
  const teamGradient = `linear-gradient(135deg, ${bgStart} 0%, ${bgEnd} 100%)`

  return (
    <div className="app-root" style={{ background: teamGradient }}>
      <header className="app-header">
        <img src="./futsalkit-icon.svg" alt="FutsalKit" className="logo" />
        <h1>FutsalKit</h1>
        <button className="btn btn-danger" onClick={handleLogout} style={{ marginLeft: 'auto' }}>
          Cerrar sesión
        </button>
      </header>
      <main>
        <HomePage onActiveTeamChange={setActiveTeam} />
      </main>
    </div>
  )
}
