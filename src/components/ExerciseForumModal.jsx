import React, {useState, useEffect, useMemo} from 'react'
import { api } from '../lib/api'
import { SearchIcon, LoaderIcon } from './Icons'

export default function ExerciseForumModal({onClose}){
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.getPublicExercises()
      .then(setExercises)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if(!q) return exercises
    return exercises.filter(e =>
      `${e.name} ${e.objective || ''} ${e.category || ''} ${e.team_name || ''}`.toLowerCase().includes(q)
    )
  }, [exercises, search])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-wide forum-modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'start'}}>
          <div>
            <h3 style={{margin:'0 0 4px'}}>Foro de ejercicios</h3>
            <p className="small" style={{margin:0}}>Ejercicios públicos compartidos por otros entrenadores. Solo lectura.</p>
          </div>
          <button className="btn btn-cancel" onClick={onClose}>Cerrar</button>
        </div>

        <div className="exercise-search-row" style={{marginTop:16}}>
          <SearchIcon size={16}/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, categoría o equipo..."
            autoFocus
          />
        </div>

        {loading ? (
          <div className="empty-state" style={{minHeight:200}}>
            <LoaderIcon size={40} className="spin" style={{marginBottom:12}}/>
            <p>Cargando foro...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{minHeight:200}}>
            <h3>{exercises.length === 0 ? 'Todavía no hay ejercicios públicos' : 'Sin resultados'}</h3>
            <p>{exercises.length === 0 ? 'Cuando algún equipo comparta uno, aparecerá aquí.' : 'Prueba con otra búsqueda.'}</p>
          </div>
        ) : (
          <div className="forum-grid">
            {filtered.map(ex => (
              <div className="card exercise-card forum-card" key={ex.id}>
                {ex.photo_url && <img src={ex.photo_url} alt={ex.name} loading="lazy" decoding="async" />}
                <div className="exercise-card-body">
                  <h3 style={{margin:'0 0 4px'}}>{ex.name}</h3>
                  {ex.category && <span className="exercise-card-category" style={{background:'#2196F3'}}>{ex.category}</span>}
                  <p className="small" style={{margin:'4px 0 0'}}>{ex.objective || 'Sin objetivo'}</p>
                </div>
                <p className="forum-card-team">Compartido por <strong>{ex.team_name}</strong></p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
