import React, {useState} from 'react'
import HomePage from './pages/HomePage'

const AUTH_USER = 'torrenuevafutsal'
const AUTH_PASSWORD = '1234'

export default function App(){
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('tf_auth') === '1')

  function handleLogin(e){
    e.preventDefault()
    if(user.trim() === AUTH_USER && password === AUTH_PASSWORD){
      sessionStorage.setItem('tf_auth', '1')
      setIsAuthenticated(true)
      setError('')
      return
    }
    setError('Credenciales incorrectas')
  }

  if(!isAuthenticated){
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
              value={user}
              onChange={(e)=>setUser(e.target.value)}
              autoComplete="username"
              required
            />

            <label htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="btn btn-primary login-btn">
              Entrar
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
      </header>
      <main>
        <HomePage />
      </main>
    </div>
  )
}
