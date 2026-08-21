// Helpers to fit the new "ficha" structure into the existing schema
// without DDL changes.
//
// Encoding:
//   - trainings.objectives jsonb keeps an extra `_ficha` object with all
//     the new metadata (session time, place, rival, video, equipment,
//     session_objective, teams, extra_attendees).
//   - training_exercises.notes carries a JSON envelope when the item belongs
//     to a "ficha" training: {text, custom_photo_url, extra_text}. Plain text
//     notes from legacy items are still parsed correctly.
//   - The section each item belongs to is derived from `category`. Within a
//     section, `order_index` defines the display order. This lets sections
//     have a variable number of items (e.g. movimientos) without DDL.

export const SECTION = {
  WARMUP_INICIO: 'warmup_inicio',
  WARMUP_MOVIMIENTOS: 'warmup_movimientos',
  WARMUP_POSESION: 'warmup_posesion',
  MAIN: 'main',
  FINAL: 'final'
}

export const SECTION_CATEGORY = {
  [SECTION.WARMUP_INICIO]: ['Inicio balón'],
  [SECTION.WARMUP_MOVIMIENTOS]: ['Movimientos tácticos/técnicos'],
  [SECTION.WARMUP_POSESION]: ['Posesión'],
  [SECTION.MAIN]: ['Principal'],
  [SECTION.FINAL]: ['Defensa portero jugador', 'Ataque portero jugador']
}

export const COURT_SIZES = ['20x20', '28x20', '40x20']
export const DEFAULT_COURT_SIZE = '40x20'

export function sectionFromCategory(category){
  for(const key of Object.keys(SECTION_CATEGORY)){
    if(SECTION_CATEGORY[key].includes(category)) return key
  }
  return SECTION.MAIN
}

// Notes envelope ----------------------------------------------------

export function parseItemNotes(rawNotes){
  if(rawNotes == null) return { text: '', custom_photo_url: null, extra_text: '' }
  if(typeof rawNotes !== 'string') return { text: String(rawNotes), custom_photo_url: null, extra_text: '' }
  const trimmed = rawNotes.trim()
  if(trimmed.startsWith('{') && trimmed.endsWith('}')){
    try{
      const parsed = JSON.parse(trimmed)
      if(parsed && typeof parsed === 'object' && ('text' in parsed || 'custom_photo_url' in parsed || 'extra_text' in parsed)){
        return {
          text: typeof parsed.text === 'string' ? parsed.text : '',
          custom_photo_url: typeof parsed.custom_photo_url === 'string' ? parsed.custom_photo_url : null,
          extra_text: typeof parsed.extra_text === 'string' ? parsed.extra_text : ''
        }
      }
    }catch(_){}
  }
  return { text: rawNotes, custom_photo_url: null, extra_text: '' }
}

export function buildItemNotes({text, custom_photo_url, extra_text}){
  const payload = {}
  if(text) payload.text = text
  if(custom_photo_url) payload.custom_photo_url = custom_photo_url
  if(extra_text) payload.extra_text = extra_text
  if(Object.keys(payload).length === 0) return ''
  return JSON.stringify(payload)
}

// Ficha metadata ----------------------------------------------------

export const EMPTY_FICHA = {
  version: 2,
  session_time: '',
  duration: '',
  place: '',
  rival: '',
  video: '',
  equipment: '',
  session_objective: '',
  extra_attendees: [],
  final_extra_text: '',
  teams: [
    { name: 'Equipo 1', player_ids: [] },
    { name: 'Equipo 2', player_ids: [] },
    { name: 'Equipo 3', player_ids: [] }
  ]
}

function normalizeExtras(raw){
  if(!Array.isArray(raw)) return []
  return raw.map((entry, idx) => {
    if(typeof entry === 'string'){
      return { id: `extra-legacy-${idx}`, name: entry }
    }
    if(entry && typeof entry === 'object'){
      const name = typeof entry.name === 'string' ? entry.name : ''
      if(!name) return null
      const id = typeof entry.id === 'string' && entry.id ? entry.id : `extra-${idx}-${name.slice(0,4)}`
      return { id, name }
    }
    return null
  }).filter(Boolean)
}

export function readFicha(objectives){
  if(objectives && typeof objectives === 'object' && objectives._ficha && typeof objectives._ficha === 'object'){
    const f = objectives._ficha
    return {
      version: f.version || 1,
      session_time: f.session_time || '',
      duration: f.duration || '',
      place: f.place || '',
      rival: f.rival || '',
      video: f.video || '',
      equipment: f.equipment || '',
      session_objective: f.session_objective || '',
      extra_attendees: normalizeExtras(f.extra_attendees),
      final_extra_text: typeof f.final_extra_text === 'string' ? f.final_extra_text : '',
      teams: Array.isArray(f.teams) && f.teams.length === 3
        ? f.teams.map((team, idx) => ({
            name: typeof team?.name === 'string' && team.name ? team.name : `Equipo ${idx + 1}`,
            player_ids: Array.isArray(team?.player_ids) ? team.player_ids : []
          }))
        : EMPTY_FICHA.teams
    }
  }
  return null
}

export function writeFicha(objectives, ficha){
  const next = (objectives && typeof objectives === 'object') ? { ...objectives } : {}
  next._ficha = {
    version: 2,
    session_time: ficha.session_time || '',
    duration: ficha.duration || '',
    place: ficha.place || '',
    rival: ficha.rival || '',
    video: ficha.video || '',
    equipment: ficha.equipment || '',
    session_objective: ficha.session_objective || '',
    extra_attendees: normalizeExtras(ficha.extra_attendees),
    final_extra_text: typeof ficha.final_extra_text === 'string' ? ficha.final_extra_text : '',
    teams: Array.isArray(ficha.teams) ? ficha.teams.slice(0, 3).map((team, idx) => ({
      name: team?.name || `Equipo ${idx + 1}`,
      player_ids: Array.isArray(team?.player_ids) ? team.player_ids : []
    })) : EMPTY_FICHA.teams
  }
  return next
}

export function isFichaTraining(training){
  return Boolean(readFicha(training?.objectives))
}

// Slot helpers ------------------------------------------------------

// Every section is a plain array now — no section has a fixed number of
// slots any more (used to be 1 for posesión/final, 6 for principal); the
// coach adds and removes as many as a given session actually needs.
export function sectionsFromItems(items){
  const list = Array.isArray(items) ? items.slice() : []
  list.sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0))

  const sections = {
    [SECTION.WARMUP_INICIO]: [],
    [SECTION.WARMUP_MOVIMIENTOS]: [],
    [SECTION.WARMUP_POSESION]: [],
    [SECTION.MAIN]: [],
    [SECTION.FINAL]: []
  }

  for(const item of list){
    const sec = sectionFromCategory(item.category)
    sections[sec].push(item)
  }
  return sections
}

export function computeSessionNumber(trainings, currentTraining){
  if(!currentTraining || !Array.isArray(trainings)) return null
  const currentDate = new Date(currentTraining.training_date).getTime()
  const currentCreated = new Date(currentTraining.created_at || 0).getTime()
  const earlier = trainings.filter((t) => {
    const tDate = new Date(t.training_date).getTime()
    if(tDate < currentDate) return true
    if(tDate > currentDate) return false
    const tCreated = new Date(t.created_at || 0).getTime()
    return tCreated <= currentCreated
  })
  return earlier.length || 1
}
