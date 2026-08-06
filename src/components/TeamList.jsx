import React, {useEffect, useState} from 'react'
import { api, uploadPhoto } from '../lib/api'
import ConfirmModal from './ConfirmModal'
import TeamBrandingModal from './TeamBrandingModal'
import { SoccerIcon, TrophyIcon, PaletteIcon, ShieldIcon, TrashIcon } from './Icons'

export default function TeamList({onOpen}){
  const [teams,setTeams] = useState([])
  const [creatingTeam,setCreatingTeam] = useState(false)
  const [confirmFor,setConfirmFor] = useState(null)
  const [brandingFor,setBrandingFor] = useState(null)

  useEffect(()=>{
    api.getTeams().then(setTeams)
  },[])

  async function remove(team){
    setConfirmFor(team)
  }

  async function doRemove(){
    if(!confirmFor) return
    await api.deleteTeam(confirmFor.id)
    setTeams(s => s.filter(item => item.id !== confirmFor.id))
    setConfirmFor(null)
  }

  async function createTeam({name, gradient_start, gradient_end, file}){
    const crest_url = file ? await uploadPhoto(file) : null
    const t = await api.createTeam(name, {gradient_start, gradient_end, crest_url})
    setTeams(s=>[t,...s])
    setCreatingTeam(false)
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
        <button className="btn btn-primary" onClick={()=>setCreatingTeam(true)}>+ Nuevo equipo</button>
      </div>
      
      {teams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><TrophyIcon size={72}/></div>
          <h3>No hay equipos aún</h3>
          <p>Crea tu primer equipo para comenzar a registrar entrenamientos y ejercicios</p>
          <button className="btn btn-primary" onClick={()=>setCreatingTeam(true)} style={{marginTop:'16px'}}>
            Crear primer equipo
          </button>
        </div>
      ) : (
        <div className="team-list">
          {teams.map(t => (
            <div className="card team-card" key={t.id} onClick={()=>onOpen && onOpen(t)}>
              <div className="team-card-actions">
                <button
                  className="team-card-icon-btn"
                  title="Personalizar equipo"
                  aria-label="Personalizar equipo"
                  onClick={(e)=>{ e.stopPropagation(); setBrandingFor(t) }}
                >
                  <PaletteIcon size={14}/>
                </button>
                <button
                  className="team-card-icon-btn danger"
                  title="Eliminar equipo"
                  aria-label="Eliminar equipo"
                  onClick={(e)=>{ e.stopPropagation(); remove(t) }}
                >
                  <TrashIcon size={14}/>
                </button>
              </div>
              <div
                className="team-card-banner"
                style={{background:`linear-gradient(135deg, ${t.gradient_start || '#1E3A8A'} 0%, ${t.gradient_end || '#2563EB'} 100%)`}}
              />
              <div className="team-card-crest">
                {t.crest_url ? (
                  <img src={t.crest_url} alt={`Escudo de ${t.name}`} />
                ) : (
                  <div className="team-card-crest-placeholder"><ShieldIcon size={24}/></div>
                )}
              </div>
              <h3>{t.name}</h3>
              <p className="small">Toca para abrir el equipo</p>
            </div>
          ))}
        </div>
      )}

      {creatingTeam && (
        <TeamBrandingModal
          onSave={createTeam}
          onCancel={()=>setCreatingTeam(false)}
        />
      )}
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
