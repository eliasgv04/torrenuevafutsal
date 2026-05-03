import { supabase } from './supabaseClient'

const HAS_SUPABASE = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON)

// LocalStorage keys
const LS_TEAMS = 'tf_teams'
const LS_EXERCISES = 'tf_exercises'
const LS_RECORDS = 'tf_records'

function uid(){
  return 'local-' + Math.random().toString(36).slice(2,9)
}

async function uploadPhoto(file){
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

export const api = {
  async getTeams(){
    try{
      if(HAS_SUPABASE){
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
    lsSet(LS_TEAMS, teams)
    lsSet(LS_EXERCISES, exercises)
    lsSet(LS_RECORDS, records)
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

  async createExercise({team_id,name,objective,file,category}){
    let photo_url = null
    if(file) photo_url = await uploadPhoto(file)
    try{
      if(HAS_SUPABASE){
        const { data, error } = await supabase.from('exercises').insert({team_id,name,objective,photo_url,category}).select().single()
        if(error) throw error
        return data
      }
    }catch(e){
      console.error('Supabase error, falling back to localStorage:', e)
    }
    const items = lsGet(LS_EXERCISES)
    const ex = {id:uid(), team_id, name, objective, photo_url, category, created_at:new Date().toISOString()}
    items.unshift(ex)
    lsSet(LS_EXERCISES, items)
    return ex
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
    lsSet(LS_EXERCISES, exercises)
    lsSet(LS_RECORDS, records)
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
  }
}
