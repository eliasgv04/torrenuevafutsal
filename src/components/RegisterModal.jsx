import React, {useState} from 'react'

export default function RegisterModal({exercise, onSave, onCancel}){
  const [date,setDate] = useState(new Date().toISOString().slice(0,10))
  const [count,setCount] = useState(1)
  const [effectiveness,setEffectiveness] = useState(0)
  const [dimensions,setDimensions] = useState('20x20')
  const [notes,setNotes] = useState('')

  function save(){
    onSave({occurred_at:date,count:Number(count),effectiveness:Number(effectiveness),dimensions,notes})
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>📊 Registrar {exercise?.name || 'ejercicio'}</h3>
        <label>Fecha de ejecución</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
        <label>¿Cuántas veces?</label>
        <div className="stepper">
          <button type="button" onClick={()=>setCount(c=>Math.max(1, Number(c)-1))}>-</button>
          <input type="number" value={count} onChange={e=>setCount(e.target.value)} min={1} />
          <button type="button" onClick={()=>setCount(c=>Number(c)+1)}>+</button>
        </div>
        <label>Efectividad (%)</label>
        <div className="stepper">
          <button type="button" onClick={()=>setEffectiveness(v=>Math.max(0, Number(v)-1))}>-</button>
          <input type="number" value={effectiveness} onChange={e=>setEffectiveness(e.target.value)} min={0} max={100} />
          <button type="button" onClick={()=>setEffectiveness(v=>Math.min(100, Number(v)+1))}>+</button>
        </div>
        <label>Tamaño de pista</label>
        <input value={dimensions} onChange={e=>setDimensions(e.target.value)} placeholder="Ej: 40x40" />
        <label>Notas adicionales</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="¿Cómo fue el ejercicio?" style={{minHeight:'100px'}} />
        <div className="modal-buttons">
          <button className="btn btn-primary" onClick={save}>Guardar registro</button>
          <button className="btn btn-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
