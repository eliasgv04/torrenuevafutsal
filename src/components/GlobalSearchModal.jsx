import React, {useState, useMemo} from 'react'
import { SearchIcon, XIcon, UsersIcon, DumbbellIcon, CalendarIcon } from './Icons'

const MAX_PER_GROUP = 8

export default function GlobalSearchModal({players, exercises, trainings, onClose, onSelectPlayer, onSelectExercise, onSelectTraining}){
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if(!q) return {players:[], exercises:[], trainings:[]}
    return {
      players: players
        .filter(p => `${p.name} ${p.surname} ${p.dorsal} ${p.position}`.toLowerCase().includes(q))
        .slice(0, MAX_PER_GROUP),
      exercises: exercises
        .filter(e => `${e.name} ${e.objective || ''} ${e.category || ''}`.toLowerCase().includes(q))
        .slice(0, MAX_PER_GROUP),
      trainings: trainings
        .filter(t => `${t.notes || ''} ${new Date(t.training_date).toLocaleDateString('es-ES')}`.toLowerCase().includes(q))
        .slice(0, MAX_PER_GROUP),
    }
  }, [query, players, exercises, trainings])

  const hasResults = results.players.length > 0 || results.exercises.length > 0 || results.trainings.length > 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-modal-input-row">
          <SearchIcon size={18}/>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar jugadores, ejercicios, entrenamientos..."
          />
          <button className="modal-close" onClick={onClose} aria-label="Cerrar"><XIcon size={16}/></button>
        </div>

        {!query.trim() && (
          <p className="small search-modal-hint">Escribe para buscar en toda la app del equipo.</p>
        )}

        {query.trim() && !hasResults && (
          <p className="small search-modal-hint">Sin resultados para "{query}"</p>
        )}

        {results.players.length > 0 && (
          <div className="search-result-group">
            <h4><UsersIcon size={13}/> Jugadores</h4>
            {results.players.map(p => (
              <button key={p.id} className="search-result-item" onClick={() => onSelectPlayer(p)}>
                <strong>{p.name} {p.surname}</strong>
                <span className="small">#{p.dorsal} · {p.position}</span>
              </button>
            ))}
          </div>
        )}

        {results.exercises.length > 0 && (
          <div className="search-result-group">
            <h4><DumbbellIcon size={13}/> Ejercicios</h4>
            {results.exercises.map(e => (
              <button key={e.id} className="search-result-item" onClick={() => onSelectExercise(e)}>
                <strong>{e.name}</strong>
                {e.category && <span className="small">{e.category}</span>}
              </button>
            ))}
          </div>
        )}

        {results.trainings.length > 0 && (
          <div className="search-result-group">
            <h4><CalendarIcon size={13}/> Entrenamientos</h4>
            {results.trainings.map(t => (
              <button key={t.id} className="search-result-item" onClick={() => onSelectTraining(t)}>
                <strong>{new Date(t.training_date).toLocaleDateString('es-ES')}</strong>
                {t.notes && <span className="small">{t.notes}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
