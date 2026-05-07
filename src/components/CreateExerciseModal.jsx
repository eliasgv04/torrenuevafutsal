import React, {useState} from 'react'

export default function CreateExerciseModal({onCreate, onCancel, onSave, initial}){
  const [name,setName] = useState(initial?.name || '')
  const [objective,setObjective] = useState(initial?.objective || '')
  const [file,setFile] = useState(null)
  const [preview,setPreview] = useState(initial?.photo_url || null)
  const [category,setCategory] = useState(initial?.category || 'Técnica')
  const [dimensions,setDimensions] = useState(initial?.dimensions || '')

  function submit(){
    if(!name) return alert('Nombre requerido')
    const payload = {name,objective,file,category,dimensions}
    if(onSave) return onSave(payload)
    if(onCreate) return onCreate(payload)
  }

  function handleFile(e){
    const f = e.target.files[0]
    setFile(f)
    if(f){
      const reader = new FileReader()
      reader.onload = (ev) => setPreview(ev.target.result)
      reader.readAsDataURL(f)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>✨ Nuevo ejercicio</h3>
        {preview && <img src={preview} alt="preview" style={{width:'100%',borderRadius:'10px',marginBottom:'16px',maxHeight:'200px',objectFit:'cover'}} />}
        <label>Nombre del ejercicio</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej: Bordalás" autoFocus />
        <label>Objetivo</label>
        <input value={objective} onChange={e=>setObjective(e.target.value)} placeholder="Ej: Mandar el balón a la mierda" />
                <label>Categoría</label>
                <select value={category} onChange={e=>setCategory(e.target.value)}>
                  <option>Inicio balón</option>
                  <option>Movimientos tácticos/técnicos</option>
                  <option>Posesión</option>
                  <option>Principal</option>
                  <option>Defensa portero jugador</option>
                  <option>Ataque portero jugador</option>

                </select>
        <label>Dimensiones (ej: 40x40)</label>
        <input value={dimensions} onChange={e=>setDimensions(e.target.value)} placeholder="Ej: 40x40" />
        <label>Foto (opcional)</label>
        <input type="file" accept="image/*" onChange={handleFile} />
        <div className="modal-buttons">
          <button className="btn btn-primary" onClick={submit}>{onSave ? 'Guardar cambios' : 'Crear ejercicio'}</button>
          <button className="btn btn-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
