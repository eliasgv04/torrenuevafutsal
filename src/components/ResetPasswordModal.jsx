import React, {useState} from 'react'

function randomPassword(){
  return Math.random().toString(36).slice(-10)
}

export default function ResetPasswordModal({account, onSubmit, onCancel}){
  const [password,setPassword] = useState('')
  const [notifyEmail,setNotifyEmail] = useState('')
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')

  async function submit(){
    if(!password){ setError('Escribe una contraseña'); return }
    setSaving(true)
    setError('')
    try{
      await onSubmit({password, notifyEmail})
    }catch(err){
      setError(err.message || 'No se pudo restablecer la contraseña')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Restablecer contraseña</h3>
        <p style={{marginTop:8}}>Cuenta: <strong>{account.email}</strong></p>

        <label>Nueva contraseña</label>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <input type="text" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nueva contraseña" autoFocus style={{flex:1, margin:'8px 0 16px'}} />
          <button type="button" className="btn btn-secondary btn-secondary-small" style={{marginTop:0}} onClick={()=>setPassword(randomPassword())}>Generar</button>
        </div>

        <label htmlFor="notify-email">Avisar por email (opcional)</label>
        <input id="notify-email" type="email" value={notifyEmail} onChange={e=>setNotifyEmail(e.target.value)} placeholder="Email del club, si quieres avisarle" />

        {error && <p className="login-error">{error}</p>}

        <div className="modal-buttons">
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Guardando...' : 'Restablecer'}</button>
          <button className="btn btn-cancel" onClick={onCancel} disabled={saving}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
