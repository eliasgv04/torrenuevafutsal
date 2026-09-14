import { supabase } from './supabaseClient'

const HAS_SUPABASE = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON)

if(!HAS_SUPABASE){
  console.warn('Supabase is not configured. App is using localStorage fallback, data will not sync across devices.')
}

// Every Supabase call that fails in the app used to just vanish into
// console.error, invisible unless a user happened to notice and report it
// (e.g. the PGRST204 "missing column" errors from a migration that was
// never run). This writes it to app_logs instead, so it shows up in
// AdminPanel — fire-and-forget, and never throws itself, since a failure to
// log must never break the feature that failed in the first place.
export async function logAppError(error, extra){
  console.error('App error:', error)
  if(!HAS_SUPABASE) return
  try{
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('app_logs').insert({
      message: error?.message || String(error),
      code: error?.code || null,
      details: error?.stack || (extra ? JSON.stringify(extra) : null),
      user_email: session?.user?.email || null,
    })
  }catch{
    // logging must never cascade into a second failure
  }
}

// Retry a Supabase query up to `attempts` times with increasing delay.
// Handles transient timeouts (e.g. free-tier project waking from pause).
async function withRetry(fn, attempts = 3, baseDelayMs = 2000) {
  let lastErr
  for(let i = 0; i < attempts; i++){
    try { return await fn() }
    catch(e){
      lastErr = e
      const isTimeout = e?.code === '57014' || e?.message?.includes('timeout') || e?.message?.includes('abort')
      if(!isTimeout || i === attempts - 1) throw e
      console.warn(`Query timeout (attempt ${i+1}/${attempts}), retrying in ${baseDelayMs*(i+1)}ms…`)
      await new Promise(r => setTimeout(r, baseDelayMs * (i + 1)))
    }
  }
  throw lastErr
}

// ── Short-lived read cache ─────────────────────────────────────────
// Reopening a team (e.g. back to the team list and straight back in) was
// re-fetching its exercises/players/trainings/matches from scratch every
// single time, even seconds apart — a big share of Supabase egress for data
// that almost never changes that fast. A short TTL kills that "just looked
// at this" case while still refreshing regularly; mutations invalidate
// their own key (or, when the mutated row's team_id isn't at hand, the
// whole cache) so your own edits always show up immediately.
const READ_CACHE_TTL_MS = 60_000
const readCache = new Map() // key -> { data, ts }

async function cachedRead(key, fetchFn){
  const hit = readCache.get(key)
  if(hit && Date.now() - hit.ts < READ_CACHE_TTL_MS) return hit.data
  const data = await fetchFn()
  readCache.set(key, { data, ts: Date.now() })
  return data
}

function invalidateCache(key){
  readCache.delete(key)
}

function clearCache(){
  readCache.clear()
}

// LocalStorage keys
const LS_TEAMS = 'tf_teams'
const LS_EXERCISES = 'tf_exercises'
const LS_TRAININGS = 'tf_trainings'
const LS_TRAINING_ITEMS = 'tf_training_items'
const LS_SUPABASE_PLAYERS_SYNCED = 'tf_supabase_players_synced_v1'

let localPlayersSyncPromise = null

function uid(){
  return 'local-' + Math.random().toString(36).slice(2,9)
}

