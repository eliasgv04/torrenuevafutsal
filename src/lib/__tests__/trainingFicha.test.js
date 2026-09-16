import { describe, it, expect } from 'vitest'
import {
  SECTION,
  sectionFromCategory,
  parseItemNotes,
  buildItemNotes,
  readFicha,
  writeFicha,
  isFichaTraining,
  sectionsFromItems,
  computeSessionNumber,
  EMPTY_FICHA
} from '../trainingFicha'

describe('sectionFromCategory', () => {
  it('maps every known category to its section', () => {
    expect(sectionFromCategory('Inicio balón')).toBe(SECTION.WARMUP_INICIO)
    expect(sectionFromCategory('Movimientos tácticos/técnicos')).toBe(SECTION.WARMUP_MOVIMIENTOS)
    expect(sectionFromCategory('Posesión')).toBe(SECTION.WARMUP_POSESION)
    expect(sectionFromCategory('Principal')).toBe(SECTION.MAIN)
    expect(sectionFromCategory('Defensa portero jugador')).toBe(SECTION.FINAL)
    expect(sectionFromCategory('Ataque portero jugador')).toBe(SECTION.FINAL)
  })

  it('falls back to MAIN for an unknown or missing category', () => {
    expect(sectionFromCategory('Categoría inventada')).toBe(SECTION.MAIN)
    expect(sectionFromCategory(undefined)).toBe(SECTION.MAIN)
    expect(sectionFromCategory(null)).toBe(SECTION.MAIN)
  })
})

describe('parseItemNotes', () => {
  it('returns an empty envelope for null/undefined notes', () => {
    expect(parseItemNotes(null)).toEqual({ text: '', custom_photo_url: null, extra_text: '' })
    expect(parseItemNotes(undefined)).toEqual({ text: '', custom_photo_url: null, extra_text: '' })
  })

  it('stringifies non-string input', () => {
    expect(parseItemNotes(5)).toEqual({ text: '5', custom_photo_url: null, extra_text: '' })
  })

  it('treats plain text as-is', () => {
    expect(parseItemNotes('nota normal')).toEqual({ text: 'nota normal', custom_photo_url: null, extra_text: '' })
  })

  it('decodes a JSON envelope produced by buildItemNotes', () => {
    const raw = '{"text":"nota","custom_photo_url":"http://x/y.png","extra_text":"extra"}'
    expect(parseItemNotes(raw)).toEqual({ text: 'nota', custom_photo_url: 'http://x/y.png', extra_text: 'extra' })
  })

  it('falls back to plain text when the braces do not contain valid JSON', () => {
    const raw = '{esto no es json}'
    expect(parseItemNotes(raw)).toEqual({ text: raw, custom_photo_url: null, extra_text: '' })
  })

  it('falls back to plain text when the JSON is valid but not a notes envelope', () => {
    const raw = '{"foo":"bar"}'
    expect(parseItemNotes(raw)).toEqual({ text: raw, custom_photo_url: null, extra_text: '' })
  })
})

describe('buildItemNotes', () => {
  it('returns an empty string when there is nothing to store', () => {
    expect(buildItemNotes({ text: '', custom_photo_url: null, extra_text: '' })).toBe('')
  })

  it('round-trips through parseItemNotes', () => {
    const original = { text: 'nota', custom_photo_url: 'http://x/y.png', extra_text: 'extra' }
    const built = buildItemNotes(original)
    expect(parseItemNotes(built)).toEqual(original)
  })

  it('omits falsy fields instead of writing them as empty strings', () => {
    const built = buildItemNotes({ text: 'solo texto', custom_photo_url: null, extra_text: '' })
    expect(JSON.parse(built)).toEqual({ text: 'solo texto' })
  })
})

