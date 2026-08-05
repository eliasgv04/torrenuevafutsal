import React, {useEffect, useState} from 'react'
import { api, uploadPhoto } from '../lib/api'
import InputModal from './InputModal'
import ConfirmModal from './ConfirmModal'
import TeamBrandingModal from './TeamBrandingModal'
import { SoccerIcon, TrophyIcon, PaletteIcon } from './Icons'

export default function TeamList({onOpen}){
  const [teams,setTeams] = useState([])
  const [showInput,setShowInput] = useState(false)
  const [confirmFor,setConfirmFor] = useState(null)
  const [brandingFor,setBrandingFor] = useState(null)

  useEffect(()=>{
    api.getTeams().then(setTeams)
  },[])

  async function add(name){
    const t = await api.createTeam(name)
    setTeams(s=>[t,...s])
    setShowInput(false)
  }

  async function remove(team){
    setConfirmFor(team)
  }

  async function doRemove(){
    if(!confirmFor) return
    await api.deleteTeam(confirmFor.id)
    setTeams(s => s.filter(item => item.id !== confirmFor.id))
    setConfirmFor(null)
  }

  async function saveBranding({gradient_start, gradient_end, file, removed}){
    if(!brandingFor) return
    let crest_url = brandingFor.crest_url
    if(file) crest_url = await uploadPhoto(file)
    else if(removed) crest_url = null
    const updated = await api.updateTeam(brandingFor.id, {gradient_start, gradient_end, crest_url})
    setTeams(s => s.map(t => t.id === brandingFor.id ? { ...t, ...updated } : t))
    setBrandingFor(null)
  }

  return (
    <div>
      <div className="header-top">
        <h2 style={{display:'flex',alignItems:'center',gap:8}}><SoccerIcon size={22}/> Equipos</h2>
        <button className="btn btn-primary" onClick={()=>setShowInput(true)}>+ Nuevo equipo</button>
      </div>
      
      {teams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><TrophyIcon size={72}/></div>
          <h3>No hay equipos aún</h3>
          <p>Crea tu primer equipo para comenzar a registrar entrenamientos y ejercicios</p>
          <button className="btn btn-primary" onClick={()=>setShowInput(true)} style={{marginTop:'16px'}}>
            Crear primer equipo
          </button>
        </div>
      ) : (
        <div className="team-list">
          {teams.map(t => (
            <div className="card team-card" key={t.id}>
              <button className="card-icon-btn" title="Personalizar equipo" aria-label="Personalizar equipo" onClick={()=>setBrandingFor(t)}>
                <PaletteIcon size={16}/>
              </button>
              <div className="team-card-crest">
                {t.crest_url ? (
                  <img src={t.crest_url} alt={`Escudo de ${t.name}`} />
                ) : (
                  <div className="team-card-crest-placeholder"><SoccerIcon size={24}/></div>
                )}
              </div>
              <h3>{t.name}</h3>
              <p className="small">Toca para ver ejercicios</p>
              <div
                style={{
                  height:'8px',
                  borderRadius:'999px',
                  margin:'8px 0 4px',
                  background:`linear-gradient(90deg, ${t.gradient_start || '#1E3A8A'} 0%, ${t.gradient_end || '#2563EB'} 100%)`
                }}
              />
              <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                <button className="btn" onClick={()=>onOpen && onOpen(t)}>Abrir equipo</button>
                <button className="btn btn-danger" onClick={()=>remove(t)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showInput && <InputModal title="Nombre del equipo" placeholder="Ej: Torrenueva Futsal" onConfirm={add} onCancel={()=>setShowInput(false)} />}
      {confirmFor && (
        <ConfirmModal
          title={`Eliminar ${confirmFor.name}`}
          message={`Eliminar el equipo "${confirmFor.name}"? Se borrarán también sus ejercicios y registros.`}
          onConfirm={doRemove}
          onCancel={()=>setConfirmFor(null)}
        />
      )}
      {brandingFor && (
        <TeamBrandingModal
          team={brandingFor}
          onSave={saveBranding}
          onCancel={()=>setBrandingFor(null)}
        />
      )}
    </div>
  )
}