export async function uploadPhoto(file){
  if(HAS_SUPABASE){
    try{
      const name = `${Date.now()}_${file.name}`
      // The timestamp makes every filename unique forever, so this content
      // can never go stale under that URL — cache it for a year instead of
      // Supabase's default ~1h, so repeat views don't re-download it from
      // storage (that was driving egress far higher than the actual bytes
      // stored would suggest).
      const { data, error } = await supabase.storage.from('photos').upload(name, file, { cacheControl: '31536000' })
      if(!error){
        const url = supabase.storage.from('photos').getPublicUrl(name).data.publicUrl
        return url
      }
      console.warn('Supabase storage.upload returned error, falling back to data URL', error)
    }catch(e){
      console.warn('Supabase upload threw, falling back to data URL', e)
    }
  }
  // fallback: read as data URL
  return await new Promise((res,rej)=>{
    const r = new FileReader()
    r.onload = ()=>res(r.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// LocalStorage helpers
function lsGet(key){
  try{return JSON.parse(localStorage.getItem(key) || '[]') }catch(e){return []}
}
function lsSet(key, val){ localStorage.setItem(key, JSON.stringify(val)) }

function normalizeText(value){
  return String(value || '').trim().toLowerCase()
}

async function ensureLocalPlayersSynced(){
  if(!HAS_SUPABASE) return
  if(localStorage.getItem(LS_SUPABASE_PLAYERS_SYNCED) === '1') return
  if(localPlayersSyncPromise) return localPlayersSyncPromise

  localPlayersSyncPromise = (async () => {
    const localTeams = lsGet(LS_TEAMS)
    const localPlayers = lsGet('tf_players')

    if(localTeams.length === 0 && localPlayers.length === 0){
      localStorage.setItem(LS_SUPABASE_PLAYERS_SYNCED, '1')
      return
    }

    const { data: cloudTeams, error: cloudTeamsError } = await supabase.from('teams').select('*')
    if(cloudTeamsError) throw cloudTeamsError

    const teamMap = new Map()
    const cloudTeamsByName = new Map(
      (cloudTeams || []).map((team) => [normalizeText(team.name), team])
    )

    for(const localTeam of localTeams){
      const teamKey = normalizeText(localTeam.name)
      let cloudTeam = cloudTeamsByName.get(teamKey)

      if(!cloudTeam){
        const { data, error } = await supabase
          .from('teams')
          .insert({ name: localTeam.name })
          .select()
          .single()
        if(error) throw error
        cloudTeam = data
        cloudTeamsByName.set(teamKey, cloudTeam)
      }

      teamMap.set(localTeam.id, cloudTeam.id)
    }

    const localTeamIds = new Set(localPlayers.map((player) => player.team_id))
    const cloudTeamIds = [...localTeamIds]
      .map((teamId) => teamMap.get(teamId))
      .filter(Boolean)

    let cloudPlayers = []
    if(cloudTeamIds.length > 0){
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .in('team_id', cloudTeamIds)
      if(error) throw error
      cloudPlayers = data || []
    }

    const playerMap = new Map()

    for(const localPlayer of localPlayers){
      const cloudTeamId = teamMap.get(localPlayer.team_id)
      if(!cloudTeamId) continue

      const matchedPlayer = cloudPlayers.find((player) => (
        player.team_id === cloudTeamId &&
        player.dorsal === localPlayer.dorsal &&
        normalizeText(player.name) === normalizeText(localPlayer.name) &&
        normalizeText(player.surname) === normalizeText(localPlayer.surname)
      ))

      if(matchedPlayer){
        playerMap.set(localPlayer.id, matchedPlayer.id)
        continue
      }

      const { data, error } = await supabase
        .from('players')
        .insert({
          team_id: cloudTeamId,
          name: localPlayer.name,
          surname: localPlayer.surname,
          dorsal: localPlayer.dorsal,
          position: localPlayer.position
        })
        .select()
        .single()

      if(error) throw error
      playerMap.set(localPlayer.id, data.id)
      cloudPlayers.push(data)
    }

    localStorage.setItem(LS_SUPABASE_PLAYERS_SYNCED, '1')
    console.info('Local player data synced to Supabase.')
  })().finally(() => {
    localPlayersSyncPromise = null
  })

  return localPlayersSyncPromise
}

export const api = {
  async getTeams(){
    try{
      if(HAS_SUPABASE){
        await ensureLocalPlayersSynced()
        const { data, error } = await supabase.from('teams').select('*').order('created_at', {ascending:false})
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    const items = lsGet(LS_TEAMS)
    if(items.length===0){
      const t = {id:uid(), name:'Torrenueva Futsal', created_at: new Date().toISOString()}
      lsSet(LS_TEAMS,[t])
      return [t]
    }
    return items
  },

  async createTeam(name, {gradient_start, gradient_end, crest_url} = {}){
    const payload = {name, gradient_start, gradient_end, crest_url}
    try{
      if(HAS_SUPABASE){
        // Id generated client-side and inserted without .select(): an
        // INSERT ... RETURNING would require a SELECT policy check on the
        // new row before the creator-access trigger's grant is guaranteed
        // visible to it. Skipping RETURNING sidesteps that entirely — we
        // already know everything about the row we just built.
        const id = crypto.randomUUID()
        const created_at = new Date().toISOString()
        const { error } = await supabase.from('teams').insert({ id, created_at, ...payload })
        if(error) throw error
        return { id, created_at, ...payload }
      }
    }catch(e){
      logAppError(e)
    }
    const items = lsGet(LS_TEAMS)
    const t = {id:uid(), ...payload, created_at: new Date().toISOString()}
    items.unshift(t)
    lsSet(LS_TEAMS, items)
    return t
  },

  async updateTeam(teamId, {name, gradient_start, gradient_end, crest_url}){
    const payload = {}
    if(name !== undefined) payload.name = name
    if(gradient_start !== undefined) payload.gradient_start = gradient_start
    if(gradient_end !== undefined) payload.gradient_end = gradient_end
    if(crest_url !== undefined) payload.crest_url = crest_url

    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase.from('teams').update(payload).eq('id', teamId).select().single()
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }

    const items = lsGet(LS_TEAMS)
    const idx = items.findIndex(t=>t.id===teamId)
    if(idx>=0){
      items[idx] = { ...items[idx], ...payload }
      lsSet(LS_TEAMS, items)
      return items[idx]
    }
    return null
  },

  async deleteTeam(teamId){
    clearCache()
    try{
      if(HAS_SUPABASE){
        const { error } = await supabase.from('teams').delete().eq('id', teamId)
        if(error) throw error
      }
    }catch(e){
      logAppError(e)
    }
    const teams = lsGet(LS_TEAMS).filter(team => team.id !== teamId)
    const exercises = lsGet(LS_EXERCISES).filter(exercise => exercise.team_id !== teamId)
    const trainings = lsGet(LS_TRAININGS).filter(training => training.team_id !== teamId)
    const trainingIds = new Set(lsGet(LS_TRAININGS).filter(training => training.team_id === teamId).map(training => training.id))
    const trainingItems = lsGet(LS_TRAINING_ITEMS).filter(item => !trainingIds.has(item.training_id))
    lsSet(LS_TEAMS, teams)
    lsSet(LS_EXERCISES, exercises)
    lsSet(LS_TRAININGS, trainings)
    lsSet(LS_TRAINING_ITEMS, trainingItems)
  },

  async getExercises(teamId){
    return cachedRead(`exercises:${teamId}`, async () => {
      try{
        if(HAS_SUPABASE){
          const data = await withRetry(() =>
            supabase
              .from('exercises')
              .select('id,name,objective,description,photo_url,category,dimensions,created_at,team_id,is_public')
              .eq('team_id', teamId)
              .order('created_at', {ascending:false})
              .then(r => { if(r.error) throw r.error; return r.data })
          )
          return data
        }
      }catch(e){
        logAppError(e)
      }
      return lsGet(LS_EXERCISES).filter(e=>e.team_id===teamId)
    })
  },

  async createExercise({team_id,name,objective,description,file,category,dimensions,photo_url:existingPhotoUrl,is_public}){
    let photo_url = existingPhotoUrl || null
    if(file) photo_url = await uploadPhoto(file)
    invalidateCache(`exercises:${team_id}`)
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase.from('exercises').insert({team_id,name,objective,description,photo_url,category,dimensions,is_public:!!is_public}).select().single()
        if(error) throw error
        return { ...data, dimensions }
      }
    }catch(e){
      logAppError(e)
    }
    const items = lsGet(LS_EXERCISES)
    const ex = {id:uid(), team_id, name, objective, description, photo_url, category, dimensions, is_public:!!is_public, created_at:new Date().toISOString()}
    items.unshift(ex)
    lsSet(LS_EXERCISES, items)
    return ex
  },

  async updateExercise(exerciseId, {name,objective,description,category,file,dimensions,is_public}){
    let photo_url = null
    if(file) photo_url = await uploadPhoto(file)
    clearCache() // no team_id at hand here — cheap to just drop everything
    try{
      if(HAS_SUPABASE){
        const payload = { name, objective, description, category, dimensions, is_public:!!is_public }
        if(photo_url) payload.photo_url = photo_url
        const { data, error } = await supabase.from('exercises').update(payload).eq('id', exerciseId).select().single()
        if(error) throw error
        return { ...data, dimensions }
      }
    }catch(e){
      logAppError(e)
    }

    const items = lsGet(LS_EXERCISES)
    const idx = items.findIndex(i=>i.id===exerciseId)
    if(idx>=0){
      items[idx] = { ...items[idx], name, objective, description, category, dimensions, is_public:!!is_public }
      if(photo_url) items[idx].photo_url = photo_url
      lsSet(LS_EXERCISES, items)
      return items[idx]
    }
    return null
  },

  async getPublicExercises(){
    if(!HAS_SUPABASE) return []
    const { data, error } = await supabase.rpc('get_public_exercises')
    if(error) throw error
    return data
  },

  async deleteExercise(exerciseId){
    clearCache()
    try{
      if(HAS_SUPABASE){
        const { error } = await supabase.from('exercises').delete().eq('id', exerciseId)
        if(error) throw error
      }
    }catch(e){
      logAppError(e)
    }
    const exercises = lsGet(LS_EXERCISES).filter(exercise => exercise.id !== exerciseId)
    const trainingItems = lsGet(LS_TRAINING_ITEMS).filter(item => item.exercise_id !== exerciseId)
    lsSet(LS_EXERCISES, exercises)
    lsSet(LS_TRAINING_ITEMS, trainingItems)
  },

  async getTrainings(teamId){
    return cachedRead(`trainings:${teamId}`, async () => {
      try{
        if(HAS_SUPABASE){
          const data = await withRetry(() =>
            supabase
              .from('trainings')
              .select('*')
              .eq('team_id', teamId)
              .order('training_date', {ascending:false})
              .order('created_at', {ascending:false})
              .then(r => { if(r.error) throw r.error; return r.data })
          )
          return data
        }
      }catch(e){
        logAppError(e)
      }
      return lsGet(LS_TRAININGS)
        .filter(t=>t.team_id===teamId)
        .sort((a,b)=>new Date(b.training_date) - new Date(a.training_date))
    })
  },

  async getTrainingItems(trainingId){
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('training_exercises')
          .select('*')
          .eq('training_id', trainingId)
          .order('order_index', {ascending:true})
          .order('created_at', {ascending:true})
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    return lsGet(LS_TRAINING_ITEMS)
      .filter(i=>i.training_id===trainingId)
      .sort((a,b)=>(a.order_index ?? 0) - (b.order_index ?? 0))
  },

  // Batched equivalent of getTrainingItems for many trainings at once (avoids
  // N+1 round trips when loading a team's full training history). This tends
  // to be the single biggest payload of the four cached reads — every
  // exercise snapshot (name, objective, category, dimensions, notes)
  // repeated per training it was used in — so it's cached the same way,
  // keyed off the exact set of training ids asked for.
  async getTrainingItemsByTrainingIds(trainingIds){
    if(!trainingIds || trainingIds.length === 0) return {}
    const cacheKey = `training_items:${trainingIds.slice().sort().join(',')}`
    return cachedRead(cacheKey, () => this._getTrainingItemsByTrainingIdsUncached(trainingIds))
  },

  async _getTrainingItemsByTrainingIdsUncached(trainingIds){
    try{
      if(HAS_SUPABASE){
        const CHUNK = 25
        const chunks = []
        for(let i = 0; i < trainingIds.length; i += CHUNK)
          chunks.push(trainingIds.slice(i, i + CHUNK))

        const results = await Promise.all(chunks.map(chunk =>
          withRetry(() =>
            supabase.from('training_exercises')
              .select('*')
              .in('training_id', chunk)
              .order('order_index', {ascending:true})
              .order('created_at', {ascending:true})
              .then(r => { if(r.error) throw r.error; return r.data })
          )
        ))
        const byTraining = {}
        results.flat().forEach(item => {
          if(!byTraining[item.training_id]) byTraining[item.training_id] = []
          byTraining[item.training_id].push(item)
        })
        return byTraining
      }
    }catch(e){
      logAppError(e)
    }
    const idSet = new Set(trainingIds)
    const byTraining = {}
    lsGet(LS_TRAINING_ITEMS)
      .filter(i=>idSet.has(i.training_id))
      .sort((a,b)=>(a.order_index ?? 0) - (b.order_index ?? 0))
      .forEach(item => {
        if(!byTraining[item.training_id]) byTraining[item.training_id] = []
        byTraining[item.training_id].push(item)
      })
    return byTraining
  },

  async createTraining({team_id, training_date, notes, items, selected_players, objectives, warmup}){
    invalidateCache(`trainings:${team_id}`)
    try{
      if(HAS_SUPABASE){
        const { data: training, error: trainingError } = await supabase
          .from('trainings')
          .insert({team_id, training_date, notes, attending_players: selected_players || [], objectives: objectives || {}, warmup: warmup || ''})
          .select()
          .single()
        if(trainingError) throw trainingError

        if(items?.length){
          const payload = items.map((item, index)=>(
            {
              training_id: training.id,
              exercise_id: item.exercise_id,
              exercise_name: item.exercise_name,
              objective: item.objective,
              category: item.category,
              planned_count: item.planned_count,
              dimensions: item.dimensions,
              notes: item.notes,
              order_index: index
            }
          ))
          const { error: itemsError } = await supabase.from('training_exercises').insert(payload)
          if(itemsError) throw itemsError
        }
        return training
      }
    }catch(e){
      logAppError(e)
    }

    const trainings = lsGet(LS_TRAININGS)
    const training = {
      id: uid(),
      team_id,
      training_date,
      notes: notes || '',
      attending_players: selected_players || [],
      objectives: objectives || {},
      warmup: warmup || '',
      created_at: new Date().toISOString()
    }
    trainings.unshift(training)
    lsSet(LS_TRAININGS, trainings)

    const currentItems = lsGet(LS_TRAINING_ITEMS)
    const newItems = (items || []).map((item, index)=>(
      {
        id: uid(),
        training_id: training.id,
        exercise_id: item.exercise_id,
        exercise_name: item.exercise_name,
        objective: item.objective,
        category: item.category,
        planned_count: item.planned_count,
        dimensions: item.dimensions,
        notes: item.notes,
        order_index: index,
        created_at: new Date().toISOString()
      }
    ))
    lsSet(LS_TRAINING_ITEMS, [...newItems, ...currentItems])

    return training
  },

  async updateTraining(trainingId, {training_date, notes, attending_players, objectives, warmup}){
    clearCache() // no team_id at hand here — cheap to just drop everything
    const payload = {}
    if(training_date !== undefined) payload.training_date = training_date
    if(notes !== undefined) payload.notes = notes || ''
    if(attending_players !== undefined) payload.attending_players = attending_players || []
    if(objectives !== undefined) payload.objectives = objectives || {}
    if(warmup !== undefined) payload.warmup = warmup || ''

    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('trainings')
          .update(payload)
          .eq('id', trainingId)
          .select()
          .single()
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }

    const trainings = lsGet(LS_TRAININGS)
    const idx = trainings.findIndex(t => t.id === trainingId)
    if(idx >= 0){
      trainings[idx] = { ...trainings[idx], ...payload }
      lsSet(LS_TRAININGS, trainings)
      return trainings[idx]
    }
    return null
  },

  async replaceTrainingItems(trainingId, items){
    clearCache() // training id isn't known to any cached key set up front
    const list = (items || []).map((item) => ({
      training_id: trainingId,
      exercise_id: item.exercise_id || null,
      exercise_name: item.exercise_name,
      objective: item.objective || '',
      category: item.category || '',
      planned_count: Number(item.planned_count || 1),
      dimensions: item.dimensions || '',
      notes: item.notes || '',
      order_index: Number(item.order_index ?? 0)
    }))

    try{
      if(HAS_SUPABASE){
        const { error: deleteError } = await supabase
          .from('training_exercises')
          .delete()
          .eq('training_id', trainingId)
        if(deleteError) throw deleteError
        if(list.length){
          const { error: insertError } = await supabase
            .from('training_exercises')
            .insert(list)
          if(insertError) throw insertError
        }
        return true
      }
    }catch(e){
      logAppError(e)
    }

    const allItems = lsGet(LS_TRAINING_ITEMS).filter(item => item.training_id !== trainingId)
    const newItems = list.map(item => ({
      ...item,
      id: uid(),
      created_at: new Date().toISOString()
    }))
    lsSet(LS_TRAINING_ITEMS, [...newItems, ...allItems])
    return true
  },

  async deleteTraining(trainingId){
    clearCache()
    try{
      if(HAS_SUPABASE){
        const { error: itemsError } = await supabase
          .from('training_exercises')
          .delete()
          .eq('training_id', trainingId)
        if(itemsError) throw itemsError
        const { error } = await supabase
          .from('trainings')
          .delete()
          .eq('id', trainingId)
        if(error) throw error
        return true
      }
    }catch(e){
      logAppError(e)
    }
    const trainings = lsGet(LS_TRAININGS).filter(t => t.id !== trainingId)
    const items = lsGet(LS_TRAINING_ITEMS).filter(item => item.training_id !== trainingId)
    lsSet(LS_TRAININGS, trainings)
    lsSet(LS_TRAINING_ITEMS, items)
    return true
  },

  // ========== FUTSAL MATCH MANAGEMENT ==========
  
  async getPlayers(teamId){
    return cachedRead(`players:${teamId}`, async () => {
      try{
        if(HAS_SUPABASE){
          await ensureLocalPlayersSynced()
          const data = await withRetry(() =>
            supabase
              .from('players')
              .select('*')
              .eq('team_id', teamId)
              .order('dorsal', {ascending:true})
              .then(r => { if(r.error) throw r.error; return r.data })
          )
          return data
        }
      }catch(e){
        logAppError(e)
      }
      return lsGet('tf_players')
        .filter(p=>p.team_id===teamId)
        .sort((a,b)=>a.dorsal - b.dorsal)
    })
  },

  async createPlayer({team_id, name, surname, dorsal, position}){
    invalidateCache(`players:${team_id}`)
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('players')
          .insert({team_id, name, surname, dorsal, position})
          .select()
          .single()
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    const players = lsGet('tf_players')
    const player = {id:uid(), team_id, name, surname, dorsal, position, created_at: new Date().toISOString()}
    players.push(player)
    lsSet('tf_players', players)
    return player
  },

  async updatePlayer(playerId, {name, surname, dorsal, position}){
    clearCache() // no team_id at hand here — cheap to just drop everything
    const payload = {name, surname, dorsal, position}
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('players')
          .update(payload)
          .eq('id', playerId)
          .select()
          .single()
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    const players = lsGet('tf_players')
    const idx = players.findIndex(p=>p.id===playerId)
    if(idx>=0){
      players[idx] = { ...players[idx], ...payload }
      lsSet('tf_players', players)
      return players[idx]
    }
    return null
  },

  async deletePlayer(playerId){
    clearCache()
    try{
      if(HAS_SUPABASE){
        const { error } = await supabase.from('players').delete().eq('id', playerId)
        if(error) throw error
      }
    }catch(e){
      logAppError(e)
    }
    const players = lsGet('tf_players')
    lsSet('tf_players', players.filter(p=>p.id!==playerId))
  },

  async getMatches(teamId){
    return cachedRead(`matches:${teamId}`, async () => {
      try{
        if(HAS_SUPABASE){
          const { data, error } = await supabase
            .from('matches')
            .select('*')
            .eq('team_id', teamId)
            .order('match_date', {ascending:false})
          if(error) throw error
          return data
        }
      }catch(e){
        logAppError(e)
      }
      return lsGet('tf_matches')
        .filter(m=>m.team_id===teamId)
        .sort((a,b)=>new Date(b.match_date) - new Date(a.match_date))
    })
  },

  async createMatch({team_id, rival_team_name, match_date, place, jornada, is_home, notes}){
    invalidateCache(`matches:${team_id}`)
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('matches')
          .insert({
            team_id,
            rival_team_name,
            match_date,
            place,
            jornada,
            notes: notes || '',
            is_home: is_home ?? true,
            status: 'scheduled'
          })
          .select()
          .single()
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    const matches = lsGet('tf_matches')
    const match = {
      id:uid(),
      team_id,
      rival_team_name,
      match_date,
      place,
      jornada,
      notes: notes || '',
      is_home: is_home ?? true,
      status: 'scheduled',
      home_goals: null,
      away_goals: null,
      ended_at: null,
      created_at: new Date().toISOString()
    }
    matches.push(match)
    lsSet('tf_matches', matches)
    return match
  },

  async finalizeMatch({match_id, home_goals, away_goals, ended_at, notes}){
    clearCache()
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('matches')
          .update({
            status: 'finished',
            home_goals,
            away_goals,
            notes,
            ended_at: ended_at || new Date().toISOString()
          })
          .eq('id', match_id)
          .select()
          .single()
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    const matches = lsGet('tf_matches')
    const idx = matches.findIndex(m=>m.id===match_id)
    if(idx>=0){
      matches[idx] = {
        ...matches[idx],
        status: 'finished',
        home_goals,
        away_goals,
        notes,
        ended_at: ended_at || new Date().toISOString()
      }
      lsSet('tf_matches', matches)
      return matches[idx]
    }
    return null
  },

  async updateMatchNotes({match_id, notes}){
    clearCache()
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('matches')
          .update({notes})
          .eq('id', match_id)
          .select()
          .single()
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    const matches = lsGet('tf_matches')
    const idx = matches.findIndex(m=>m.id===match_id)
    if(idx>=0){
      matches[idx] = { ...matches[idx], notes }
      lsSet('tf_matches', matches)
      return matches[idx]
    }
    return null
  },

  async updateCalledUpPlayers({match_id, player_ids}){
    clearCache()
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('matches')
          .update({called_up_players: player_ids})
          .eq('id', match_id)
          .select()
          .single()
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    const matches = lsGet('tf_matches')
    const idx = matches.findIndex(m=>m.id===match_id)
    if(idx>=0){
      matches[idx] = { ...matches[idx], called_up_players: player_ids }
      lsSet('tf_matches', matches)
      return matches[idx]
    }
    return null
  },

  async deleteMatch(matchId){
    clearCache()
    try{
      if(HAS_SUPABASE){
        const { error } = await supabase.from('matches').delete().eq('id', matchId)
        if(error) throw error
      }
    }catch(e){
      logAppError(e)
    }
    const matches = lsGet('tf_matches')
    lsSet('tf_matches', matches.filter(m=>m.id!==matchId))
  },

  async getMatchPlayerStats(matchId){
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('match_player_stats')
          .select('*')
          .eq('match_id', matchId)
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    return lsGet('tf_match_player_stats')
      .filter(s=>s.match_id===matchId)
  },

  async upsertMatchPlayerStats({match_id, player_id, goals, assists, shots_on_goal, shots_out, fouls, yellow_cards, red_cards, minutes_played, saves}){
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('match_player_stats')
          .upsert({match_id, player_id, goals, assists, shots_on_goal, shots_out, fouls, yellow_cards, red_cards, minutes_played, saves}, {onConflict:'match_id,player_id'})
          .select()
          .single()
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    const stats = lsGet('tf_match_player_stats')
    const idx = stats.findIndex(s=>s.match_id===match_id && s.player_id===player_id)
    const stat = {id:uid(), match_id, player_id, goals, assists, shots_on_goal, shots_out, fouls, yellow_cards, red_cards, minutes_played, saves, created_at: new Date().toISOString()}
    if(idx>=0) stats[idx] = stat
    else stats.push(stat)
    lsSet('tf_match_player_stats', stats)
    return stat
  },

  async getRivalTeamStats(matchId){
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('rival_team_stats')
          .select('*')
          .eq('match_id', matchId)
          .single()
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    const stats = lsGet('tf_rival_team_stats').filter(s=>s.match_id===matchId)
    return stats[0] || null
  },

  async upsertRivalTeamStats({match_id, goals, shots_on_goal, fouls, yellow_cards, red_cards}){
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('rival_team_stats')
          .upsert({match_id, goals, shots_on_goal, fouls, yellow_cards, red_cards}, {onConflict:'match_id'})
          .select()
          .single()
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    const stats = lsGet('tf_rival_team_stats')
    const idx = stats.findIndex(s=>s.match_id===match_id)
    const stat = {id:uid(), match_id, goals, shots_on_goal, fouls, yellow_cards, red_cards, created_at: new Date().toISOString()}
    if(idx>=0) stats[idx] = stat
    else stats.push(stat)
    lsSet('tf_rival_team_stats', stats)
    return stat
  },

  async getOnFieldPlayers(matchId){
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('on_field_players')
          .select('*')
          .eq('match_id', matchId)
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    return lsGet('tf_on_field_players')
      .filter(o=>o.match_id===matchId)
  },

  async setPlayerOnField({match_id, player_id, entry_minute}){
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('on_field_players')
          .insert({match_id, player_id, entry_minute})
          .select()
          .single()
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    const onField = lsGet('tf_on_field_players')
    const record = {id:uid(), match_id, player_id, entry_minute, exit_minute:null, created_at: new Date().toISOString()}
    onField.push(record)
    lsSet('tf_on_field_players', onField)
    return record
  },

  async setPlayerOffField(onFieldId, exit_minute){
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('on_field_players')
          .update({exit_minute})
          .eq('id', onFieldId)
          .select()
          .single()
        if(error) throw error
        return data
      }
    }catch(e){
      logAppError(e)
    }
    const onField = lsGet('tf_on_field_players')
    const idx = onField.findIndex(o=>o.id===onFieldId)
    if(idx>=0) onField[idx].exit_minute = exit_minute
    lsSet('tf_on_field_players', onField)
    return onField[idx]
  },

  // Full per-match stat history for a player (finished matches only), most
  // recent first — used by the roster's player detail popup.
  async getPlayerMatches(playerId){
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('match_player_stats')
          .select(`
            goals, assists, shots_on_goal, shots_out, fouls, yellow_cards, red_cards, minutes_played, saves,
            matches:match_id(
              id,
              rival_team_name,
              match_date,
              is_home,
              home_goals,
              away_goals,
              status
            )
          `)
          .eq('player_id', playerId)
          .order('match_date', {foreignTable:'matches', ascending:false})
        if(error) throw error
        return data
          .filter(d => d.matches?.status === 'finished')
          .map(d => ({
            match_id: d.matches?.id,
            rival_team_name: d.matches?.rival_team_name,
            match_date: d.matches?.match_date,
            is_home: d.matches?.is_home,
            home_goals: d.matches?.home_goals,
            away_goals: d.matches?.away_goals,
            goals: d.goals,
            assists: d.assists,
            shots_on_goal: d.shots_on_goal,
            shots_out: d.shots_out,
            fouls: d.fouls,
            yellow_cards: d.yellow_cards,
            red_cards: d.red_cards,
            saves: d.saves,
            minutes_played: d.minutes_played
          }))
      }
    }catch(e){
      logAppError(e)
    }
    const playerStats = lsGet('tf_match_player_stats').filter(s=>s.player_id===playerId)
    const matches = lsGet('tf_matches')
    return playerStats
      .map(stat=>{
        const match = matches.find(m=>m.id===stat.match_id)
        return {
          ...stat,
          rival_team_name: match?.rival_team_name,
          match_date: match?.match_date,
          is_home: match?.is_home,
          home_goals: match?.home_goals,
          away_goals: match?.away_goals,
          status: match?.status
        }
      })
      .filter(s => s.status === 'finished')
      .sort((a,b)=>new Date(b.match_date||0) - new Date(a.match_date||0))
  },

  // Public "solicitar acceso" form. Deliberately never .select()s the row
  // back — RLS only grants INSERT here, no SELECT, so requesting the row
  // back would fail. Admin accounts review/approve requests from AdminPanel
  // (see the admin.* helpers below); no other account can read this table.
  async requestAccess({team_name, contact_name, contact_email, message, privacy_accepted}){
    if(!HAS_SUPABASE) throw new Error('Supabase no configurado')
    if(!privacy_accepted) throw new Error('Debes aceptar la política de privacidad')
    const { error } = await supabase.from('access_requests').insert({
      team_name, contact_name, contact_email, message: message || null, privacy_accepted: true
    })
    if(error) throw error
  },

  // ── Admin ──────────────────────────────────────────────────────────
  async isAdmin(){
    if(!HAS_SUPABASE) return false
    const { data, error } = await supabase.rpc('is_admin')
    if(error) return false
    return !!data
  },

  async getAllTeamsAdmin(){
    if(!HAS_SUPABASE) return []
    const { data, error } = await supabase.from('teams').select('*').order('name')
    if(error) throw error
    return data
  },

  async getAccessRequests(){
    if(!HAS_SUPABASE) return []
    const { data, error } = await supabase.from('access_requests').select('*').order('created_at', {ascending:false})
    if(error) throw error
    return data
  },

  async rejectAccessRequest(id){
    if(!HAS_SUPABASE) throw new Error('Supabase no configurado')
    const { error } = await supabase.from('access_requests').update({status:'rejected'}).eq('id', id)
    if(error) throw error
  },

  // Runs server-side (Edge Function) since creating an auth user needs the
  // service_role key, which must never reach the browser bundle.
  async adminCreateAccount({email, password, team_id, request_id}){
    if(!HAS_SUPABASE) throw new Error('Supabase no configurado')
    const { data, error } = await supabase.functions.invoke('admin-create-account', {
      body: {email, password, team_id: team_id || null, request_id: request_id || null}
    })
    if(error) throw error
    if(data?.error) throw new Error(data.error)
    return data
  },

  // auth.users isn't exposed via PostgREST, so listing/deleting accounts
  // also goes through an Edge Function with the service_role key.
  async getAllAccounts(){
    if(!HAS_SUPABASE) return []
    const { data, error } = await supabase.functions.invoke('admin-accounts', { body: {action:'list'} })
    if(error) throw error
    if(data?.error) throw new Error(data.error)
    return data.accounts
  },

  async deleteAccount(userId){
    if(!HAS_SUPABASE) throw new Error('Supabase no configurado')
    const { data, error } = await supabase.functions.invoke('admin-accounts', { body: {action:'delete', user_id:userId} })
    if(error) throw error
    if(data?.error) throw new Error(data.error)
    return data
  },

  async resetAccountPassword({user_id, new_password, notify_email}){
    if(!HAS_SUPABASE) throw new Error('Supabase no configurado')
    const { data, error } = await supabase.functions.invoke('admin-accounts', {
      body: {action:'reset_password', user_id, new_password, notify_email: notify_email || null}
    })
    if(error) throw error
    if(data?.error) throw new Error(data.error)
    return data
  },

  // Adding/removing a team link is a plain table write — RLS already lets
  // an admin do this directly, no service_role needed.
  async addTeamToAccount(teamId, userId){
    if(!HAS_SUPABASE) throw new Error('Supabase no configurado')
    const { error } = await supabase.from('team_users').insert({team_id:teamId, user_id:userId})
    if(error) throw error
  },

  async removeTeamFromAccount(teamId, userId){
    if(!HAS_SUPABASE) throw new Error('Supabase no configurado')
    const { error } = await supabase.from('team_users').delete().eq('team_id', teamId).eq('user_id', userId)
    if(error) throw error
  },

  async getAppLogs(){
    if(!HAS_SUPABASE) return []
    const { data, error } = await supabase.from('app_logs').select('*').order('created_at', {ascending:false}).limit(200)
    if(error) throw error
    return data
  },

  async clearAppLogs(){
    if(!HAS_SUPABASE) throw new Error('Supabase no configurado')
    const { error } = await supabase.from('app_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if(error) throw error
  }
}

