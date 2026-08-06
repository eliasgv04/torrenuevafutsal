import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import ConfirmModal from './ConfirmModal'
import { ArrowLeftIcon, TrashIcon } from './Icons'

function fmtMins(secs){
  const s = Math.max(0, Number(secs) || 0)
  const m = Math.floor(s / 60), r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

const EMPTY_TOTALS = { matches:0, goals:0, assists:0, shots_on_goal:0, shots_out:0, fouls:0, yellow_cards:0, red_cards:0, saves:0, minutes_played:0 }

function sumMatches(matches){
  return matches.reduce((acc, m) => ({
    matches: acc.matches + 1,
    goals: acc.goals + (m.goals || 0),
    assists: acc.assists + (m.assists || 0),
    shots_on_goal: acc.shots_on_goal + (m.shots_on_goal || 0),
    shots_out: acc.shots_out + (m.shots_out || 0),
    fouls: acc.fouls + (m.fouls || 0),
    yellow_cards: acc.yellow_cards + (m.yellow_cards || 0),
    red_cards: acc.red_cards + (m.red_cards || 0),
    saves: acc.saves + (m.saves || 0),
    minutes_played: acc.minutes_played + (m.minutes_played || 0),
  }), { ...EMPTY_TOTALS })
}

export default function PlayerManagement({ teamId, onClose }) {
  const [players, setPlayers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [detailPlayer, setDetailPlayer] = useState(null)
  const [playerMatchesMap, setPlayerMatchesMap] = useState({})
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [confirmDeleteFor, setConfirmDeleteFor] = useState(null)
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

  const handleDeletePlayer = async () => {
    if (!confirmDeleteFor) return
    const playerId = confirmDeleteFor.id
    await api.deletePlayer(playerId)
    if (detailPlayer?.id === playerId) setDetailPlayer(null)
    setConfirmDeleteFor(null)
    loadPlayers()
  }

  const openDetail = async (player) => {
    setDetailPlayer(player)
    if (!playerMatchesMap[player.id]) {
      setLoadingMatches(true)
      try {
        const matches = await api.getPlayerMatches(player.id)
        setPlayerMatchesMap((prev) => ({ ...prev, [player.id]: matches || [] }))
      } finally {
        setLoadingMatches(false)
      }
    }
  }

  const positions = ['Portero', 'Cierre', 'Ala Diestro', 'Ala Zurdo', 'Pivot']
  const positionColors = {
    'Portero': '#EF4444',
    'Cierre': '#F97316',
    'Ala Diestro': '#3B82F6',
    'Ala Zurdo': '#22C55E',
    'Pivot': '#A855F7'
  }

  const detailMatches = detailPlayer ? (playerMatchesMap[detailPlayer.id] || []) : []
  const detailTotals = sumMatches(detailMatches)
  const recentMatches = detailMatches.slice(0, 3)

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
          <div className="modal-content" style={{maxWidth:640}} onClick={(e) => e.stopPropagation()}>
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

            {loadingMatches && !playerMatchesMap[detailPlayer.id] ? (
              <p className="player-stats-note">Cargando estadísticas...</p>
            ) : detailMatches.length === 0 ? (
              <p className="player-stats-note">Sin partidos finalizados registrados todavía</p>
            ) : (
              <>
                <p className="player-stats-note">Total en {detailTotals.matches} partido{detailTotals.matches === 1 ? '' : 's'}</p>
                <div className="player-totals-grid">
                  <div className="player-total-stat"><span>{detailTotals.goals}</span><label>Goles</label></div>
                  <div className="player-total-stat"><span>{detailTotals.assists}</span><label>Asist.</label></div>
                  <div className="player-total-stat"><span>{detailTotals.shots_on_goal}</span><label>T. puerta</label></div>
                  <div className="player-total-stat"><span>{detailTotals.shots_out}</span><label>T. fuera</label></div>
                  <div className="player-total-stat"><span>{detailTotals.fouls}</span><label>Faltas</label></div>
                  <div className="player-total-stat"><span>{detailTotals.yellow_cards}</span><label>Amarillas</label></div>
                  <div className="player-total-stat"><span>{detailTotals.red_cards}</span><label>Rojas</label></div>
                  <div className="player-total-stat"><span>{detailTotals.saves}</span><label>Paradas</label></div>
                  <div className="player-total-stat"><span>{fmtMins(detailTotals.minutes_played)}</span><label>Minutos</label></div>
                </div>

                <p className="player-stats-note" style={{marginTop:20}}>Últimos partidos</p>
                <div className="player-match-list">
                  {recentMatches.map((m) => {
                    const isHome = m.is_home !== false
                    const ourGoals = isHome ? (m.home_goals ?? 0) : (m.away_goals ?? 0)
                    const rivGoals = isHome ? (m.away_goals ?? 0) : (m.home_goals ?? 0)
                    const result = ourGoals > rivGoals ? 'W' : ourGoals < rivGoals ? 'L' : 'D'
                    const resultColor = result === 'W' ? '#22c55e' : result === 'L' ? '#ef4444' : '#f59e0b'
                    return (
                      <div key={m.match_id} className="player-match-card">
                        <div className="player-match-card-head">
                          <div>
                            <div className="player-match-rival">vs {m.rival_team_name}</div>
                            <div className="player-match-date">
                              {m.match_date ? new Date(m.match_date).toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' }) : ''}
                            </div>
                          </div>
                          <span className="player-match-result" style={{ background:resultColor }}>{ourGoals}-{rivGoals}</span>
                        </div>
                        <div className="player-match-stats-grid">
                          <div className="player-match-stat"><div className="player-match-stat-value">{m.goals ?? 0}</div><div className="player-match-stat-label">Goles</div></div>
                          <div className="player-match-stat"><div className="player-match-stat-value">{m.assists ?? 0}</div><div className="player-match-stat-label">Asist.</div></div>
                          <div className="player-match-stat"><div className="player-match-stat-value">{m.shots_on_goal ?? 0}</div><div className="player-match-stat-label">T+</div></div>
                          <div className="player-match-stat"><div className="player-match-stat-value">{m.shots_out ?? 0}</div><div className="player-match-stat-label">T-</div></div>
                          <div className="player-match-stat"><div className="player-match-stat-value">{m.fouls ?? 0}</div><div className="player-match-stat-label">Faltas</div></div>
                          <div className="player-match-stat"><div className="player-match-stat-value">{m.yellow_cards ?? 0}</div><div className="player-match-stat-label">TA</div></div>
                          <div className="player-match-stat"><div className="player-match-stat-value">{m.red_cards ?? 0}</div><div className="player-match-stat-label">TR</div></div>
                          <div className="player-match-stat"><div className="player-match-stat-value">{m.saves ?? 0}</div><div className="player-match-stat-label">Paradas</div></div>
                          <div className="player-match-stat"><div className="player-match-stat-value">{fmtMins(m.minutes_played)}</div><div className="player-match-stat-label">Min</div></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            <div className="modal-buttons" style={{marginTop:16}}>
              <button className="btn btn-danger" style={{flex:'none', padding:'8px 14px', fontSize:13}} onClick={() => setConfirmDeleteFor(detailPlayer)}>
                <TrashIcon size={13}/> Eliminar
              </button>
              <button className="btn btn-cancel" style={{flex:'none', padding:'8px 14px', fontSize:13, marginLeft:'auto'}} onClick={() => setDetailPlayer(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteFor && (
        <ConfirmModal
          title="Eliminar jugador"
          message={`¿Eliminar a ${confirmDeleteFor.name} ${confirmDeleteFor.surname}? Se borrarán también sus estadísticas de partidos.`}
          onConfirm={handleDeletePlayer}
          onCancel={() => setConfirmDeleteFor(null)}
        />
      )}
    </div>
  )
}
