import { describe, it, expect } from 'vitest'
import { matchFormScore, playerFormScore, formTrend, formRotationDeg } from '../playerForm'

describe('matchFormScore', () => {
  it('gives full result points for a home win with no other stats', () => {
    const match = { is_home: true, home_goals: 2, away_goals: 0, minutes_played: 0, goals: 0, assists: 0 }
    expect(matchFormScore(match)).toBe(30) // win only, no minutes/goals/assists
  })

  it('gives partial points for a draw', () => {
    const match = { is_home: true, home_goals: 1, away_goals: 1, minutes_played: 0, goals: 0, assists: 0 }
    expect(matchFormScore(match)).toBe(15)
  })

  it('gives zero result points for a loss', () => {
    const match = { is_home: true, home_goals: 0, away_goals: 3, minutes_played: 0, goals: 0, assists: 0 }
    expect(matchFormScore(match)).toBe(0)
  })

  it('evaluates the result from the away side when is_home is false', () => {
    // Away team wins 3-1 (home_goals=1, away_goals=3): from the away player's
    // perspective "our" goals are away_goals, so this should score as a win.
    const match = { is_home: false, home_goals: 1, away_goals: 3, minutes_played: 0, goals: 0, assists: 0 }
    expect(matchFormScore(match)).toBe(30)
  })

  it('treats a missing is_home as home (default)', () => {
    const match = { home_goals: 2, away_goals: 2, minutes_played: 0, goals: 0, assists: 0 }
    expect(matchFormScore(match)).toBe(15) // draw
  })

  it.each([
    [0, 0],
    [-5, 0],
    [599, 10],
    [600, 10],
    [601, 20],
    [1500, 20],
    [1501, 30],
    [999999, 30],
  ])('bands %i seconds played into %i minute points', (seconds, expectedPoints) => {
    const match = { is_home: true, home_goals: 0, away_goals: 0, minutes_played: seconds, goals: 0, assists: 0 }
    // Draw contributes 15, so subtract it to isolate the minutes band.
    expect(matchFormScore(match) - 15).toBe(expectedPoints)
  })

  it('caps goal points at 20 (2+ goals)', () => {
    const base = { is_home: true, home_goals: 0, away_goals: 0, minutes_played: 0, assists: 0 }
    expect(matchFormScore({ ...base, goals: 1 }) - 15).toBe(10)
    expect(matchFormScore({ ...base, goals: 2 }) - 15).toBe(20)
    expect(matchFormScore({ ...base, goals: 5 }) - 15).toBe(20)
  })

  it('caps assist points at 20 (2+ assists)', () => {
    const base = { is_home: true, home_goals: 0, away_goals: 0, minutes_played: 0, goals: 0 }
    expect(matchFormScore({ ...base, assists: 1 }) - 15).toBe(10)
    expect(matchFormScore({ ...base, assists: 2 }) - 15).toBe(20)
    expect(matchFormScore({ ...base, assists: 5 }) - 15).toBe(20)
  })

  it('treats missing/non-numeric stats as zero', () => {
    const match = { is_home: true, home_goals: null, away_goals: undefined, minutes_played: 'x', goals: null, assists: undefined }
    expect(matchFormScore(match)).toBe(15) // 0-0 counts as a draw, everything else 0
  })
})

describe('playerFormScore', () => {
  it('returns null when there are no matches', () => {
    expect(playerFormScore([])).toBeNull()
    expect(playerFormScore(null)).toBeNull()
    expect(playerFormScore(undefined)).toBeNull()
  })

  it('scores a single match as itself', () => {
    const win = { is_home: true, home_goals: 1, away_goals: 0, minutes_played: 0, goals: 0, assists: 0 }
    expect(playerFormScore([win])).toBe(matchFormScore(win))
  })

  it('averages exactly the two most recent matches, ignoring older ones', () => {
    const win  = { is_home: true, home_goals: 1, away_goals: 0, minutes_played: 0, goals: 0, assists: 0 }  // 30
    const loss = { is_home: true, home_goals: 0, away_goals: 1, minutes_played: 0, goals: 0, assists: 0 }  // 0
    const draw = { is_home: true, home_goals: 1, away_goals: 1, minutes_played: 0, goals: 0, assists: 0 }  // 15
    // Most-recent-first: win, loss are used; draw (3rd, older) must be ignored.
    expect(playerFormScore([win, loss, draw])).toBe(15) // (30+0)/2
  })

  it('rounds the average to the nearest integer', () => {
    const a = { is_home: true, home_goals: 1, away_goals: 0, minutes_played: 0, goals: 0, assists: 1 } // 30+10=40
    const b = { is_home: true, home_goals: 1, away_goals: 1, minutes_played: 0, goals: 0, assists: 0 } // 15
    // (40+15)/2 = 27.5 -> rounds to 28
    expect(playerFormScore([a, b])).toBe(28)
  })
})

describe('formTrend', () => {
  it('returns null for a null score', () => {
    expect(formTrend(null)).toBeNull()
  })

  it('bands scores into up / flat / down', () => {
    expect(formTrend(100)).toBe('up')
    expect(formTrend(66)).toBe('up')
    expect(formTrend(65)).toBe('flat')
    expect(formTrend(34)).toBe('flat')
    expect(formTrend(33)).toBe('down')
    expect(formTrend(0)).toBe('down')
  })
})

describe('formRotationDeg', () => {
  it('returns null for a null score', () => {
    expect(formRotationDeg(null)).toBeNull()
  })

  it('maps 0/50/100 to the expected needle angles', () => {
    expect(formRotationDeg(0)).toBe(180)
    expect(formRotationDeg(50)).toBe(90)
    expect(formRotationDeg(100)).toBe(0)
  })

  it('clamps out-of-range scores instead of extrapolating', () => {
    expect(formRotationDeg(-20)).toBe(180)
    expect(formRotationDeg(150)).toBe(0)
  })
})
