import { vi, describe, it, expect, beforeEach } from 'vitest'
import { escapeHtml, cleanText, safe, formatSessionDate, fetchAsDataUrl, pickPhotoUrl, buildHtml, exportTrainingFichaToPdf } from '../pdfFicha'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

vi.mock('html2canvas', () => ({ default: vi.fn() }))
vi.mock('jspdf', () => ({ jsPDF: vi.fn() }))

describe('escapeHtml / cleanText / safe', () => {
  it('escapes HTML-sensitive characters', () => {
    expect(escapeHtml(`<a>&"'</a>`)).toBe('&lt;a&gt;&amp;&quot;&#39;&lt;/a&gt;')
  })

  it('cleanText collapses whitespace and trims', () => {
    expect(cleanText('  a   b  ')).toBe('a b')
  })

  it('safe falls back (default empty string, or a custom one) when blank', () => {
    expect(safe('   ')).toBe('')
    expect(safe(null, 'x')).toBe('x')
    expect(safe('dato')).toBe('dato')
  })
})

describe('formatSessionDate', () => {
  it('returns an empty string for a missing or invalid date', () => {
    expect(formatSessionDate(null)).toBe('')
    expect(formatSessionDate('')).toBe('')
    expect(formatSessionDate('not-a-date')).toBe('')
  })

  it('formats a valid date as "<weekday> dd/mm/yy"', () => {
    const result = formatSessionDate('2026-03-15')
    expect(result).toMatch(/^\S+ \d{2}\/\d{2}\/\d{2}$/)
    expect(result).toContain('15/03/26')
  })
})

