import React, {useEffect, useState} from 'react'
import { api } from '../lib/api'
import InputModal from './InputModal'
import ConfirmModal from './ConfirmModal'

export default function TeamList({onOpen}){
  const [teams,setTeams] = useState([])
  const [showInput,setShowInput] = useState(false)
  const [confirmFor,setConfirmFor] = useState(null)

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

  return (
    <div>
      <div className="header-top">
        <h2>⚽ Equipos</h2>
        <button className="btn btn-primary" onClick={()=>setShowInput(true)}>+ Nuevo equipo</button>
      </div>
      
      {teams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <h3>No hay equipos aún</h3>
          <p>Crea tu primer equipo para comenzar a registrar entrenamientos y ejercicios</p>
          <button className="btn btn-primary" onClick={()=>setShowInput(true)} style={{marginTop:'16px'}}>
            Crear primer equipo
          </button>
        </div>
      ) : (
        <div className="team-list">
          {teams.map(t => (
            <div className="card" key={t.id}>
              <h3>{t.name}</h3>
              <p className="small">Toca para ver ejercicios</p>
              <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                <button className="btn" onClick={()=>onOpen && onOpen(t)}>Abrir equipo</button>
                <button className="btn btn-danger" onClick={()=>remove(t)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showInput && <InputModal title="✨ Nombre del equipo" placeholder="Ej: Torrenueva Futsal" onConfirm={add} onCancel={()=>setShowInput(false)} />}
      {confirmFor && (
        <ConfirmModal
          title={`Eliminar ${confirmFor.name}`}
          message={`Eliminar el equipo "${confirmFor.name}"? Se borrarán también sus ejercicios y registros.`}
          onConfirm={doRemove}
          onCancel={()=>setConfirmFor(null)}
        />
      )}
    </div>
  )
}
