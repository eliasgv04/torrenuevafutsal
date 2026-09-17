import { vi, describe, it, expect, beforeEach } from 'vitest'

// vi.mock is hoisted above these imports by Vitest; vi.hoisted() lets the
// mock object itself be created before that hoisted call runs.
const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) },
  storage: { from: vi.fn() },
  functions: { invoke: vi.fn() }
}))

vi.mock('../supabaseClient', () => ({ supabase: supabaseMock }))

import { api, clearCache } from '../api'
import { chainable } from './supabaseTestUtils'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  clearCache() // api.js's read cache is a module-level singleton — reset it too
  supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } })
})

describe('api.getTeams', () => {
  it('returns the teams Supabase responds with', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({
      data: [{ id: 't1', name: 'Torrenueva Futsal' }],
      error: null
    }))

    const teams = await api.getTeams()

    expect(teams).toEqual([{ id: 't1', name: 'Torrenueva Futsal' }])
    expect(supabaseMock.from).toHaveBeenCalledWith('teams')
  })

  it('falls back to localStorage and seeds a default team when Supabase fails', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'network down' } }))

    const teams = await api.getTeams()

    expect(teams).toHaveLength(1)
    expect(teams[0].name).toBe('Torrenueva Futsal')
    // The seeded team must also have been persisted, so the next call is stable.
    expect(JSON.parse(localStorage.getItem('tf_teams'))).toEqual(teams)
  })

  it('returns the previously seeded local team on a second failure, without duplicating it', async () => {
    supabaseMock.from.mockReturnValue(chainable({ data: null, error: { message: 'still down' } }))

    const first = await api.getTeams()
    const second = await api.getTeams()

    expect(second).toEqual(first)
    expect(second).toHaveLength(1)
  })
})

describe('api.createTeam', () => {
  it('inserts the team and returns it with a client-generated id (no RETURNING round trip)', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ error: null }))

    const team = await api.createTeam('CD Manchego', { gradient_start: '#000', gradient_end: '#fff', crest_url: null })

    expect(team.name).toBe('CD Manchego')
    expect(team.id).toBeTruthy()
    expect(team.created_at).toBeTruthy()
    expect(supabaseMock.from).toHaveBeenCalledWith('teams')
  })

  it('falls back to a local team when the insert fails', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ error: { message: 'insert failed' } }))

    const team = await api.createTeam('CD Manchego')

    expect(team.name).toBe('CD Manchego')
    expect(team.id).toMatch(/^local-/)
    expect(JSON.parse(localStorage.getItem('tf_teams'))).toEqual([team])
  })
})

describe('api.updateTeam', () => {
  it('sends only the fields that were provided', async () => {
    const builder = chainable({ data: { id: 't1', name: 'Nuevo nombre' }, error: null })
    supabaseMock.from.mockReturnValueOnce(builder)

    const result = await api.updateTeam('t1', { name: 'Nuevo nombre' })

    expect(result).toEqual({ id: 't1', name: 'Nuevo nombre' })
    expect(builder.update).toHaveBeenCalledWith({ name: 'Nuevo nombre' })
    expect(builder.eq).toHaveBeenCalledWith('id', 't1')
  })

  it('updates the matching local team on failure and returns null if it does not exist', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))
    localStorage.setItem('tf_teams', JSON.stringify([{ id: 't1', name: 'Viejo' }]))

    const result = await api.updateTeam('t1', { name: 'Actualizado' })
    expect(result.name).toBe('Actualizado')

    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))
    const missing = await api.updateTeam('no-existe', { name: 'x' })
    expect(missing).toBeNull()
  })
})

describe('api.deleteTeam', () => {
  it('deletes the team from Supabase and cleans up its local-storage remnants', async () => {
    localStorage.setItem('tf_teams', JSON.stringify([{ id: 't1' }, { id: 't2' }]))
    localStorage.setItem('tf_exercises', JSON.stringify([{ id: 'e1', team_id: 't1' }, { id: 'e2', team_id: 't2' }]))

    const builder = chainable({ error: null })
    supabaseMock.from.mockReturnValueOnce(builder)

    await api.deleteTeam('t1')

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 't1')
    expect(JSON.parse(localStorage.getItem('tf_teams'))).toEqual([{ id: 't2' }])
    expect(JSON.parse(localStorage.getItem('tf_exercises'))).toEqual([{ id: 'e2', team_id: 't2' }])
  })

  it('clears the read cache, so a subsequent getExercises for the deleted team re-fetches instead of using stale data', async () => {
    // Prime the cache for team t1's exercises.
    supabaseMock.from.mockReturnValueOnce(chainable({ data: [{ id: 'e1' }], error: null }))
    await api.getExercises('t1')
    expect(supabaseMock.from).toHaveBeenCalledTimes(1)

    // Still cached: a second call within the TTL must NOT hit Supabase again.
    const cachedAgain = await api.getExercises('t1')
    expect(cachedAgain).toEqual([{ id: 'e1' }])
    expect(supabaseMock.from).toHaveBeenCalledTimes(1)

    // Deleting (any) team clears the whole cache...
    supabaseMock.from.mockReturnValueOnce(chainable({ error: null }))
    await api.deleteTeam('t1')

    // ...so this must hit Supabase again rather than reuse the stale cache entry.
    supabaseMock.from.mockReturnValueOnce(chainable({ data: [{ id: 'e1-refreshed' }], error: null }))
    const afterDelete = await api.getExercises('t1')
    expect(afterDelete).toEqual([{ id: 'e1-refreshed' }])
    expect(supabaseMock.from).toHaveBeenCalledTimes(3) // getExercises, deleteTeam, getExercises again
  })
})

