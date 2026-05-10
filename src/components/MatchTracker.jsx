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
  const [isProcessingSubstitution, setIsProcessingSubstitution] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null, onCancel: null })
  const chronoIntervalRef = useRef(null)
  const actionLockRef = useRef(false)
  const draftRestoreRef = useRef(false)
  const draftSaveRef = useRef(null)
  const draftKey = `tf_match_draft_${match.id}`

  const createEmptyMatchPlayerStat = (playerId) => ({
    match_id: match.id,
    player_id: playerId,
    goals: 0,
    assists: 0,
    shots_on_goal: 0,
    shots_out: 0,
    fouls: 0,
    yellow_cards: 0,
    red_cards: 0,
    minutes_played: 0,
    saves: 0
  })

  function StatStepper({ value, onChange, min = 0, max, onBlur }){
    return (
      <div className="stepper">
        <button type="button" onClick={()=>{ const nv = Math.max(min, (Number(value)||0) - 1); onChange(nv); if(onBlur) onBlur(); }}>-</button>
        <input type="number" value={value} onChange={(e)=>onChange(parseInt(e.target.value)||0)} onBlur={(e)=>onBlur && onBlur()} />
        <button type="button" onClick={()=>{ const nv = typeof max === 'number' ? Math.min(max, (Number(value)||0) + 1) : (Number(value)||0) + 1; onChange(nv); if(onBlur) onBlur(); }}>+</button>
      </div>
    )
  }

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
    const handleKeyDown = (event) => {
      if (event.code !== 'Space' || event.repeat) return

      const target = event.target
      const isEditableTarget =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if (isEditableTarget || confirmDialog.isOpen) return

      event.preventDefault()
      setIsChronoRunning((prev) => !prev)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmDialog.isOpen])

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
    try {
      const [onField, stats, rival] = await Promise.all([
        api.getOnFieldPlayers(match.id),
        api.getMatchPlayerStats(match.id),
        api.getRivalTeamStats(match.id)
      ])

      const normalizedOnField = Array.isArray(onField)
        ? onField.map((item) => ({
            ...item,
            entry_minute: Number(item.entry_minute ?? 0),
            exit_minute: item.exit_minute == null ? null : Number(item.exit_minute)
          }))
        : []

      const draftRaw = localStorage.getItem(draftKey)
      if (!draftRestoreRef.current && draftRaw) {
        try {
          const draft = JSON.parse(draftRaw)
          const draftAge = Date.now() - (draft.savedAt || Date.now())
          const validDraftOnField = Array.isArray(draft.onFieldPlayers)
            ? draft.onFieldPlayers.filter((item) => players.some((p) => p.id === item.player_id))
            : normalizedOnField
          setChrono((draft.chrono ?? 0) + (draft.isChronoRunning ? Math.floor(draftAge / 1000) : 0))
          setIsChronoRunning(Boolean(draft.isChronoRunning))
          setOnFieldPlayers(validDraftOnField)
          setPlayerStats(draft.playerStats || {})
          // Merge with BD stats: BD data wins if draft is missing data
          if(rival && (!draft.rivalStats || Object.keys(draft.rivalStats).length === 0)) {
            setRivalStats({goals: rival.goals ?? 0, shots_on_goal: rival.shots_on_goal ?? 0, fouls: rival.fouls ?? 0, yellow_cards: rival.yellow_cards ?? 0, red_cards: rival.red_cards ?? 0})
          } else if(draft.rivalStats) {
            setRivalStats(draft.rivalStats)
          }
          if (typeof draft.matchNotes === 'string') setMatchNotes(draft.matchNotes)
          setSelectedPlayerForChange(draft.selectedPlayerForChange || null)
          draftRestoreRef.current = true
          return
        } catch (error) {
          console.warn('Invalid match draft, falling back to persisted data', error)
        }
      }

      const validOnField = normalizedOnField.filter((item) => players.some((p) => p.id === item.player_id))
      setOnFieldPlayers(validOnField)

      // BD stats have priority
      const statsFromBd = {}
      stats.forEach((s) => {
        statsFromBd[s.player_id] = s
      })

      setPlayerStats((prevStats) => {
        const mergedStats = { ...prevStats, ...statsFromBd }
        validOnField.forEach((onFieldItem) => {
          if (!mergedStats[onFieldItem.player_id]) {
            mergedStats[onFieldItem.player_id] = createEmptyMatchPlayerStat(onFieldItem.player_id)
          }
        })
        return mergedStats
      })

      if (rival) {
        setRivalStats({
          goals: rival.goals ?? 0,
          shots_on_goal: rival.shots_on_goal ?? 0,
          fouls: rival.fouls ?? 0,
          yellow_cards: rival.yellow_cards ?? 0,
          red_cards: rival.red_cards ?? 0
        })
      }
      setMatchNotes(match.notes || '')
      draftRestoreRef.current = true
    } catch (error) {
      console.error('Error loading match data:', error)
    }
  }

  const formatChrono = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getPlayerLiveTime = (onField) => {
    const current = playerStats[onField.player_id] || {}
    const accumulated = Math.max(0, Number(current.minutes_played ?? 0))
    const entryMinute = Number(onField.entry_minute ?? 0)
    const currentChrono = Number(chrono ?? 0)
    const elapsed = Math.max(0, currentChrono - entryMinute)
    return formatChrono(accumulated + elapsed)
  }

  const persistPlayerMinutes = async (playerId, extraSeconds = 0) => {
    const current = playerStats[playerId] || {}
    const nextMinutesPlayed = (current.minutes_played ?? 0) + extraSeconds

    setPlayerStats((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || createEmptyMatchPlayerStat(playerId)),
        ...current,
        minutes_played: nextMinutesPlayed
      }
    }))

    await api.upsertMatchPlayerStats({
      match_id: match.id,
      player_id: playerId,
      goals: current.goals ?? 0,
      assists: current.assists ?? 0,
      shots_on_goal: current.shots_on_goal ?? 0,
      shots_out: current.shots_out ?? 0,
      fouls: current.fouls ?? 0,
      yellow_cards: current.yellow_cards ?? 0,
      red_cards: current.red_cards ?? 0,
      minutes_played: nextMinutesPlayed,
      saves: current.saves ?? 0
    })
  }

  const handleAddPlayerToField = async (playerId) => {
    if (actionLockRef.current) return
    try {
      actionLockRef.current = true
      const currentActive = onFieldPlayers.filter((item) => item.exit_minute === null)
      
      // Validación 1: máximo 5 jugadores
      if (currentActive.length >= 5) {
        alert('Máximo 5 jugadores en pista')
        return
      }
      
      // Validación 2: no duplicados
      if (currentActive.some((item) => item.player_id === playerId)) {
        alert('Este jugador ya está en pista')
        return
      }
      
      await api.setPlayerOnField({ match_id: match.id, player_id: playerId, entry_minute: chrono })
      await loadMatchData()
      setShowPlayerSelector(false)
    } catch (error) {
      console.error('Error adding player to field:', error)
      alert('Error al añadir jugador: ' + error.message)
    } finally {
      actionLockRef.current = false
    }
  }

  const handleRemovePlayerFromQuintet = async (onFieldId) => {
    setConfirmDialog({
      isOpen: true,
      message: '¿Eliminar jugador del quinteto?',
      onConfirm: async () => {
        try {
          if (actionLockRef.current) return
          actionLockRef.current = true
          const onField = onFieldPlayers.find((item) => item.id === onFieldId)
          if (onField) {
            const playedSeconds = Math.max(0, chrono - (onField.entry_minute ?? 0))
            await persistPlayerMinutes(onField.player_id, playedSeconds)
          }
          await api.setPlayerOffField(onFieldId, chrono)
          await loadMatchData()
          setConfirmDialog({ isOpen: false, message: '', onConfirm: null, onCancel: null })
        } catch (error) {
          console.error('Error removing player from field:', error)
          alert('Error al eliminar jugador: ' + error.message)
          setConfirmDialog({ isOpen: false, message: '', onConfirm: null, onCancel: null })
        } finally {
          actionLockRef.current = false
        }
      },
      onCancel: () => {
        setConfirmDialog({ isOpen: false, message: '', onConfirm: null, onCancel: null })
      }
    })
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
    if (!outOnFieldId || !inPlayerId || isProcessingSubstitution || actionLockRef.current) return
    
    try {
      actionLockRef.current = true
      setIsProcessingSubstitution(true)
      const outgoing = onFieldPlayers.find((item) => item.id === outOnFieldId)
      if (outgoing) {
        const playedSeconds = Math.max(0, chrono - (outgoing.entry_minute ?? 0))
        await persistPlayerMinutes(outgoing.player_id, playedSeconds)
      }
      await api.setPlayerOffField(outOnFieldId, chrono)
      await api.setPlayerOnField({ match_id: match.id, player_id: inPlayerId, entry_minute: chrono })
      await loadMatchData()
      setSelectedPlayerForChange(null)
    } catch (error) {
      console.error('Error during substitution:', error)
      alert('Error al realizar cambio: ' + error.message)
    } finally {
      setIsProcessingSubstitution(false)
      actionLockRef.current = false
    }
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
      assists: current.assists ?? 0,
      shots_on_goal: current.shots_on_goal ?? 0,
      shots_out: current.shots_out ?? 0,
      fouls: current.fouls ?? 0,
      yellow_cards: current.yellow_cards ?? 0,
      red_cards: current.red_cards ?? 0,
      minutes_played: current.minutes_played ?? 0,
      saves: current.saves ?? 0
    })
  }

  const persistAllPlayerStats = async () => {
    const entries = Object.entries(playerStats)
    const errors = []
    for (const [playerId, stats] of entries) {
      try {
        await api.upsertMatchPlayerStats({
          match_id: match.id,
          player_id: playerId,
          goals: Math.max(0, stats?.goals ?? 0),
          assists: Math.max(0, stats?.assists ?? 0),
          shots_on_goal: Math.max(0, stats?.shots_on_goal ?? 0),
          shots_out: Math.max(0, stats?.shots_out ?? 0),
          fouls: Math.max(0, stats?.fouls ?? 0),
          yellow_cards: Math.max(0, stats?.yellow_cards ?? 0),
          red_cards: Math.max(0, stats?.red_cards ?? 0),
          minutes_played: Math.max(0, stats?.minutes_played ?? 0),
          saves: Math.max(0, stats?.saves ?? 0)
        })
      } catch (error) {
        console.error(`Error saving stats for player ${playerId}:`, error)
        errors.push(`Jugador ${playerId}: ${error.message}`)
      }
    }
    if (errors.length > 0) {
      console.warn('Some player stats failed to save:', errors)
    }
  }

  const handleUpdateRivalStat = async (stat, value) => {
    setRivalStats((prev) => ({ ...prev, [stat]: value }))
  }

  const persistRivalStats = async () => {
    try {
      await api.upsertRivalTeamStats({
        match_id: match.id,
        goals: Math.max(0, rivalStats.goals ?? 0),
        shots_on_goal: Math.max(0, rivalStats.shots_on_goal ?? 0),
        fouls: Math.max(0, rivalStats.fouls ?? 0),
        yellow_cards: Math.max(0, rivalStats.yellow_cards ?? 0),
        red_cards: Math.max(0, rivalStats.red_cards ?? 0)
      })
    } catch (error) {
      console.error('Error saving rival stats:', error)
    }
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
    setConfirmDialog({
      isOpen: true,
      message: `¿Finalizar partido?
${isHome ? 'Torrenueva' : match.rival_team_name} ${homeScore} - ${awayScore} ${isHome ? match.rival_team_name : 'Torrenueva'}`,
      onConfirm: async () => {
        try {
          setIsChronoRunning(false)
          console.log('Saving all match data before finalize...')

          // Save all stats with error handling
          await persistAllPlayerStats()
          console.log('Player stats saved')
          
          await persistRivalStats()
          console.log('Rival stats saved')

          const activePlayers = onFieldPlayers.filter((item) => item.exit_minute === null)
          for (const active of activePlayers) {
            const playedSeconds = Math.max(0, chrono - (active.entry_minute ?? 0))
            await persistPlayerMinutes(active.player_id, playedSeconds)
            await api.setPlayerOffField(active.id, chrono)
          }
          console.log('Final player minutes saved')

          await api.finalizeMatch({
            match_id: match.id,
            home_goals: homeScore,
            away_goals: awayScore,
            notes: matchNotes,
            ended_at: new Date().toISOString()
          })
          console.log('Match finalized successfully')

          localStorage.removeItem(draftKey)
          alert('Partido finalizado correctamente')
          onClose()
          setConfirmDialog({ isOpen: false, message: '', onConfirm: null, onCancel: null })
        } catch (error) {
          console.error('Error finalizing match:', error)
          alert('Error al finalizar partido: ' + error.message)
          setConfirmDialog({ isOpen: false, message: '', onConfirm: null, onCancel: null })
        }
      },
      onCancel: () => {
        setConfirmDialog({ isOpen: false, message: '', onConfirm: null, onCancel: null })
      }
    })
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
            <h3>Tiempo del partido {isChronoRunning && '▶️ EN DIRECTO'}</h3>
          </div>
          <div className="chrono-display" style={{ animation: isChronoRunning ? 'pulse 1s infinite' : 'none', color: isChronoRunning ? '#2ecc71' : '#333' }}>{formatChrono(chrono)}</div>
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
                  <th>Asist.</th>
                  <th>T.Puerta</th>
                  <th>Fuera</th>
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
                        <StatStepper value={stats.goals ?? 0} onChange={(v)=>{handleUpdatePlayerStat(onField.player_id, 'goals', v)}} onBlur={()=>persistPlayerStats(onField.player_id)} />
                      </td>
                      <td>
                        <StatStepper value={stats.assists ?? 0} onChange={(v)=>{handleUpdatePlayerStat(onField.player_id, 'assists', v)}} onBlur={()=>persistPlayerStats(onField.player_id)} />
                      </td>
                      <td>
                        <StatStepper value={stats.shots_on_goal ?? 0} onChange={(v)=>{handleUpdatePlayerStat(onField.player_id, 'shots_on_goal', v)}} onBlur={()=>persistPlayerStats(onField.player_id)} />
                      </td>
                      <td>
                        <StatStepper value={stats.shots_out ?? 0} onChange={(v)=>{handleUpdatePlayerStat(onField.player_id, 'shots_out', v)}} onBlur={()=>persistPlayerStats(onField.player_id)} />
                      </td>
                      <td>
                        <StatStepper value={stats.fouls ?? 0} onChange={(v)=>{handleUpdatePlayerStat(onField.player_id, 'fouls', v)}} onBlur={()=>persistPlayerStats(onField.player_id)} />
                      </td>
                      <td>
                        <StatStepper value={stats.yellow_cards ?? 0} onChange={(v)=>{handleUpdatePlayerStat(onField.player_id, 'yellow_cards', v)}} onBlur={()=>persistPlayerStats(onField.player_id)} />
                      </td>
                      <td>
                        <StatStepper value={stats.red_cards ?? 0} onChange={(v)=>{handleUpdatePlayerStat(onField.player_id, 'red_cards', v)}} onBlur={()=>persistPlayerStats(onField.player_id)} />
                      </td>
                      <td>
                        <span className="live-time-badge">{getPlayerLiveTime(onField)}</span>
                      </td>
                      <td className="actions-col">
                        <button className="btn-small-action" onClick={() => setSelectedPlayerForChange(onField.id)}>
                          Cambiar
                        </button>
                        <button className="btn-small-action-delete" onClick={() => handleRemovePlayerFromQuintet(onField.id)} title="Eliminar del quinteto">
                          ✕
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
            <h4>¿Con quién cambiar? {isProcessingSubstitution && '(procesando...)'}</h4>
            <div className="substitution-list">
              {benchPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => handleSubstitution(selectedPlayerForChange, player.id)}
                  disabled={isProcessingSubstitution}
                >
                  #{player.dorsal} {player.name}
                </button>
              ))}
            </div>
            <button className="btn-secondary" onClick={() => setSelectedPlayerForChange(null)} disabled={isProcessingSubstitution}>
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
              <StatStepper value={rivalStats.goals ?? 0} onChange={(v)=>handleUpdateRivalStat('goals', v)} onBlur={persistRivalStats} />
            </label>
            <label className="rival-stat-field">
              <span>Tiros a puerta</span>
              <StatStepper value={rivalStats.shots_on_goal ?? 0} onChange={(v)=>handleUpdateRivalStat('shots_on_goal', v)} onBlur={persistRivalStats} />
            </label>
            <label className="rival-stat-field">
              <span>Faltas</span>
              <StatStepper value={rivalStats.fouls ?? 0} onChange={(v)=>handleUpdateRivalStat('fouls', v)} onBlur={persistRivalStats} />
            </label>
            <label className="rival-stat-field">
              <span>Amarillas</span>
              <StatStepper value={rivalStats.yellow_cards ?? 0} onChange={(v)=>handleUpdateRivalStat('yellow_cards', v)} onBlur={persistRivalStats} />
            </label>
            <label className="rival-stat-field">
              <span>Rojas</span>
              <StatStepper value={rivalStats.red_cards ?? 0} onChange={(v)=>handleUpdateRivalStat('red_cards', v)} onBlur={persistRivalStats} />
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

          {/* Custom Confirmation Dialog */}
          {confirmDialog.isOpen && (
            <div className="confirm-dialog-overlay" onClick={() => confirmDialog.onCancel?.()}>
              <div className="confirm-dialog-content" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-dialog-message">
                  {confirmDialog.message.split('\n').map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
                <div className="confirm-dialog-buttons">
                  <button className="btn-secondary" onClick={() => confirmDialog.onCancel?.()}>
                    Cancelar
                  </button>
                  <button className="btn-danger" onClick={() => confirmDialog.onConfirm?.()}>
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  )
}
