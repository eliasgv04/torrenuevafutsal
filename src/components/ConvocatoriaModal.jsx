import React, { useState } from 'react'
import { api } from '../lib/api'

const POSITION_ORDER = ['Portero', 'Cierre', 'Ala Zurdo', 'Ala Diestro', 'Pivot']
const positionColors = { 'Portero':'#EF4444', 'Cierre':'#F97316', 'Ala Diestro':'#3B82F6', 'Ala Zurdo':'#22C55E', 'Pivot':'#A855F7' }

function positionRank(position){
  const idx = POSITION_ORDER.indexOf(position)
  return idx === -1 ? POSITION_ORDER.length : idx
}

export default function ConvocatoriaModal({ match, players, onSaved, onCancel }){
  const sortedPlayers = [...(players || [])].sort((a, b) =>
    positionRank(a.position) - positionRank(b.position) || (a.dorsal ?? 0) - (b.dorsal ?? 0)
  )

  // No convocatoria set yet → default to everyone called up
  const initial = Array.isArray(match.called_up_players)
    ? new Set(match.called_up_players)
    : new Set(sortedPlayers.map(p => p.id))

  const [selected, setSelected] = useState(initial)
  const [saving, setSaving] = useState(false)

  function toggle(playerId){
    setSelected(prev => {
      const next = new Set(prev)
      if(next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  async function save(){
    setSaving(true)
    try{
      const updated = await api.updateCalledUpPlayers({ match_id: match.id, player_ids: Array.from(selected) })
      onSaved(updated)
    }finally{
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Convocatoria — vs {match.rival_team_name}</h3>
        <p className="small" style={{marginTop:4}}>
          Elige los jugadores convocados para este partido. Solo ellos aparecerán como opción al trackear.
        </p>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'12px 0 8px'}}>
          <span style={{fontSize:13,fontWeight:700,color:'var(--green-dark)'}}>
            {selected.size} / {sortedPlayers.length} convocados
          </span>
          <div style={{display:'flex',gap:8}}>
            <button type="button" className="btn btn-secondary btn-secondary-small" style={{marginTop:0}}
              onClick={() => setSelected(new Set(sortedPlayers.map(p => p.id)))}>
              Todos
            </button>
            <button type="button" className="btn btn-secondary btn-secondary-small" style={{marginTop:0}}
              onClick={() => setSelected(new Set())}>
              Ninguno
            </button>
          </div>
        </div>

        <div className="callup-list">
          {sortedPlayers.length === 0 && (
            <p className="small" style={{padding:8}}>No hay jugadores en la plantilla todavía.</p>
          )}
          {sortedPlayers.map(player => (
            <label key={player.id} className="callup-item">
              <input
                type="checkbox"
                checked={selected.has(player.id)}
                onChange={() => toggle(player.id)}
              />
              <span className="callup-dorsal">#{player.dorsal}</span>
              <span className="callup-name">{player.name} {player.surname}</span>
              <span className="position-badge-small" style={{backgroundColor: positionColors[player.position] || '#999'}}>
                {(player.position || '?').slice(0, 3)}
              </span>
            </label>
          ))}
        </div>

        <div className="modal-buttons">
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar convocatoria'}</button>
          <button className="btn btn-cancel" onClick={onCancel} disabled={saving}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
