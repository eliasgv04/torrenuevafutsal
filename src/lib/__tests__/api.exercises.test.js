import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

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

describe('api.getExercises', () => {
  it('returns Supabase data and only queries once thanks to the read cache', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: [{ id: 'e1', team_id: 't1' }], error: null }))

    const first = await api.getExercises('t1')
    const second = await api.getExercises('t1')

    expect(first).toEqual([{ id: 'e1', team_id: 't1' }])
    expect(second).toEqual(first)
    expect(supabaseMock.from).toHaveBeenCalledTimes(1) // second call served from cache
  })

  it('falls back to the local list, filtered by team, on a non-timeout error', async () => {
    localStorage.setItem('tf_exercises', JSON.stringify([
      { id: 'e1', team_id: 't1' },
      { id: 'e2', team_id: 't2' }
    ]))
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'permission denied' } }))

    const result = await api.getExercises('t1')

    expect(result).toEqual([{ id: 'e1', team_id: 't1' }])
    // A non-timeout error must NOT be retried — exactly one query against
    // 'exercises' (a second call to .from(), for 'app_logs', comes from the
    // fire-and-forget error log and isn't what this test is about).
    expect(supabaseMock.from.mock.calls.filter(c => c[0] === 'exercises')).toHaveLength(1)
  })

  it('retries a timeout error with backoff and succeeds once Supabase recovers', async () => {
    vi.useFakeTimers()
    try {
      supabaseMock.from
        .mockReturnValueOnce(chainable({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }))
        .mockReturnValueOnce(chainable({ data: [{ id: 'e1', team_id: 't1' }], error: null }))

      const pending = api.getExercises('t1')
      // First attempt fails immediately; withRetry then waits ~2000ms before retrying.
      await vi.advanceTimersByTimeAsync(2100)
      const result = await pending

      expect(result).toEqual([{ id: 'e1', team_id: 't1' }])
      expect(supabaseMock.from).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('api.createExercise', () => {
  it('inserts the exercise and always returns the dimensions it was called with', async () => {
    const builder = chainable({ data: { id: 'e1', name: 'Rondo', dimensions: 'stale-from-db' }, error: null })
    supabaseMock.from.mockReturnValueOnce(builder)

    const result = await api.createExercise({
      team_id: 't1', name: 'Rondo', objective: 'Posesión', description: '',
      category: 'Principal', dimensions: '40x20', is_public: false
    })

    expect(result).toEqual({ id: 'e1', name: 'Rondo', dimensions: '40x20' })
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ team_id: 't1', name: 'Rondo', is_public: false }))
  })

  it('coerces a falsy is_public to a real boolean before inserting', async () => {
    const builder = chainable({ data: { id: 'e1' }, error: null })
    supabaseMock.from.mockReturnValueOnce(builder)

    await api.createExercise({ team_id: 't1', name: 'x', is_public: undefined })

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ is_public: false }))
  })

  it('saves locally when the insert fails, invalidating that team\'s exercise cache', async () => {
    // Prime the cache so we can prove it gets invalidated by the create.
    supabaseMock.from.mockReturnValueOnce(chainable({ data: [], error: null }))
    await api.getExercises('t1')

    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'insert failed' } }))
    const created = await api.createExercise({ team_id: 't1', name: 'Rondo', dimensions: '40x20' })
    expect(created.id).toMatch(/^local-/)
    expect(created.name).toBe('Rondo')

    // Cache for t1 must have been invalidated by createExercise, so this re-fetches.
    supabaseMock.from.mockReturnValueOnce(chainable({ data: [{ id: 'fresh' }], error: null }))
    const afterCreate = await api.getExercises('t1')
    expect(afterCreate).toEqual([{ id: 'fresh' }])
    // 3 calls against 'exercises': the initial read, the failed insert
    // attempt, and a second real read afterwards — that last one is the
    // point of the test: if the cache hadn't been invalidated by
    // createExercise, this would have been served from the stale cache
    // instead (only 2 calls total).
    expect(supabaseMock.from.mock.calls.filter(c => c[0] === 'exercises')).toHaveLength(3)
  })
})

describe('api.updateExercise', () => {
  it('only sends a photo_url when a new photo was actually uploaded', async () => {
    const builder = chainable({ data: { id: 'e1', name: 'Nuevo' }, error: null })
    supabaseMock.from.mockReturnValueOnce(builder)

    await api.updateExercise('e1', { name: 'Nuevo', objective: '', description: '', category: 'Principal', dimensions: '40x20', is_public: true })

    const payload = builder.update.mock.calls[0][0]
    expect(payload).not.toHaveProperty('photo_url')
    expect(payload.is_public).toBe(true)
  })

  it('updates the matching local exercise on failure', async () => {
    localStorage.setItem('tf_exercises', JSON.stringify([{ id: 'e1', name: 'Viejo', photo_url: 'old.png' }]))
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))

    const result = await api.updateExercise('e1', { name: 'Actualizado', category: 'Principal', dimensions: '40x20', is_public: false })

    expect(result.name).toBe('Actualizado')
    expect(result.photo_url).toBe('old.png') // untouched, no new photo was uploaded
  })
})

describe('api.getPublicExercises', () => {
  it('returns whatever the RPC call resolves with', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: [{ id: 'pub1' }], error: null })
    const result = await api.getPublicExercises()
    expect(result).toEqual([{ id: 'pub1' }])
    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_public_exercises')
  })

  it('propagates an RPC error instead of silently swallowing it', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc failed' } })
    await expect(api.getPublicExercises()).rejects.toEqual({ message: 'rpc failed' })
  })
})

describe('api.deleteExercise', () => {
  it('deletes locally-orphaned copies even when the Supabase delete succeeds', async () => {
    localStorage.setItem('tf_exercises', JSON.stringify([{ id: 'e1' }, { id: 'e2' }]))
    localStorage.setItem('tf_training_items', JSON.stringify([{ id: 'ti1', exercise_id: 'e1' }, { id: 'ti2', exercise_id: 'e2' }]))
    supabaseMock.from.mockReturnValueOnce(chainable({ error: null }))

    await api.deleteExercise('e1')

    expect(JSON.parse(localStorage.getItem('tf_exercises'))).toEqual([{ id: 'e2' }])
    expect(JSON.parse(localStorage.getItem('tf_training_items'))).toEqual([{ id: 'ti2', exercise_id: 'e2' }])
  })
})
