import React, { useState } from 'react'
import { PLANS } from '../lib/plans'

export default function PlanOverrideModal({ account, onSubmit, onCancel }) {
  const sub = account.subscription || {}
  const [status, setStatus] = useState(sub.status || 'inactive')
  const [plan, setPlan] = useState(sub.plan || '')
  const [maxTeams, setMaxTeams] = useState(sub.max_teams ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setSaving(true)
    setError('')
    try {
      await onSubmit({
        status,
        plan: plan || null,
        max_teams: maxTeams === '' ? null : parseInt(maxTeams, 10),
      })
    } catch (err) {
      setError(err.message || 'No se pudo guardar')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Plan — {account.email}</h3>

        <label htmlFor="plan-override-status">Estado</label>
        <select id="plan-override-status" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="inactive">Sin acceso</option>
          <option value="active">Activo (pagado)</option>
          <option value="expired">Caducado</option>
          <option value="free_override">Gratis (manual)</option>
        </select>

        <label htmlFor="plan-override-plan" style={{ marginTop: 12, display: 'block' }}>Plan asociado (solo informativo)</label>
        <select id="plan-override-plan" value={plan} onChange={e => setPlan(e.target.value)}>
          <option value="">Sin plan</option>
          {PLANS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <label htmlFor="plan-override-max" style={{ marginTop: 12, display: 'block' }}>Límite de equipos</label>
        <input
          id="plan-override-max"
          type="number"
          min="1"
          value={maxTeams}
          onChange={e => setMaxTeams(e.target.value)}
          placeholder="Vacío = ilimitado"
        />

        {error && <p className="login-error">{error}</p>}

        <div className="modal-buttons">
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          <button className="btn btn-cancel" onClick={onCancel} disabled={saving}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
