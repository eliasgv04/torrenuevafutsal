import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ChangePasswordModal({ onDone, onCancel }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (updateError) {
      setError('No se pudo cambiar la contraseña. Inténtalo de nuevo.')
      return
    }
    setSuccess(true)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {success ? (
          <>
            <h3>Contraseña actualizada</h3>
            <p style={{ marginTop: 8 }}>Tu contraseña se ha cambiado correctamente.</p>
            <div className="modal-buttons">
              <button className="btn btn-primary" onClick={onDone}>Cerrar</button>
            </div>
          </>
        ) : (
          <>
            <h3>Cambiar contraseña</h3>
            <form onSubmit={submit}>
              <label htmlFor="new-password">Nueva contraseña</label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
                required
              />
              <label htmlFor="confirm-password" style={{ marginTop: 12, display: 'block' }}>Repite la contraseña</label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
              {error && <p className="login-error">{error}</p>}
              <div className="modal-buttons">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" className="btn btn-cancel" onClick={onCancel} disabled={saving}>Cancelar</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
