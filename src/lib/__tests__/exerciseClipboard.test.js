import { describe, it, expect, beforeEach } from 'vitest'
import { getExerciseClipboard, setExerciseClipboard } from '../exerciseClipboard'

const KEY = 'tf_exercise_clipboard'

beforeEach(() => {
  localStorage.clear()
})

describe('exerciseClipboard', () => {
  it('returns an empty array when nothing has been copied yet', () => {
    expect(getExerciseClipboard()).toEqual([])
  })

  it('round-trips a list of exercises through localStorage', () => {
    const exercises = [{ id: 'ex1', name: 'Rondo 4x2' }, { id: 'ex2', name: 'Transiciones' }]
    setExerciseClipboard(exercises)
    expect(getExerciseClipboard()).toEqual(exercises)
  })

  it('persists under the expected localStorage key', () => {
    setExerciseClipboard([{ id: 'ex1' }])
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual([{ id: 'ex1' }])
  })

  it('recovers with an empty array instead of throwing on corrupted data', () => {
    localStorage.setItem(KEY, 'this is not valid JSON')
    expect(getExerciseClipboard()).toEqual([])
  })
})