describe('fetchAsDataUrl (guard clauses only — image decoding needs a real <canvas>)', () => {
  it('resolves to null for a falsy url', async () => {
    expect(await fetchAsDataUrl(null)).toBeNull()
    expect(await fetchAsDataUrl('')).toBeNull()
  })

  it('resolves to the same value when it is already a data URL', async () => {
    expect(await fetchAsDataUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
  })
})

describe('pickPhotoUrl', () => {
  it('returns null for a missing item', () => {
    expect(pickPhotoUrl(null, new Map())).toBeNull()
  })

  it('prefers a custom photo stored in the item notes envelope', () => {
    const item = { notes: JSON.stringify({ custom_photo_url: 'http://x/custom.png' }), exercise_id: 'e1' }
    const lookup = new Map([['e1', { photo_url: 'http://x/exercise.png' }]])
    expect(pickPhotoUrl(item, lookup)).toBe('http://x/custom.png')
  })

  it('falls back to the linked exercise photo when there is no custom one', () => {
    const item = { notes: '', exercise_id: 'e1' }
    const lookup = new Map([['e1', { photo_url: 'http://x/exercise.png' }]])
    expect(pickPhotoUrl(item, lookup)).toBe('http://x/exercise.png')
  })

  it('returns null when neither a custom photo nor a linked exercise photo exists', () => {
    expect(pickPhotoUrl({ notes: '', exercise_id: 'missing' }, new Map())).toBeNull()
  })
})

describe('buildHtml', () => {
  const baseArgs = {
    training: {
      training_date: '2026-03-15',
      notes: '',
      items: [
        { id: 'i1', exercise_name: 'Rondo posesión', category: 'Principal', order_index: 0, notes: '', dimensions: '40x20' },
        { id: 'i2', exercise_name: 'Vuelta a la calma', category: 'Defensa portero jugador', order_index: 1, notes: '' }
      ]
    },
    ficha: {
      session_time: '18:00', duration: '90', place: 'Pabellón', rival: 'CD Manchego',
      video: '', equipment: 'Conos', session_objective: 'Transición defensa-ataque',
      extra_attendees: [], final_extra_text: '', teams: [{ name: 'Rojo', player_ids: ['p1'] }]
    },
    sessionNumber: '3',
    teamName: 'Torrenueva <FS>',
    attending: [{ id: 'p1', name: 'Ana', dorsal: 7 }, { id: 'p2', name: 'Luis', dorsal: null }],
    extras: [{ id: 'x1', name: 'Pepe (juvenil)' }],
    photos: { posesion: [], main: [null] },
    logoDataUrl: null,
    accentStart: '#111111',
    accentEnd: '#222222'
  }

  it('escapes the team name and shows the session number/date', () => {
    const html = buildHtml(baseArgs)
    expect(html).toContain('Torrenueva &lt;FS&gt;')
    expect(html).toContain('>3<')
    expect(html).toContain('15/03/26')
  })

  it('lists dorsal players and extras together, styling the extra as roster-extra', () => {
    const html = buildHtml(baseArgs)
    expect(html).toContain('Ana')
    expect(html).toContain('Luis')
    expect(html).toContain('Pepe (juvenil)')
    expect(html).toContain('roster-extra')
  })

  it('shows "Sin asistentes" when nobody attended and nobody extra was added', () => {
    const html = buildHtml({ ...baseArgs, attending: [], extras: [] })
    expect(html).toContain('Sin asistentes')
  })

  it('always renders exactly 3 team columns, padding out missing ones', () => {
    const html = buildHtml(baseArgs) // only 1 team supplied in ficha.teams
    expect((html.match(/class="equipo-col"/g) || [])).toHaveLength(3)
    // The supplied team's player (p1 = Ana) must show up inside a column.
    expect(html).toContain('equipo-name">Ana<')
  })

  it('marks the final card empty when there is no final-section content, and fills it in when there is', () => {
    const empty = buildHtml({
      ...baseArgs,
      training: { ...baseArgs.training, items: [baseArgs.training.items[0]] } // drop the FINAL-section item
    })
    expect(empty).toMatch(/class="final-card empty"/)

    const filled = buildHtml(baseArgs) // includes the "Vuelta a la calma" FINAL item
    expect(filled).not.toMatch(/class="final-card empty"/)
    expect(filled).toContain('Vuelta a la calma')
  })

  it('shows a dimensions badge on a main-section card only when dimensions are set', () => {
    const html = buildHtml(baseArgs)
    expect(html).toContain('main-dims')
    expect(html).toContain('40x20')
  })

  it('renders an empty main slot when there are no main-section items at all', () => {
    const html = buildHtml({
      ...baseArgs,
      training: { ...baseArgs.training, items: [baseArgs.training.items[1]] } // only the FINAL item remains
    })
    expect(html).toContain('main-card empty')
  })

  it('escapes the session objective and omits it when blank', () => {
    const withObjective = buildHtml(baseArgs)
    expect(withObjective).toContain('Transición defensa-ataque')

    const withoutObjective = buildHtml({ ...baseArgs, ficha: { ...baseArgs.ficha, session_objective: '' } })
    expect(withoutObjective).toContain('objective-empty')
  })

  it('renders a posesión photo card per item, with a placeholder when that item has no photo', () => {
    const html = buildHtml({
      ...baseArgs,
      training: {
        ...baseArgs.training,
        items: [
          ...baseArgs.training.items,
          { id: 'i3', exercise_name: 'Rondo pases', category: 'Posesión', order_index: 2, notes: '' },
          { id: 'i4', exercise_name: 'Conservación', category: 'Posesión', order_index: 3, notes: '' }
        ]
      },
      photos: { posesion: ['http://x/rondo.png', null], main: [null] }
    })
    expect(html).toContain('cal-photo-card-img" src="http://x/rondo.png"')
    expect(html).toContain('cal-photo-card-img cal-photo-card-img-empty')
    expect(html).toContain('Rondo pases')
    expect(html).toContain('Conservación')
  })
})

describe('exportTrainingFichaToPdf', () => {
  const training = { id: 't1', training_date: '2026-05-01', notes: '', items: [], attending_players: [] }
  let pdfInstance

  beforeEach(() => {
    vi.clearAllMocks()
    html2canvas.mockResolvedValue({ toDataURL: () => 'data:image/jpeg;base64,FAKE' })
    pdfInstance = {
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
      addImage: vi.fn(),
      save: vi.fn()
    }
    jsPDF.mockImplementation(() => pdfInstance)
  })

  it('renders the ficha into a canvas, adds it to a PDF and saves it with a descriptive filename', async () => {
    await exportTrainingFichaToPdf(training, [], [], { name: 'Torrenueva' }, [])

    expect(html2canvas).toHaveBeenCalledTimes(1)
    expect(pdfInstance.addImage).toHaveBeenCalledWith('data:image/jpeg;base64,FAKE', 'JPEG', 0, 0, 210, 297)
    expect(pdfInstance.save).toHaveBeenCalledWith('ficha_Torrenueva_2026-05-01.pdf')
    expect(document.body.children.length).toBe(0) // the offscreen render wrapper must not leak
  }, 10000)

  it('falls back to generic team/date names when missing', async () => {
    await exportTrainingFichaToPdf({ ...training, training_date: null }, [], [], {}, [])
    expect(pdfInstance.save).toHaveBeenCalledWith('ficha_Equipo_sin_fecha.pdf')
  }, 10000)

  // Unlike exportMatchToPdf, this function has no internal try/catch — a
  // missing training rejects instead of alerting; callers must catch it.
  it('rejects (rather than alerting) when there is no training', async () => {
    await expect(exportTrainingFichaToPdf(null, [], [], {}, [])).rejects.toThrow('No hay datos de entrenamiento')
    expect(html2canvas).not.toHaveBeenCalled()
  })

  it('still removes the offscreen wrapper if html2canvas rejects', async () => {
    html2canvas.mockRejectedValue(new Error('canvas boom'))
    await expect(exportTrainingFichaToPdf(training, [], [], {}, [])).rejects.toThrow('canvas boom')
    expect(pdfInstance.save).not.toHaveBeenCalled()
    expect(document.body.children.length).toBe(0)
  }, 10000)
})
