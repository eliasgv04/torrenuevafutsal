import { supabase } from './supabaseClient'

const HAS_SUPABASE = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON)

if(!HAS_SUPABASE){
  console.warn('Supabase is not configured. App is using localStorage fallback, data will not sync across devices.')
}

// LocalStorage keys
const LS_TEAMS = 'tf_teams'
const LS_EXERCISES = 'tf_exercises'
const LS_RECORDS = 'tf_records'
const LS_TRAININGS = 'tf_trainings'
const LS_TRAINING_ITEMS = 'tf_training_items'
const LS_PLAYER_CAREER_STATS = 'tf_player_career_stats'
const LS_SUPABASE_PLAYERS_SYNCED = 'tf_supabase_players_synced_v1'

let localPlayersSyncPromise = null

function uid(){
  return 'local-' + Math.random().toString(36).slice(2,9)
}

export async function uploadPhoto(file){
  if(HAS_SUPABASE){
    try{
      const name = `${Date.now()}_${file.name}`
      const { data, error } = await supabase.storage.from('photos').upload(name, file)
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
    const localCareerStats = lsGet(LS_PLAYER_CAREER_STATS)

    if(localTeams.length === 0 && localPlayers.length === 0 && localCareerStats.length === 0){
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

    for(const localStat of localCareerStats){
      const cloudPlayerId = playerMap.get(localStat.player_id)
      if(!cloudPlayerId) continue

      const cloudTeamId = teamMap.get(localStat.team_id)
      const payload = {
        team_id: cloudTeamId || localStat.team_id,
        player_id: cloudPlayerId,
        matches_played: localStat.matches_played ?? 0,
        goals: localStat.goals ?? 0,
        shots_on_goal: localStat.shots_on_goal ?? 0,
        yellow_cards: localStat.yellow_cards ?? 0,
        red_cards: localStat.red_cards ?? 0,
        minutes_played: localStat.minutes_played ?? 0,
        saves: localStat.saves ?? 0,
        updated_at: localStat.updated_at || new Date().toISOString()
      }

      const { error } = await supabase
        .from('player_career_stats')
        .upsert(payload, { onConflict: 'player_id' })

      if(error) throw error
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
      console.error('Supabase error, falling back to localStorage:', e)
    }
    const items = lsGet(LS_TEAMS)
    if(items.length===0){
      const t = {id:uid(), name:'Torrenueva Futsal', created_at: new Date().toISOString()}
      lsSet(LS_TEAMS,[t])
      return [t]
    }
    return items
  },

  async createTeam(name){
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase.from('teams').insert({name}).select().single()
        if(error) throw error
        return data
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }
    const items = lsGet(LS_TEAMS)
    const t = {id:uid(), name, created_at: new Date().toISOString()}
    items.unshift(t)
    lsSet(LS_TEAMS, items)
    return t
  },

  async deleteTeam(teamId){
    try{
      if(HAS_SUPABASE){
        const { error } = await supabase.from('teams').delete().eq('id', teamId)
        if(error) throw error
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }
    const teams = lsGet(LS_TEAMS).filter(team => team.id !== teamId)
    const exercises = lsGet(LS_EXERCISES).filter(exercise => exercise.team_id !== teamId)
    const exerciseIds = new Set(lsGet(LS_EXERCISES).filter(exercise => exercise.team_id === teamId).map(exercise => exercise.id))
    const records = lsGet(LS_RECORDS).filter(record => !exerciseIds.has(record.exercise_id))
    const trainings = lsGet(LS_TRAININGS).filter(training => training.team_id !== teamId)
    const trainingIds = new Set(lsGet(LS_TRAININGS).filter(training => training.team_id === teamId).map(training => training.id))
    const trainingItems = lsGet(LS_TRAINING_ITEMS).filter(item => !trainingIds.has(item.training_id))
    lsSet(LS_TEAMS, teams)
    lsSet(LS_EXERCISES, exercises)
    lsSet(LS_RECORDS, records)
    lsSet(LS_TRAININGS, trainings)
    lsSet(LS_TRAINING_ITEMS, trainingItems)
  },

  async getExercises(teamId){
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase.from('exercises').select('*').eq('team_id', teamId).order('created_at', {ascending:false})
        if(error) throw error
        return data
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }
    const items = lsGet(LS_EXERCISES).filter(e=>e.team_id===teamId)
    return items
  },

  async createExercise({team_id,name,objective,file,category,dimensions}){
    let photo_url = null
    if(file) photo_url = await uploadPhoto(file)
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase.from('exercises').insert({team_id,name,objective,photo_url,category,dimensions}).select().single()
        if(error) throw error
        return { ...data, dimensions }
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }
    const items = lsGet(LS_EXERCISES)
    const ex = {id:uid(), team_id, name, objective, photo_url, category, dimensions, created_at:new Date().toISOString()}
    items.unshift(ex)
    lsSet(LS_EXERCISES, items)
    return ex
  },

  async updateExercise(exerciseId, {name,objective,category,file,dimensions}){
    let photo_url = null
    if(file) photo_url = await uploadPhoto(file)
    try{
      if(HAS_SUPABASE){
        const payload = { name, objective, category, dimensions }
        if(photo_url) payload.photo_url = photo_url
        const { data, error } = await supabase.from('exercises').update(payload).eq('id', exerciseId).select().single()
        if(error) throw error
        return { ...data, dimensions }
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }

    const items = lsGet(LS_EXERCISES)
    const idx = items.findIndex(i=>i.id===exerciseId)
    if(idx>=0){
      items[idx] = { ...items[idx], name, objective, category, dimensions }
      if(photo_url) items[idx].photo_url = photo_url
      lsSet(LS_EXERCISES, items)
      return items[idx]
    }
    return null
  },

  async deleteExercise(exerciseId){
    try{
      if(HAS_SUPABASE){
        const { error } = await supabase.from('exercises').delete().eq('id', exerciseId)
        if(error) throw error
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }
    const exercises = lsGet(LS_EXERCISES).filter(exercise => exercise.id !== exerciseId)
    const records = lsGet(LS_RECORDS).filter(record => record.exercise_id !== exerciseId)
    const trainingItems = lsGet(LS_TRAINING_ITEMS).filter(item => item.exercise_id !== exerciseId)
    lsSet(LS_EXERCISES, exercises)
    lsSet(LS_RECORDS, records)
    lsSet(LS_TRAINING_ITEMS, trainingItems)
  },

  async getRecords(exerciseId){
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase.from('exercise_records').select('*').eq('exercise_id', exerciseId).order('occurred_at', {ascending:false})
        if(error) throw error
        return data
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }
    return lsGet(LS_RECORDS).filter(r=>r.exercise_id===exerciseId)
  },

  // Fetch all records for multiple exercises in a single query (avoids N+1)
  async getRecordsByExerciseIds(exerciseIds){
    if(!exerciseIds || exerciseIds.length === 0) return []
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('exercise_records')
          .select('*')
          .in('exercise_id', exerciseIds)
          .order('occurred_at', {ascending:false})
        if(error) throw error
        return data
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }
    const idSet = new Set(exerciseIds)
    return lsGet(LS_RECORDS)
      .filter(r => idSet.has(r.exercise_id))
      .sort((a,b) => new Date(b.occurred_at) - new Date(a.occurred_at))
  },

  async createRecord({exercise_id, occurred_at, count, effectiveness, dimensions, notes}){
    const recordDate = occurred_at || new Date().toISOString().slice(0, 10)
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase.from('exercise_records').insert({exercise_id, occurred_at: recordDate, count, effectiveness, dimensions, notes}).select().single()
        if(error) throw error
        return data
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }
    const items = lsGet(LS_RECORDS)
    const r = {id:uid(), exercise_id, occurred_at: recordDate, count, effectiveness, dimensions, notes, created_at:new Date().toISOString()}
    items.unshift(r)
    lsSet(LS_RECORDS, items)
    return r
  },

  async getTrainings(teamId){
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('trainings')
          .select('*')
          .eq('team_id', teamId)
          .order('training_date', {ascending:false})
          .order('created_at', {ascending:false})
        if(error) throw error
        return data
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }
    return lsGet(LS_TRAININGS)
      .filter(t=>t.team_id===teamId)
      .sort((a,b)=>new Date(b.training_date) - new Date(a.training_date))
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
      console.error('Supabase error, falling back to localStorage:', e)
    }
    return lsGet(LS_TRAINING_ITEMS)
      .filter(i=>i.training_id===trainingId)
      .sort((a,b)=>(a.order_index ?? 0) - (b.order_index ?? 0))
  },

  async createTraining({team_id, training_date, notes, items, selected_players, objectives, warmup}){
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
      console.error('Supabase error, falling back to localStorage:', e)
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
      console.error('Supabase error, falling back to localStorage:', e)
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
      console.error('Supabase error, falling back to localStorage:', e)
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
      console.error('Supabase error, falling back to localStorage:', e)
    }
    const trainings = lsGet(LS_TRAININGS).filter(t => t.id !== trainingId)
    const items = lsGet(LS_TRAINING_ITEMS).filter(item => item.training_id !== trainingId)
    lsSet(LS_TRAININGS, trainings)
    lsSet(LS_TRAINING_ITEMS, items)
    return true
  },

  // ========== FUTSAL MATCH MANAGEMENT ==========
  
  async getPlayers(teamId){
    try{
      if(HAS_SUPABASE){
        await ensureLocalPlayersSynced()
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('team_id', teamId)
          .order('dorsal', {ascending:true})
        if(error) throw error
        return data
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }
    return lsGet('tf_players')
      .filter(p=>p.team_id===teamId)
      .sort((a,b)=>a.dorsal - b.dorsal)
  },

  async createPlayer({team_id, name, surname, dorsal, position}){
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
      console.error('Supabase error, falling back to localStorage:', e)
    }
    const players = lsGet('tf_players')
    const player = {id:uid(), team_id, name, surname, dorsal, position, created_at: new Date().toISOString()}
    players.push(player)
    lsSet('tf_players', players)
    return player
  },

  async deletePlayer(playerId){
    try{
      if(HAS_SUPABASE){
        const { error } = await supabase.from('players').delete().eq('id', playerId)
        if(error) throw error
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }
    const players = lsGet('tf_players')
    lsSet('tf_players', players.filter(p=>p.id!==playerId))
    const careerStats = lsGet(LS_PLAYER_CAREER_STATS)
    lsSet(LS_PLAYER_CAREER_STATS, careerStats.filter(s=>s.player_id!==playerId))
  },

  async getPlayerCareerStats(playerId){
    try{
      if(HAS_SUPABASE){
        await ensureLocalPlayersSynced()
        const { data, error } = await supabase
          .from('player_career_stats')
          .select('*')
          .eq('player_id', playerId)
          .maybeSingle()
        if(error) throw error
        return data || null
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }
    return lsGet(LS_PLAYER_CAREER_STATS).find(s=>s.player_id===playerId) || null
  },

  async upsertPlayerCareerStats({team_id, player_id, matches_played, goals, shots_on_goal, assists, shots_out, yellow_cards, red_cards, minutes_played, saves}){
    const payload = {
      team_id,
      player_id,
      matches_played: matches_played ?? 0,
      goals: goals ?? 0,
      shots_on_goal: shots_on_goal ?? 0,
      assists: assists ?? 0,
      shots_out: shots_out ?? 0,
      yellow_cards: yellow_cards ?? 0,
      red_cards: red_cards ?? 0,
      minutes_played: minutes_played ?? 0,
      saves: saves ?? 0,
      updated_at: new Date().toISOString()
    }

    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('player_career_stats')
          .upsert(payload, {onConflict:'player_id'})
          .select()
          .single()
        if(error) throw error
        return data
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }

    const stats = lsGet(LS_PLAYER_CAREER_STATS)
    const idx = stats.findIndex(item=>item.player_id===player_id)
    const record = { id: idx >= 0 ? stats[idx].id : uid(), ...payload }
    if(idx >= 0) stats[idx] = record
    else stats.push(record)
    lsSet(LS_PLAYER_CAREER_STATS, stats)
    return record
  },

  async getMatches(teamId){
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
      console.error('Supabase error, falling back to localStorage:', e)
    }
    return lsGet('tf_matches')
      .filter(m=>m.team_id===teamId)
      .sort((a,b)=>new Date(b.match_date) - new Date(a.match_date))
  },

  async createMatch({team_id, rival_team_name, match_date, place, jornada, is_home, notes}){
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
      console.error('Supabase error, falling back to localStorage:', e)
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
      console.error('Supabase error, falling back to localStorage:', e)
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
      console.error('Supabase error, falling back to localStorage:', e)
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

  async deleteMatch(matchId){
    try{
      if(HAS_SUPABASE){
        const { error } = await supabase.from('matches').delete().eq('id', matchId)
        if(error) throw error
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
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
      console.error('Supabase error, falling back to localStorage:', e)
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
      console.error('Supabase error, falling back to localStorage:', e)
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
      console.error('Supabase error, falling back to localStorage:', e)
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
      console.error('Supabase error, falling back to localStorage:', e)
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
      console.error('Supabase error, falling back to localStorage:', e)
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
      console.error('Supabase error, falling back to localStorage:', e)
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
      console.error('Supabase error, falling back to localStorage:', e)
    }
    const onField = lsGet('tf_on_field_players')
    const idx = onField.findIndex(o=>o.id===onFieldId)
    if(idx>=0) onField[idx].exit_minute = exit_minute
    lsSet('tf_on_field_players', onField)
    return onField[idx]
  },

  async getPlayerMatches(playerId){
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase
          .from('match_player_stats')
          .select(`
            *,
            matches:match_id(
              id,
              rival_team_name,
              match_date
            )
          `)
          .eq('player_id', playerId)
          .order('match_date', {ascending:false})
        if(error) throw error
        return data.map(d=>({
          id: d.id,
          rival_team_name: d.matches?.rival_team_name,
          match_date: d.matches?.match_date,
          goals: d.goals,
          shots_on_goal: d.shots_on_goal,
          yellow_cards: d.yellow_cards,
          red_cards: d.red_cards,
          saves: d.saves,
          minutes_played: d.minutes_played
        }))
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }
    const playerStats = lsGet('tf_match_player_stats').filter(s=>s.player_id===playerId)
    const matches = lsGet('tf_matches')
    return playerStats.map(stat=>{
      const match = matches.find(m=>m.id===stat.match_id)
      return {
        ...stat,
        match_id: stat.match_id,
        rival_team_name: match?.rival_team_name,
        match_date: match?.match_date
      }
    }).sort((a,b)=>new Date(b.match_date||0) - new Date(a.match_date||0))
  }
}