// One-time migration (triggered lazily from getTeams/getPlayers) that moves
// anything left over from the pre-Supabase, localStorage-only version of the
// app into the cloud: matched by name (team) or by dorsal+name+surname
// (player) against what's already there, so it's safe to run more than once.
describe('ensureLocalPlayersSynced (via api.getTeams)', () => {
  it('matches an existing cloud team/player by name, and creates the ones that are missing', async () => {
    localStorage.setItem('tf_teams', JSON.stringify([{ id: 'lt1', name: 'Torrenueva' }]))
    localStorage.setItem('tf_players', JSON.stringify([
      { id: 'lp1', team_id: 'lt1', name: 'Ana', surname: 'García', dorsal: 7, position: 'Cierre' },
      { id: 'lp2', team_id: 'lt1', name: 'Luis', surname: 'B', dorsal: 1, position: 'Portero' }
    ]))

    supabaseMock.from
      .mockReturnValueOnce(chainable({ data: [{ id: 'ct1', name: 'torrenueva' }], error: null })) // cloud teams (case-insensitive match)
      .mockReturnValueOnce(chainable({ data: [{ id: 'cp1', team_id: 'ct1', name: 'Ana', surname: 'García', dorsal: 7 }], error: null })) // cloud players for ct1
      .mockReturnValueOnce(chainable({ data: { id: 'cp2', team_id: 'ct1', name: 'Luis', surname: 'B', dorsal: 1, position: 'Portero' }, error: null })) // insert Luis
      .mockReturnValueOnce(chainable({ data: [{ id: 'ct1', name: 'torrenueva' }], error: null })) // getTeams' own select

    const teams = await api.getTeams()

    expect(teams).toEqual([{ id: 'ct1', name: 'torrenueva' }])
    expect(supabaseMock.from.mock.calls.filter(c => c[0] === 'teams')).toHaveLength(2) // cloud lookup + getTeams' own select (no insert — matched by name)
    const playersCalls = supabaseMock.from.mock.calls.filter(c => c[0] === 'players')
    expect(playersCalls).toHaveLength(2) // select existing + insert only the unmatched one (Luis)
    expect(localStorage.getItem('tf_supabase_players_synced_v1')).toBe('1')
  })

  it('runs only once: a second call skips the sync entirely', async () => {
    localStorage.setItem('tf_teams', JSON.stringify([{ id: 'lt1', name: 'Torrenueva' }]))
    localStorage.setItem('tf_players', JSON.stringify([{ id: 'lp1', team_id: 'lt1', name: 'Ana', surname: 'García', dorsal: 7 }]))
    supabaseMock.from
      .mockReturnValueOnce(chainable({ data: [], error: null })) // cloud teams (none yet)
      .mockReturnValueOnce(chainable({ data: { id: 'ct1', name: 'Torrenueva' }, error: null })) // insert team
      .mockReturnValueOnce(chainable({ data: [], error: null })) // cloud players for ct1 (none yet)
      .mockReturnValueOnce(chainable({ data: { id: 'cp1', team_id: 'ct1', name: 'Ana' }, error: null })) // insert Ana
      .mockReturnValueOnce(chainable({ data: [{ id: 'ct1', name: 'Torrenueva' }], error: null })) // getTeams' own select

    await api.getTeams()
    expect(localStorage.getItem('tf_supabase_players_synced_v1')).toBe('1')

    supabaseMock.from.mockClear()
    supabaseMock.from.mockReturnValueOnce(chainable({ data: [{ id: 'ct1', name: 'Torrenueva' }], error: null }))
    await api.getTeams()
    expect(supabaseMock.from).toHaveBeenCalledTimes(1) // only getTeams' own select — sync skipped
  })

  it('sets the synced flag without calling Supabase when there is nothing local to sync', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: [{ id: 'ct1', name: 'Torrenueva' }], error: null }))
    await api.getTeams()
    expect(supabaseMock.from).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('tf_supabase_players_synced_v1')).toBe('1')
  })
})
