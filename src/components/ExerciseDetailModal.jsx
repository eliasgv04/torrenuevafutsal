import React, {useMemo, useState} from 'react'
import Lightbox from './Lightbox'
import { EyeIcon, EyeOffIcon } from './Icons'

export default function ExerciseDetailModal({exercise, trainings, onClose, onEdit, onToggleVisibility}){
  const [showLightbox, setShowLightbox] = useState(false)
  const [togglingVisibility, setTogglingVisibility] = useState(false)

  async function handleToggleVisibility(){
    if(!onToggleVisibility || togglingVisibility) return
    setTogglingVisibility(true)
    try{
      await onToggleVisibility()
    }finally{
      setTogglingVisibility(false)
    }
  }

  const usedIn = useMemo(() => {
    return (trainings || [])
      .map((training) => {
        const item = (training.items || []).find((i) => i.exercise_id === exercise.id)
        return item ? { id: training.id, date: training.training_date, dimensions: item.dimensions } : null
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [trainings, exercise.id])

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{maxWidth:760}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',flexWrap:'wrap',gap:8}}>
          <div>
            <h3 style={{margin:'0 0 4px'}}>{exercise.name}</h3>
            {exercise.is_public && <span className="exercise-card-category" style={{background:'#2563EB'}}>Público</span>}
          </div>
          <div style={{display:'flex',gap:8}}>
            {onToggleVisibility && (
              <button
                className="btn btn-icon-only"
                onClick={handleToggleVisibility}
                disabled={togglingVisibility}
                title={exercise.is_public ? 'Hacer privado' : 'Hacer público'}
                aria-label={exercise.is_public ? 'Hacer privado' : 'Hacer público'}
              >
                {exercise.is_public ? <EyeIcon size={16}/> : <EyeOffIcon size={16}/>}
              </button>
            )}
            {onEdit && <button className="btn" onClick={()=>onEdit()}>Editar</button>}
            <button className="btn btn-cancel" onClick={onClose}>Cerrar</button>
          </div>
        </div>
        <p className="small">{exercise.objective}</p>
        {exercise.photo_url && (
          <img
            src={exercise.photo_url} alt={exercise.name}
            onClick={() => setShowLightbox(true)}
            style={{width:'100%',borderRadius:10,objectFit:'cover',marginTop:12,maxHeight:360,cursor:'zoom-in'}}
          />
        )}
        {showLightbox && (
          <Lightbox src={exercise.photo_url} alt={exercise.name} onClose={() => setShowLightbox(false)} />
        )}
        {exercise.description && (
          <div style={{marginTop:16}}>
            <h4 style={{margin:'0 0 6px'}}>Descripción</h4>
            <p className="small" style={{whiteSpace:'pre-wrap'}}>{exercise.description}</p>
          </div>
        )}
        <div style={{marginTop:16}}>
          <h4>Usado en entrenamientos ({usedIn.length})</h4>
          {usedIn.length === 0 ? (
            <p className="small">Este ejercicio todavía no se ha incluido en ningún entrenamiento</p>
          ) : (
            <ul style={{paddingLeft:18}}>
              {usedIn.map(t => (
                <li key={t.id} style={{marginBottom:8}}>
                  <strong>{new Date(t.date).toLocaleDateString('es-ES')}</strong>{t.dimensions ? ` — ${t.dimensions}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
