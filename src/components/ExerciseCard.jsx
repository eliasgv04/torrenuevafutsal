import React from 'react'
import { BarChartIcon, StarIcon, RulerIcon, CalendarIcon } from './Icons'

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

export default function ExerciseCard({exercise, onAddRecord, onDelete, onOpenDetail, onEdit}){
  return (
    <div className="card" onClick={(e)=>{ if(onOpenDetail) onOpenDetail(); }} style={{cursor: onOpenDetail ? 'pointer' : 'default'}}>
      {exercise.photo_url && <img src={exercise.photo_url} alt={exercise.name} />}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:'8px'}}>
        <div style={{flex:1}}>
          <h3 style={{margin:'0 0 4px'}}>{exercise.name}</h3>
          <p className="small" style={{margin:0}}>{exercise.objective || 'Sin objetivo'}</p>
        </div>
        {exercise.category && <span style={{background:getCategoryColor(exercise.category),color:'#fff',padding:'4px 8px',borderRadius:'6px',fontSize:'11px',whiteSpace:'nowrap',marginLeft:'8px'}}>{exercise.category}</span>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'12px',fontSize:'13px',borderTop:'1px solid #eee',paddingTop:'12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:4}}><BarChartIcon size={13}/> <strong>Veces:</strong>&nbsp;{exercise.totalCount || 0}</div>
        <div style={{display:'flex',alignItems:'center',gap:4}}><StarIcon size={13}/> <strong>Efectividad:</strong>&nbsp;{exercise.effectivenessAvg !== undefined ? Math.round(exercise.effectivenessAvg) : '—'}%</div>
        <div style={{display:'flex',alignItems:'center',gap:4}}><RulerIcon size={13}/> <strong>Pista:</strong>&nbsp;{exercise.lastDimensions || exercise.dimensions || '—'}</div>
        <div style={{display:'flex',alignItems:'center',gap:4}}><CalendarIcon size={13}/> <strong>Última:</strong>&nbsp;{exercise.lastDate ? new Date(exercise.lastDate).toLocaleDateString('es-ES') : '—'}</div>
      </div>
      <div style={{display:'flex',gap:'10px',flexWrap:'wrap',marginTop:'12px'}}>
        {onAddRecord && <button className="btn" onClick={(e)=>{e.stopPropagation(); onAddRecord()}} style={{marginTop:0,flex:'1 1 180px'}}>+ Agregar registro</button>}
        {onEdit && <button className="btn" onClick={(e)=>{e.stopPropagation(); onEdit()}} style={{marginTop:0,flex:'1 1 120px'}}>Editar</button>}
        {onDelete && <button className="btn btn-danger" onClick={(e)=>{e.stopPropagation(); onDelete()}} style={{marginTop:0,flex:'1 1 120px'}}>Eliminar</button>}
      </div>
    </div>
  )
}
