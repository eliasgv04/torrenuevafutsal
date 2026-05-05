import { useState, useEffect } from 'react'
import { api } from '../lib/api'

export default function MatchManagement({ teamId, onSelectMatch, onClose }) {
  const [matches, setMatches] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    rival_team_name: '',
    match_date: '',
    place: '',
    jornada: '',
    is_home: 'home'
  })

  useEffect(() => {
    loadMatches()
  }, [teamId])

  const loadMatches = async () => {
    const data = await api.getMatches(teamId)
    setMatches(data)
  }

  const handleCreateMatch = async (e) => {
    e.preventDefault()
    if (!formData.rival_team_name || !formData.match_date || !formData.place) return

    const match = await api.createMatch({
      team_id: teamId,
      rival_team_name: formData.rival_team_name,
      match_date: formData.match_date,
      place: formData.place,
      jornada: formData.jornada ? parseInt(formData.jornada) : null,
      is_home: formData.is_home === 'home'
    })

    setFormData({ rival_team_name: '', match_date: '', place: '', jornada: '', is_home: 'home' })
    setShowForm(false)
    loadMatches()
  }

  const handleDeleteMatch = async (matchId) => {
    if (confirm('¿Eliminar partido?')) {
      await api.deleteMatch(matchId)
      loadMatches()
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) {
      return dateStr
    }
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const renderResult = (match) => {
    if (match.status !== 'finished' || match.home_goals === null || match.away_goals === null) {
      return null
    }
    const teamGoals = match.is_home === false ? match.away_goals : match.home_goals
    const rivalGoals = match.is_home === false ? match.home_goals : match.away_goals
    return `Final: ${teamGoals} - ${rivalGoals}`
  }

  return (
    <div className="match-management-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>Gestión de Partidos</h2>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>

      <div className="modal-content">
        {!showForm && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Crear Partido
          </button>
        )}

        {showForm && (
          <form onSubmit={handleCreateMatch} className="match-form">
            <input
              type="text"
              placeholder="Rival"
              value={formData.rival_team_name}
              onChange={(e) => setFormData({ ...formData, rival_team_name: e.target.value })}
              required
            />
            <input
              type="datetime-local"
              value={formData.match_date}
              onChange={(e) => setFormData({ ...formData, match_date: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Lugar"
              value={formData.place}
              onChange={(e) => setFormData({ ...formData, place: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Jornada (opcional)"
              value={formData.jornada}
              onChange={(e) => setFormData({ ...formData, jornada: e.target.value })}
            />
            <select
              value={formData.is_home}
              onChange={(e) => setFormData({ ...formData, is_home: e.target.value })}
            >
              <option value="home">Somos local</option>
              <option value="away">Somos visitante</option>
            </select>
            <button type="submit" className="btn-primary">Guardar</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          </form>
        )}

        <div className="matches-list">
          {matches.length === 0 ? (
            <p className="empty-state">No hay partidos creados.</p>
          ) : (
            matches.map((match) => (
              <div key={match.id} className="match-card">
                <div className="match-info">
                  <h3>vs {match.rival_team_name}</h3>
                  <p className="match-date">{formatDate(match.match_date)}</p>
                  <p className="match-place">{match.place}</p>
                  <p className="match-place">{match.is_home === false ? 'Visitante' : 'Local'}</p>
                  {match.jornada && <p className="match-jornada">Jornada {match.jornada}</p>}
                  {renderResult(match) && <p className="match-jornada">{renderResult(match)}</p>}
                </div>
                <div className="match-actions">
                  <button className="btn-secondary" onClick={() => onSelectMatch(match)}>
                    Trackear
                  </button>
                  <button className="btn-danger" onClick={() => handleDeleteMatch(match.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
