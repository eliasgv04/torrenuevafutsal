import React, {useRef, useState} from 'react'
import { CameraIcon, TrashIcon } from './Icons'

// Curated dark gradients instead of a free color picker: they stay on-brand
// (dark, matching the app's own navy→electric look) while still spanning
// enough hues to roughly cover real kit colors — one per team stays legible
// and distinguishable from the others.
const GRADIENT_PRESETS = [
  { name: 'Azul marino',  start: '#1E3A8A', end: '#2563EB' },
  { name: 'Rojo',         start: '#7F1D1D', end: '#DC2626' },
  { name: 'Verde',        start: '#14532D', end: '#16A34A' },
  { name: 'Morado',       start: '#4C1D95', end: '#7C3AED' },
  { name: 'Grafito',      start: '#18181B', end: '#3F3F46' },
  { name: 'Naranja',      start: '#7C2D12', end: '#EA580C' },
  { name: 'Torrenueva',   start: '#1F6F23', end: '#FFD400' },
  { name: 'Granate',      start: '#4C0519', end: '#9F1239' },
]

export default function TeamBrandingModal({team, onSave, onCancel}){
  const isCreate = !team
  const [name,setName] = useState(team?.name || '')
  const [gradientStart,setGradientStart] = useState(team?.gradient_start || '#1E3A8A')
  const [gradientEnd,setGradientEnd] = useState(team?.gradient_end || '#2563EB')
  const [file,setFile] = useState(null)
  const [preview,setPreview] = useState(team?.crest_url || null)
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
    if(isCreate && !name.trim()) return
    setSaving(true)
    try{
      await onSave({name: name.trim(), gradient_start: gradientStart, gradient_end: gradientEnd, file, removed})
    }finally{
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{isCreate ? 'Nuevo equipo' : `Personalizar ${team.name}`}</h3>

        {isCreate && (
          <>
            <label>Nombre del equipo</label>
            <input
              type="text"
              value={name}
              onChange={(e)=>setName(e.target.value)}
              placeholder="Ej: Torrenueva Futsal"
              autoFocus
            />
          </>
        )}

        <label style={isCreate ? {marginTop:'16px'} : undefined}>Escudo del equipo</label>
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

        <label style={{marginTop:'16px'}}>Color del equipo</label>
        <div className="gradient-preset-grid">
          {GRADIENT_PRESETS.map((preset) => {
            const active = preset.start === gradientStart && preset.end === gradientEnd
            return (
              <button
                key={preset.name}
                type="button"
                className={`gradient-preset${active ? ' active' : ''}`}
                title={preset.name}
                aria-label={preset.name}
                onClick={() => { setGradientStart(preset.start); setGradientEnd(preset.end) }}
                style={{ background: `linear-gradient(135deg, ${preset.start} 0%, ${preset.end} 100%)` }}
              />
            )
          })}
        </div>

        <div className="modal-buttons">
          <button className="btn btn-primary" onClick={submit} disabled={saving || (isCreate && !name.trim())}>
            {saving ? 'Guardando...' : isCreate ? 'Crear equipo' : 'Guardar cambios'}
          </button>
          <button className="btn btn-cancel" onClick={onCancel} disabled={saving}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
