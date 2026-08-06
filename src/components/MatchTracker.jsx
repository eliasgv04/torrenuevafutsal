import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import { exportMatchToPdf } from '../lib/pdfMatchExport'
import { ArrowLeftIcon, XIcon, PauseIcon, PlayIcon, DownloadIcon } from './Icons'

// Defined at module scope (not inside MatchTracker) so it keeps a stable
// component identity across renders — the chrono re-renders MatchTracker
// every second while running, and a component redefined inline gets
// remounted on every one of those renders, which was causing clicks on the
// +/- buttons to occasionally double-fire (stats jumping by two).
function StatStepper({ value, onChange, onBlur, min=0, max }) {
  const v = Number(value) || 0
  return (
    <div className="stepper">
      <button type="button" onClick={() => { const nv = Math.max(min, v-1); onChange(nv); if (onBlur) onBlur() }}>-</button>
      <input type="number" value={v} min={min} max={max}
        onChange={e => onChange(Math.max(min, Math.round(Number(e.target.value)) || 0))}
        onBlur={() => onBlur?.()}
      />
      <button type="button" onClick={() => { const nv = max !== undefined ? Math.min(max, v+1) : v+1; onChange(nv); if (onBlur) onBlur() }}>+</button>
    </div>
  )
}

function finalizeToneColor(tone) {
  return tone === 'success' ? '#22c55e' : tone === 'error' ? '#ef4444' : '#f59e0b'
}

function FinalizeToneIcon({ tone }) {
  const color = finalizeToneColor(tone)
  const common = { width:20, height:20, viewBox:'0 0 24 24', fill:'none', stroke:color, strokeWidth:'2.5', strokeLinecap:'round', strokeLinejoin:'round' }
  if (tone === 'success') return <svg {...common}><path d="M5 13l4 4L19 7"/></svg>
  if (tone === 'error')   return <svg {...common}><path d="M18 6L6 18M6 6l12 12"/></svg>
  return (
    <svg {...common}>
      <path d="M10.29 3.86L1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0z"/>
      <path d="M12 9v4M12 17h.01"/>
    </svg>
  )
}

