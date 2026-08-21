import React, {useEffect, useMemo, useRef, useState} from 'react'
import { uploadPhoto } from '../lib/api'
import { EditIcon, CalendarIcon, GripIcon, ChevronUpIcon, ChevronDownIcon } from './Icons'
import {
  SECTION,
  SECTION_CATEGORY,
  COURT_SIZES,
  DEFAULT_COURT_SIZE,
  EMPTY_FICHA,
  readFicha,
  writeFicha,
  buildItemNotes,
  parseItemNotes,
  sectionsFromItems
} from '../lib/trainingFicha'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function emptySlot(){
  return {
    exercise_id: '',
    planned_count: 1,
    dimensions: DEFAULT_COURT_SIZE,
    notes: '',
    extra_text: '',
    custom_photo_url: null,
    custom_photo_pending_file: null
  }
}

function slotFromItem(item){
  if(!item) return emptySlot()
  const parsed = parseItemNotes(item.notes)
  return {
    exercise_id: item.exercise_id || '',
    planned_count: item.planned_count ?? 1,
    dimensions: item.dimensions || DEFAULT_COURT_SIZE,
    notes: parsed.text || '',
    extra_text: parsed.extra_text || '',
    custom_photo_url: parsed.custom_photo_url || null,
    custom_photo_pending_file: null
  }
}

// Every exercise section (inicio, movimientos, posesión, principal, final)
// works the same way now: a list you add to and remove from freely, no
// section has a fixed slot count any more. One shared hook instead of
// repeating add/remove/setAt five times.
function useSlotList(getInitial){
  const [slots, setSlots] = useState(() => {
    const list = getInitial()
    return list.length > 0 ? list : [emptySlot()]
  })

  function add(){
    setSlots((current) => [...current, emptySlot()])
  }

  function remove(idx){
    setSlots((current) => {
      const next = current.filter((_, i) => i !== idx)
      return next.length > 0 ? next : [emptySlot()]
    })
  }

  function setAt(idx, updater){
    setSlots((current) => current.map((slot, i) => i === idx ? updater(slot) : slot))
  }

  function clearLabel(idx){
    return slots.length > 1 || slots[idx].exercise_id ? 'Quitar' : 'Vaciar'
  }

  return { slots, setSlots, add, remove, setAt, clearLabel }
}

