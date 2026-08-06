import React from 'react'
import {
  ArrowLeftIcon,
  DumbbellIcon,
  CalendarIcon,
  TrophyIcon,
  UsersIcon,
  BoardIcon,
  TrendingUpIcon
} from './Icons'

export default function TeamHub({
  team,
  counts,
  onBack,
  onOpenExercises,
  onOpenTrainings,
  onOpenMatches,
  onOpenRoster,
  onOpenBoard,
  onOpenStats,
  onOpenCalendar
}){
  const cards = [
    {
      key: 'exercises',
      icon: <DumbbellIcon size={26}/>,
      title: 'Ejercicios',
      desc: 'Catálogo, categorías y estadísticas de uso',
      count: counts?.exercises,
      onClick: onOpenExercises
    },
    {
      key: 'trainings',
      icon: <CalendarIcon size={26}/>,
      title: 'Entrenamientos',
      desc: 'Planificar sesiones y ver el historial',
      count: counts?.trainings,
      onClick: onOpenTrainings
    },
    {
      key: 'matches',
      icon: <TrophyIcon size={26}/>,
      title: 'Partidos',
      desc: 'Convocatorias, calendario y seguimiento en vivo',
      onClick: onOpenMatches
    },
    {
      key: 'roster',
      icon: <UsersIcon size={26}/>,
      title: 'Plantilla',
      desc: 'Jugadores, dorsales y estadísticas de carrera',
      count: counts?.players,
      onClick: onOpenRoster
    },
    {
      key: 'board',
      icon: <BoardIcon size={26}/>,
      title: 'Pizarra táctica',
      desc: 'Tablero interactivo para diseñar jugadas',
      onClick: onOpenBoard
    },
    {
      key: 'stats',
      icon: <TrendingUpIcon size={26}/>,
      title: 'Estadísticas',
      desc: 'Rendimiento de entrenamientos y de partidos',
      onClick: onOpenStats
    }
  ]

  return (
    <div>
      <div className="header-top">
        <div>
          <button className="btn btn-back" onClick={onBack}>
            <ArrowLeftIcon size={15}/> Atrás
          </button>
          <h2 style={{display:'inline-block',marginLeft:16,marginTop:0}}>{team.name}</h2>
        </div>
        <button className="btn btn-icon-only" onClick={onOpenCalendar} title="Calendario" aria-label="Calendario">
          <CalendarIcon size={18}/>
        </button>
      </div>

      <div className="hub-grid">
        {cards.map((card) => (
          <button key={card.key} className="hub-card" onClick={card.onClick}>
            {card.count != null && <span className="hub-card-count">{card.count}</span>}
            <span
              className="hub-card-icon"
              style={{background:`linear-gradient(135deg, ${team.gradient_start || '#1E3A8A'} 0%, ${team.gradient_end || '#2563EB'} 100%)`}}
            >
              {card.icon}
            </span>
            <span className="hub-card-title">{card.title}</span>
            <span className="hub-card-desc">{card.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