export default function MatchTracker({ match, teamId, teamName, team, players, onClose }) {
  const ourTeamName = teamName || 'Nuestro equipo'
  // Finished matches open in a read-only summary: no editing, no chrono, no
  // drafts/autosave — just showing how the stats ended up.
  const isReadOnly = match.status === 'finished'
  const [onFieldPlayers,          setOnFieldPlayers]          = useState([])
  const [playerStats,             setPlayerStats]             = useState({})
  const [rivalStats,              setRivalStats]              = useState({ goals:0, shots_on_goal:0, fouls:0, yellow_cards:0, red_cards:0 })
  const [matchNotes,              setMatchNotes]              = useState(match.notes || '')
  const [chrono,                  setChrono]                  = useState(0)
  const [isChronoRunning,         setIsChronoRunning]         = useState(false)
  const [selectedPlayerForChange, setSelectedPlayerForChange] = useState(null)
  const [isProcessing,            setIsProcessing]            = useState(false)
  const [saveStatus,              setSaveStatus]              = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const [confirmDialog,           setConfirmDialog]           = useState({ isOpen:false, message:'', onConfirm:null, onCancel:null })
  const [redCardAlert,            setRedCardAlert]            = useState(null) // { playerId, playerName, onFieldId }
  const [finalizeInfo,            setFinalizeInfo]            = useState(null) // { tone:'success'|'warning'|'error', title, message }
  const [exportingPdf,            setExportingPdf]            = useState(false)

  const chronoIntervalRef  = useRef(null)
  const actionLockRef      = useRef(false)
  const draftRestoredRef   = useRef(false)
  const draftSaveTimerRef  = useRef(null)
  const statSaveTimers     = useRef(new Map())   // playerId → timeout id
  const rivalSaveTimerRef  = useRef(null)
  const autoSaveIntervalRef= useRef(null)
  const draftKey = `tf_match_draft_${match.id}`

  // ── Chrono ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isReadOnly) return
    if (isChronoRunning) {
      chronoIntervalRef.current = setInterval(() => setChrono(p => p + 1), 1000)
    } else {
      clearInterval(chronoIntervalRef.current)
    }
    return () => clearInterval(chronoIntervalRef.current)
  }, [isChronoRunning])

  // ── Space-bar toggle ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (isReadOnly) return
      if (e.code !== 'Space' || e.repeat) return
      const t = e.target
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT' || t?.isContentEditable) return
      if (confirmDialog.isOpen || redCardAlert) return
      e.preventDefault()
      setIsChronoRunning(p => !p)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [confirmDialog.isOpen, redCardAlert])

  // ── Draft save (debounced 350ms) ────────────────────────────────────
  useEffect(() => {
    if (isReadOnly || !draftRestoredRef.current) return
    clearTimeout(draftSaveTimerRef.current)
    draftSaveTimerRef.current = setTimeout(() => saveDraft(), 350)
    return () => clearTimeout(draftSaveTimerRef.current)
  }, [chrono, isChronoRunning, onFieldPlayers, playerStats, rivalStats, matchNotes, selectedPlayerForChange])

  // ── Draft save on tab close ─────────────────────────────────────────
  useEffect(() => {
    if (isReadOnly) return
    const handler = () => saveDraft()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [chrono, isChronoRunning, onFieldPlayers, playerStats, rivalStats, matchNotes, selectedPlayerForChange])

  // ── Periodic auto-save every 30s ────────────────────────────────────
  useEffect(() => {
    if (isReadOnly) return
    autoSaveIntervalRef.current = setInterval(() => {
      if (draftRestoredRef.current) autoSaveAll()
    }, 30_000)
    return () => clearInterval(autoSaveIntervalRef.current)
  }, [])

  // ── Load data on mount ──────────────────────────────────────────────
  useEffect(() => { loadMatchData() }, [match.id])

  // ── Helpers ─────────────────────────────────────────────────────────
  function saveDraft() {
    localStorage.setItem(draftKey, JSON.stringify({
      chrono, isChronoRunning, onFieldPlayers, playerStats,
      rivalStats, matchNotes, selectedPlayerForChange,
      savedAt: Date.now()
    }))
  }

  function emptyStats(playerId) {
    return { match_id:match.id, player_id:playerId, goals:0, assists:0, shots_on_goal:0, shots_out:0, fouls:0, yellow_cards:0, red_cards:0, minutes_played:0, saves:0 }
  }

  function formatChrono(secs) {
    const m = Math.floor(secs / 60), s = secs % 60
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  function getPlayerLiveTime(onField) {
    const acc = Math.max(0, Number(playerStats[onField.player_id]?.minutes_played ?? 0))
    const elapsed = Math.max(0, Number(chrono) - Number(onField.entry_minute ?? 0))
    return formatChrono(acc + elapsed)
  }

  // ── Load from DB (+ optional draft restore) ─────────────────────────
  // Called on mount AND after every field action (sub, remove, red card...).
  // Only the very first call may pull player/rival stats from the DB or a
  // draft — later calls only reconcile onFieldPlayers, so an in-flight
  // (debounced, not-yet-saved) stat edit for another player can never get
  // silently reverted by a refetch triggered by an unrelated field action.
  const loadMatchData = async () => {
    if (isReadOnly) {
      try {
        const [stats, rival] = await Promise.all([
          api.getMatchPlayerStats(match.id),
          api.getRivalTeamStats(match.id)
        ])
        const statsMap = {}
        stats.forEach(s => { statsMap[s.player_id] = s })
        setPlayerStats(statsMap)
        if (rival) {
          setRivalStats({ goals: rival.goals??0, shots_on_goal: rival.shots_on_goal??0, fouls: rival.fouls??0, yellow_cards: rival.yellow_cards??0, red_cards: rival.red_cards??0 })
        }
        setMatchNotes(match.notes || '')
      } catch (err) {
        console.error('Error cargando datos del partido:', err)
      }
      return
    }

    const isInitialLoad = !draftRestoredRef.current
    try {
      const [onField, stats, rival] = await Promise.all([
        api.getOnFieldPlayers(match.id),
        api.getMatchPlayerStats(match.id),
        api.getRivalTeamStats(match.id)
      ])

      const normOnField = (Array.isArray(onField) ? onField : [])
        .map(o => ({ ...o, entry_minute: Number(o.entry_minute ?? 0), exit_minute: o.exit_minute == null ? null : Number(o.exit_minute) }))

      const statsMap = {}
      stats.forEach(s => { statsMap[s.player_id] = s })

      // Attempt draft restore (only on the very first load)
      if (isInitialLoad) {
        const draftRaw = localStorage.getItem(draftKey)
        if (draftRaw) {
          try {
            const d = JSON.parse(draftRaw)
            const age = Date.now() - (d.savedAt || 0)          // ← was: || Date.now() (bug: age always 0)
            const MAX_DRAFT_AGE = 6 * 60 * 60 * 1000           // 6 hours
            if (age < MAX_DRAFT_AGE) {
              const validDraftOnField = Array.isArray(d.onFieldPlayers)
                ? d.onFieldPlayers.filter(o => players.some(p => p.id === o.player_id))
                : normOnField

              setChrono((d.chrono ?? 0) + (d.isChronoRunning ? Math.floor(age / 1000) : 0))
              setIsChronoRunning(Boolean(d.isChronoRunning))
              setOnFieldPlayers(validDraftOnField)
              // Draft wins per-player; DB only fills in players the draft doesn't have
              setPlayerStats({ ...statsMap, ...(d.playerStats || {}) })

              // Deep-merge rival stats: DB wins for missing draft fields
              setRivalStats({
                goals:         d.rivalStats?.goals         ?? rival?.goals         ?? 0,
                shots_on_goal: d.rivalStats?.shots_on_goal ?? rival?.shots_on_goal ?? 0,
                fouls:         d.rivalStats?.fouls         ?? rival?.fouls         ?? 0,
                yellow_cards:  d.rivalStats?.yellow_cards  ?? rival?.yellow_cards  ?? 0,
                red_cards:     d.rivalStats?.red_cards     ?? rival?.red_cards     ?? 0,
              })

              if (typeof d.matchNotes === 'string') setMatchNotes(d.matchNotes)
              setSelectedPlayerForChange(d.selectedPlayerForChange || null)
              draftRestoredRef.current = true
              return
            }
          } catch (err) {
            console.warn('Draft corrupto, usando datos de BD:', err)
            localStorage.removeItem(draftKey)
          }
        }
      }

      // No valid draft — reconcile on-field list from DB (always, so the
      // action that triggered this call is reflected with real DB ids)
      const validOnField = normOnField.filter(o => players.some(p => p.id === o.player_id))
      setOnFieldPlayers(validOnField)

      if (isInitialLoad) {
        setPlayerStats(prev => {
          const merged = { ...statsMap, ...prev }
          validOnField.forEach(o => {
            if (!merged[o.player_id]) merged[o.player_id] = emptyStats(o.player_id)
          })
          return merged
        })
        if (rival) {
          setRivalStats({ goals: rival.goals??0, shots_on_goal: rival.shots_on_goal??0, fouls: rival.fouls??0, yellow_cards: rival.yellow_cards??0, red_cards: rival.red_cards??0 })
        }
        setMatchNotes(match.notes || '')
        draftRestoredRef.current = true
      } else {
        // Just ensure any freshly-on-fielded player has a stats entry
        setPlayerStats(prev => {
          let changed = false
          const merged = { ...prev }
          validOnField.forEach(o => {
            if (!merged[o.player_id]) { merged[o.player_id] = emptyStats(o.player_id); changed = true }
          })
          return changed ? merged : prev
        })
      }
    } catch (err) {
      console.error('Error cargando datos del partido:', err)
      alert('Error al cargar el partido. Revisa la conexión e inténtalo de nuevo.')
    }
  }

  // ── Persist helpers ─────────────────────────────────────────────────
  const persistPlayerMinutes = async (playerId, extraSecs = 0) => {
    const cur = playerStats[playerId] || {}
    const next = Math.max(0, (cur.minutes_played ?? 0) + extraSecs)
    setPlayerStats(p => ({ ...p, [playerId]: { ...(p[playerId] || emptyStats(playerId)), minutes_played: next } }))
    await api.upsertMatchPlayerStats({ match_id:match.id, player_id:playerId, goals:cur.goals??0, assists:cur.assists??0, shots_on_goal:cur.shots_on_goal??0, shots_out:cur.shots_out??0, fouls:cur.fouls??0, yellow_cards:cur.yellow_cards??0, red_cards:cur.red_cards??0, minutes_played:next, saves:cur.saves??0 })
  }

  const persistPlayerStats = useCallback(async (playerId) => {
    const cur = playerStats[playerId] || {}
    try {
      setSaveStatus('saving')
      await api.upsertMatchPlayerStats({ match_id:match.id, player_id:playerId, goals:cur.goals??0, assists:cur.assists??0, shots_on_goal:cur.shots_on_goal??0, shots_out:cur.shots_out??0, fouls:cur.fouls??0, yellow_cards:cur.yellow_cards??0, red_cards:cur.red_cards??0, minutes_played:cur.minutes_played??0, saves:cur.saves??0 })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch (err) {
      console.error('Error guardando stats:', err)
      setSaveStatus('error')
    }
  }, [playerStats, match.id])

  const persistRivalStats = useCallback(async () => {
    try {
      setSaveStatus('saving')
      await api.upsertRivalTeamStats({ match_id:match.id, goals:Math.max(0,rivalStats.goals??0), shots_on_goal:Math.max(0,rivalStats.shots_on_goal??0), fouls:Math.max(0,rivalStats.fouls??0), yellow_cards:Math.max(0,rivalStats.yellow_cards??0), red_cards:Math.max(0,rivalStats.red_cards??0) })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch (err) {
      console.error('Error guardando stats rival:', err)
      setSaveStatus('error')
    }
  }, [rivalStats, match.id])

  const persistAllPlayerStats = async () => {
    const errors = []
    for (const [pid, s] of Object.entries(playerStats)) {
      try {
        await api.upsertMatchPlayerStats({ match_id:match.id, player_id:pid, goals:Math.max(0,s?.goals??0), assists:Math.max(0,s?.assists??0), shots_on_goal:Math.max(0,s?.shots_on_goal??0), shots_out:Math.max(0,s?.shots_out??0), fouls:Math.max(0,s?.fouls??0), yellow_cards:Math.max(0,s?.yellow_cards??0), red_cards:Math.max(0,s?.red_cards??0), minutes_played:Math.max(0,s?.minutes_played??0), saves:Math.max(0,s?.saves??0) })
      } catch (err) {
        errors.push(pid)
        console.error(`Error stats jugador ${pid}:`, err)
      }
    }
    return errors
  }

  const autoSaveAll = async () => {
    try {
      setSaveStatus('saving')
      await persistAllPlayerStats()
      await persistRivalStats()
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch {}
  }

  // Schedule debounced stat save per player
  function scheduleStatSave(playerId) {
    if (statSaveTimers.current.has(playerId)) clearTimeout(statSaveTimers.current.get(playerId))
    statSaveTimers.current.set(playerId, setTimeout(() => {
      persistPlayerStats(playerId)
      statSaveTimers.current.delete(playerId)
    }, 800))
  }
  function flushStatSave(playerId) {
    if (statSaveTimers.current.has(playerId)) { clearTimeout(statSaveTimers.current.get(playerId)); statSaveTimers.current.delete(playerId) }
    persistPlayerStats(playerId)
  }
  function scheduleRivalSave() {
    clearTimeout(rivalSaveTimerRef.current)
    rivalSaveTimerRef.current = setTimeout(() => persistRivalStats(), 800)
  }

  // ── Stat update ──────────────────────────────────────────────────────
  const handleUpdatePlayerStat = (playerId, stat, value) => {
    const clamped = Math.max(0, Number(value) || 0)
    setPlayerStats(prev => {
      const updated = { ...(prev[playerId] || emptyStats(playerId)), [stat]: clamped }
      // Red card → prompt removal from field
      if (stat === 'red_cards' && clamped > (prev[playerId]?.red_cards ?? 0)) {
        const onField = onFieldPlayers.find(o => o.player_id === playerId && o.exit_minute === null)
        if (onField) {
          const player = players.find(p => p.id === playerId)
          setRedCardAlert({ playerId, playerName: player ? `${player.name} ${player.surname}`.trim() : 'Jugador', onFieldId: onField.id })
        }
      }
      return { ...prev, [playerId]: updated }
    })
    scheduleStatSave(playerId)
  }

  const handleUpdateRivalStat = (stat, value) => {
    setRivalStats(prev => ({ ...prev, [stat]: Math.max(0, Number(value) || 0) }))
    scheduleRivalSave()
  }

  // ── Field management ─────────────────────────────────────────────────
  const currentOnField = onFieldPlayers.filter(o => o.exit_minute === null && players.some(p => p.id === o.player_id))
  // Bench only offers convocados (if a convocatoria was set for this match);
  // on-field lookups still use the full roster so nothing already tracked
  // ever disappears just because they're outside the call-up list.
  const calledUpIds   = Array.isArray(match.called_up_players) ? new Set(match.called_up_players) : null
  const eligiblePlayers = calledUpIds ? players.filter(p => calledUpIds.has(p.id)) : players
  const benchPlayers   = eligiblePlayers.filter(p => !currentOnField.find(o => o.player_id === p.id))

  // Read-only summary: every player who has a stats row, sorted by dorsal
  const finishedPlayerStats = Object.entries(playerStats)
    .map(([playerId, st]) => ({ player: players.find(p => p.id === playerId), st }))
    .filter(row => row.player)
    .sort((a, b) => (a.player.dorsal ?? 0) - (b.player.dorsal ?? 0))

  const handleAddPlayerToField = async (playerId) => {
    if (actionLockRef.current) return
    try {
      actionLockRef.current = true

      // Validaciones
      if (currentOnField.length >= 5) {
        alert('Máximo 5 jugadores en pista. Realiza un cambio o retira a un jugador primero.')
        return
      }
      if (currentOnField.some(o => o.player_id === playerId)) {
        alert('Este jugador ya está en pista.')
        return
      }

      setIsProcessing(true)
      await api.setPlayerOnField({ match_id:match.id, player_id:playerId, entry_minute:chrono })
      // Ensure stats entry exists for this player
      setPlayerStats(prev => ({ ...prev, [playerId]: prev[playerId] || emptyStats(playerId) }))
      await loadMatchData()
    } catch (err) {
      console.error('Error añadiendo jugador:', err)
      alert('Error al añadir jugador: ' + (err.message || err))
    } finally {
      actionLockRef.current = false
      setIsProcessing(false)
    }
  }

  const handleRemoveFromField = async (onFieldId) => {
    setConfirmDialog({
      isOpen: true,
      message: '¿Retirar este jugador de la pista?\nSe guardarán sus minutos jugados hasta ahora.',
      onConfirm: async () => {
        if (actionLockRef.current) return
        try {
          actionLockRef.current = true
          setIsProcessing(true)
          closeConfirm()
          const onField = onFieldPlayers.find(o => o.id === onFieldId)
          if (onField) {
            const secs = Math.max(0, chrono - (onField.entry_minute ?? 0))
            await persistPlayerMinutes(onField.player_id, secs)
          }
          await api.setPlayerOffField(onFieldId, chrono)
          await loadMatchData()
        } catch (err) {
          console.error('Error retirando jugador:', err)
          alert('Error al retirar jugador: ' + (err.message || err))
        } finally {
          actionLockRef.current = false
          setIsProcessing(false)
        }
      },
      onCancel: closeConfirm
    })
  }

  const handleSubstitution = async (outOnFieldId, inPlayerId) => {
    if (!outOnFieldId || !inPlayerId || actionLockRef.current) return

    // Guard: incoming player shouldn't be on field already
    if (currentOnField.some(o => o.player_id === inPlayerId)) {
      alert('Ese jugador ya está en pista.')
      return
    }

    try {
      actionLockRef.current = true
      setIsProcessing(true)
      const outgoing = onFieldPlayers.find(o => o.id === outOnFieldId)
      if (outgoing) {
        const secs = Math.max(0, chrono - (outgoing.entry_minute ?? 0))
        await persistPlayerMinutes(outgoing.player_id, secs)
      }
      await api.setPlayerOffField(outOnFieldId, chrono)
      await api.setPlayerOnField({ match_id:match.id, player_id:inPlayerId, entry_minute:chrono })
      setPlayerStats(prev => ({ ...prev, [inPlayerId]: prev[inPlayerId] || emptyStats(inPlayerId) }))
      setSelectedPlayerForChange(null)
      await loadMatchData()
    } catch (err) {
      console.error('Error en cambio:', err)
      alert('Error al realizar el cambio: ' + (err.message || err))
    } finally {
      actionLockRef.current = false
      setIsProcessing(false)
    }
  }

  // ── Red card removal prompt ──────────────────────────────────────────
  const handleRedCardDismiss = () => setRedCardAlert(null)
  const handleRedCardRemove  = async () => {
    if (!redCardAlert) return
    const { onFieldId } = redCardAlert
    setRedCardAlert(null)
    // Remove without confirm (user just confirmed via the alert)
    if (actionLockRef.current) return
    try {
      actionLockRef.current = true
      setIsProcessing(true)
      const onField = onFieldPlayers.find(o => o.id === onFieldId)
      if (onField) {
        const secs = Math.max(0, chrono - (onField.entry_minute ?? 0))
        await persistPlayerMinutes(onField.player_id, secs)
      }
      await api.setPlayerOffField(onFieldId, chrono)
      await loadMatchData()
    } catch (err) {
      console.error('Error retirando jugador expulsado:', err)
    } finally {
      actionLockRef.current = false
      setIsProcessing(false)
    }
  }

  // ── Finalize ─────────────────────────────────────────────────────────
  const totalTeamGoals  = Object.values(playerStats).reduce((s, p) => s + (p?.goals ?? 0), 0)
  const totalRivalGoals = rivalStats.goals ?? 0
  const isHome   = match.is_home !== false
  const homeScore = isHome ? totalTeamGoals : totalRivalGoals
  const awayScore = isHome ? totalRivalGoals : totalTeamGoals
  // homeScore/awayScore is what gets persisted (real "home team"/"away team"
  // convention). Every display, though, always shows our team first — this
  // is what the scoreboard, MatchManagement's list and the PDF export all do,
  // so this must match them or "local"/"visitante" reads backwards depending
  // which screen you're on.
  const ourScore   = isHome ? homeScore : awayScore
  const rivalScore = isHome ? awayScore : homeScore

  const handleFinalizeMatch = () => {
    if (match.status === 'finished') {
      setFinalizeInfo({ tone:'warning', title:'Partido ya finalizado', message:'Este partido ya fue finalizado.' })
      return
    }
    setConfirmDialog({
      isOpen: true,
      message: `¿Finalizar partido?\n\n${ourTeamName} ${ourScore} - ${rivalScore} ${match.rival_team_name}\n\nSe guardarán todas las estadísticas.`,
      onConfirm: async () => {
        closeConfirm()
        try {
          setIsChronoRunning(false)
          setIsProcessing(true)
          setSaveStatus('saving')

          // 1. Save all player stats
          const statErrors = await persistAllPlayerStats()
          // 2. Save rival stats
          await persistRivalStats()
          // 3. Record final minutes for active players and remove from field
          const active = onFieldPlayers.filter(o => o.exit_minute === null)
          for (const a of active) {
            const secs = Math.max(0, chrono - (a.entry_minute ?? 0))
            await persistPlayerMinutes(a.player_id, secs)
            await api.setPlayerOffField(a.id, chrono)
          }
          // 4. Save notes
          await api.updateMatchNotes({ match_id:match.id, notes:matchNotes })
          // 5. Finalize
          await api.finalizeMatch({ match_id:match.id, home_goals:homeScore, away_goals:awayScore, notes:matchNotes, ended_at:new Date().toISOString() })

          localStorage.removeItem(draftKey)
          setSaveStatus('saved')

          if (statErrors.length > 0) {
            setFinalizeInfo({
              tone: 'warning',
              title: 'Partido finalizado con advertencias',
              message: `${statErrors.length} estadística(s) de jugador no se pudieron guardar.`,
            })
          } else {
            setFinalizeInfo({
              tone: 'success',
              title: 'Partido finalizado',
              message: `${ourTeamName} ${ourScore} - ${rivalScore} ${match.rival_team_name}\n\nTodas las estadísticas se han guardado correctamente.`,
            })
          }
        } catch (err) {
          console.error('Error finalizando partido:', err)
          setSaveStatus('error')
          setFinalizeInfo({
            tone: 'error',
            title: 'Error al finalizar el partido',
            message: `${err.message || err}\n\nLos datos se han guardado en borrador local. Puedes reintentar sin perder nada.`,
          })
        } finally {
          setIsProcessing(false)
        }
      },
      onCancel: closeConfirm
    })
  }

  const handleResetChrono = () => {
    setConfirmDialog({
      isOpen: true,
      message: '¿Reiniciar el cronómetro a 00:00?\n\nAtención: esto afectará al cálculo de minutos jugados de los jugadores en pista.',
      onConfirm: () => { setChrono(0); closeConfirm() },
      onCancel:  closeConfirm
    })
  }

  function closeConfirm() { setConfirmDialog({ isOpen:false, message:'', onConfirm:null, onCancel:null }) }

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      await exportMatchToPdf(match, players, team)
    } finally {
      setExportingPdf(false)
    }
  }

  function closeFinalizeInfo() {
    const wasFinalized = finalizeInfo?.tone !== 'error'
    setFinalizeInfo(null)
    if (wasFinalized) onClose()
  }

  // ── Position colors ──────────────────────────────────────────────────
  const positionColors = { 'Portero':'#EF4444', 'Cierre':'#F97316', 'Ala Diestro':'#3B82F6', 'Ala Zurdo':'#22C55E', 'Pivot':'#A855F7' }

  const saveStatusLabel = saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'saved' ? 'Guardado' : saveStatus === 'error' ? 'Error al guardar' : null
  const saveStatusColor = saveStatus === 'saving' ? '#f59e0b' : saveStatus === 'saved' ? '#22c55e' : '#ef4444'

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="header-top">
        <div>
          <button className="btn btn-back" onClick={onClose}>
            <ArrowLeftIcon size={15}/> Atrás
          </button>
          <h2 style={{display:'inline-block',marginLeft:16,marginTop:0,fontSize:22}}>{match.rival_team_name} · {match.place}</h2>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
          {isReadOnly ? (
            <span style={{fontSize:12, color:'#666', fontWeight:700, background:'rgba(0,0,0,0.06)', padding:'6px 12px', borderRadius:20}}>
              Partido finalizado · solo lectura
            </span>
          ) : (
            <>
              {saveStatusLabel && (
                <span style={{fontSize:12, color:saveStatusColor, fontWeight:700}}>{saveStatusLabel}</span>
              )}
              {isProcessing && <span style={{fontSize:12, color:'#f59e0b', fontWeight:700}}>Procesando...</span>}
              <button className="btn btn-secondary" onClick={autoSaveAll} disabled={isProcessing}>
                Guardar ahora
              </button>
            </>
          )}
        </div>
      </div>

      <div className="tracker-content">

        {/* Chrono */}
        {!isReadOnly && <div className="chrono-section">
          <div className="chrono-title-row">
            <h3>Tiempo del partido {isChronoRunning && <span style={{color:'#2ecc71',fontSize:12}}>● EN DIRECTO</span>}</h3>
          </div>
          <div className="chrono-display" style={{animation: isChronoRunning ? 'pulse 1s infinite' : 'none', color: isChronoRunning ? '#2ecc71' : '#333'}}>
            {formatChrono(chrono)}
          </div>
          <div className="chrono-actions">
            <button className={`btn-chrono ${isChronoRunning ? 'running' : ''}`}
              onClick={() => setIsChronoRunning(p => !p)} disabled={isProcessing}>
              {isChronoRunning ? <PauseIcon size={14}/> : <PlayIcon size={14}/>} {isChronoRunning ? 'Pausar' : 'Reanudar'}
            </button>
            <button className="btn btn-secondary btn-secondary-small" style={{marginTop:0}} onClick={handleResetChrono} disabled={isProcessing}>
              Reiniciar
            </button>
          </div>
        </div>}

        {/* Scoreboard — our team always shown first, regardless of home/away */}
        <div className="live-scoreboard">
          <div className="score-team">
            <span className="score-label">{ourTeamName} ({isHome ? 'Local' : 'Visitante'})</span>
            <strong>{ourScore}</strong>
          </div>
          <div className="score-separator">-</div>
          <div className="score-team">
            <span className="score-label">{match.rival_team_name}</span>
            <strong>{rivalScore}</strong>
          </div>
        </div>

        {/* Read-only player stats summary (finished matches) */}
        {isReadOnly && (
          <div className="on-field-section">
            <h3>Jugadores ({finishedPlayerStats.length})</h3>
            <div className="on-field-table-container">
              <table className="on-field-table">
                <thead>
                  <tr>
                    <th>#</th><th>Nombre</th><th>Pos.</th>
                    <th>Goles</th><th>Asist.</th><th>T.Puerta</th><th>Fuera</th><th>Faltas</th>
                    <th><span style={{display:'inline-block',width:14,height:14,borderRadius:3,background:'#fbbf24',verticalAlign:'middle'}}/></th>
                    <th><span style={{display:'inline-block',width:14,height:14,borderRadius:3,background:'#ef4444',verticalAlign:'middle'}}/></th>
                    <th>Tiempo</th>
                  </tr>
                </thead>
                <tbody>
                  {finishedPlayerStats.map(({ player, st }) => (
                    <tr key={player.id} className="player-row-stats">
                      <td className="dorsal-col">#{player.dorsal}</td>
                      <td className="name-col">{player.name} {player.surname}</td>
                      <td className="position-col">
                        <span className="position-badge-small" style={{backgroundColor: positionColors[player.position] || '#999'}}>
                          {(player.position || '?').slice(0,3)}
                        </span>
                      </td>
                      <td style={{textAlign:'center'}}>{st.goals??0}</td>
                      <td style={{textAlign:'center'}}>{st.assists??0}</td>
                      <td style={{textAlign:'center'}}>{st.shots_on_goal??0}</td>
                      <td style={{textAlign:'center'}}>{st.shots_out??0}</td>
                      <td style={{textAlign:'center'}}>{st.fouls??0}</td>
                      <td style={{textAlign:'center'}}>{st.yellow_cards??0}</td>
                      <td style={{textAlign:'center'}}>{st.red_cards??0}</td>
                      <td><span className="live-time-badge">{formatChrono(st.minutes_played??0)}</span></td>
                    </tr>
                  ))}
                  {finishedPlayerStats.length === 0 && (
                    <tr><td colSpan={11} style={{textAlign:'center',color:'#999',padding:'16px',fontStyle:'italic'}}>Sin estadísticas guardadas para este partido</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* On-field players */}
        {!isReadOnly && <div className="on-field-section">
          <h3>En Pista ({currentOnField.length}/5)
            {currentOnField.length < 5 && <span style={{color:'#f59e0b', fontSize:12, marginLeft:8}}>· {5 - currentOnField.length} plaza(s) libre(s)</span>}
            {currentOnField.length === 5 && <span style={{color:'#22c55e', fontSize:12, marginLeft:8}}>· Quinteto completo</span>}
          </h3>
          <div className="on-field-table-container">
            <table className="on-field-table">
              <thead>
                <tr>
                  <th>#</th><th>Nombre</th><th>Pos.</th>
                  <th>Goles</th><th>Asist.</th><th>T.Puerta</th><th>Fuera</th><th>Faltas</th>
                  <th><span style={{display:'inline-block',width:14,height:14,borderRadius:3,background:'#fbbf24',verticalAlign:'middle'}}/></th>
                  <th><span style={{display:'inline-block',width:14,height:14,borderRadius:3,background:'#ef4444',verticalAlign:'middle'}}/></th>
                  <th>Tiempo</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentOnField.map(onField => {
                  const player = players.find(p => p.id === onField.player_id)
                  const st = playerStats[onField.player_id] || {}
                  if (!player) return null
                  const pid = onField.player_id
                  return (
                    <tr key={onField.id} className="player-row-stats">
                      <td className="dorsal-col">#{player.dorsal}</td>
                      <td className="name-col">{player.name} {player.surname}</td>
                      <td className="position-col">
                        <span className="position-badge-small" style={{backgroundColor: positionColors[player.position] || '#999'}}>
                          {(player.position || '?').slice(0,3)}
                        </span>
                      </td>
                      <td><StatStepper value={st.goals??0}         onChange={v=>handleUpdatePlayerStat(pid,'goals',v)}         onBlur={()=>flushStatSave(pid)}/></td>
                      <td><StatStepper value={st.assists??0}       onChange={v=>handleUpdatePlayerStat(pid,'assists',v)}       onBlur={()=>flushStatSave(pid)}/></td>
                      <td><StatStepper value={st.shots_on_goal??0} onChange={v=>handleUpdatePlayerStat(pid,'shots_on_goal',v)} onBlur={()=>flushStatSave(pid)}/></td>
                      <td><StatStepper value={st.shots_out??0}     onChange={v=>handleUpdatePlayerStat(pid,'shots_out',v)}     onBlur={()=>flushStatSave(pid)}/></td>
                      <td><StatStepper value={st.fouls??0}         onChange={v=>handleUpdatePlayerStat(pid,'fouls',v)}         onBlur={()=>flushStatSave(pid)}/></td>
                      <td><StatStepper value={st.yellow_cards??0}  onChange={v=>handleUpdatePlayerStat(pid,'yellow_cards',v)}  onBlur={()=>flushStatSave(pid)}/></td>
                      <td><StatStepper value={st.red_cards??0}     onChange={v=>handleUpdatePlayerStat(pid,'red_cards',v)}     onBlur={()=>flushStatSave(pid)}/></td>
                      <td><span className="live-time-badge">{getPlayerLiveTime(onField)}</span></td>
                      <td className="actions-col">
                        <button className="btn-small-action" onClick={() => setSelectedPlayerForChange(onField.id)} disabled={isProcessing}>Cambiar</button>
                        <button type="button" style={deleteButtonStyle} onClick={() => handleRemoveFromField(onField.id)} disabled={isProcessing} title="Retirar de pista" aria-label="Retirar de pista"
                          onMouseEnter={e=>{e.currentTarget.style.background='#ffecec';e.currentTarget.style.color='#a82d2d';e.currentTarget.style.borderColor='rgba(200,69,69,0.55)';e.currentTarget.style.transform='translateY(-1px) scale(1.03)'}}
                          onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='#c84545';e.currentTarget.style.borderColor='rgba(200,69,69,0.35)';e.currentTarget.style.transform='none'}}>
                          <XIcon size={12}/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {currentOnField.length === 0 && (
                  <tr><td colSpan={13} style={{textAlign:'center',color:'#999',padding:'16px',fontStyle:'italic'}}>No hay jugadores en pista</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>}

        {/* Bench */}
        {!isReadOnly && <div className="bench-section">
          <h3>Suplentes ({benchPlayers.length})</h3>
          {currentOnField.length >= 5 && (
            <p className="bench-limit-note" style={{color:'#f59e0b',fontSize:12,margin:'4px 0'}}>
              Quinteto completo. Para añadir a alguien usa "Cambiar" o retira un jugador primero.
            </p>
          )}
          <div className="bench-list">
            {benchPlayers.map(player => (
              <button key={player.id} className="bench-player"
                onClick={() => handleAddPlayerToField(player.id)}
                disabled={currentOnField.length >= 5 || isProcessing}>
                #{player.dorsal} {player.name}
              </button>
            ))}
            {benchPlayers.length === 0 && (
              <span style={{fontSize:12,color:'#999',fontStyle:'italic'}}>Todos los jugadores están en pista</span>
            )}
          </div>
        </div>}

        {/* Substitution panel */}
        {!isReadOnly && selectedPlayerForChange && (
          <div className="substitution-modal">
            <h4>Selecciona el jugador que entra {isProcessing && '(procesando...)'}</h4>
            {benchPlayers.length === 0
              ? <p style={{color:'#999',fontSize:13}}>No hay jugadores disponibles en el banquillo.</p>
              : <div className="substitution-list">
                  {benchPlayers.map(player => (
                    <button key={player.id} onClick={() => handleSubstitution(selectedPlayerForChange, player.id)} disabled={isProcessing}>
                      #{player.dorsal} {player.name}
                    </button>
                  ))}
                </div>
            }
            <button className="btn btn-secondary" style={{marginTop:0}} onClick={() => setSelectedPlayerForChange(null)} disabled={isProcessing}>Cancelar</button>
          </div>
        )}

        {/* Rival stats */}
        <div className="rival-section">
          <h3>Rival: {match.rival_team_name}</h3>
          <div className="rival-stats-grid">
            {[
              ['goals','Goles'], ['shots_on_goal','Tiros a puerta'], ['fouls','Faltas'],
              ['yellow_cards','Amarillas'], ['red_cards','Rojas']
            ].map(([key, label]) => (
              <label key={key} className="rival-stat-field">
                <span>{label}</span>
                {isReadOnly
                  ? <span className="live-time-badge">{rivalStats[key]??0}</span>
                  : <StatStepper value={rivalStats[key]??0} onChange={v=>handleUpdateRivalStat(key,v)} onBlur={persistRivalStats}/>
                }
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="match-notes-section">
          <label htmlFor="match-notes">Anotaciones del partido</label>
          {isReadOnly ? (
            <p className="small" style={{margin:0}}>{matchNotes || 'Sin anotaciones.'}</p>
          ) : (
            <textarea id="match-notes" rows={4} value={matchNotes}
              onChange={e=>setMatchNotes(e.target.value)}
              onBlur={() => api.updateMatchNotes({match_id:match.id, notes:matchNotes}).catch(console.error)}
              placeholder="Observaciones, incidencias, tácticas usadas..."
            />
          )}
        </div>

        {/* Footer actions */}
        <div className="match-footer-actions">
          {isReadOnly ? (
            <>
              <button className="btn btn-secondary" style={{marginTop:0}} onClick={onClose}>Volver</button>
              <button className="btn" style={{marginTop:0}} onClick={handleExportPdf} disabled={exportingPdf}>
                <DownloadIcon size={13}/> {exportingPdf ? 'Generando...' : 'Exportar PDF'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" style={{marginTop:0}} onClick={onClose}>Salir sin finalizar</button>
              <button className="btn btn-danger" style={{marginTop:0}} onClick={handleFinalizeMatch} disabled={isProcessing}>
                Finalizar partido
              </button>
            </>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmDialog.isOpen && (
        <div style={dlgOverlay} onClick={() => confirmDialog.onCancel?.()}>
          <div style={dlgContent} onClick={e=>e.stopPropagation()}>
            <div style={dlgMsg}>{confirmDialog.message.split('\n').map((l,i)=><div key={i}>{l || <br/>}</div>)}</div>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-secondary" style={{...dlgBtn, marginTop:0}} onClick={()=>confirmDialog.onCancel?.()}>Cancelar</button>
              <button className="btn btn-danger" style={{...dlgBtn, marginTop:0}} onClick={()=>confirmDialog.onConfirm?.()}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Red card expulsion alert */}
      {redCardAlert && (
        <div style={dlgOverlay} onClick={handleRedCardDismiss}>
          <div style={{...dlgContent, borderTop:'4px solid #ef4444'}} onClick={e=>e.stopPropagation()}>
            <div style={{...dlgMsg, color:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
              <span style={{display:'inline-block',width:14,height:18,borderRadius:3,background:'#ef4444'}}/>
              Tarjeta roja
            </div>
            <div style={dlgMsg}><strong>{redCardAlert.playerName}</strong> ha recibido tarjeta roja.<br/>¿Retirar al jugador de la pista?</div>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-secondary" style={{...dlgBtn, marginTop:0}} onClick={handleRedCardDismiss}>No, mantener</button>
              <button className="btn btn-danger" style={{...dlgBtn, marginTop:0}} onClick={handleRedCardRemove}>Sí, retirar</button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize result dialog */}
      {finalizeInfo && (
        <div style={dlgOverlay} onClick={closeFinalizeInfo}>
          <div style={{...dlgContent, borderTop:`4px solid ${finalizeToneColor(finalizeInfo.tone)}`}} onClick={e=>e.stopPropagation()}>
            <div style={{...dlgMsg, color:finalizeToneColor(finalizeInfo.tone), display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:12}}>
              <FinalizeToneIcon tone={finalizeInfo.tone}/>
              {finalizeInfo.title}
            </div>
            <div style={dlgMsg}>{finalizeInfo.message.split('\n').map((l,i)=><div key={i}>{l || <br/>}</div>)}</div>
            <button className="btn btn-primary" style={{...dlgBtn, marginTop:0, width:'100%'}} onClick={closeFinalizeInfo}>Aceptar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────
const deleteButtonStyle = {
  display:'inline-flex', alignItems:'center', justifyContent:'center',
  width:'30px', height:'30px', marginLeft:'6px',
  border:'1px solid rgba(200,69,69,0.35)', borderRadius:'999px',
  background:'#fff', color:'#c84545', fontSize:'16px', fontWeight:700,
  cursor:'pointer', transition:'all 0.18s ease'
}
const dlgOverlay = { position:'fixed', inset:0, background:'rgba(11,11,11,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000, backdropFilter:'blur(3px)' }
const dlgContent = { background:'linear-gradient(180deg,#fff 0%,#f8fbf7 100%)', border:'1px solid rgba(30,58,138,0.12)', borderRadius:'18px', padding:'26px 24px 22px', width:'min(420px,calc(100vw - 32px))', boxShadow:'0 24px 70px rgba(0,0,0,0.28)' }
const dlgMsg     = { color:'var(--text-dark)', fontSize:'15px', fontWeight:600, lineHeight:1.6, marginBottom:'20px', textAlign:'center', whiteSpace:'pre-line' }
const dlgBtn     = { flex:1, minHeight:'42px', padding:'10px 16px', border:'none', borderRadius:'10px', fontWeight:700, cursor:'pointer' }
