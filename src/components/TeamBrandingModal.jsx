import React, {useRef, useState} from 'react'
import { CameraIcon, TrashIcon } from './Icons'

export default function TeamBrandingModal({team, onSave, onCancel}){
  const [gradientStart,setGradientStart] = useState(team.gradient_start || '#1E3A8A')
  const [gradientEnd,setGradientEnd] = useState(team.gradient_end || '#2563EB')
  const [file,setFile] = useState(null)
  const [preview,setPreview] = useState(team.crest_url || null)
  const [removed,setRemoved] = useState(false)
  const [saving,setSaving] = useState(false)
  const fileInputRef = useRef(null)

  function handleFile(e){
    const f = e.target.files[0]
    if(!f) return
    setFile(f)
    setRemoved(false)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  function removeCrest(){
    setFile(null)
    setPreview(null)
    setRemoved(true)
    if(fileInputRef.current) fileInputRef.current.value = ''
  }

  async function submit(){
    setSaving(true)
    try{
      await onSave({gradient_start: gradientStart, gradient_end: gradientEnd, file, removed})
    }finally{
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Personalizar {team.name}</h3>

        <label>Escudo del equipo</label>
        <div className="crest-upload-row">
          <div className="crest-preview-wrap" onClick={()=>fileInputRef.current?.click()}>
            {preview ? (
              <>
                <img src={preview} alt="Escudo" className="crest-preview-img" />
                <div className="crest-preview-overlay">
                  <button
                    type="button"
                    className="crest-remove-btn"
                    title="Eliminar escudo"
                    aria-label="Eliminar escudo"
                    onClick={(e)=>{ e.stopPropagation(); removeCrest() }}
                  >
                    <TrashIcon size={16}/>
                  </button>
                </div>
              </>
            ) : (
              <div className="crest-placeholder">
                <CameraIcon size={22}/>
                <span>Subir escudo</span>
              </div>
            )}
          </div>
          <div className="crest-upload-actions">
            <button type="button" className="btn btn-secondary btn-secondary-small" onClick={()=>fileInputRef.current?.click()}>
              {preview ? 'Cambiar imagen' : 'Seleccionar archivo'}
            </button>
            <p className="crest-upload-hint">PNG o JPG</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{display:'none'}} />
        </div>

        <label style={{marginTop:'16px'}}>Color inicial del degradado</label>
        <input type="color" value={gradientStart} onChange={e=>setGradientStart(e.target.value)} style={{height:'42px',padding:'4px',cursor:'pointer'}} />

        <label>Color final del degradado</label>
        <input type="color" value={gradientEnd} onChange={e=>setGradientEnd(e.target.value)} style={{height:'42px',padding:'4px',cursor:'pointer'}} />

        <div
          style={{
            marginTop:'12px',
            height:'48px',
            borderRadius:'10px',
            background:`linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
            border:'1px solid rgba(0,0,0,0.08)'
          }}
        />

        <div className="modal-buttons">
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
          <button className="btn btn-cancel" onClick={onCancel} disabled={saving}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
