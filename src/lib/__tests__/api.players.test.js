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

describe('api.getPlayers', () => {
  it('returns Supabase data ordered by dorsal', async () => {
    const builder = chainable({ data: [{ id: 'p1', dorsal: 7 }], error: null })
    supabaseMock.from.mockReturnValueOnce(builder)

    const result = await api.getPlayers('t1')

    expect(result).toEqual([{ id: 'p1', dorsal: 7 }])
    expect(builder.eq).toHaveBeenCalledWith('team_id', 't1')
    expect(builder.order).toHaveBeenCalledWith('dorsal', { ascending: true })
  })

  it('falls back to the local roster, sorted by dorsal, on failure', async () => {
    localStorage.setItem('tf_players', JSON.stringify([
      { id: 'p1', team_id: 't1', dorsal: 9 },
      { id: 'p2', team_id: 't1', dorsal: 3 },
      { id: 'p3', team_id: 't2', dorsal: 1 }
    ]))
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))

    const result = await api.getPlayers('t1')
    expect(result.map(p => p.id)).toEqual(['p2', 'p1'])
  })
})

describe('api.createPlayer', () => {
  it('inserts the player and invalidates that team\'s player cache', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: [], error: null })) // prime cache
    await api.getPlayers('t1')

    const builder = chainable({ data: { id: 'p1', name: 'Ana' }, error: null })
    supabaseMock.from.mockReturnValueOnce(builder)
    const created = await api.createPlayer({ team_id: 't1', name: 'Ana', surname: 'García', dorsal: 7, position: 'Cierre' })
    expect(created).toEqual({ id: 'p1', name: 'Ana' })
    expect(builder.insert).toHaveBeenCalledWith({ team_id: 't1', name: 'Ana', surname: 'García', dorsal: 7, position: 'Cierre' })

    supabaseMock.from.mockReturnValueOnce(chainable({ data: [{ id: 'fresh' }], error: null }))
    const afterCreate = await api.getPlayers('t1')
    expect(afterCreate).toEqual([{ id: 'fresh' }]) // cache was invalidated, not stale
  })

  it('saves locally with a generated id when the insert fails', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))
    const created = await api.createPlayer({ team_id: 't1', name: 'Ana', surname: 'García', dorsal: 7, position: 'Cierre' })
    expect(created.id).toMatch(/^local-/)
    expect(JSON.parse(localStorage.getItem('tf_players'))).toEqual([created])
  })
})

describe('api.updatePlayer', () => {
  it('sends the update payload and returns the Supabase row', async () => {
    const builder = chainable({ data: { id: 'p1', name: 'Actualizado' }, error: null })
    supabaseMock.from.mockReturnValueOnce(builder)

    const result = await api.updatePlayer('p1', { name: 'Actualizado', surname: 'x', dorsal: 8, position: 'Pivot' })
    expect(result.name).toBe('Actualizado')
    expect(builder.eq).toHaveBeenCalledWith('id', 'p1')
  })

  it('updates the local copy and returns null for a non-existent player on failure', async () => {
    localStorage.setItem('tf_players', JSON.stringify([{ id: 'p1', name: 'Viejo' }]))
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))

    const updated = await api.updatePlayer('p1', { name: 'Nuevo', surname: '', dorsal: 1, position: 'Pivot' })
    expect(updated.name).toBe('Nuevo')

    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))
    expect(await api.updatePlayer('ghost', { name: 'x', surname: '', dorsal: 1, position: 'Pivot' })).toBeNull()
  })
})

describe('api.deletePlayer', () => {
  it('removes the player from the local roster regardless of the Supabase outcome', async () => {
    localStorage.setItem('tf_players', JSON.stringify([{ id: 'p1' }, { id: 'p2' }]))
    supabaseMock.from.mockReturnValueOnce(chainable({ error: null }))

    await api.deletePlayer('p1')
    expect(JSON.parse(localStorage.getItem('tf_players'))).toEqual([{ id: 'p2' }])
  })

  it('also removes the player locally when the Supabase delete itself fails', async () => {
    localStorage.setItem('tf_players', JSON.stringify([{ id: 'p1' }, { id: 'p2' }]))
    supabaseMock.from.mockReturnValueOnce(chainable({ error: { message: 'down' } }))

    await api.deletePlayer('p1')
    expect(JSON.parse(localStorage.getItem('tf_players'))).toEqual([{ id: 'p2' }])
  })
})
