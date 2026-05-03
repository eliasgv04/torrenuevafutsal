import React, {useEffect, useState} from 'react'
import ExerciseCard from './ExerciseCard'
import { api } from '../lib/api'
import CreateExerciseModal from './CreateExerciseModal'
import RegisterModal from './RegisterModal'
import ConfirmModal from './ConfirmModal'
import ExerciseDetailModal from './ExerciseDetailModal'

export default function TeamPage({team, onBack}){
  const [exercises,setExercises] = useState([])
  const [creating,setCreating] = useState(false)
  const [registerFor,setRegisterFor] = useState(null)
  const [confirmFor,setConfirmFor] = useState(null)
  const [detailFor,setDetailFor] = useState(null)

  useEffect(()=>{
    if(!team) return
    api.getExercises(team.id).then(setExercises)
  },[team])
  useEffect(()=>{
    if(exercises.length === 0) return
    loadExerciseWithRecords(exercises).then(setExercises)
  },[exercises.length])

  async function onCreate(data){
    const ex = await api.createExercise({...data, team_id: team.id})
    setExercises(s=>[ex,...s])
    setCreating(false)
  }

  async function loadExerciseWithRecords(exercises){
    const enriched = await Promise.all(exercises.map(async (ex)=>{
      const records = await api.getRecords(ex.id)
      const totalCount = records.reduce((sum, r) => sum + (r.count || 0), 0)
      const avgEff = records.length > 0 ? records.reduce((sum, r) => sum + (r.effectiveness || 0), 0) / records.length : 0
      const lastRecord = records[0]
      return {
        ...ex,
        totalCount,
        effectivenessAvg: avgEff,
        lastDate: lastRecord?.occurred_at,
        lastDimensions: lastRecord?.dimensions
      }
    }))
    return enriched
  }

  async function onSaveRecord(data){
    await api.createRecord({exercise_id: registerFor.id, ...data})
    const updated = await loadExerciseWithRecords(exercises)
    setExercises(updated)
    setRegisterFor(null)
  }

  async function onDeleteExercise(exercise){
    setConfirmFor(exercise)
  }

  async function doDeleteExercise(){
    if(!confirmFor) return
    await api.deleteExercise(confirmFor.id)
    setExercises(current => current.filter(item => item.id !== confirmFor.id))
    if(registerFor?.id === confirmFor.id) setRegisterFor(null)
    setConfirmFor(null)
  }
  return (
    <div>
      <div className="header-top">
        <div>
          <button className="btn btn-back" onClick={onBack}>← Atrás</button>
          <h2 style={{display:'inline-block',marginLeft:16,marginTop:0}}>{team.name}</h2>
        </div>
        <button className="btn btn-primary" onClick={()=>setCreating(true)}>+ Nuevo ejercicio</button>
      </div>

      {exercises.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏋️</div>
          <h3>Sin ejercicios aún</h3>
          <p>Crea tu primer ejercicio para comenzar a registrar entrenamientos</p>
          <button className="btn btn-primary" onClick={()=>setCreating(true)} style={{marginTop:'16px'}}>
            Crear primer ejercicio
          </button>
        </div>
      ) : (
        <div className="team-list">
          {exercises.map(e => (
            <ExerciseCard
              key={e.id}
              exercise={e}
              onAddRecord={()=>setRegisterFor(e)}
              onDelete={()=>onDeleteExercise(e)}
              onOpenDetail={()=>setDetailFor(e)}
            />
          ))}
        </div>
      )}

      {creating && <CreateExerciseModal onCreate={onCreate} onCancel={()=>setCreating(false)} />}
      {registerFor && <RegisterModal exercise={registerFor} onSave={onSaveRecord} onCancel={()=>setRegisterFor(null)} />}
      {confirmFor && (
        <ConfirmModal
          title={`Eliminar ${confirmFor.name}`}
          message={`Eliminar el ejercicio "${confirmFor.name}"? Se borrarán también sus registros.`}
          onConfirm={doDeleteExercise}
          onCancel={()=>setConfirmFor(null)}
        />
      )}
      {detailFor && (
        <ExerciseDetailModal exercise={detailFor} onClose={()=>setDetailFor(null)} />
      )}
    </div>
  )
}
