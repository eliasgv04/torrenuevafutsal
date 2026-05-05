import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import PlayerManagement from './PlayerManagement'
import MatchManagement from './MatchManagement'
import MatchTracker from './MatchTracker'

export default function FutsalPage({ teamId, onBack }) {
  const [view, setView] = useState('menu') // menu, players, matches, tracker
  const [players, setPlayers] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)

  useEffect(() => {
    if (view === 'tracker' || view === 'matches') {
      loadPlayers()
    }
  }, [view])

  const loadPlayers = async () => {
    const data = await api.getPlayers(teamId)
    setPlayers(data)
  }

  return (
    <div className="futsal-page">
      {/* Header */}
      <div className="page-header">
        <button className="btn-back" onClick={onBack}>← Volver</button>
        <h1>Futsal - Gestión de Partidos</h1>
      </div>

      {/* Menu Principal */}
      {view === 'menu' && (
        <div className="futsal-menu">
          <button className="menu-btn" onClick={() => setView('players')}>
            <span className="menu-icon">👥</span>
            <span>Gestionar Jugadores</span>
          </button>
          <button className="menu-btn" onClick={() => setView('matches')}>
            <span className="menu-icon">🏆</span>
            <span>Gestionar Partidos</span>
          </button>
          <button className="menu-btn" onClick={() => setView('stats')}>
            <span className="menu-icon">📊</span>
            <span>Estadísticas</span>
          </button>
        </div>
      )}

      {/* Player Management View */}
      {view === 'players' && (
        <div className="futsal-view">
          <PlayerManagement
            teamId={teamId}
            onClose={() => setView('menu')}
          />
        </div>
      )}

      {/* Match Management View */}
      {view === 'matches' && (
        <div className="futsal-view">
          {selectedMatch ? (
            <MatchTracker
              match={selectedMatch}
              teamId={teamId}
              players={players}
              onClose={() => {
                setSelectedMatch(null)
                setView('matches')
              }}
            />
          ) : (
            <MatchManagement
              teamId={teamId}
              onSelectMatch={(match) => {
                setSelectedMatch(match)
              }}
              onClose={() => setView('menu')}
            />
          )}
        </div>
      )}

      {/* Stats View */}
      {view === 'stats' && (
        <div className="futsal-view stats-view">
          <div className="modal-header">
            <h2>Estadísticas Futsal</h2>
            <button className="modal-close" onClick={() => setView('menu')}>✕</button>
          </div>
          <p style={{ textAlign: 'center', marginTop: '2rem' }}>
            Las estadísticas se cargarán desde los partidos registrados.
          </p>
        </div>
      )}
    </div>
  )
}
