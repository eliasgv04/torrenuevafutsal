import React, {useState} from 'react'

function randomPassword(){
  return Math.random().toString(36).slice(-10)
}

export default function ApproveRequestModal({request, teams, onSubmit, onCancel}){
  const [email,setEmail] = useState(request.contact_email || '')
  const [password,setPassword] = useState('')
  const [teamId,setTeamId] = useState('')
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')

  async function submit(){
    if(!email || !password){ setError('Email y contraseña son obligatorios'); return }
    setSaving(true)
    setError('')
    try{
      await onSubmit({email, password, team_id: teamId || null})
    }catch(err){
      setError(err.message || 'No se pudo crear la cuenta')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Crear cuenta — {request.team_name}</h3>
        <p style={{marginTop:8}}>Solicitado por {request.contact_name} ({request.contact_email})</p>

        <label>Email de acceso</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus />

        <label>Contraseña</label>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <input type="text" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Contraseña" style={{flex:1, margin:'8px 0 16px'}} />
          <button type="button" className="btn btn-secondary btn-secondary-small" style={{marginTop:0}} onClick={()=>setPassword(randomPassword())}>Generar</button>
        </div>

        <label htmlFor="approve-team">Equipo a vincular</label>
        <select id="approve-team" value={teamId} onChange={e=>setTeamId(e.target.value)}>
          <option value="">Sin equipo (el club creará el suyo)</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {error && <p className="login-error">{error}</p>}

        <div className="modal-buttons">
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Creando...' : 'Crear cuenta'}</button>
          <button className="btn btn-cancel" onClick={onCancel} disabled={saving}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
