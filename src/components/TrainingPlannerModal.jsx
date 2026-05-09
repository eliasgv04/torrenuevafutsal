import React, {useMemo, useState} from 'react'

export default function TrainingPlannerModal({exercises, players, onSave, onCancel}){
  const [trainingDate, setTrainingDate] = useState(new Date().toISOString().slice(0,10))
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState({})
  const [selectedPlayers, setSelectedPlayers] = useState({})
  const [objectives, setObjectives] = useState({
    fisicos: '',
    tecnicos: '',
    tacticos: '',
    psicologicos: ''
  })
  const [warmup, setWarmup] = useState('')

  const selectedCount = useMemo(
    ()=>Object.values(selected).filter(item=>item.selected).length,
    [selected]
  )

  function toggleExercise(ex){
    setSelected((current)=>{
      const prev = current[ex.id]
      return {
        ...current,
        [ex.id]: {
          selected: !prev?.selected,
          planned_count: prev?.planned_count ?? 1,
          dimensions: prev?.dimensions ?? '40x20',
          notes: prev?.notes ?? ''
        }
      }
    })
  }

  function updateExercise(exerciseId, field, value){
    setSelected((current)=>({
      ...current,
      [exerciseId]: {
        ...current[exerciseId],
        selected: true,
        [field]: value
      }
    }))
  }

  function submit(){
    const items = exercises
      .filter(ex=>selected[ex.id]?.selected)
      .map((ex)=>(
        {
          exercise_id: ex.id,
          exercise_name: ex.name,
          objective: ex.objective || '',
          category: ex.category || '',
          planned_count: Number(selected[ex.id]?.planned_count || 1),
          dimensions: selected[ex.id]?.dimensions || '',
          notes: selected[ex.id]?.notes || ''
        }
      ))

    if(items.length === 0){
      alert('Selecciona al menos un ejercicio para crear el entrenamiento')
      return
    }

    onSave({
      training_date: trainingDate,
      notes,
      items,
      selected_players: Object.keys(selectedPlayers).filter(id => selectedPlayers[id]),
      objectives,
      warmup
    })
  }

  const playersCount = Object.values(selectedPlayers).filter(Boolean).length

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{maxWidth:760}}>
        <h3>🗓️ Planificar entrenamiento</h3>
        <label>Fecha</label>
        <input type="date" value={trainingDate} onChange={(e)=>setTrainingDate(e.target.value)} />

        <label style={{marginTop: '12px'}}>Jugadores ({playersCount} seleccionados)</label>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:'6px', marginBottom:'12px', maxHeight:'100px', overflowY:'auto', border:'1px solid #ddd', padding:'8px', borderRadius:'4px'}}>
          {players && players.map((player) => (
            <label key={player.id} style={{display:'flex', alignItems:'center', gap:'6px', margin:0, fontSize:'11px'}}>
              <input
                type="checkbox"
                checked={Boolean(selectedPlayers[player.id])}
                onChange={(e) => setSelectedPlayers((prev) => ({ ...prev, [player.id]: e.target.checked }))}
              />
              #{player.dorsal} {player.name}
            </label>
          ))}
        </div>

        <label style={{marginTop: '12px'}}>Objetivos de la sesión (opcional)</label>
        <div style={{fontSize:'11px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'12px'}}>
          <textarea value={objectives.fisicos} onChange={(e) => setObjectives({...objectives, fisicos: e.target.value})} placeholder="Objetivos físicos" style={{minHeight:'50px'}} />
          <textarea value={objectives.tecnicos} onChange={(e) => setObjectives({...objectives, tecnicos: e.target.value})} placeholder="Objetivos técnicos" style={{minHeight:'50px'}} />
          <textarea value={objectives.tacticos} onChange={(e) => setObjectives({...objectives, tacticos: e.target.value})} placeholder="Tácticos/Estrategia" style={{minHeight:'50px'}} />
          <textarea value={objectives.psicologicos} onChange={(e) => setObjectives({...objectives, psicologicos: e.target.value})} placeholder="Psicológicos" style={{minHeight:'50px'}} />
        </div>

        <label>Calentamiento (opcional)</label>
        <textarea value={warmup} onChange={(e) => setWarmup(e.target.value)} placeholder="Describe el calentamiento..." style={{minHeight:'50px', marginBottom:'12px'}} />

        <label>Notas del entrenamiento (opcional)</label>
        <textarea
          value={notes}
          onChange={(e)=>setNotes(e.target.value)}
          placeholder="Objetivo general de la sesión, observaciones..."
          style={{minHeight:'80px'}}
        />

        <label>Ejercicios ({selectedCount} seleccionados)</label>
        <div className="training-list">
          {exercises.map((ex)=>(
            <div key={ex.id} className="training-item">
              <div className="training-item-top">
                <label style={{margin:0, display:'flex', alignItems:'center', gap:8, fontFamily:'Raleway, sans-serif'}}>
                  <input
                    type="checkbox"
                    checked={Boolean(selected[ex.id]?.selected)}
                    onChange={()=>toggleExercise(ex)}
                    style={{width:'auto', margin:0}}
                  />
                  <strong>{ex.name}</strong>
                </label>
                <span className="small">{ex.category || 'Sin categoría'}</span>
              </div>

              {selected[ex.id]?.selected && (
                <div className="training-item-fields">
                  <input
                    type="number"
                    min={1}
                    value={selected[ex.id]?.planned_count ?? 1}
                    onChange={(e)=>updateExercise(ex.id, 'planned_count', e.target.value)}
                    placeholder="Veces"
                  />
                  <input
                    value={selected[ex.id]?.dimensions ?? '40x20'}
                    onChange={(e)=>updateExercise(ex.id, 'dimensions', e.target.value)}
                    placeholder="Ej: 40x40"
                  />
                  <input
                    value={selected[ex.id]?.notes ?? ''}
                    onChange={(e)=>updateExercise(ex.id, 'notes', e.target.value)}
                    placeholder="Notas para este ejercicio"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="modal-buttons">
          <button className="btn btn-primary" onClick={submit}>Guardar entrenamiento</button>
          <button className="btn btn-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
