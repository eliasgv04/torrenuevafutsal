import React, {useState, useRef, useEffect} from 'react'
import { CameraIcon, TrashIcon } from './Icons'

export default function CreateExerciseModal({onCreate, onCancel, onSave, initial}){
  const [name,setName] = useState(initial?.name || '')
  const [objective,setObjective] = useState(initial?.objective || '')
  const [description,setDescription] = useState(initial?.description || '')
  const [file,setFile] = useState(null)
  const [preview,setPreview] = useState(initial?.photo_url || null)
  const [category,setCategory] = useState(initial?.category || 'Inicio balón')
  const [dimensions,setDimensions] = useState(initial?.dimensions || '')
  const [isPublic,setIsPublic] = useState(initial?.is_public || false)
  const [dragOver,setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  function submit(){
    if(!name) return alert('Nombre requerido')
    const payload = {name,objective,description,file,category,dimensions,is_public:isPublic}
    if(onSave) return onSave(payload)
    if(onCreate) return onCreate(payload)
  }

  function setImage(f){
    if(!f || !f.type.startsWith('image/')) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  function removeImage(){
    setFile(null)
    setPreview(null)
    if(fileInputRef.current) fileInputRef.current.value = ''
  }

  // Paste an image straight from the clipboard (e.g. copied from WhatsApp,
  // a browser tab or another app) — no need to save it to disk first.
  useEffect(() => {
    function handlePaste(e){
      const item = Array.from(e.clipboardData?.items || []).find(it => it.type.startsWith('image/'))
      if(item) setImage(item.getAsFile())
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  function handleDrop(e){
    e.preventDefault()
    setDragOver(false)
    setImage(e.dataTransfer.files?.[0])
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Nuevo ejercicio</h3>
        <label>Foto (opcional)</label>
        <div className="crest-upload-row">
          <div
            className="crest-preview-wrap"
            style={{width:140, height:100, borderRadius:10, outline: dragOver ? '2px dashed #2563EB' : 'none', outlineOffset:2}}
            onClick={()=>fileInputRef.current?.click()}
            onDragOver={e=>{e.preventDefault(); setDragOver(true)}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={handleDrop}
          >
            {preview ? (
              <>
                <img src={preview} alt="Vista previa del ejercicio" className="crest-preview-img" />
                <div className="crest-preview-overlay">
                  <button
                    type="button"
                    className="crest-remove-btn"
                    title="Quitar imagen"
                    aria-label="Quitar imagen"
                    onClick={(e)=>{ e.stopPropagation(); removeImage() }}
                  >
                    <TrashIcon size={16}/>
                  </button>
                </div>
              </>
            ) : (
              <div className="crest-placeholder">
                <CameraIcon size={20}/>
                <span>Sube o pega una imagen</span>
              </div>
            )}
          </div>
          <div className="crest-upload-actions">
            <button type="button" className="btn btn-secondary btn-secondary-small" onClick={()=>fileInputRef.current?.click()}>
              {preview ? 'Cambiar imagen' : 'Seleccionar archivo'}
            </button>
            <p className="crest-upload-hint">O arrastra una imagen aquí, o pégala con Ctrl+V</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={e=>setImage(e.target.files[0])} style={{display:'none'}} />
        </div>

        <label>Nombre del ejercicio</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej: Bordalás" autoFocus />
        <label>Objetivo</label>
        <input value={objective} onChange={e=>setObjective(e.target.value)} placeholder="Ej: Mandar el balón a la mierda" />
        <label>Descripción (opcional)</label>
        <textarea
          value={description}
          onChange={e=>setDescription(e.target.value)}
          placeholder="Detalles del ejercicio: cómo se ejecuta, normas, variantes..."
          rows={4}
        />
        <p className="crest-upload-hint" style={{marginTop:-8}}>Solo se ve en el detalle del ejercicio, no se incluye en el PDF.</p>
        <label>Categoría</label>
        <input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Ej: inicio balón" list="exercise-categories" />
        <datalist id="exercise-categories">
          <option value="Inicio balón" />
          <option value="Movimientos tácticos/técnicos" />
          <option value="Posesión" />
          <option value="Principal" />
          <option value="Defensa portero jugador" />
          <option value="Ataque portero jugador" />
        </datalist>
        <label>Dimensiones (ej: 40x20)</label>
        <input value={dimensions} onChange={e=>setDimensions(e.target.value)} placeholder="Ej: 40x20" />

        <label className="exercise-public-toggle">
          <input type="checkbox" checked={isPublic} onChange={e=>setIsPublic(e.target.checked)} />
          <span>
            Hacer público
            <small>Visible para otros entrenadores en el Foro de ejercicios</small>
          </span>
        </label>

        <div className="modal-buttons">
          <button className="btn btn-primary" onClick={submit}>{onSave ? 'Guardar cambios' : 'Crear ejercicio'}</button>
          <button className="btn btn-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
