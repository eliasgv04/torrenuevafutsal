import React, {useMemo} from 'react'

export default function ExerciseDetailModal({exercise, trainings, onClose, onEdit}){
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
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}>
          <h3>{exercise.name}</h3>
          <div style={{display:'flex',gap:8}}>
            {onEdit && <button className="btn" onClick={()=>onEdit()}>Editar</button>}
            <button className="btn btn-cancel" onClick={onClose}>Cerrar</button>
          </div>
        </div>
        <p className="small">{exercise.objective}</p>
        {exercise.photo_url && <img src={exercise.photo_url} alt={exercise.name} style={{width:'100%',borderRadius:10,objectFit:'cover',marginTop:12,maxHeight:360}} />}
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
