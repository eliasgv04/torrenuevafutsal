import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { ArrowLeftIcon, XIcon } from './Icons'

export default function PlayerManagement({ teamId, onClose }) {
  const [players, setPlayers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [careerStats, setCareerStats] = useState({ matches_played: 0, goals: 0 })
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
      loadPlayers()
    }
  }

  const handleSelectPlayer = async (player) => {
    setSelectedPlayer(player)
    const stats = await api.getPlayerCareerStats(player.id)
    setCareerStats(stats || {
      matches_played: 0,
      goals: 0
    })
  }

  const saveCareerStats = async (nextStats) => {
    if (!selectedPlayer) return
    const payload = {
      matches_played: parseInt(nextStats.matches_played) || 0,
      goals: parseInt(nextStats.goals) || 0
    }
    setCareerStats(payload)
    await api.upsertPlayerCareerStats({
      team_id: selectedPlayer.team_id,
      player_id: selectedPlayer.id,
      matches_played: payload.matches_played,
      goals: payload.goals
    })
  }

  const positions = ['Portero', 'Cierre', 'Ala Diestro', 'Ala Zurdo', 'Pivot']
  const positionColors = {
    'Portero': '#FF6B6B',
    'Cierre': '#4ECDC4',
    'Ala Diestro': '#45B7D1',
    'Ala Zurdo': '#96CEB4',
    'Pivot': '#FFEAA7'
  }

  return (
    <div className="player-management-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>Gestión de Jugadores</h2>
        <button className="modal-close" onClick={onClose}><XIcon size={14}/></button>
      </div>

      <div className="modal-content">
        {!selectedPlayer ? (
          <>
            {!showForm && (
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                + Añadir Jugador
              </button>
            )}

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
                <button type="submit" className="btn-primary">Guardar</button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              </form>
            )}

            {players.length === 0 ? (
              <p className="empty-state">No hay jugadores. Añade uno para empezar.</p>
            ) : (
              <div className="players-table-container">
                <table className="players-table">
                  <thead>
                    <tr>
                      <th>Dorsal</th>
                      <th>Nombre y Apellidos</th>
                      <th>Posición</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player) => (
                      <tr key={player.id} onClick={() => handleSelectPlayer(player)} className="player-row">
                        <td className="dorsal-cell">#{player.dorsal}</td>
                        <td className="name-cell">{player.name} {player.surname}</td>
                        <td className="position-cell">
                          <span
                            className="position-badge"
                            style={{ backgroundColor: positionColors[player.position] }}
                          >
                            {player.position}
                          </span>
                        </td>
                        <td className="actions-cell">
                          <button
                            className="btn-delete-small"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeletePlayer(player.id)
                            }}
                            title="Eliminar jugador"
                          >
                            <XIcon size={12}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          // Player Detail View
          <div className="player-detail-view">
            <button className="btn-back" onClick={() => setSelectedPlayer(null)} style={{display:'flex',alignItems:'center',gap:6}}><ArrowLeftIcon size={14}/> Volver</button>
            
            <div className="player-header-detail">
              <span className="player-dorsal-large">#{selectedPlayer.dorsal}</span>
              <div className="player-info-detail">
                <h2>{selectedPlayer.name} {selectedPlayer.surname}</h2>
                <span
                  className="position-badge-large"
                  style={{ backgroundColor: positionColors[selectedPlayer.position] }}
                >
                  {selectedPlayer.position}
                </span>
              </div>
            </div>

            <div className="player-stats-summary">
              <h3>Estadísticas históricas del club</h3>
              <p className="player-stats-note">Datos manuales, independientes de los partidos.</p>
              <div className="career-stats-grid">
                <label className="career-stat-card">
                  <span>Partidos</span>
                  <input
                    type="number"
                    min="0"
                    value={careerStats.matches_played ?? 0}
                    onChange={(e) => setCareerStats((prev) => ({ ...prev, matches_played: e.target.value }))}
                    onBlur={() => saveCareerStats(careerStats)}
                  />
                </label>
                <label className="career-stat-card">
                  <span>Goles</span>
                  <input
                    type="number"
                    min="0"
                    value={careerStats.goals ?? 0}
                    onChange={(e) => setCareerStats((prev) => ({ ...prev, goals: e.target.value }))}
                    onBlur={() => saveCareerStats(careerStats)}
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
