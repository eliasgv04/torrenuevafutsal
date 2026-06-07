import React, { useState, useEffect } from 'react'
import HomePage from './pages/HomePage'
import { supabase } from './lib/supabaseClient'

const VALID_USERNAME = 'torrenuevafutsal'
const AUTH_EMAIL = 'torrenuevafutsal@torrenuevafutsal.local'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

    if (username.trim() !== VALID_USERNAME) {
      setError('Credenciales incorrectas')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email: AUTH_EMAIL, password })
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
          <p>Introduce tus credenciales para entrar a Torrenueva Futsal.</p>
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

  return (
    <div className="app-root">
      <header className="app-header">
        <img src="./logo-192.png" alt="Torrenueva logo" className="logo" />
        <h1>Torrenueva Futsal</h1>
        <button className="btn btn-cancel" onClick={handleLogout} style={{ marginLeft: 'auto' }}>
          Cerrar sesión
        </button>
      </header>
      <main>
        <HomePage />
      </main>
    </div>
  )
}
