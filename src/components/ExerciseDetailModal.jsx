import React, {useEffect, useState} from 'react'
import { api } from '../lib/api'

export default function ExerciseDetailModal({exercise, onClose}){
  const [records,setRecords] = useState([])

  useEffect(()=>{
    if(!exercise) return
    api.getRecords(exercise.id).then(setRecords)
  },[exercise])

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{maxWidth:760}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}>
          <h3>{exercise.name}</h3>
          <button className="btn btn-cancel" onClick={onClose}>Cerrar</button>
        </div>
        <p className="small">{exercise.objective}</p>
        {exercise.photo_url && <img src={exercise.photo_url} alt={exercise.name} style={{width:'100%',borderRadius:10,objectFit:'cover',marginTop:12,maxHeight:360}} />}
        <div style={{marginTop:16}}>
          <h4>Registros ({records.length})</h4>
          {records.length === 0 ? (
            <p className="small">No hay registros para este ejercicio</p>
          ) : (
            <ul style={{paddingLeft:18}}>
              {records.map(r => (
                <li key={r.id} style={{marginBottom:8}}>
                  <strong>{new Date(r.occurred_at).toLocaleDateString('es-ES')}</strong> — {r.count} veces — {r.effectiveness}% {r.dimensions ? `— ${r.dimensions}` : ''}
                  {r.notes && <div className="small" style={{marginTop:4}}>{r.notes}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
