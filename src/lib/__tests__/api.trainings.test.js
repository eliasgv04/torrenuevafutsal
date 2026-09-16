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

describe('api.getTrainings', () => {
  it('returns Supabase data and caches it', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: [{ id: 'tr1' }], error: null }))
    const first = await api.getTrainings('t1')
    const second = await api.getTrainings('t1')
    expect(first).toEqual([{ id: 'tr1' }])
    expect(second).toEqual(first)
    expect(supabaseMock.from.mock.calls.filter(c => c[0] === 'trainings')).toHaveLength(1)
  })

  it('falls back to the local list sorted by date descending', async () => {
    localStorage.setItem('tf_trainings', JSON.stringify([
      { id: 'a', team_id: 't1', training_date: '2026-01-01' },
      { id: 'b', team_id: 't1', training_date: '2026-06-01' }
    ]))
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))
    const result = await api.getTrainings('t1')
    expect(result.map(t => t.id)).toEqual(['b', 'a'])
  })
})

describe('api.getTrainingItems / api.getTrainingItemsByTrainingIds', () => {
  it('getTrainingItems returns the Supabase rows for one training', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: [{ id: 'i1' }], error: null }))
    expect(await api.getTrainingItems('tr1')).toEqual([{ id: 'i1' }])
  })

  it('getTrainingItemsByTrainingIds returns {} for an empty id list without querying', async () => {
    expect(await api.getTrainingItemsByTrainingIds([])).toEqual({})
    expect(supabaseMock.from).not.toHaveBeenCalled()
  })

  it('getTrainingItemsByTrainingIds groups the batched results by training_id', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({
      data: [{ id: 'i1', training_id: 'tr1' }, { id: 'i2', training_id: 'tr1' }, { id: 'i3', training_id: 'tr2' }],
      error: null
    }))
    const result = await api.getTrainingItemsByTrainingIds(['tr1', 'tr2'])
    expect(result.tr1).toHaveLength(2)
    expect(result.tr2).toHaveLength(1)
  })

  it('falls back to the local items, grouped the same way, on failure', async () => {
    localStorage.setItem('tf_training_items', JSON.stringify([
      { id: 'i1', training_id: 'tr1', order_index: 1 },
      { id: 'i2', training_id: 'tr1', order_index: 0 }
    ]))
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))
    const result = await api.getTrainingItemsByTrainingIds(['tr1'])
    expect(result.tr1.map(i => i.id)).toEqual(['i2', 'i1']) // ordered by order_index
  })
})

describe('api.createTraining', () => {
  it('inserts the training and its items, tagging each item with its position', async () => {
    const trainingBuilder = chainable({ data: { id: 'tr1' }, error: null })
    const itemsBuilder = chainable({ error: null })
    supabaseMock.from
      .mockReturnValueOnce(trainingBuilder) // insert into trainings
      .mockReturnValueOnce(itemsBuilder)    // insert into training_exercises

    const result = await api.createTraining({
      team_id: 't1', training_date: '2026-05-01', notes: 'x',
      items: [{ exercise_name: 'Rondo' }, { exercise_name: 'Estiramientos' }],
      selected_players: ['p1']
    })

    expect(result).toEqual({ id: 'tr1' })
    const itemsPayload = itemsBuilder.insert.mock.calls[0][0]
    expect(itemsPayload.map(i => i.order_index)).toEqual([0, 1])
    expect(itemsPayload.every(i => i.training_id === 'tr1')).toBe(true)
  })

  it('does not try to insert items when none were given', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: { id: 'tr1' }, error: null }))
    await api.createTraining({ team_id: 't1', training_date: '2026-05-01' })
    expect(supabaseMock.from.mock.calls.filter(c => c[0] === 'training_exercises')).toHaveLength(0)
  })

  it('builds the full local training+items on failure', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'down' } }))
    const training = await api.createTraining({
      team_id: 't1', training_date: '2026-05-01', items: [{ exercise_name: 'Rondo' }]
    })
    expect(training.id).toMatch(/^local-/)
    const items = JSON.parse(localStorage.getItem('tf_training_items'))
    expect(items[0].training_id).toBe(training.id)
  })
})

describe('api.updateTraining / api.replaceTrainingItems / api.deleteTraining', () => {
  it('updateTraining only includes fields that were explicitly passed', async () => {
    const builder = chainable({ data: { id: 'tr1' }, error: null })
    supabaseMock.from.mockReturnValueOnce(builder)
    await api.updateTraining('tr1', { notes: 'nueva nota' })
    expect(builder.update).toHaveBeenCalledWith({ notes: 'nueva nota' })
  })

  it('replaceTrainingItems deletes the old items then inserts the new ones', async () => {
    const deleteBuilder = chainable({ error: null })
    const insertBuilder = chainable({ error: null })
    supabaseMock.from.mockReturnValueOnce(deleteBuilder).mockReturnValueOnce(insertBuilder)

    await api.replaceTrainingItems('tr1', [{ exercise_name: 'Rondo', order_index: 0 }])

    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(insertBuilder.insert).toHaveBeenCalled()
  })

  it('replaceTrainingItems skips the insert call entirely for an empty list', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ error: null }))
    await api.replaceTrainingItems('tr1', [])
    expect(supabaseMock.from.mock.calls.filter(c => c[0] === 'training_exercises')).toHaveLength(1) // delete only
  })

  it('removes both the training and its items locally when Supabase is unreachable', async () => {
    localStorage.setItem('tf_trainings', JSON.stringify([{ id: 'tr1' }, { id: 'tr2' }]))
    localStorage.setItem('tf_training_items', JSON.stringify([{ id: 'i1', training_id: 'tr1' }, { id: 'i2', training_id: 'tr2' }]))
    supabaseMock.from.mockReturnValueOnce(chainable({ error: { message: 'down' } }))

    await api.deleteTraining('tr1')

    expect(JSON.parse(localStorage.getItem('tf_trainings'))).toEqual([{ id: 'tr2' }])
    expect(JSON.parse(localStorage.getItem('tf_training_items'))).toEqual([{ id: 'i2', training_id: 'tr2' }])
  })

  // Unlike deleteTeam/deleteExercise/deletePlayer/deleteMatch (which always
  // clean up localStorage too, even when Supabase succeeds — see
  // api.teams.test.js / api.exercises.test.js), deleteTraining returns early
  // inside its own success branch and never reaches that cleanup. This looks
  // like an inconsistency rather than a deliberate choice: a stale local
  // mirror of a deleted training would survive a successful cloud delete.
  it('does NOT clean up the local mirror when the Supabase delete itself succeeds (documented current behavior)', async () => {
    localStorage.setItem('tf_trainings', JSON.stringify([{ id: 'tr1' }, { id: 'tr2' }]))
    supabaseMock.from.mockReturnValueOnce(chainable({ error: null })).mockReturnValueOnce(chainable({ error: null }))

    await api.deleteTraining('tr1')

    expect(JSON.parse(localStorage.getItem('tf_trainings'))).toEqual([{ id: 'tr1' }, { id: 'tr2' }])
  })
})
