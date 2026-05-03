import React, {useState} from 'react'

export default function CreateExerciseModal({onCreate, onCancel}){
  const [name,setName] = useState('')
  const [objective,setObjective] = useState('')
  const [file,setFile] = useState(null)
  const [preview,setPreview] = useState(null)
  const [category,setCategory] = useState('Técnica')

  function submit(){
    if(!name) return alert('Nombre requerido')
    onCreate({name,objective,file,category})
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
        <label>Foto (opcional)</label>
        <input type="file" accept="image/*" onChange={handleFile} />
        <div className="modal-buttons">
          <button className="btn btn-primary" onClick={submit}>Crear ejercicio</button>
          <button className="btn btn-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
