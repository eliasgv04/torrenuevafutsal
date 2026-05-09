import React, {useEffect, useMemo, useState} from 'react'
import ExerciseCard from './ExerciseCard'
import { api } from '../lib/api'
import CreateExerciseModal from './CreateExerciseModal'
import RegisterModal from './RegisterModal'
import ConfirmModal from './ConfirmModal'
import ExerciseDetailModal from './ExerciseDetailModal'
import TrainingPlannerModal from './TrainingPlannerModal'
import TrainingHistoryModal from './TrainingHistoryModal'
import TeamDashboardModal from './TeamDashboardModal'
import FutsalPage from './FutsalPage'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export default function TeamPage({team, onBack}){
  const [exercises,setExercises] = useState([])
  const [creating,setCreating] = useState(false)
  const [editingExercise,setEditingExercise] = useState(null)
  const [registerFor,setRegisterFor] = useState(null)
  const [confirmFor,setConfirmFor] = useState(null)
  const [detailFor,setDetailFor] = useState(null)
  const [creatingTraining,setCreatingTraining] = useState(false)
  const [showTrainingHistory,setShowTrainingHistory] = useState(false)
  const [showDashboard,setShowDashboard] = useState(false)
  const [showFutsal, setShowFutsal] = useState(false)
  const [trainings,setTrainings] = useState([])
  const [showExerciseFilters,setShowExerciseFilters] = useState(false)
  const [showTrainingFilters,setShowTrainingFilters] = useState(false)
  const [searchText,setSearchText] = useState('')
  const [categoryFilter,setCategoryFilter] = useState('all')
  const [exerciseDateFrom,setExerciseDateFrom] = useState('')
  const [exerciseDateTo,setExerciseDateTo] = useState('')
  const [trainingSearch,setTrainingSearch] = useState('')
  const [trainingDateFrom,setTrainingDateFrom] = useState('')
  const [trainingDateTo,setTrainingDateTo] = useState('')

  const normalizeExerciseName = (value) => String(value || '').trim().toLowerCase()

  function isDuplicateExerciseName(name, currentExerciseId = null){
    const normalizedName = normalizeExerciseName(name)
    if(!normalizedName) return false
    return exercises.some((exercise) => {
      if(currentExerciseId && exercise.id === currentExerciseId) return false
      return normalizeExerciseName(exercise.name) === normalizedName
    })
  }

  useEffect(()=>{
    if(!team) return
    api.getExercises(team.id).then(setExercises)
    loadTrainingHistory(team.id)
  },[team])
  useEffect(()=>{
    if(exercises.length === 0) return
    loadExerciseWithRecords(exercises).then(setExercises)
  },[exercises.length])

  async function onCreate(data){
    if(isDuplicateExerciseName(data.name)){
      alert('Ya existe un ejercicio con ese nombre. Usa otro distinto.')
      return
    }
    const ex = await api.createExercise({...data, team_id: team.id})
    setExercises(s=>[ex,...s])
    setCreating(false)
  }

  async function onSaveEdit(data){
    if(!editingExercise) return
    if(isDuplicateExerciseName(data.name, editingExercise.id)){
      alert('Ya existe un ejercicio con ese nombre. Usa otro distinto.')
      return
    }
    const updated = await api.updateExercise(editingExercise.id, data)
    setExercises((current)=>current.map(item=> item.id === editingExercise.id ? updated : item))
    setEditingExercise(null)
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

  async function loadTrainingHistory(teamId){
    const basicTrainings = await api.getTrainings(teamId)
    const withItems = await Promise.all(
      basicTrainings.map(async (training)=>{
        const items = await api.getTrainingItems(training.id)
        return {...training, items}
      })
    )
    setTrainings(withItems)
  }

  async function onCreateTraining(payload){
    await api.createTraining({team_id: team.id, ...payload})
    await loadTrainingHistory(team.id)
    setCreatingTraining(false)
  }

  function exportTrainingsToPdf(){
    const dataForExport = filteredTrainings.length > 0 ? filteredTrainings : trainings
    if(dataForExport.length === 0){
      alert('No hay entrenamientos para exportar')
      return
    }

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`Entrenamientos - ${team.name}`, 14, 16)

    const rows = []
    dataForExport.forEach((training)=>{
      const date = new Date(training.training_date).toLocaleDateString('es-ES')
      ;(training.items || []).forEach((item)=>{
        rows.push([
          date,
          item.exercise_name || '-',
          item.category || '-',
          item.planned_count ?? '-',
          item.dimensions || '-',
          item.objective || '-',
          item.notes || '-',
          training.notes || '-'
        ])
      })
      if(!training.items?.length){
        rows.push([date, '-', '-', '-', '-', '-', '-', training.notes || '-'])
      }
    })

    autoTable(doc, {
      startY: 24,
      head: [['Fecha', 'Ejercicio', 'Categoría', 'Veces', 'Dimensiones', 'Objetivo', 'Notas ejercicio', 'Notas entrenamiento']],
      body: rows,
      styles: {fontSize: 8}
    })

    const safeTeam = team.name.replace(/\s+/g, '_')
    doc.save(`entrenamientos_${safeTeam}.pdf`)
  }

  function exportTrainingsToExcel(){
    const dataForExport = filteredTrainings.length > 0 ? filteredTrainings : trainings
    if(dataForExport.length === 0){
      alert('No hay entrenamientos para exportar')
      return
    }

    const rows = []
    dataForExport.forEach((training)=>{
      const date = new Date(training.training_date).toLocaleDateString('es-ES')
      ;(training.items || []).forEach((item)=>{
        rows.push({
          Fecha: date,
          Ejercicio: item.exercise_name || '-',
          Categoria: item.category || '-',
          Veces: item.planned_count ?? '-',
          Dimensiones: item.dimensions || '-',
          Objetivo: item.objective || '-',
          NotasEjercicio: item.notes || '-',
          NotasEntrenamiento: training.notes || '-'
        })
      })
      if(!training.items?.length){
        rows.push({
          Fecha: date,
          Ejercicio: '-',
          Categoria: '-',
          Veces: '-',
          Dimensiones: '-',
          Objetivo: '-',
          NotasEjercicio: '-',
          NotasEntrenamiento: training.notes || '-'
        })
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Entrenamientos')
    const safeTeam = team.name.replace(/\s+/g, '_')
    XLSX.writeFile(workbook, `entrenamientos_${safeTeam}.xlsx`)
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

  const categories = useMemo(
    ()=>['all', ...Array.from(new Set(exercises.map(ex=>ex.category).filter(Boolean)))],
    [exercises]
  )

  const filteredExercises = useMemo(()=>{
    const search = searchText.trim().toLowerCase()
    return exercises.filter((ex)=>{
      const textOk = !search || `${ex.name} ${ex.objective || ''} ${ex.category || ''}`.toLowerCase().includes(search)
      const categoryOk = categoryFilter === 'all' || ex.category === categoryFilter
      const lastDate = ex.lastDate ? new Date(ex.lastDate) : null
      const fromOk = !exerciseDateFrom || (lastDate && lastDate >= new Date(exerciseDateFrom))
      const toOk = !exerciseDateTo || (lastDate && lastDate <= new Date(exerciseDateTo))
      const dateOk = (!exerciseDateFrom && !exerciseDateTo) || (fromOk && toOk)
      return textOk && categoryOk && dateOk
    })
  }, [exercises, searchText, categoryFilter, exerciseDateFrom, exerciseDateTo])

  const filteredTrainings = useMemo(()=>{
    const search = trainingSearch.trim().toLowerCase()
    return trainings.filter((training)=>{
      const trainingDate = training.training_date ? new Date(training.training_date) : null
      const fromOk = !trainingDateFrom || (trainingDate && trainingDate >= new Date(trainingDateFrom))
      const toOk = !trainingDateTo || (trainingDate && trainingDate <= new Date(trainingDateTo))
      const dateOk = (!trainingDateFrom && !trainingDateTo) || (fromOk && toOk)
      if(!dateOk) return false
      if(!search) return true

      const joined = `${training.notes || ''} ${(training.items || []).map(item=>`${item.exercise_name || ''} ${item.category || ''} ${item.objective || ''} ${item.notes || ''}`).join(' ')}`.toLowerCase()
      return joined.includes(search)
    })
  }, [trainings, trainingSearch, trainingDateFrom, trainingDateTo])

  function clearExerciseFilters(){
    setSearchText('')
    setCategoryFilter('all')
    setExerciseDateFrom('')
    setExerciseDateTo('')
  }

  function clearTrainingFilters(){
    setTrainingSearch('')
    setTrainingDateFrom('')
    setTrainingDateTo('')
  }

  return (
    <div>
      {showFutsal ? (
        <FutsalPage teamId={team.id} onBack={() => setShowFutsal(false)} />
      ) : (
        <>
          <div className="header-top">
            <div>
              <button className="btn btn-back" onClick={onBack}>← Atrás</button>
              <h2 style={{display:'inline-block',marginLeft:16,marginTop:0}}>{team.name}</h2>
            </div>
            <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
              <button className="btn" onClick={()=>setShowDashboard(true)}>📈 Dashboard</button>
              <button className="btn" onClick={()=>setCreatingTraining(true)}>🗓️ Nuevo entrenamiento</button>
              <button className="btn" onClick={()=>setShowTrainingHistory(true)}>📚 Historial</button>
              <button className="btn btn-futsal" onClick={()=>setShowFutsal(true)}>⚽ Futsal</button>
              <button className="btn btn-primary" onClick={()=>setCreating(true)}>+ Nuevo ejercicio</button>
            </div>
          </div>

          <div className="compact-toolbar">
            <button className="btn" style={{marginTop:0}} onClick={()=>setShowExerciseFilters(s=>!s)}>
              🔎 Filtros ejercicios {showExerciseFilters ? '▲' : '▼'}
            </button>
        <button className="btn" style={{marginTop:0}} onClick={()=>setShowTrainingFilters(s=>!s)}>
          🗂️ Filtros historial {showTrainingFilters ? '▲' : '▼'}
        </button>
        <button className="btn" style={{marginTop:0}} onClick={()=>setShowTrainingHistory(true)}>
          Ver historial ({filteredTrainings.length})
        </button>
      </div>

      {showExerciseFilters && (
        <div className="filters-panel compact">
          <div className="filters-grid">
            <input
              value={searchText}
              onChange={(e)=>setSearchText(e.target.value)}
              placeholder="Buscar por nombre, objetivo o categoría"
            />
            <select value={categoryFilter} onChange={(e)=>setCategoryFilter(e.target.value)}>
              {categories.map((category)=>(
                <option key={category} value={category}>
                  {category === 'all' ? 'Todas las categorías' : category}
                </option>
              ))}
            </select>
            <input type="date" value={exerciseDateFrom} onChange={(e)=>setExerciseDateFrom(e.target.value)} />
            <input type="date" value={exerciseDateTo} onChange={(e)=>setExerciseDateTo(e.target.value)} />
            <button className="btn btn-cancel" style={{marginTop:0}} onClick={clearExerciseFilters}>Limpiar</button>
          </div>
        </div>
      )}

      {showTrainingFilters && (
        <div className="filters-panel compact" style={{marginTop:12}}>
          <div className="filters-grid training-filters-grid">
            <input
              value={trainingSearch}
              onChange={(e)=>setTrainingSearch(e.target.value)}
              placeholder="Buscar por notas o ejercicios del entrenamiento"
            />
            <input type="date" value={trainingDateFrom} onChange={(e)=>setTrainingDateFrom(e.target.value)} />
            <input type="date" value={trainingDateTo} onChange={(e)=>setTrainingDateTo(e.target.value)} />
            <button className="btn btn-cancel" style={{marginTop:0}} onClick={clearTrainingFilters}>Limpiar</button>
            <button className="btn" style={{marginTop:0}} onClick={()=>setShowTrainingHistory(true)}>
              Abrir filtrado ({filteredTrainings.length})
            </button>
          </div>
        </div>
      )}

      {exercises.length > 0 && (
        <div className="quick-stats-row">
          <span>{filteredExercises.length} ejercicios visibles</span>
          <span>{trainings.length} entrenamientos totales</span>
        </div>
      )}

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
          {filteredExercises.map(e => (
            <ExerciseCard
              key={e.id}
              exercise={e}
              onAddRecord={()=>setRegisterFor(e)}
              onDelete={()=>onDeleteExercise(e)}
              onOpenDetail={()=>setDetailFor(e)}
              onEdit={()=>setEditingExercise(e)}
            />
          ))}
        </div>
      )}

      {exercises.length > 0 && filteredExercises.length === 0 && (
        <div className="empty-state" style={{minHeight:220}}>
          <h3>No hay ejercicios con esos filtros</h3>
          <p>Prueba a limpiar filtros o ajustar la búsqueda.</p>
        </div>
      )}

      {creating && <CreateExerciseModal onCreate={onCreate} onCancel={()=>setCreating(false)} />}
      {editingExercise && <CreateExerciseModal initial={editingExercise} onSave={onSaveEdit} onCancel={()=>setEditingExercise(null)} />}
      {creatingTraining && (
        <TrainingPlannerModal
          exercises={exercises}
          onSave={onCreateTraining}
          onCancel={()=>setCreatingTraining(false)}
        />
      )}
      {showTrainingHistory && (
        <TrainingHistoryModal
          trainings={filteredTrainings}
          onClose={()=>setShowTrainingHistory(false)}
          onExportPdf={exportTrainingsToPdf}
          onExportExcel={exportTrainingsToExcel}
        />
      )}
      {showDashboard && (
        <TeamDashboardModal
          teamName={team.name}
          exercises={exercises}
          trainings={trainings}
          onClose={()=>setShowDashboard(false)}
        />
      )}
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
        <ExerciseDetailModal exercise={detailFor} onClose={()=>setDetailFor(null)} onEdit={() => { setDetailFor(null); setEditingExercise(detailFor); }} />
      )}
        </>
      )}
    </div>
  )
}
