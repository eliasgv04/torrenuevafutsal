import { vi, describe, it, expect, beforeEach } from 'vitest'

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
  clearCache()
})

describe('api.getMatches', () => {
  it('returns Supabase matches ordered most-recent-first', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: [{ id: 'm1' }], error: null }))
    expect(await api.getMatches('t1')).toEqual([{ id: 'm1' }])
  })

  it('falls back to the local list, sorted by date descending', async () => {
    localStorage.setItem('tf_matches', JSON.stringify([
      { id: 'm1', team_id: 't1', match_date: '2026-01-01' },
      { id: 'm2', team_id: 't1', match_date: '2026-03-01' }
    ]))
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))
    const result = await api.getMatches('t1')
    expect(result.map(m => m.id)).toEqual(['m2', 'm1'])
  })
})

describe('api.createMatch', () => {
  it('defaults is_home to true and notes to an empty string when omitted', async () => {
    const builder = chainable({ data: { id: 'm1' }, error: null })
    supabaseMock.from.mockReturnValueOnce(builder)

    await api.createMatch({ team_id: 't1', rival_team_name: 'CD X', match_date: '2026-05-01', place: 'Casa', jornada: 3 })

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      is_home: true, notes: '', status: 'scheduled'
    }))
  })

  it('respects an explicit is_home: false', async () => {
    const builder = chainable({ data: { id: 'm1' }, error: null })
    supabaseMock.from.mockReturnValueOnce(builder)
    await api.createMatch({ team_id: 't1', rival_team_name: 'CD X', match_date: '2026-05-01', place: 'Fuera', is_home: false })
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ is_home: false }))
  })

  it('builds a full local match (with null scores) when Supabase fails', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))
    const match = await api.createMatch({ team_id: 't1', rival_team_name: 'CD X', match_date: '2026-05-01', place: 'Casa' })
    expect(match).toMatchObject({ status: 'scheduled', home_goals: null, away_goals: null, is_home: true })
    expect(match.id).toMatch(/^local-/)
  })
})

describe('api.finalizeMatch', () => {
  it('sets status to finished and stamps ended_at when not provided', async () => {
    const builder = chainable({ data: { id: 'm1', status: 'finished' }, error: null })
    supabaseMock.from.mockReturnValueOnce(builder)

    await api.finalizeMatch({ match_id: 'm1', home_goals: 3, away_goals: 1 })

    const payload = builder.update.mock.calls[0][0]
    expect(payload.status).toBe('finished')
    expect(payload.home_goals).toBe(3)
    expect(payload.ended_at).toBeTruthy()
  })

  it('updates the local match on failure', async () => {
    localStorage.setItem('tf_matches', JSON.stringify([{ id: 'm1', status: 'scheduled' }]))
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))

    const result = await api.finalizeMatch({ match_id: 'm1', home_goals: 2, away_goals: 2, ended_at: '2026-05-01T20:00:00Z' })
    expect(result).toMatchObject({ status: 'finished', home_goals: 2, away_goals: 2 })
  })
})

describe('api.updateMatchNotes / updateCalledUpPlayers / deleteMatch', () => {
  it('updateMatchNotes only touches the notes field', async () => {
    const builder = chainable({ data: { id: 'm1', notes: 'Buen partido' }, error: null })
    supabaseMock.from.mockReturnValueOnce(builder)
    await api.updateMatchNotes({ match_id: 'm1', notes: 'Buen partido' })
    expect(builder.update).toHaveBeenCalledWith({ notes: 'Buen partido' })
  })

  it('updateCalledUpPlayers stores the given player_ids under called_up_players', async () => {
    const builder = chainable({ data: { id: 'm1', called_up_players: ['p1', 'p2'] }, error: null })
    supabaseMock.from.mockReturnValueOnce(builder)
    const result = await api.updateCalledUpPlayers({ match_id: 'm1', player_ids: ['p1', 'p2'] })
    expect(builder.update).toHaveBeenCalledWith({ called_up_players: ['p1', 'p2'] })
    expect(result.called_up_players).toEqual(['p1', 'p2'])
  })

  it('deleteMatch removes the match from local storage regardless of the Supabase outcome', async () => {
    localStorage.setItem('tf_matches', JSON.stringify([{ id: 'm1' }, { id: 'm2' }]))
    supabaseMock.from.mockReturnValueOnce(chainable({ error: null }))
    await api.deleteMatch('m1')
    expect(JSON.parse(localStorage.getItem('tf_matches'))).toEqual([{ id: 'm2' }])
  })
})