describe('readFicha / writeFicha / isFichaTraining', () => {
  it('returns null when there is no _ficha object', () => {
    expect(readFicha(null)).toBeNull()
    expect(readFicha({})).toBeNull()
    expect(readFicha({ _ficha: 'not-an-object' })).toBeNull()
  })

  it('is false for a training with no ficha, true for one with a ficha', () => {
    expect(isFichaTraining({ objectives: {} })).toBe(false)
    expect(isFichaTraining({ objectives: null })).toBe(false)
    const withFicha = writeFicha({}, { session_time: '18:00' })
    expect(isFichaTraining({ objectives: withFicha })).toBe(true)
  })

  it('writes and reads back the fields that were set', () => {
    const objectives = writeFicha({ attending_players: ['a'] }, {
      session_time: '18:00',
      duration: '90',
      place: 'Pabellón',
      rival: 'CD Manchego',
      video: '',
      equipment: 'Conos',
      session_objective: 'Transición',
      extra_attendees: ['Pepe (juvenil)'],
      final_extra_text: '',
      teams: [
        { name: 'Rojo', player_ids: [1, 2] },
        { name: 'Azul', player_ids: [3] },
        { name: 'Verde', player_ids: [] }
      ]
    })

    // Writing a ficha must not clobber unrelated existing fields.
    expect(objectives.attending_players).toEqual(['a'])

    const ficha = readFicha(objectives)
    expect(ficha.session_time).toBe('18:00')
    expect(ficha.place).toBe('Pabellón')
    expect(ficha.extra_attendees).toEqual([{ id: 'extra-legacy-0', name: 'Pepe (juvenil)' }])
    expect(ficha.teams).toEqual([
      { name: 'Rojo', player_ids: [1, 2] },
      { name: 'Azul', player_ids: [3] },
      { name: 'Verde', player_ids: [] }
    ])
  })

  it('falls back to the default 3 empty teams when fewer than 3 teams are stored', () => {
    // writeFicha stores exactly what it's given (here, only 1 team)...
    const objectives = writeFicha({}, { teams: [{ name: 'Solo', player_ids: [] }] })
    // ...but readFicha only trusts a stored `teams` array of exactly length 3,
    // so a short one is treated as absent rather than partially restored.
    expect(readFicha(objectives).teams).toEqual(EMPTY_FICHA.teams)
  })

  it('falls back to the default 3 empty teams when the stored teams are malformed', () => {
    const objectives = { _ficha: { version: 2, teams: 'not-an-array' } }
    const ficha = readFicha(objectives)
    expect(ficha.teams).toEqual(EMPTY_FICHA.teams)
  })

  it('defaults a missing version to 1 (pre-ficha-v2 data)', () => {
    const objectives = { _ficha: {} }
    expect(readFicha(objectives).version).toBe(1)
  })

  it('normalizes both legacy string and object extra_attendees, dropping invalid entries', () => {
    const objectives = writeFicha({}, {
      extra_attendees: ['Ana', { name: 'Luis', id: 'custom-id' }, { name: '' }, 'no-a-string-with-id']
    })
    const ficha = readFicha(objectives)
    expect(ficha.extra_attendees).toEqual([
      { id: 'extra-legacy-0', name: 'Ana' },
      { id: 'custom-id', name: 'Luis' },
      // { name: '' } is dropped (no name)
      { id: 'extra-legacy-3', name: 'no-a-string-with-id' }
    ])
  })
})

describe('sectionsFromItems', () => {
  it('buckets items by category and keeps them ordered by order_index within each section', () => {
    const items = [
      { id: 1, category: 'Principal', order_index: 2 },
      { id: 2, category: 'Inicio balón', order_index: 0 },
      { id: 3, category: 'Principal', order_index: 1 },
      { id: 4, category: 'Posesión', order_index: 3 },
    ]
    const sections = sectionsFromItems(items)
    expect(sections[SECTION.MAIN].map(i => i.id)).toEqual([3, 1])
    expect(sections[SECTION.WARMUP_INICIO].map(i => i.id)).toEqual([2])
    expect(sections[SECTION.WARMUP_POSESION].map(i => i.id)).toEqual([4])
    expect(sections[SECTION.WARMUP_MOVIMIENTOS]).toEqual([])
    expect(sections[SECTION.FINAL]).toEqual([])
  })

  it('treats a missing order_index as 0 and handles a non-array input', () => {
    expect(sectionsFromItems(null)[SECTION.MAIN]).toEqual([])
    const items = [{ id: 1, category: 'Principal' }, { id: 2, category: 'Principal', order_index: -1 }]
    expect(sectionsFromItems(items)[SECTION.MAIN].map(i => i.id)).toEqual([2, 1])
  })
})

describe('computeSessionNumber', () => {
  it('returns null without a current training or a trainings array', () => {
    expect(computeSessionNumber([], null)).toBeNull()
    expect(computeSessionNumber(null, { training_date: '2026-01-01' })).toBeNull()
  })

  it('counts this session as 1 when it is the earliest', () => {
    const current = { training_date: '2026-01-10', created_at: '2026-01-10T10:00:00Z' }
    const later = { training_date: '2026-01-20', created_at: '2026-01-20T10:00:00Z' }
    expect(computeSessionNumber([current, later], current)).toBe(1)
  })

  it('counts strictly earlier sessions by date', () => {
    const current = { training_date: '2026-01-20', created_at: '2026-01-20T10:00:00Z' }
    const earlier1 = { training_date: '2026-01-01', created_at: '2026-01-01T10:00:00Z' }
    const earlier2 = { training_date: '2026-01-10', created_at: '2026-01-10T10:00:00Z' }
    expect(computeSessionNumber([current, earlier1, earlier2], current)).toBe(3)
  })

  it('breaks same-day ties by creation time, including sessions created at the same instant', () => {
    const current = { training_date: '2026-01-10', created_at: '2026-01-10T12:00:00Z' }
    const sameDayEarlierCreated = { training_date: '2026-01-10', created_at: '2026-01-10T09:00:00Z' }
    const sameDayLaterCreated = { training_date: '2026-01-10', created_at: '2026-01-10T15:00:00Z' }
    const result = computeSessionNumber([current, sameDayEarlierCreated, sameDayLaterCreated], current)
    // current itself + the one created earlier that same day = 2; the one
    // created later that same day must NOT count.
    expect(result).toBe(2)
  })
})
