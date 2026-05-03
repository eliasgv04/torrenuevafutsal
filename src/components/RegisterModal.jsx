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
        <input type="number" value={count} onChange={e=>setCount(e.target.value)} min={1} />
        <label>Efectividad (%)</label>
        <input type="number" value={effectiveness} onChange={e=>setEffectiveness(e.target.value)} min={0} max={100} />
        <label>Tamaño de pista</label>
        <select value={dimensions} onChange={e=>setDimensions(e.target.value)}>
          <option>20x20</option>
          <option>40x20</option>
          <option>28x20</option>

        </select>
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
