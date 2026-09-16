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

describe('api.getMatchPlayerStats / api.getRivalTeamStats', () => {
  it('returns the Supabase rows for a match', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: [{ player_id: 'p1', goals: 2 }], error: null }))
    expect(await api.getMatchPlayerStats('m1')).toEqual([{ player_id: 'p1', goals: 2 }])
  })

  it('falls back to the local rows filtered by match, for player stats', async () => {
    localStorage.setItem('tf_match_player_stats', JSON.stringify([
      { match_id: 'm1', player_id: 'p1' }, { match_id: 'm2', player_id: 'p2' }
    ]))
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))
    expect(await api.getMatchPlayerStats('m1')).toEqual([{ match_id: 'm1', player_id: 'p1' }])
  })

  it('falls back to null (not undefined) when no local rival stats exist for the match', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))
    expect(await api.getRivalTeamStats('m1')).toBeNull()
  })
})

describe('api.upsertMatchPlayerStats', () => {
  it('upserts with the match_id+player_id conflict key', async () => {
    const builder = chainable({ data: { id: 's1', goals: 2 }, error: null })
    supabaseMock.from.mockReturnValueOnce(builder)

    await api.upsertMatchPlayerStats({ match_id: 'm1', player_id: 'p1', goals: 2 })

    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ match_id: 'm1', player_id: 'p1', goals: 2 }),
      { onConflict: 'match_id,player_id' }
    )
  })

  it('replaces an existing local row for the same match+player instead of duplicating it', async () => {
    localStorage.setItem('tf_match_player_stats', JSON.stringify([
      { id: 'old', match_id: 'm1', player_id: 'p1', goals: 1 }
    ]))
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))

    await api.upsertMatchPlayerStats({ match_id: 'm1', player_id: 'p1', goals: 3 })

    const stored = JSON.parse(localStorage.getItem('tf_match_player_stats'))
    expect(stored).toHaveLength(1)
    expect(stored[0].goals).toBe(3)
  })

  it('pushes a new local row for a different player in the same match', async () => {
    localStorage.setItem('tf_match_player_stats', JSON.stringify([
      { id: 'old', match_id: 'm1', player_id: 'p1', goals: 1 }
    ]))
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))

    await api.upsertMatchPlayerStats({ match_id: 'm1', player_id: 'p2', goals: 5 })

    const stored = JSON.parse(localStorage.getItem('tf_match_player_stats'))
    expect(stored).toHaveLength(2)
  })
})

describe('api.upsertRivalTeamStats', () => {
  it('upserts on the match_id conflict key', async () => {
    const builder = chainable({ data: { id: 'r1', goals: 1 }, error: null })
    supabaseMock.from.mockReturnValueOnce(builder)
    await api.upsertRivalTeamStats({ match_id: 'm1', goals: 1 })
    expect(builder.upsert).toHaveBeenCalledWith(expect.objectContaining({ match_id: 'm1' }), { onConflict: 'match_id' })
  })
})

describe('api.getOnFieldPlayers / setPlayerOnField / setPlayerOffField', () => {
  it('records an entry with a null exit_minute, then can close it locally', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))
    const entry = await api.setPlayerOnField({ match_id: 'm1', player_id: 'p1', entry_minute: 5 })
    expect(entry.exit_minute).toBeNull()

    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))
    const closed = await api.setPlayerOffField(entry.id, 30)
    expect(closed.exit_minute).toBe(30)
  })

  it('getOnFieldPlayers filters the local fallback by match', async () => {
    localStorage.setItem('tf_on_field_players', JSON.stringify([
      { id: 'o1', match_id: 'm1' }, { id: 'o2', match_id: 'm2' }
    ]))
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))
    expect(await api.getOnFieldPlayers('m1')).toEqual([{ id: 'o1', match_id: 'm1' }])
  })
})

describe('api.getPlayerMatches', () => {
  it('flattens the joined match data and keeps only finished matches, from Supabase', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({
      data: [
        { goals: 2, assists: 0, matches: { id: 'm1', rival_team_name: 'CD X', match_date: '2026-05-01', status: 'finished', home_goals: 3, away_goals: 1 } },
        { goals: 0, assists: 1, matches: { id: 'm2', rival_team_name: 'CD Y', match_date: '2026-06-01', status: 'scheduled' } }
      ],
      error: null
    }))

    const result = await api.getPlayerMatches('p1')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ match_id: 'm1', rival_team_name: 'CD X', goals: 2 })
  })

  it('builds the same shape from local storage, sorted most-recent-first, on failure', async () => {
    localStorage.setItem('tf_match_player_stats', JSON.stringify([
      { match_id: 'm1', player_id: 'p1', goals: 1 },
      { match_id: 'm2', player_id: 'p1', goals: 2 },
      { match_id: 'm3', player_id: 'p1', goals: 9 } // belongs to an unfinished match
    ]))
    localStorage.setItem('tf_matches', JSON.stringify([
      { id: 'm1', match_date: '2026-01-01', status: 'finished', rival_team_name: 'Viejo' },
      { id: 'm2', match_date: '2026-06-01', status: 'finished', rival_team_name: 'Nuevo' },
      { id: 'm3', match_date: '2026-07-01', status: 'scheduled', rival_team_name: 'Futuro' }
    ]))
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))

    const result = await api.getPlayerMatches('p1')
    expect(result.map(r => r.rival_team_name)).toEqual(['Nuevo', 'Viejo']) // most recent finished match first
  })
})
