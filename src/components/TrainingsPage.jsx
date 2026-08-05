import React, { useMemo, useState } from 'react'
import { parseItemNotes, isFichaTraining } from '../lib/trainingFicha'
import {
  ArrowLeftIcon,
  CalendarIcon,
  SearchIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  EditIcon,
  DownloadIcon,
  TrashIcon,
  CameraIcon,
  UsersIcon,
  DumbbellIcon
} from './Icons'

export default function TrainingsPage({
  trainings,
  players,
  onBack,
  onNewTraining,
  onExportTraining,
  onEditTraining,
  onDeleteTraining
}){
  const [expanded, setExpanded] = useState(() => new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showMonthChart, setShowMonthChart] = useState(false)
  const [showAttendance, setShowAttendance] = useState(false)

  const stats = useMemo(() => {
    const total = trainings.length
    const now = new Date()

    const thisMonth = trainings.filter((t) => {
      const d = new Date(t.training_date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length

    const rosterSize = players.length
    const attendanceRates = trainings
      .filter((t) => Array.isArray(t.attending_players) && rosterSize > 0)
      .map((t) => t.attending_players.length / rosterSize)
    const avgAttendance = attendanceRates.length
      ? Math.round((attendanceRates.reduce((sum, v) => sum + v, 0) / attendanceRates.length) * 100)
      : null

    const sortedByDate = [...trainings].sort((a, b) => new Date(b.training_date) - new Date(a.training_date))
    const lastDate = sortedByDate[0]?.training_date ? new Date(sortedByDate[0].training_date) : null
    const daysSinceLast = lastDate ? Math.floor((now - lastDate) / (1000 * 60 * 60 * 24)) : null

    const categoryMap = {}
    trainings.forEach((t) => (t.items || []).forEach((item) => {
      const key = item.category || 'Sin categoría'
      categoryMap[key] = (categoryMap[key] || 0) + 1
    }))
    const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

    const monthsMap = {}
    trainings.forEach((t) => {
      const d = new Date(t.training_date)
      if (Number.isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthsMap[key] = (monthsMap[key] || 0) + 1
    })
    const monthData = Object.entries(monthsMap)
      .map(([key, value]) => {
        const [y, m] = key.split('-')
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
        return { key, label, value }
      })
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-8)
    const maxMonth = monthData.reduce((max, item) => Math.max(max, item.value), 0) || 1

    const playerAttendance = players
      .map((p) => ({
        id: p.id,
        dorsal: p.dorsal,
        name: p.name,
        surname: p.surname,
        count: trainings.filter((t) => Array.isArray(t.attending_players) && t.attending_players.includes(p.id)).length
      }))
      .sort((a, b) => b.count - a.count || (a.dorsal || 0) - (b.dorsal || 0))

    return { total, thisMonth, avgAttendance, daysSinceLast, topCategory, monthData, maxMonth, playerAttendance }
  }, [trainings, players])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return trainings
      .filter((training) => {
        const d = training.training_date ? new Date(training.training_date) : null
        const fromOk = !dateFrom || (d && d >= new Date(dateFrom))
        const toOk = !dateTo || (d && d <= new Date(dateTo))
        if (!fromOk || !toOk) return false
        if (!term) return true
        const joined = `${training.notes || ''} ${(training.items || [])
          .map((item) => {
            const parsed = parseItemNotes(item.notes)
            return `${item.exercise_name || ''} ${item.category || ''} ${item.objective || ''} ${parsed.text} ${parsed.extra_text}`
          })
          .join(' ')}`.toLowerCase()
        return joined.includes(term)
      })
      .sort((a, b) => new Date(b.training_date) - new Date(a.training_date))
  }, [trainings, search, dateFrom, dateTo])

  function toggleExpand(id){
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearFilters(){
    setSearch('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div>
      <div className="header-top">
        <div>
          <button className="btn btn-back" onClick={onBack}>
            <ArrowLeftIcon size={15}/> Atrás
          </button>
          <h2 style={{display:'inline-block',marginLeft:16,marginTop:0}}>Entrenamientos</h2>
        </div>
        <button className="btn btn-primary" onClick={onNewTraining}>+ Nuevo entrenamiento</button>
      </div>

      <div className="dashboard-kpis" style={{marginBottom:16}}>
        <div className="kpi-card"><span>Total</span><strong>{stats.total}</strong></div>
        <div className="kpi-card"><span>Este mes</span><strong>{stats.thisMonth}</strong></div>
        <div className="kpi-card"><span>Asistencia media</span><strong>{stats.avgAttendance != null ? `${stats.avgAttendance}%` : '—'}</strong></div>
        <div className="kpi-card"><span>Último entrenamiento</span><strong>{stats.daysSinceLast == null ? '—' : stats.daysSinceLast === 0 ? 'Hoy' : `Hace ${stats.daysSinceLast}d`}</strong></div>
        <div className="kpi-card"><span>Categoría más trabajada</span><strong>{stats.topCategory}</strong></div>
      </div>

      {stats.monthData.length > 0 && (
        <section className="chart-panel collapsible" style={{marginBottom:12}}>
          <button className="chart-panel-toggle" onClick={() => setShowMonthChart((s) => !s)}>
            <h4>Entrenamientos por mes</h4>
            {showMonthChart ? <ChevronUpIcon size={14}/> : <ChevronDownIcon size={14}/>}
          </button>
          {showMonthChart && (
            <div className="month-chart" style={{marginTop:10}}>
              {stats.monthData.map((item) => (
                <div key={item.key} className="month-col">
                  <div className="month-bar-wrap">
                    <div className="month-bar" style={{height:`${Math.max(14, Math.round((item.value / stats.maxMonth) * 120))}px`}} />
                  </div>
                  <span className="month-value">{item.value}</span>
                  <span className="month-label">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {stats.total > 0 && stats.playerAttendance.length > 0 && (
        <section className="chart-panel collapsible" style={{marginBottom:16}}>
          <button className="chart-panel-toggle" onClick={() => setShowAttendance((s) => !s)}>
            <h4>Asistencia por jugador</h4>
            {showAttendance ? <ChevronUpIcon size={14}/> : <ChevronDownIcon size={14}/>}
          </button>
          {showAttendance && (
          <div className="bars-list" style={{marginTop:10}}>
            {stats.playerAttendance.map((p) => (
              <div key={p.id} className="bar-row">
                <div className="bar-label">#{p.dorsal} {p.name} {p.surname}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{width:`${Math.max(4, Math.round((p.count / stats.total) * 100))}%`}} />
                </div>
                <div className="bar-value">{p.count}/{stats.total}</div>
              </div>
            ))}
          </div>
          )}
        </section>
      )}

      <div className="exercise-search-row">
        <SearchIcon size={16}/>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por notas o ejercicios"
        />
      </div>

      <button className="btn" onClick={() => setShowFilters((s) => !s)}>
        Más filtros {showFilters ? <ChevronUpIcon size={13}/> : <ChevronDownIcon size={13}/>}
      </button>

      {showFilters && (
        <div className="filters-panel compact" style={{marginTop:10}}>
          <div className="filters-grid exercise-filters-grid">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <button className="btn btn-cancel" style={{marginTop:0}} onClick={clearFilters}>Limpiar</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><CalendarIcon size={72}/></div>
          <h3>{trainings.length === 0 ? 'Sin entrenamientos todavía' : 'No hay entrenamientos con esos filtros'}</h3>
          <p>{trainings.length === 0 ? 'Crea tu primer entrenamiento para empezar a llevar el registro.' : 'Prueba a limpiar filtros o ajustar la búsqueda.'}</p>
          {trainings.length === 0 && (
            <button className="btn btn-primary" onClick={onNewTraining} style={{marginTop:16}}>+ Nuevo entrenamiento</button>
          )}
        </div>
      ) : (
        <div className="training-list-page" style={{marginTop:16}}>
          {filtered.map((training) => {
            const isFicha = isFichaTraining(training)
            const isOpen = expanded.has(training.id)
            const categories = Array.from(new Set((training.items || []).map((i) => i.category).filter(Boolean)))
            const attendCount = Array.isArray(training.attending_players) ? training.attending_players.length : null

            return (
              <div key={training.id} className="training-summary-card">
                <div className="training-summary-head" onClick={() => toggleExpand(training.id)}>
                  <div className="training-summary-date">
                    <strong>{new Date(training.training_date).toLocaleDateString('es-ES', {weekday:'short', day:'numeric', month:'short', year:'numeric'})}</strong>
                    {isFicha && <span className="training-badge">ficha</span>}
                  </div>
                  <div className="training-summary-meta">
                    <span><DumbbellIcon size={13}/> {training.items?.length || 0} ejercicios</span>
                    {attendCount != null && <span><UsersIcon size={13}/> {attendCount} jugadores</span>}
                  </div>
                  <div className="training-summary-categories">
                    {categories.slice(0, 3).map((c) => <span key={c} className="training-category-pill">{c}</span>)}
                    {categories.length > 3 && <span className="training-category-pill">+{categories.length - 3}</span>}
                  </div>
                  <span className="training-summary-chevron">
                    {isOpen ? <ChevronUpIcon size={16}/> : <ChevronDownIcon size={16}/>}
                  </span>
                </div>

                {isOpen && (
                  <div className="training-summary-body">
                    {training.notes && <p className="small" style={{marginTop:0}}>{training.notes}</p>}
                    <ul>
                      {(training.items || []).map((item) => {
                        const parsed = parseItemNotes(item.notes)
                        return (
                          <li key={item.id || `${training.id}-${item.exercise_id}-${item.order_index || 0}`}>
                            <strong>{item.exercise_name}</strong>
                            {item.category ? ` (${item.category})` : ''}
                            {item.planned_count ? ` - ${item.planned_count} veces` : ''}
                            {item.dimensions ? ` - ${item.dimensions}` : ''}
                            {item.objective ? <div className="small">Objetivo: {item.objective}</div> : null}
                            {parsed.text ? <div className="small">Notas: {parsed.text}</div> : null}
                            {parsed.extra_text ? <div className="small">Notas extra: {parsed.extra_text}</div> : null}
                            {parsed.custom_photo_url ? <div className="small" style={{color:'#2563EB',display:'flex',alignItems:'center',gap:4}}><CameraIcon size={12}/> foto custom</div> : null}
                          </li>
                        )
                      })}
                    </ul>
                    <div className="training-summary-actions">
                      {onEditTraining && isFicha && (
                        <button className="btn" onClick={() => onEditTraining(training)}><EditIcon size={13}/> Editar</button>
                      )}
                      {onExportTraining && (
                        <button className="btn" onClick={() => onExportTraining(training)}><DownloadIcon size={13}/> Exportar PDF</button>
                      )}
                      {onDeleteTraining && (
                        <button className="btn btn-cancel" onClick={() => onDeleteTraining(training)}><TrashIcon size={13}/> Borrar</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
