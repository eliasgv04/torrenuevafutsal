import React, { useState, useEffect, useMemo } from 'react'
import { api } from '../lib/api'
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, DumbbellIcon, TrophyIcon, LoaderIcon } from './Icons'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const TRAINING_COLOR = '#2563EB'

function dateKey(value){
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildMonthGrid(monthDate){
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7 // Monday-first
  const gridStart = new Date(year, month, 1 - firstWeekday)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

export default function TeamCalendar({ teamId, team, onBack }){
  const [monthDate, setMonthDate] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [trainings, setTrainings] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null)

  const matchColor = team?.gradient_end || '#F59E0B'

  useEffect(() => {
    setLoading(true)
    Promise.all([api.getTrainings(teamId), api.getMatches(teamId)])
      .then(([t, m]) => { setTrainings(t || []); setMatches(m || []) })
      .finally(() => setLoading(false))
  }, [teamId])

  const eventsByDay = useMemo(() => {
    const map = {}
    trainings.forEach(t => {
      const key = dateKey(t.training_date)
      if (!map[key]) map[key] = []
      map[key].push({ type: 'training', color: TRAINING_COLOR, date: t.training_date, data: t })
    })
    matches.forEach(m => {
      const key = dateKey(m.match_date)
      if (!map[key]) map[key] = []
      map[key].push({ type: 'match', color: matchColor, date: m.match_date, data: m })
    })
    Object.values(map).forEach(list => list.sort((a, b) => new Date(a.date) - new Date(b.date)))
    return map
  }, [trainings, matches, matchColor])

  const cells = useMemo(() => buildMonthGrid(monthDate), [monthDate])
  const todayKey = dateKey(new Date())
  const currentMonthIdx = monthDate.getMonth()
  const monthLabel = monthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  function goMonth(delta){
    setSelectedDay(null)
    setMonthDate(d => { const nd = new Date(d); nd.setMonth(nd.getMonth() + delta); return nd })
  }

  const agendaEvents = useMemo(() => {
    if (selectedDay) return eventsByDay[selectedDay] || []
    return cells
      .filter(d => d.getMonth() === currentMonthIdx)
      .flatMap(d => eventsByDay[dateKey(d)] || [])
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [selectedDay, eventsByDay, cells, currentMonthIdx])

  function eventMeta(ev){
    if (ev.type === 'training') {
      const count = Array.isArray(ev.data.attending_players) ? ev.data.attending_players.length : 0
      return `${count} jugador${count === 1 ? '' : 'es'} convocado${count === 1 ? '' : 's'}`
    }
    const m = ev.data
    const parts = [m.place, m.is_home === false ? 'Visitante' : 'Local']
    if (m.jornada) parts.push(`Jornada ${m.jornada}`)
    if (m.status === 'finished' && m.home_goals != null && m.away_goals != null) {
      const isHome = m.is_home !== false
      const our = isHome ? m.home_goals : m.away_goals
      const riv = isHome ? m.away_goals : m.home_goals
      parts.push(`Final ${our}-${riv}`)
    }
    return parts.filter(Boolean).join(' · ')
  }

  return (
    <div>
      <div className="header-top">
        <div>
          <button className="btn btn-back" onClick={onBack}>
            <ArrowLeftIcon size={15}/> Atrás
          </button>
          <h2 style={{display:'inline-block',marginLeft:16,marginTop:0}}>Calendario</h2>
        </div>
      </div>

      <div className="calendar-header">
        <button className="calendar-nav-btn" onClick={() => goMonth(-1)} aria-label="Mes anterior">
          <ChevronLeftIcon size={16}/>
        </button>
        <span className="calendar-month-label">{monthLabel}</span>
        <button className="calendar-nav-btn" onClick={() => goMonth(1)} aria-label="Mes siguiente">
          <ChevronRightIcon size={16}/>
        </button>
      </div>

      <div className="calendar-legend">
        <span className="calendar-legend-item"><span className="calendar-legend-dot" style={{background:TRAINING_COLOR}}/> Entrenamientos</span>
        <span className="calendar-legend-item"><span className="calendar-legend-dot" style={{background:matchColor}}/> Partidos</span>
      </div>

      {loading ? (
        <div className="empty-state">
          <LoaderIcon size={48} color="#fff" className="spin" style={{marginBottom:16}}/>
          <p style={{color:'#fff', fontSize:18, fontWeight:600, margin:0}}>Cargando calendario…</p>
        </div>
      ) : (
        <>
          <div className="calendar-grid">
            {WEEKDAYS.map(w => <div key={w} className="calendar-weekday">{w}</div>)}
            {cells.map((d, i) => {
              const key = dateKey(d)
              const isOutside = d.getMonth() !== currentMonthIdx
              const isToday = key === todayKey
              const isSelected = key === selectedDay
              const dayEvents = eventsByDay[key] || []
              const visible = dayEvents.slice(0, 2)
              const extra = dayEvents.length - visible.length
              return (
                <div
                  key={i}
                  className={`calendar-day${isOutside ? ' outside' : ''}${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelectedDay(isSelected ? null : key)}
                >
                  <span className="calendar-day-num">{d.getDate()}</span>
                  {visible.map((ev, idx) => (
                    <div key={idx} className="cal-event-pill" style={{background:ev.color}}>
                      {ev.type === 'training' ? 'Entreno' : `vs ${ev.data.rival_team_name}`}
                    </div>
                  ))}
                  {extra > 0 && <span className="cal-event-more">+{extra} más</span>}
                </div>
              )
            })}
          </div>

          <div className="calendar-agenda-title">
            {selectedDay
              ? new Date(selectedDay).toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' })
              : `Eventos de ${monthLabel}`}
          </div>

          {agendaEvents.length === 0 ? (
            <p className="small" style={{color:'rgba(255,255,255,0.85)'}}>
              Sin entrenamientos ni partidos {selectedDay ? 'ese día' : 'este mes'}.
            </p>
          ) : (
            <div className="calendar-agenda-list">
              {agendaEvents.map((ev, idx) => (
                <div key={idx} className="calendar-agenda-item" style={{borderLeftColor:ev.color}}>
                  <div className="calendar-agenda-icon" style={{background:ev.color}}>
                    {ev.type === 'training' ? <DumbbellIcon size={16}/> : <TrophyIcon size={16}/>}
                  </div>
                  <div className="calendar-agenda-body">
                    <div className="calendar-agenda-title-row">
                      {ev.type === 'training'
                        ? `Entrenamiento · ${new Date(ev.date).toLocaleDateString('es-ES', { day:'numeric', month:'short' })}`
                        : `vs ${ev.data.rival_team_name} · ${new Date(ev.date).toLocaleDateString('es-ES', { day:'numeric', month:'short' })}`}
                    </div>
                    <div className="calendar-agenda-meta">{eventMeta(ev)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
