import React from 'react'
import { BarChartIcon, StarIcon, RulerIcon, CalendarIcon, CheckIcon } from './Icons'

function getCategoryColor(category){
  const colors = {
    'Técnica': '#4CAF50',
    'Táctica': '#2196F3',
    'Físico': '#FF9800',
    'Mental': '#9C27B0',
    'Otro': '#999'
  }
  return colors[category] || '#666'
}

export default function ExerciseCard({exercise, onAddRecord, onDelete, onOpenDetail, onEdit, selectable, selected, onToggleSelect}){
  return (
    <div
      className={`card exercise-card${selectable ? ' exercise-card-selectable' : ''}${selected ? ' exercise-card-selected' : ''}`}
      onClick={(e)=>{ if(selectable){ onToggleSelect && onToggleSelect(); return } if(onOpenDetail) onOpenDetail(); }}
      style={{cursor: (selectable || onOpenDetail) ? 'pointer' : 'default'}}
    >
      {selectable && (
        <div
          className={`exercise-card-checkbox${selected ? ' checked' : ''}`}
          onClick={(e)=>{ e.stopPropagation(); onToggleSelect && onToggleSelect(); }}
        >
          {selected && <CheckIcon size={13}/>}
        </div>
      )}
      {exercise.photo_url && <img src={exercise.photo_url} alt={exercise.name} loading="lazy" decoding="async" />}
      <div className="exercise-card-body">
        <h3 style={{margin:'0 0 4px'}}>{exercise.name}</h3>
        {exercise.category && <span className="exercise-card-category" style={{background:getCategoryColor(exercise.category)}}>{exercise.category}</span>}
        <p className="small" style={{margin:'4px 0 0'}}>{exercise.objective || 'Sin objetivo'}</p>
      </div>
      <div className="exercise-card-stats">
        <div className="exercise-card-stat"><BarChartIcon size={13}/> <strong>Veces:</strong>&nbsp;<span>{exercise.totalCount || 0}</span></div>
        <div className="exercise-card-stat"><StarIcon size={13}/> <strong>Efectividad:</strong>&nbsp;<span>{exercise.effectivenessAvg !== undefined ? Math.round(exercise.effectivenessAvg) : '—'}%</span></div>
        <div className="exercise-card-stat"><RulerIcon size={13}/> <strong>Pista:</strong>&nbsp;<span>{exercise.lastDimensions || exercise.dimensions || '—'}</span></div>
        <div className="exercise-card-stat"><CalendarIcon size={13}/> <strong>Última:</strong>&nbsp;<span>{exercise.lastDate ? new Date(exercise.lastDate).toLocaleDateString('es-ES') : '—'}</span></div>
      </div>
      {!selectable && (
        <div className="exercise-card-actions">
          {onAddRecord && <button className="btn" onClick={(e)=>{e.stopPropagation(); onAddRecord()}} style={{marginTop:0,flex:'1 1 180px'}}>+ Agregar registro</button>}
          {onEdit && <button className="btn" onClick={(e)=>{e.stopPropagation(); onEdit()}} style={{marginTop:0,flex:'1 1 120px'}}>Editar</button>}
          {onDelete && <button className="btn btn-danger" onClick={(e)=>{e.stopPropagation(); onDelete()}} style={{marginTop:0,flex:'1 1 120px'}}>Eliminar</button>}
        </div>
      )}
    </div>
  )
}
