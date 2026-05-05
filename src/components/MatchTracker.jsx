import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

export default function MatchTracker({ match, teamId, players, onClose }) {
  const [onFieldPlayers, setOnFieldPlayers] = useState([])
  const [playerStats, setPlayerStats] = useState({})
  const [rivalStats, setRivalStats] = useState({ goals: 0, shots_on_goal: 0, fouls: 0, yellow_cards: 0, red_cards: 0 })
  const [matchNotes, setMatchNotes] = useState(match.notes || '')
  const [chrono, setChrono] = useState(0)
  const [isChronoRunning, setIsChronoRunning] = useState(false)
  const [showPlayerSelector, setShowPlayerSelector] = useState(false)
  const [selectedPlayerForChange, setSelectedPlayerForChange] = useState(null)
  const chronoIntervalRef = useRef(null)
  const draftRestoreRef = useRef(false)
  const draftSaveRef = useRef(null)
  const draftKey = `tf_match_draft_${match.id}`

  useEffect(() => {
    loadMatchData()
  }, [match.id])

  useEffect(() => {
    if (isChronoRunning) {
      chronoIntervalRef.current = setInterval(() => {
        setChrono((prev) => prev + 1)
      }, 1000)
    } else if (chronoIntervalRef.current) {
      clearInterval(chronoIntervalRef.current)
    }
    return () => chronoIntervalRef.current && clearInterval(chronoIntervalRef.current)
  }, [isChronoRunning])

  useEffect(() => {
    if (!draftRestoreRef.current) return
    if (draftSaveRef.current) clearTimeout(draftSaveRef.current)

    draftSaveRef.current = setTimeout(() => {
      const payload = {
        chrono,
        isChronoRunning,
        onFieldPlayers,
        playerStats,
        rivalStats,
        matchNotes,
        selectedPlayerForChange,
        savedAt: Date.now()
      }
      localStorage.setItem(draftKey, JSON.stringify(payload))
    }, 350)

    return () => draftSaveRef.current && clearTimeout(draftSaveRef.current)
  }, [chrono, isChronoRunning, onFieldPlayers, playerStats, rivalStats, matchNotes, selectedPlayerForChange, draftKey])

  useEffect(() => {
    const handleBeforeUnload = () => {
      const payload = {
        chrono,
        isChronoRunning,
        onFieldPlayers,
        playerStats,
        rivalStats,
        matchNotes,
        selectedPlayerForChange,
        savedAt: Date.now()
      }
      localStorage.setItem(draftKey, JSON.stringify(payload))
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [chrono, isChronoRunning, onFieldPlayers, playerStats, rivalStats, matchNotes, selectedPlayerForChange, draftKey])

  const loadMatchData = async () => {
    const [onField, stats, rival] = await Promise.all([
      api.getOnFieldPlayers(match.id),
      api.getMatchPlayerStats(match.id),
      api.getRivalTeamStats(match.id)
    ])

    const draftRaw = localStorage.getItem(draftKey)
    if (!draftRestoreRef.current && draftRaw) {
      try {
        const draft = JSON.parse(draftRaw)
        const draftAge = Date.now() - (draft.savedAt || Date.now())
        const validDraftOnField = Array.isArray(draft.onFieldPlayers)
          ? draft.onFieldPlayers.filter((item) => players.some((p) => p.id === item.player_id))
          : onField
        setChrono((draft.chrono ?? 0) + (draft.isChronoRunning ? Math.floor(draftAge / 1000) : 0))
        setIsChronoRunning(Boolean(draft.isChronoRunning))
        setOnFieldPlayers(validDraftOnField)
        setPlayerStats(draft.playerStats || {})
        if (draft.rivalStats) setRivalStats(draft.rivalStats)
        if (typeof draft.matchNotes === 'string') setMatchNotes(draft.matchNotes)
        setSelectedPlayerForChange(draft.selectedPlayerForChange || null)
        draftRestoreRef.current = true
        return
      } catch (error) {
        console.warn('Invalid match draft, falling back to persisted data', error)
      }
    }

  setOnFieldPlayers(onField.filter((item) => players.some((p) => p.id === item.player_id)))
    const statsMap = {}
    stats.forEach((s) => {
      statsMap[s.player_id] = s
    })
    setPlayerStats(statsMap)
    if (rival) setRivalStats(rival)
    setMatchNotes(match.notes || '')
    draftRestoreRef.current = true
  }

  const formatChrono = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getPlayerLiveTime = (onField) => {
    const current = playerStats[onField.player_id] || {}
    const accumulated = current.minutes_played ?? 0
    const elapsed = Math.max(0, chrono - (onField.entry_minute ?? 0))
    return formatChrono(accumulated + elapsed)
  }

  const persistPlayerMinutes = async (playerId, extraSeconds = 0) => {
    const current = playerStats[playerId] || {}
    await api.upsertMatchPlayerStats({
      match_id: match.id,
      player_id: playerId,
      goals: current.goals ?? 0,
      shots_on_goal: current.shots_on_goal ?? 0,
      fouls: current.fouls ?? 0,
      yellow_cards: current.yellow_cards ?? 0,
      red_cards: current.red_cards ?? 0,
      minutes_played: (current.minutes_played ?? 0) + extraSeconds,
      saves: current.saves ?? 0
    })
  }

  const handleAddPlayerToField = async (playerId) => {
    const activeCount = onFieldPlayers.filter(
      (item) => item.exit_minute === null && players.some((p) => p.id === item.player_id)
    ).length
    if (activeCount >= 5) {
      return
    }
    await api.setPlayerOnField({ match_id: match.id, player_id: playerId, entry_minute: chrono })
    loadMatchData()
    setShowPlayerSelector(false)
  }

  const handleRemovePlayerFromField = async (onFieldId) => {
    const onField = onFieldPlayers.find((item) => item.id === onFieldId)
    if (onField) {
      const playedSeconds = Math.max(0, chrono - (onField.entry_minute ?? 0))
      await persistPlayerMinutes(onField.player_id, playedSeconds)
    }
    await api.setPlayerOffField(onFieldId, chrono)
    loadMatchData()
  }

  const handleSubstitution = async (outOnFieldId, inPlayerId) => {
    if (!outOnFieldId || !inPlayerId) return
    const outgoing = onFieldPlayers.find((item) => item.id === outOnFieldId)
    if (outgoing) {
      const playedSeconds = Math.max(0, chrono - (outgoing.entry_minute ?? 0))
      await persistPlayerMinutes(outgoing.player_id, playedSeconds)
    }
    await api.setPlayerOffField(outOnFieldId, chrono)
    await api.setPlayerOnField({ match_id: match.id, player_id: inPlayerId, entry_minute: chrono })
    loadMatchData()
    setSelectedPlayerForChange(null)
  }

  const handleUpdatePlayerStat = async (playerId, stat, value) => {
    setPlayerStats((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [stat]: value
      }
    }))
  }

  const persistPlayerStats = async (playerId) => {
    const current = playerStats[playerId] || {}
    await api.upsertMatchPlayerStats({
      match_id: match.id,
      player_id: playerId,
      goals: current.goals ?? 0,
      shots_on_goal: current.shots_on_goal ?? 0,
      fouls: current.fouls ?? 0,
      yellow_cards: current.yellow_cards ?? 0,
      red_cards: current.red_cards ?? 0,
      minutes_played: current.minutes_played ?? 0,
      saves: current.saves ?? 0
    })
  }

  const persistAllPlayerStats = async () => {
    const entries = Object.entries(playerStats)
    for (const [playerId, stats] of entries) {
      await api.upsertMatchPlayerStats({
        match_id: match.id,
        player_id: playerId,
        goals: stats?.goals ?? 0,
        shots_on_goal: stats?.shots_on_goal ?? 0,
        fouls: stats?.fouls ?? 0,
        yellow_cards: stats?.yellow_cards ?? 0,
        red_cards: stats?.red_cards ?? 0,
        minutes_played: stats?.minutes_played ?? 0,
        saves: stats?.saves ?? 0
      })
    }
  }

  const handleUpdateRivalStat = async (stat, value) => {
    setRivalStats((prev) => ({ ...prev, [stat]: value }))
  }

  const persistRivalStats = async () => {
    await api.upsertRivalTeamStats({
      match_id: match.id,
      goals: rivalStats.goals ?? 0,
      shots_on_goal: rivalStats.shots_on_goal ?? 0,
      fouls: rivalStats.fouls ?? 0,
      yellow_cards: rivalStats.yellow_cards ?? 0,
      red_cards: rivalStats.red_cards ?? 0
    })
  }

  const persistMatchNotes = async () => {
    await api.updateMatchNotes({
      match_id: match.id,
      notes: matchNotes
    })
  }

  const currentOnFieldPlayers = onFieldPlayers.filter(
    (o) => o.exit_minute === null && players.some((p) => p.id === o.player_id)
  )
  const benchPlayers = players.filter((p) => !currentOnFieldPlayers.find((o) => o.player_id === p.id))

  const positionColors = {
    'Portero': '#FF6B6B',
    'Cierre': '#4ECDC4',
    'Ala Diestro': '#45B7D1',
    'Ala Zurdo': '#96CEB4',
    'Pivot': '#FFEAA7'
  }

  const totalTeamGoals = Object.values(playerStats).reduce((sum, item) => sum + (item?.goals ?? 0), 0)
  const totalRivalGoals = rivalStats.goals ?? 0
  const isHome = match.is_home !== false
  const homeScore = isHome ? totalTeamGoals : totalRivalGoals
  const awayScore = isHome ? totalRivalGoals : totalTeamGoals

  const handleFinalizeMatch = async () => {
    setIsChronoRunning(false)

    await persistAllPlayerStats()
    await persistRivalStats()

    const activePlayers = onFieldPlayers.filter((item) => item.exit_minute === null)
    for (const active of activePlayers) {
      const playedSeconds = Math.max(0, chrono - (active.entry_minute ?? 0))
      await persistPlayerMinutes(active.player_id, playedSeconds)
      await api.setPlayerOffField(active.id, chrono)
    }

    await api.finalizeMatch({
      match_id: match.id,
      home_goals: homeScore,
      away_goals: awayScore,
      notes: matchNotes,
      ended_at: new Date().toISOString()
    })

    localStorage.removeItem(draftKey)
    onClose()
  }

  return (
    <div className="match-tracker-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>{match.rival_team_name} - {match.place}</h2>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>

      <button
        className={`chrono-float-toggle ${isChronoRunning ? 'running' : ''}`}
        onClick={() => setIsChronoRunning(!isChronoRunning)}
        aria-label={isChronoRunning ? 'Pausar cronómetro' : 'Reanudar cronómetro'}
        title={isChronoRunning ? 'Pausar cronómetro' : 'Reanudar cronómetro'}
      >
        <span className="chrono-float-icon">{isChronoRunning ? '⏸' : '▶'}</span>
        <span>{isChronoRunning ? 'Pausar' : 'Reanudar'}</span>
      </button>

      <div className="tracker-content">
        {/* Global Chrono */}
        <div className="chrono-section">
          <div className="chrono-title-row">
            <h3>Tiempo parado</h3>
          </div>
          <div className="chrono-display">{formatChrono(chrono)}</div>
          <div className="chrono-actions">
            <button
              className={`btn-chrono ${isChronoRunning ? 'running' : ''}`}
              onClick={() => setIsChronoRunning(!isChronoRunning)}
            >
              {isChronoRunning ? '⏸' : '▶'} {isChronoRunning ? 'Pausar' : 'Reanudar'}
            </button>
            <button className="btn-secondary btn-secondary-small" onClick={() => setChrono(0)}>
              Reiniciar
            </button>
          </div>
        </div>

        <div className="live-scoreboard">
          <div className="score-team">
            <span className="score-label">{isHome ? 'Torrenueva (Local)' : match.rival_team_name}</span>
            <strong>{homeScore}</strong>
          </div>
          <div className="score-separator">-</div>
          <div className="score-team">
            <span className="score-label">{isHome ? match.rival_team_name : 'Torrenueva (Visitante)'}</span>
            <strong>{awayScore}</strong>
          </div>
        </div>

        {/* On-Field Players */}
        <div className="on-field-section">
          <h3>En Pista ({currentOnFieldPlayers.length})</h3>
          <div className="on-field-table-container">
            <table className="on-field-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>Posición</th>
                  {/* Stats headers */}
                  <th>Goles</th>
                  <th>T.Puerta</th>
                  <th>Faltas</th>
                  <th>🟨</th>
                  <th>🟥</th>
                  <th>Tiempo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentOnFieldPlayers.map((onField) => {
                  const player = players.find((p) => p.id === onField.player_id)
                  const stats = playerStats[onField.player_id] || {}
                  if (!player) return null

                  return (
                    <tr key={onField.id} className="player-row-stats">
                      <td className="dorsal-col">#{player.dorsal}</td>
                      <td className="name-col">{player.name} {player.surname}</td>
                      <td className="position-col">
                        <span
                          className="position-badge-small"
                          style={{ backgroundColor: positionColors[player.position] }}
                        >
                          {player.position.slice(0, 3)}
                        </span>
                      </td>
                      
                      {/* Stats */}
                      <td>
                        <input
                          type="number"
                          className="stat-input"
                          value={stats.goals ?? 0}
                          onChange={(e) => handleUpdatePlayerStat(onField.player_id, 'goals', parseInt(e.target.value) || 0)}
                          onBlur={() => persistPlayerStats(onField.player_id)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="stat-input"
                          value={stats.shots_on_goal ?? 0}
                          onChange={(e) => handleUpdatePlayerStat(onField.player_id, 'shots_on_goal', parseInt(e.target.value) || 0)}
                          onBlur={() => persistPlayerStats(onField.player_id)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="stat-input"
                          value={stats.fouls ?? 0}
                          onChange={(e) => handleUpdatePlayerStat(onField.player_id, 'fouls', parseInt(e.target.value) || 0)}
                          onBlur={() => persistPlayerStats(onField.player_id)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="stat-input"
                          value={stats.yellow_cards ?? 0}
                          onChange={(e) => handleUpdatePlayerStat(onField.player_id, 'yellow_cards', parseInt(e.target.value) || 0)}
                          onBlur={() => persistPlayerStats(onField.player_id)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="stat-input"
                          value={stats.red_cards ?? 0}
                          onChange={(e) => handleUpdatePlayerStat(onField.player_id, 'red_cards', parseInt(e.target.value) || 0)}
                          onBlur={() => persistPlayerStats(onField.player_id)}
                        />
                      </td>
                      <td>
                        <span className="live-time-badge">{getPlayerLiveTime(onField)}</span>
                      </td>
                      <td className="actions-col">
                        <button className="btn-small-action" onClick={() => setSelectedPlayerForChange(onField.id)}>
                          Cambiar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bench */}
        <div className="bench-section">
          <h3>Suplentes ({benchPlayers.length})</h3>
          {currentOnFieldPlayers.length >= 5 && (
            <p className="bench-limit-note">Quinteto completo: máximo 5 titulares en pista.</p>
          )}
          <div className="bench-list">
            {benchPlayers.map((player) => (
              <button
                key={player.id}
                className="bench-player"
                onClick={() => handleAddPlayerToField(player.id)}
                disabled={currentOnFieldPlayers.length >= 5}
              >
                #{player.dorsal} {player.name}
              </button>
            ))}
          </div>
        </div>

        {/* Substitution Selection */}
        {selectedPlayerForChange && (
          <div className="substitution-modal">
            <h4>¿Con quién cambiar?</h4>
            <div className="substitution-list">
              {benchPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => handleSubstitution(selectedPlayerForChange, player.id)}
                >
                  #{player.dorsal} {player.name}
                </button>
              ))}
            </div>
            <button className="btn-secondary" onClick={() => setSelectedPlayerForChange(null)}>
              Cancelar
            </button>
          </div>
        )}

        {/* Rival Stats */}
        <div className="rival-section">
          <h3>Rival: {match.rival_team_name}</h3>
          <div className="rival-stats-grid">
            <label className="rival-stat-field">
              <span>Goles</span>
              <input type="number" value={rivalStats.goals} onChange={(e) => handleUpdateRivalStat('goals', parseInt(e.target.value) || 0)} onBlur={persistRivalStats} />
            </label>
            <label className="rival-stat-field">
              <span>Tiros a puerta</span>
              <input type="number" value={rivalStats.shots_on_goal} onChange={(e) => handleUpdateRivalStat('shots_on_goal', parseInt(e.target.value) || 0)} onBlur={persistRivalStats} />
            </label>
            <label className="rival-stat-field">
              <span>Faltas</span>
              <input type="number" value={rivalStats.fouls} onChange={(e) => handleUpdateRivalStat('fouls', parseInt(e.target.value) || 0)} onBlur={persistRivalStats} />
            </label>
            <label className="rival-stat-field">
              <span>Amarillas</span>
              <input type="number" value={rivalStats.yellow_cards} onChange={(e) => handleUpdateRivalStat('yellow_cards', parseInt(e.target.value) || 0)} onBlur={persistRivalStats} />
            </label>
            <label className="rival-stat-field">
              <span>Rojas</span>
              <input type="number" value={rivalStats.red_cards} onChange={(e) => handleUpdateRivalStat('red_cards', parseInt(e.target.value) || 0)} onBlur={persistRivalStats} />
            </label>
          </div>
        </div>

        <div className="match-footer-actions">
          <button className="btn-secondary" onClick={onClose}>Salir</button>
          <button className="btn-danger" onClick={handleFinalizeMatch}>Finalizar partido</button>
        </div>

        <div className="match-notes-section">
          <label htmlFor="match-notes">Anotaciones</label>
          <textarea
            id="match-notes"
            rows={4}
            value={matchNotes}
            onChange={(e) => setMatchNotes(e.target.value)}
            onBlur={persistMatchNotes}
            placeholder="Escribe aquí observaciones del partido..."
          />
        </div>
      </div>
    </div>
  )
}
