import { describe, it, expect } from 'vitest'
import { interpolateFrames, easeInOutQuad } from '../TacticalBoard'

describe('easeInOutQuad', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeInOutQuad(0)).toBe(0)
    expect(easeInOutQuad(1)).toBe(1)
  })

  it('passes through the midpoint', () => {
    expect(easeInOutQuad(0.5)).toBe(0.5)
  })

  it('is monotonically increasing', () => {
    const samples = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1]
    for (let i = 1; i < samples.length; i++) {
      expect(easeInOutQuad(samples[i])).toBeGreaterThanOrEqual(easeInOutQuad(samples[i - 1]))
    }
  })
})

describe('interpolateFrames', () => {
  const frameA = {
    tokens: [{ id: 't1', x: 0, y: 0, kind: 'player' }],
    textBoxes: [{ id: 'b1', x: 10, y: 10, text: 'hola' }]
  }
  const frameB = {
    tokens: [{ id: 't1', x: 100, y: 50, kind: 'player' }],
    textBoxes: [{ id: 'b1', x: 10, y: 10, text: 'hola' }]
  }

  it('matches frame A exactly at t=0 for a token present in both frames', () => {
    const result = interpolateFrames(frameA, frameB, 0)
    expect(result.tokens).toEqual([{ id: 't1', x: 0, y: 0, kind: 'player' }])
  })

  it('matches frame B exactly at t=1', () => {
    const result = interpolateFrames(frameA, frameB, 1)
    expect(result.tokens).toEqual([{ id: 't1', x: 100, y: 50, kind: 'player' }])
  })

  it('linearly blends position at intermediate t', () => {
    const result = interpolateFrames(frameA, frameB, 0.25)
    expect(result.tokens[0].x).toBe(25)   // 0 + (100-0)*0.25
    expect(result.tokens[0].y).toBe(12.5) // 0 + (50-0)*0.25
  })

  it('keeps a token that only exists in the starting frame until t reaches 1, then drops it', () => {
    const a = { tokens: [{ id: 'leaving', x: 0, y: 0 }], textBoxes: [] }
    const b = { tokens: [], textBoxes: [] }

    expect(interpolateFrames(a, b, 0).tokens).toEqual([{ id: 'leaving', x: 0, y: 0 }])
    expect(interpolateFrames(a, b, 0.99).tokens).toEqual([{ id: 'leaving', x: 0, y: 0 }])
    expect(interpolateFrames(a, b, 1).tokens).toEqual([])
  })

  it('shows a token that only exists in the ending frame at its resting position for the whole transition', () => {
    const a = { tokens: [], textBoxes: [] }
    const b = { tokens: [{ id: 'entering', x: 40, y: 20 }], textBoxes: [] }

    expect(interpolateFrames(a, b, 0).tokens).toEqual([{ id: 'entering', x: 40, y: 20 }])
    expect(interpolateFrames(a, b, 0.5).tokens).toEqual([{ id: 'entering', x: 40, y: 20 }])
  })

  it('blends textBoxes independently of tokens', () => {
    const a = { tokens: [], textBoxes: [{ id: 'b1', x: 0, y: 0 }] }
    const b = { tokens: [], textBoxes: [{ id: 'b1', x: 20, y: 0 }] }
    expect(interpolateFrames(a, b, 0.5).textBoxes[0].x).toBe(10)
  })

  it('handles several simultaneous tokens, each matched independently by id', () => {
    const a = { tokens: [{ id: 'p1', x: 0, y: 0 }, { id: 'p2', x: 10, y: 10 }], textBoxes: [] }
    const b = { tokens: [{ id: 'p1', x: 10, y: 0 }, { id: 'p2', x: 10, y: 20 }], textBoxes: [] }
    const result = interpolateFrames(a, b, 0.5)
    const byId = Object.fromEntries(result.tokens.map(t => [t.id, t]))
    expect(byId.p1).toEqual({ id: 'p1', x: 5, y: 0 })
    expect(byId.p2).toEqual({ id: 'p2', x: 10, y: 15 })
  })
})