export default function TrainingPlannerModal({exercises, players, onSave, onCancel, initial}){
  const initialDate = initial?.training_date || new Date().toISOString().slice(0,10)
  const initialFicha = readFicha(initial?.objectives) || EMPTY_FICHA
  const initialSections = sectionsFromItems(initial?.items || [])

  const [trainingDate, setTrainingDate] = useState(initialDate)
  const [notes, setNotes] = useState(initial?.notes || '')

  const [sessionTime, setSessionTime] = useState(initialFicha.session_time || '')
  const [duration, setDuration] = useState(initialFicha.duration || '')
  const [place, setPlace] = useState(initialFicha.place || '')
  const [rival, setRival] = useState(initialFicha.rival || '')
  const [video, setVideo] = useState(initialFicha.video || '')
  const [equipment, setEquipment] = useState(initialFicha.equipment || '')
  const [sessionObjective, setSessionObjective] = useState(initialFicha.session_objective || '')
  const [teams, setTeams] = useState(initialFicha.teams)

  const [extraAttendees, setExtraAttendees] = useState(
    Array.isArray(initialFicha.extra_attendees) ? initialFicha.extra_attendees : []
  )
  const [extraInput, setExtraInput] = useState('')

  function newExtraId(){
    return 'extra-' + Math.random().toString(36).slice(2, 9)
  }

  function addExtraAttendee(){
    const value = extraInput.trim()
    if(!value) return
    setExtraAttendees((current) => [...current, { id: newExtraId(), name: value }])
    setExtraInput('')
  }

  function removeExtraAttendee(idOrIdx){
    setExtraAttendees((current) => {
      const id = typeof idOrIdx === 'string' ? idOrIdx : current[idOrIdx]?.id
      // Also remove from any team
      if(id){
        setTeams((cur) => cur.map((t) => ({ ...t, player_ids: (t.player_ids || []).filter((pid) => pid !== id) })))
      }
      return current.filter((entry) => entry.id !== id)
    })
  }

  const [attending, setAttending] = useState(() => {
    const init = {}
    ;(initial?.attending_players || []).forEach((id) => { init[id] = true })
    return init
  })

  const inicio = useSlotList(() => (initialSections[SECTION.WARMUP_INICIO] || []).map(slotFromItem))
  const movimientos = useSlotList(() => (initialSections[SECTION.WARMUP_MOVIMIENTOS] || []).map(slotFromItem))
  const posesion = useSlotList(() => (initialSections[SECTION.WARMUP_POSESION] || []).map(slotFromItem))
  const main = useSlotList(() => (initialSections[SECTION.MAIN] || []).map(slotFromItem))
  const final = useSlotList(() => (initialSections[SECTION.FINAL] || []).map(slotFromItem))
  const [finalExtraText, setFinalExtraText] = useState(initialFicha.final_extra_text || '')
  const [saving, setSaving] = useState(false)

  const exercisesById = useMemo(() => {
    const map = new Map()
    ;(exercises || []).forEach((ex) => map.set(ex.id, ex))
    return map
  }, [exercises])

  const exercisesByCategory = useMemo(() => {
    const result = {
      [SECTION.WARMUP_INICIO]: [],
      [SECTION.WARMUP_MOVIMIENTOS]: [],
      [SECTION.WARMUP_POSESION]: [],
      [SECTION.MAIN]: [],
      [SECTION.FINAL]: []
    }
    ;(exercises || []).forEach((ex) => {
      Object.keys(SECTION_CATEGORY).forEach((sectionKey) => {
        if(SECTION_CATEGORY[sectionKey].includes(ex.category)) result[sectionKey].push(ex)
      })
    })
    return result
  }, [exercises])

  const attendingIds = useMemo(
    () => Object.keys(attending).filter((id) => attending[id]),
    [attending]
  )

  const playerTeamIndex = useMemo(() => {
    const map = new Map()
    teams.forEach((team, idx) => {
      ;(team.player_ids || []).forEach((id) => { map.set(id, idx) })
    })
    return map
  }, [teams])

  function toggleAttending(id){
    setAttending((current) => {
      const next = { ...current, [id]: !current[id] }
      // If the player was assigned to a team and we're un-attending them, remove from team.
      if(!next[id]){
        setTeams((cur) => cur.map((t) => ({ ...t, player_ids: (t.player_ids || []).filter((pid) => pid !== id) })))
      }
      return next
    })
  }

  function setPlayerTeam(playerId, teamIdx){
    setTeams((current) => current.map((team, idx) => {
      const filtered = (team.player_ids || []).filter((id) => id !== playerId)
      if(idx === teamIdx) return { ...team, player_ids: [...filtered, playerId] }
      return { ...team, player_ids: filtered }
    }))
  }

  function clearPlayerTeam(playerId){
    setTeams((current) => current.map((team) => ({ ...team, player_ids: (team.player_ids || []).filter((id) => id !== playerId) })))
  }

  async function handlePhotoChange(event, current, setter){
    const file = event.target.files?.[0]
    if(!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setter({ ...current, custom_photo_url: ev.target.result, custom_photo_pending_file: file })
    reader.readAsDataURL(file)
  }

  function clearPhoto(current, setter){
    setter({ ...current, custom_photo_url: null, custom_photo_pending_file: null })
  }

  async function buildItemFromSlot(slot, orderIndex){
    if(!slot.exercise_id) return null
    const ex = exercisesById.get(slot.exercise_id)
    if(!ex) return null
    let custom_photo_url = slot.custom_photo_url
    if(slot.custom_photo_pending_file){
      custom_photo_url = await uploadPhoto(slot.custom_photo_pending_file)
    }
    const notesEnvelope = buildItemNotes({
      text: slot.notes || '',
      custom_photo_url: custom_photo_url || null,
      extra_text: slot.extra_text || ''
    })
    return {
      exercise_id: ex.id,
      exercise_name: ex.name,
      objective: ex.objective || '',
      category: ex.category || '',
      planned_count: Number(slot.planned_count || 1),
      dimensions: slot.dimensions || '',
      notes: notesEnvelope,
      order_index: orderIndex
    }
  }

  async function submit(){
    if(saving) return
    setSaving(true)
    try{
      const items = []
      let order = 0
      for(const group of [inicio.slots, movimientos.slots, posesion.slots, main.slots, final.slots]){
        for(const slot of group){
          const item = await buildItemFromSlot(slot, order)
          if(item){ items.push(item); order++ }
        }
      }

      const fichaPayload = writeFicha({}, {
        session_time: sessionTime,
        duration,
        place,
        rival,
        video,
        equipment,
        session_objective: sessionObjective,
        extra_attendees: extraAttendees,
        final_extra_text: finalExtraText,
        teams
      })

      onSave({
        training_date: trainingDate,
        notes,
        items,
        selected_players: attendingIds,
        objectives: fichaPayload,
        warmup: ''
      })
    }catch(err){
      console.error('Error guardando entrenamiento:', err)
      alert('Error al guardar el entrenamiento: ' + (err.message || err))
    }finally{
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-wide">
        <h3 style={{display:'flex',alignItems:'center',gap:8}}>{initial ? <><EditIcon size={18}/> Editar entrenamiento</> : <><CalendarIcon size={18}/> Planificar entrenamiento</>}</h3>

        <section className="planner-section">
          <h4 className="planner-heading">Datos de la sesión</h4>
          <div className="planner-grid two">
            <Field label="Fecha"><input type="date" value={trainingDate} onChange={(e)=>setTrainingDate(e.target.value)} /></Field>
            <Field label="Hora"><input type="time" value={sessionTime} onChange={(e)=>setSessionTime(e.target.value)} /></Field>
            <Field label="Duración"><input value={duration} onChange={(e)=>setDuration(e.target.value)} placeholder="Ej: 90 min" /></Field>
            <Field label="Lugar"><input value={place} onChange={(e)=>setPlace(e.target.value)} placeholder="Ej: Pabellón Torrenueva" /></Field>
            <Field label="Rival"><input value={rival} onChange={(e)=>setRival(e.target.value)} placeholder="Ej: CD Manchego" /></Field>
            <Field label="Vídeo"><input value={video} onChange={(e)=>setVideo(e.target.value)} placeholder="Enlace o referencia" /></Field>
            <Field label="Equipamiento"><input value={equipment} onChange={(e)=>setEquipment(e.target.value)} placeholder="Petos, conos..." /></Field>
            <Field label="Objetivo de la sesión"><input value={sessionObjective} onChange={(e)=>setSessionObjective(e.target.value)} placeholder="Ej: transición defensa-ataque" /></Field>
          </div>
        </section>

        <section className="planner-section">
          <h4 className="planner-heading">Asistencia ({attendingIds.length + extraAttendees.length})</h4>
          <div className="planner-attendance">
            {(players || []).length === 0 && <p className="small">No hay jugadores creados todavía.</p>}
            {(players || []).map((player) => (
              <label key={player.id} className="planner-attend-item">
                <input
                  type="checkbox"
                  checked={Boolean(attending[player.id])}
                  onChange={() => toggleAttending(player.id)}
                />
                <span className="planner-attend-text">#{player.dorsal} {player.name} {player.surname || ''}</span>
              </label>
            ))}
          </div>
          <div style={{marginTop: 10}}>
            <label className="planner-field"><span>Asistentes extra (no jugadores del equipo)</span></label>
            <div className="planner-extra-row">
              <input
                value={extraInput}
                onChange={(e) => setExtraInput(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter'){ e.preventDefault(); addExtraAttendee() } }}
                placeholder="Ej: Pepe (juvenil)"
              />
              <button type="button" className="btn btn-primary" style={{margin:0, padding:'8px 14px'}} onClick={addExtraAttendee}>+ Añadir</button>
            </div>
            {extraAttendees.length > 0 && (
              <ul className="planner-extra-pills">
                {extraAttendees.map((entry) => (
                  <li key={entry.id} className="planner-extra-pill">
                    {entry.name}
                    <button type="button" onClick={() => removeExtraAttendee(entry.id)}>×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="planner-section">
          <h4 className="planner-heading">Equipos</h4>
          <p className="small" style={{margin:'0 0 10px'}}>Cada jugador asistente sólo puede estar en un equipo.</p>
          <div className="planner-teams-grid">
            {teams.map((team, teamIdx) => (
              <div key={teamIdx} className="planner-team-card">
                <input
                  className="planner-team-name"
                  value={team.name}
                  onChange={(e) => setTeams((current) => current.map((t, i) => i === teamIdx ? { ...t, name: e.target.value } : t))}
                />
                <ul className="planner-team-pills">
                  {(team.player_ids || []).map((id) => {
                    const player = (players || []).find((it) => it.id === id)
                    const extra = extraAttendees.find((it) => it.id === id)
                    const label = player ? `#${player.dorsal} ${player.name}` : (extra ? extra.name : null)
                    if(!label) return null
                    return (
                      <li key={id} className="planner-team-pill">
                        {label}
                        <button type="button" onClick={() => clearPlayerTeam(id)}>×</button>
                      </li>
                    )
                  })}
                  {(team.player_ids || []).length === 0 && <li className="small" style={{listStyle:'none'}}>(vacío)</li>}
                </ul>
              </div>
            ))}
          </div>
          {(attendingIds.length > 0 || extraAttendees.length > 0) && (
            <div className="planner-team-assign">
              <p className="small" style={{margin:'8px 0 6px', fontWeight:600, color:'#374151'}}>Asignar asistentes:</p>
              <div className="planner-team-assign-list">
                {attendingIds.map((id) => {
                  const p = (players || []).find((it) => it.id === id)
                  if(!p) return null
                  const currentTeam = playerTeamIndex.get(id)
                  return (
                    <div key={id} className="planner-team-assign-row">
                      <span className="planner-team-assign-name">#{p.dorsal} {p.name}</span>
                      <div className="planner-team-assign-buttons">
                        {[0,1,2].map((tIdx) => (
                          <button
                            key={tIdx}
                            type="button"
                            className={`planner-team-btn ${currentTeam === tIdx ? 'active' : ''}`}
                            onClick={() => currentTeam === tIdx ? clearPlayerTeam(id) : setPlayerTeam(id, tIdx)}
                          >
                            {tIdx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {extraAttendees.map((extra) => {
                  const currentTeam = playerTeamIndex.get(extra.id)
                  return (
                    <div key={extra.id} className="planner-team-assign-row">
                      <span className="planner-team-assign-name" style={{fontStyle:'italic'}}>{extra.name}</span>
                      <div className="planner-team-assign-buttons">
                        {[0,1,2].map((tIdx) => (
                          <button
                            key={tIdx}
                            type="button"
                            className={`planner-team-btn ${currentTeam === tIdx ? 'active' : ''}`}
                            onClick={() => currentTeam === tIdx ? clearPlayerTeam(extra.id) : setPlayerTeam(extra.id, tIdx)}
                          >
                            {tIdx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        <section className="planner-section">
          <h4 className="planner-heading">Calentamiento</h4>
          <div className="planner-warmup">
            <SlotGroup
              title="1 · Inicio balón / Lúdico"
              group={inicio}
              exercises={exercisesByCategory[SECTION.WARMUP_INICIO]}
              labelPrefix="Inicio balón"
              minimal
            />

            <SlotGroup
              title="2 · Movimientos tác/téc"
              group={movimientos}
              exercises={exercisesByCategory[SECTION.WARMUP_MOVIMIENTOS]}
              labelPrefix="Movimiento"
              minimal
            />

            <SlotGroup
              title="3 · Posesión"
              group={posesion}
              exercises={exercisesByCategory[SECTION.WARMUP_POSESION]}
              labelPrefix="Posesión"
              minimal
            />
          </div>
        </section>

        <section className="planner-section">
          <h4 className="planner-heading">Parte principal</h4>
          <p className="small" style={{margin:'0 0 10px'}}>Añade los que necesites y arrástralos para reordenar.</p>
          <MainSlotsList
            group={main}
            exercises={exercisesByCategory[SECTION.MAIN]}
            handlePhotoChange={handlePhotoChange}
            clearPhoto={clearPhoto}
          />
        </section>

        <section className="planner-section">
          <h4 className="planner-heading">Parte final</h4>
          <SlotGroup
            title="Defensa o ataque portero-jugador (opcional)"
            group={final}
            exercises={exercisesByCategory[SECTION.FINAL]}
            labelPrefix="Final"
            hidePhoto
            hideHeaderWhenSingle
          />
          <Field label="Notas de la parte final (siempre aparece en la ficha)">
            <textarea
              value={finalExtraText}
              onChange={(e)=>setFinalExtraText(e.target.value)}
              rows={2}
              placeholder="Ej: trabajo de portero-jugador 5x4, transiciones rápidas..."
            />
          </Field>
        </section>

        <section className="planner-section">
          <Field label="Notas internas (no aparecen en la ficha)">
            <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} rows={2} placeholder="Observaciones internas" />
          </Field>
        </section>

        <div className="modal-buttons">
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Guardando...' : (initial ? 'Guardar cambios' : 'Guardar entrenamiento')}
          </button>
          <button className="btn btn-cancel" onClick={onCancel} disabled={saving}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function Field({label, children}){
  return (
    <label className="planner-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

// A titled block of slots with a "+ Añadir" button — the same shape used by
// every exercise section (inicio, movimientos, posesión, final). "Parte
// principal" gets its own variant below since it also drags to reorder.
function SlotGroup({title, group, exercises, labelPrefix, minimal, hidePhoto, hideHeaderWhenSingle}){
  return (
    <div className="planner-mov-block">
      <div className="planner-mov-header">
        <strong>{title}</strong>
        <button type="button" className="planner-add-btn" onClick={group.add}>+ Añadir</button>
      </div>
      {group.slots.map((slot, idx) => (
        <ExerciseSlot
          key={idx}
          label={hideHeaderWhenSingle && group.slots.length === 1 ? '' : `${labelPrefix} ${idx + 1}`}
          slot={slot}
          setSlot={(next) => group.setAt(idx, () => next)}
          exercises={exercises}
          onClear={() => group.remove(idx)}
          clearLabel={group.clearLabel(idx)}
          minimal={minimal}
          hidePhoto={hidePhoto}
        />
      ))}
    </div>
  )
}

function ExerciseSlot({label, slot, setSlot, exercises, onClear, clearLabel = 'Vaciar', onPhotoChange, onPhotoClear, hidePhoto, allowEmpty, minimal, dragHandle}){
  const update = (patch) => setSlot({ ...slot, ...patch })
  return (
    <div className="planner-slot">
      <div className="planner-slot-header">
        {dragHandle}
        {label && <strong className="planner-slot-label">{label}</strong>}
        {(slot.exercise_id || allowEmpty) && (
          <button type="button" className="planner-slot-clear" onClick={onClear}>{clearLabel}</button>
        )}
      </div>
      <ExercisePicker
        value={slot.exercise_id}
        exercises={exercises}
        onChange={(id) => update({ exercise_id: id })}
      />
      {slot.exercise_id && !minimal && (
        <>
          <div className="planner-slot-row">
            <input
              type="number"
              min={1}
              value={slot.planned_count}
              onChange={(e) => update({ planned_count: e.target.value })}
              placeholder="Veces"
            />
            <select
              value={slot.dimensions}
              onChange={(e) => update({ dimensions: e.target.value })}
            >
              {COURT_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <textarea
            value={slot.notes}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Notas para este ejercicio"
            rows={2}
          />
          {!hidePhoto && (
            <div className="planner-slot-photo">
              {slot.custom_photo_url ? (
                <>
                  <img src={slot.custom_photo_url} alt="custom" />
                  <button type="button" className="planner-slot-clear" onClick={onPhotoClear}>Quitar foto</button>
                </>
              ) : (
                <label className="planner-slot-photo-upload">
                  <span>Foto custom (opcional, sustituye a la del ejercicio)</span>
                  <input type="file" accept="image/*" onChange={onPhotoChange} />
                </label>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MainSlotsList({group, exercises, handlePhotoChange, clearPhoto}){
  const { slots, add, remove, setAt, clearLabel } = group
  const ids = useMemo(() => slots.map((_, idx) => `main-${idx}`), [slots])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event){
    const { active, over } = event
    if(!over || active.id === over.id) return
    const from = ids.indexOf(active.id)
    const to = ids.indexOf(over.id)
    if(from < 0 || to < 0) return
    group.setSlots((current) => arrayMove(current, from, to))
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="planner-main-list">
            {slots.map((slot, idx) => (
              <SortableMainSlot
                key={ids[idx]}
                id={ids[idx]}
                index={idx}
                slot={slot}
                exercises={exercises}
                onChange={(updater) => setAt(idx, updater)}
                onClear={() => remove(idx)}
                clearLabel={clearLabel(idx)}
                onMoveUp={() => group.setSlots((current) => arrayMove(current, idx, idx - 1))}
                onMoveDown={() => group.setSlots((current) => arrayMove(current, idx, idx + 1))}
                canMoveUp={idx > 0}
                canMoveDown={idx < slots.length - 1}
                onPhotoChange={(e) => handlePhotoChange(e, slot, (next) => setAt(idx, () => next))}
                onPhotoClear={() => clearPhoto(slot, (next) => setAt(idx, () => next))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button type="button" className="planner-add-btn" style={{marginTop:8}} onClick={add}>+ Añadir ejercicio</button>
    </>
  )
}

function SortableMainSlot({id, index, slot, exercises, onChange, onClear, clearLabel, onMoveUp, onMoveDown, canMoveUp, canMoveDown, onPhotoChange, onPhotoClear}){
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  }
  return (
    <div ref={setNodeRef} style={style} className="planner-main-slot-wrap">
      <ExerciseSlot
        label={`Principal ${index + 1}`}
        slot={slot}
        setSlot={(next) => onChange(() => next)}
        exercises={exercises}
        onClear={onClear}
        clearLabel={clearLabel}
        onPhotoChange={onPhotoChange}
        onPhotoClear={onPhotoClear}
        dragHandle={
          <div className="planner-drag-controls">
            <button type="button" className="planner-handle" {...attributes} {...listeners} aria-label="Arrastrar"><GripIcon size={15}/></button>
            <button type="button" className="planner-arrow" onClick={onMoveUp} disabled={!canMoveUp} aria-label="Mover arriba"><ChevronUpIcon size={13}/></button>
            <button type="button" className="planner-arrow" onClick={onMoveDown} disabled={!canMoveDown} aria-label="Mover abajo"><ChevronDownIcon size={13}/></button>
          </div>
        }
      />
    </div>
  )
}

function ExercisePicker({value, exercises, onChange}){
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const sorted = useMemo(() => {
    return [...(exercises || [])].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' })
    )
  }, [exercises])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if(!q) return sorted
    return sorted.filter((ex) => String(ex.name || '').toLowerCase().includes(q))
  }, [sorted, query])

  const selected = useMemo(() => (exercises || []).find((ex) => ex.id === value) || null, [exercises, value])

  useEffect(() => {
    if(!open) return
    const handler = (e) => {
      if(containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if(open) setTimeout(() => inputRef.current?.focus(), 0)
    else { setQuery(''); setHighlight(0) }
  }, [open])

  useEffect(() => { setHighlight(0) }, [query])

  function pick(ex){
    onChange(ex.id)
    setOpen(false)
  }

  function onKeyDown(e){
    if(e.key === 'ArrowDown'){
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)))
    }else if(e.key === 'ArrowUp'){
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    }else if(e.key === 'Enter'){
      e.preventDefault()
      const ex = filtered[highlight]
      if(ex) pick(ex)
    }else if(e.key === 'Escape'){
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="picker" ref={containerRef}>
      <button
        type="button"
        className={`picker-button ${selected ? 'has-value' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="picker-text">{selected ? selected.name : '— Selecciona ejercicio —'}</span>
        <span className="picker-caret">{open ? <ChevronUpIcon size={12}/> : <ChevronDownIcon size={12}/>}</span>
      </button>
      {open && (
        <div className="picker-dropdown">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar ejercicio..."
            className="picker-search"
          />
          {filtered.length === 0 ? (
            <div className="picker-empty">Sin coincidencias</div>
          ) : (
            <ul className="picker-list" role="listbox">
              {filtered.map((ex, idx) => (
                <li
                  key={ex.id}
                  role="option"
                  aria-selected={ex.id === value}
                  className={`picker-option ${idx === highlight ? 'highlighted' : ''} ${ex.id === value ? 'selected' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); pick(ex) }}
                  onMouseEnter={() => setHighlight(idx)}
                >
                  {ex.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
