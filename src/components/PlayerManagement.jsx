import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { ArrowLeftIcon, TrashIcon } from './Icons'

export default function PlayerManagement({ teamId, onClose }) {
  const [players, setPlayers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [detailPlayer, setDetailPlayer] = useState(null)
  const [careerStatsMap, setCareerStatsMap] = useState({})
  const [formData, setFormData] = useState({ name: '', surname: '', dorsal: '', position: 'Portero' })

  useEffect(() => {
    loadPlayers()
  }, [teamId])

  const loadPlayers = async () => {
    const data = await api.getPlayers(teamId)
    setPlayers(data)
  }

  const handleAddPlayer = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.surname || !formData.dorsal) return

    await api.createPlayer({
      team_id: teamId,
      name: formData.name,
      surname: formData.surname,
      dorsal: parseInt(formData.dorsal),
      position: formData.position
    })

    setFormData({ name: '', surname: '', dorsal: '', position: 'Portero' })
    setShowForm(false)
    loadPlayers()
  }

  const handleDeletePlayer = async (playerId) => {
    if (confirm('¿Eliminar jugador?')) {
      await api.deletePlayer(playerId)
      if (detailPlayer?.id === playerId) setDetailPlayer(null)
      loadPlayers()
    }
  }

  const openDetail = async (player) => {
    setDetailPlayer(player)
    if (!careerStatsMap[player.id]) {
      const stats = await api.getPlayerCareerStats(player.id)
      setCareerStatsMap((prev) => ({ ...prev, [player.id]: stats || { matches_played: 0, goals: 0 } }))
    }
  }

  const updateCareerStatField = (player, field, value) => {
    setCareerStatsMap((prev) => ({
      ...prev,
      [player.id]: { ...(prev[player.id] || { matches_played: 0, goals: 0 }), [field]: value }
    }))
  }

  const saveCareerStats = async (player) => {
    const current = careerStatsMap[player.id] || { matches_played: 0, goals: 0 }
    const payload = {
      matches_played: parseInt(current.matches_played) || 0,
      goals: parseInt(current.goals) || 0
    }
    setCareerStatsMap((prev) => ({ ...prev, [player.id]: payload }))
    await api.upsertPlayerCareerStats({
      team_id: player.team_id,
      player_id: player.id,
      matches_played: payload.matches_played,
      goals: payload.goals
    })
  }

  const positions = ['Portero', 'Cierre', 'Ala Diestro', 'Ala Zurdo', 'Pivot']
  const positionColors = {
    'Portero': '#EF4444',
    'Cierre': '#F97316',
    'Ala Diestro': '#3B82F6',
    'Ala Zurdo': '#22C55E',
    'Pivot': '#A855F7'
  }

  const detailStats = detailPlayer ? (careerStatsMap[detailPlayer.id] || { matches_played: 0, goals: 0 }) : null

  const sortedPlayers = [...players].sort((a, b) => {
    const posDiff = positions.indexOf(a.position) - positions.indexOf(b.position)
    if (posDiff !== 0) return posDiff
    return (a.dorsal || 0) - (b.dorsal || 0)
  })

  return (
    <div>
      <div className="header-top">
        <div>
          <button className="btn btn-back" onClick={onClose}>
            <ArrowLeftIcon size={15}/> Atrás
          </button>
          <h2 style={{display:'inline-block',marginLeft:16,marginTop:0}}>Plantilla</h2>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Añadir jugador
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAddPlayer} className="player-form">
          <input
            type="text"
            placeholder="Nombre"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Apellidos"
            value={formData.surname}
            onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="Dorsal"
            value={formData.dorsal}
            onChange={(e) => setFormData({ ...formData, dorsal: e.target.value })}
            required
            min="1"
            max="99"
          />
          <select
            value={formData.position}
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
          >
            {positions.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary" style={{marginTop:0}}>Guardar</button>
          <button type="button" className="btn btn-cancel" style={{marginTop:0}} onClick={() => setShowForm(false)}>Cancelar</button>
        </form>
      )}

      {players.length === 0 ? (
        <div className="empty-state">
          <h3>Sin jugadores todavía</h3>
          <p>Añade el primero para empezar a montar la plantilla.</p>
          {!showForm && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{marginTop:16}}>
              + Añadir jugador
            </button>
          )}
        </div>
      ) : (
        <div className="player-square-grid">
          {sortedPlayers.map((player) => (
            <button key={player.id} className="player-square-card" onClick={() => openDetail(player)}>
              <div className="player-square-photo" style={{ background: positionColors[player.position] }}>
                <span className="player-square-dorsal">{player.dorsal}</span>
              </div>
              <div className="player-square-info">
                <div className="player-square-name">{player.name} {player.surname}</div>
                <div className="player-square-position">{player.position}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {detailPlayer && (
        <div className="modal-overlay" onClick={() => setDetailPlayer(null)}>
          <div className="modal-content" style={{maxWidth:420}} onClick={(e) => e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
              <span className="player-square-dorsal" style={{ background:positionColors[detailPlayer.position], width:64, height:64, borderRadius:14, fontSize:26 }}>
                {detailPlayer.dorsal}
              </span>
              <div>
                <h3 style={{margin:'0 0 4px'}}>{detailPlayer.name} {detailPlayer.surname}</h3>
                <span className="player-square-position-badge" style={{ background:positionColors[detailPlayer.position] }}>
                  {detailPlayer.position}
                </span>
              </div>
            </div>

            <p className="player-stats-note">Estadísticas históricas del club (manuales)</p>
            <div className="career-stats-grid">
              <label className="career-stat-card">
                <span>Partidos</span>
                <input
                  type="number"
                  min="0"
                  value={detailStats.matches_played ?? 0}
                  onChange={(e) => updateCareerStatField(detailPlayer, 'matches_played', e.target.value)}
                  onBlur={() => saveCareerStats(detailPlayer)}
                />
              </label>
              <label className="career-stat-card">
                <span>Goles</span>
                <input
                  type="number"
                  min="0"
                  value={detailStats.goals ?? 0}
                  onChange={(e) => updateCareerStatField(detailPlayer, 'goals', e.target.value)}
                  onBlur={() => saveCareerStats(detailPlayer)}
                />
              </label>
            </div>

            <div className="modal-buttons" style={{marginTop:16}}>
              <button className="btn btn-danger" style={{flex:'none', padding:'8px 14px', fontSize:13}} onClick={() => handleDeletePlayer(detailPlayer.id)}>
                <TrashIcon size={13}/> Eliminar
              </button>
              <button className="btn btn-cancel" style={{flex:'none', padding:'8px 14px', fontSize:13, marginLeft:'auto'}} onClick={() => setDetailPlayer(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
