import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchTracker from '../MatchTracker'
import { api } from '../../lib/api'
import { exportMatchToPdf } from '../../lib/pdfMatchExport'

vi.mock('../../lib/api', () => ({
  api: {
    getOnFieldPlayers: vi.fn(), getMatchPlayerStats: vi.fn(), getRivalTeamStats: vi.fn(),
    upsertMatchPlayerStats: vi.fn(), upsertRivalTeamStats: vi.fn(),
    setPlayerOnField: vi.fn(), setPlayerOffField: vi.fn(),
    updateMatchNotes: vi.fn(), finalizeMatch: vi.fn()
  }
}))
vi.mock('../../lib/pdfMatchExport', () => ({ exportMatchToPdf: vi.fn() }))

const players = [
  { id: 'p1', dorsal: 7, name: 'Ana', surname: 'García', position: 'Cierre' },
  { id: 'p2', dorsal: 1, name: 'Luis', surname: 'B', position: 'Portero' },
  { id: 'p3', dorsal: 9, name: 'Marta', surname: 'C', position: 'Pivot' }
]

const match = { id: 'm1', status: 'scheduled', is_home: true, rival_team_name: 'CD Rival', place: 'Casa', notes: '', called_up_players: null }
const finishedMatch = { ...match, status: 'finished' }

function setDefaults({ onField = [], stats = [], rival = null } = {}) {
  api.getOnFieldPlayers.mockResolvedValue(onField)
  api.getMatchPlayerStats.mockResolvedValue(stats)
  api.getRivalTeamStats.mockResolvedValue(rival)
  api.upsertMatchPlayerStats.mockResolvedValue()
  api.upsertRivalTeamStats.mockResolvedValue()
  api.setPlayerOnField.mockResolvedValue()
  api.setPlayerOffField.mockResolvedValue()
  api.updateMatchNotes.mockResolvedValue()
}

function rivalGrid(){
  return document.querySelector('.rival-stats-grid')
}

function rivalField(label){
  return within(rivalGrid()).getByText(label).closest('label')
}

function substitutionList(){
  return document.querySelector('.substitution-list')
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('MatchTracker — read-only (finished match)', () => {
  it('shows the read-only summary and hides chrono/editing UI', async () => {
    setDefaults({ stats: [{ player_id: 'p1', goals: 2, assists: 1, shots_on_goal: 3, shots_out: 0, fouls: 1, yellow_cards: 0, red_cards: 0, minutes_played: 125 }] })
    render(<MatchTracker match={finishedMatch} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)

    expect(screen.getByText('Partido finalizado · solo lectura')).toBeInTheDocument()
    expect(screen.queryByText('Tiempo del partido')).not.toBeInTheDocument()
    expect(await screen.findByText('Jugadores (1)')).toBeInTheDocument()
    const row = screen.getByText('Ana García').closest('tr')
    expect(within(row).getByText('2')).toBeInTheDocument() // goals
    expect(within(row).getByText('02:05')).toBeInTheDocument() // minutes_played=125s

    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finalizar partido' })).not.toBeInTheDocument()
  })

  it('exports a PDF from the footer button', async () => {
    const user = userEvent.setup()
    setDefaults()
    let resolveExport
    exportMatchToPdf.mockImplementation(() => new Promise((res) => { resolveExport = res }))
    render(<MatchTracker match={finishedMatch} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('Jugadores (0)')

    await user.click(screen.getByRole('button', { name: /Exportar PDF/ }))
    expect(exportMatchToPdf).toHaveBeenCalledWith(finishedMatch, players, {})
    expect(screen.getByText(/Generando/)).toBeInTheDocument()

    resolveExport()
    await waitFor(() => expect(screen.queryByText(/Generando/)).not.toBeInTheDocument())
  })
})

describe('MatchTracker — bench and field management', () => {
  it('shows all players on the bench when no one is on the field yet', async () => {
    setDefaults()
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    expect(await screen.findByText('En Pista (0/5)')).toBeInTheDocument()
    expect(screen.getByText('Suplentes (3)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '#7 Ana' })).toBeInTheDocument()
  })

  it('adds a bench player to the field', async () => {
    const user = userEvent.setup()
    setDefaults()
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (0/5)')

    api.getOnFieldPlayers.mockResolvedValueOnce([{ id: 'of1', player_id: 'p1', entry_minute: 0, exit_minute: null }])
    await user.click(screen.getByRole('button', { name: '#7 Ana' }))

    expect(api.setPlayerOnField).toHaveBeenCalledWith({ match_id: 'm1', player_id: 'p1', entry_minute: 0 })
    expect(await screen.findByText('En Pista (1/5)')).toBeInTheDocument()
    expect(screen.getByText('Suplentes (2)')).toBeInTheDocument()
  })

  it('refuses to add a 6th player and does not call the API', async () => {
    const user = userEvent.setup()
    const six = [...players,
      { id: 'p4', dorsal: 2, name: 'Eva', surname: 'D', position: 'Ala Diestro' },
      { id: 'p5', dorsal: 3, name: 'Nora', surname: 'E', position: 'Ala Zurdo' },
      { id: 'p6', dorsal: 4, name: 'Ivan', surname: 'F', position: 'Pivot' }
    ]
    const fiveOnField = six.slice(0, 5).map((p, i) => ({ id: `of${i}`, player_id: p.id, entry_minute: 0, exit_minute: null }))
    setDefaults({ onField: fiveOnField })
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={six} onClose={vi.fn()} />)
    await screen.findByText('En Pista (5/5)')

    // The bench button for the only remaining player is disabled once 5 are on the field.
    expect(screen.getByRole('button', { name: '#4 Ivan' })).toBeDisabled()
    expect(api.setPlayerOnField).not.toHaveBeenCalled()
  })

  it('removes a player from the field after confirming, persisting elapsed minutes', async () => {
    const user = userEvent.setup()
    setDefaults({ onField: [{ id: 'of1', player_id: 'p1', entry_minute: 0, exit_minute: null }] })
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (1/5)')

    api.getOnFieldPlayers.mockResolvedValueOnce([])
    await user.click(screen.getByRole('button', { name: 'Retirar de pista' }))
    expect(screen.getByText(/Retirar este jugador de la pista/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(api.setPlayerOffField).toHaveBeenCalledWith('of1', 0)
    expect(api.upsertMatchPlayerStats).toHaveBeenCalledWith(expect.objectContaining({ player_id: 'p1', minutes_played: 0 }))
    expect(await screen.findByText('En Pista (0/5)')).toBeInTheDocument()
  })

  it('cancels removing a player from the confirm dialog', async () => {
    const user = userEvent.setup()
    setDefaults({ onField: [{ id: 'of1', player_id: 'p1', entry_minute: 0, exit_minute: null }] })
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (1/5)')

    await user.click(screen.getByRole('button', { name: 'Retirar de pista' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(api.setPlayerOffField).not.toHaveBeenCalled()
    expect(screen.getByText('En Pista (1/5)')).toBeInTheDocument()
  })

  it('substitutes a player for a bench player', async () => {
    const user = userEvent.setup()
    setDefaults({ onField: [{ id: 'of1', player_id: 'p1', entry_minute: 0, exit_minute: null }] })
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (1/5)')

    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    expect(screen.getByText('Selecciona el jugador que entra')).toBeInTheDocument()

    api.getOnFieldPlayers.mockResolvedValueOnce([{ id: 'of2', player_id: 'p2', entry_minute: 0, exit_minute: null }])
    await user.click(within(substitutionList()).getByRole('button', { name: '#1 Luis' }))

    expect(api.setPlayerOffField).toHaveBeenCalledWith('of1', 0)
    expect(api.setPlayerOnField).toHaveBeenCalledWith({ match_id: 'm1', player_id: 'p2', entry_minute: 0 })
    expect(await screen.findByText('Luis B')).toBeInTheDocument()
    expect(screen.queryByText('Selecciona el jugador que entra')).not.toBeInTheDocument()
  })
})

describe('MatchTracker — stat steppers', () => {
  // The stepper's "+"/"-" button calls onChange (setState) then its onBlur
  // handler synchronously in the very same click, before React re-renders —
  // so the immediate save reads playerStats via a closure from BEFORE this
  // click and persists the *previous* value, not the one now on screen. The
  // UI itself is correct (functional setState), only the API call lags by
  // one click. It self-corrects on the next click/finalize/"Guardar ahora".
  it('updates the displayed value immediately, but the immediate save is one click behind (real staleness bug)', async () => {
    const user = userEvent.setup()
    setDefaults({ onField: [{ id: 'of1', player_id: 'p1', entry_minute: 0, exit_minute: null }] })
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (1/5)')

    const row = screen.getByText('Ana García').closest('tr')
    await user.click(within(row).getAllByRole('button', { name: '+' })[0]) // Goles is the first stepper column

    expect(within(row).getAllByRole('spinbutton')[0]).toHaveValue(1)
    expect(api.upsertMatchPlayerStats).toHaveBeenCalledWith(expect.objectContaining({ player_id: 'p1', goals: 0 }))

    await user.click(within(row).getAllByRole('button', { name: '+' })[0])
    expect(within(row).getAllByRole('spinbutton')[0]).toHaveValue(2)
    expect(api.upsertMatchPlayerStats).toHaveBeenLastCalledWith(expect.objectContaining({ player_id: 'p1', goals: 1 })) // still one behind
  })

  it('prompts to remove a player from the field on a red card, and removes them on confirmation', async () => {
    const user = userEvent.setup()
    setDefaults({ onField: [{ id: 'of1', player_id: 'p1', entry_minute: 0, exit_minute: null }] })
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (1/5)')

    const row = screen.getByText('Ana García').closest('tr')
    api.getOnFieldPlayers.mockResolvedValueOnce([])
    await user.click(within(row).getAllByRole('button', { name: '+' })[6]) // Rojas is the 7th stepper column

    expect(screen.getByText('Tarjeta roja')).toBeInTheDocument()
    expect(screen.getByText('Ana García', { selector: 'strong' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sí, retirar' }))
    expect(api.setPlayerOffField).toHaveBeenCalledWith('of1', 0)
    expect(await screen.findByText('En Pista (0/5)')).toBeInTheDocument()
  })

  it('dismisses the red card alert without removing the player when choosing "No, mantener"', async () => {
    const user = userEvent.setup()
    setDefaults({ onField: [{ id: 'of1', player_id: 'p1', entry_minute: 0, exit_minute: null }] })
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (1/5)')

    const row = screen.getByText('Ana García').closest('tr')
    await user.click(within(row).getAllByRole('button', { name: '+' })[6])
    await user.click(screen.getByRole('button', { name: 'No, mantener' }))

    expect(screen.queryByText('Tarjeta roja')).not.toBeInTheDocument()
    expect(api.setPlayerOffField).not.toHaveBeenCalled()
    expect(screen.getByText('En Pista (1/5)')).toBeInTheDocument()
  })

  it('updates the displayed rival stat immediately, though the same one-click-behind save bug applies here too', async () => {
    const user = userEvent.setup()
    setDefaults()
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (0/5)')

    const goalsField = rivalField('Goles')
    await user.click(within(goalsField).getByRole('button', { name: '+' }))

    expect(within(goalsField).getByRole('spinbutton')).toHaveValue(1)
    expect(api.upsertRivalTeamStats).toHaveBeenCalledWith(expect.objectContaining({ goals: 0 }))
  })
})

describe('MatchTracker — notes and chrono', () => {
  it('persists the match notes on blur', async () => {
    const user = userEvent.setup()
    setDefaults()
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (0/5)')

    const textarea = screen.getByLabelText('Anotaciones del partido')
    await user.type(textarea, 'Buen partido')
    await user.tab()

    expect(api.updateMatchNotes).toHaveBeenCalledWith({ match_id: 'm1', notes: 'Buen partido' })
  })

  it('toggles the chrono with the Reanudar/Pausar button', async () => {
    const user = userEvent.setup()
    setDefaults()
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (0/5)')

    await user.click(screen.getByRole('button', { name: /Reanudar/ }))
    expect(screen.getByRole('button', { name: /Pausar/ })).toBeInTheDocument()
    expect(screen.getByText('● EN DIRECTO')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Pausar/ }))
    expect(screen.getByRole('button', { name: /Reanudar/ })).toBeInTheDocument()
  })

  it('toggles the chrono with the space bar, but not while a text field has focus', async () => {
    const user = userEvent.setup()
    setDefaults()
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (0/5)')

    const textarea = screen.getByLabelText('Anotaciones del partido')
    textarea.focus()
    await user.keyboard(' ')
    expect(screen.getByRole('button', { name: /Reanudar/ })).toBeInTheDocument()

    textarea.blur()
    await user.keyboard(' ')
    expect(screen.getByRole('button', { name: /Pausar/ })).toBeInTheDocument()
  })

  it('shows a confirm dialog before resetting the chrono', async () => {
    const user = userEvent.setup()
    setDefaults()
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (0/5)')

    await user.click(screen.getByRole('button', { name: 'Reiniciar' }))
    expect(screen.getByText(/Reiniciar el cronómetro/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('saves a debounced draft to localStorage after a change', async () => {
    const user = userEvent.setup()
    setDefaults()
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (0/5)')

    await user.type(screen.getByLabelText('Anotaciones del partido'), 'x')

    await waitFor(() => {
      const raw = localStorage.getItem('tf_match_draft_m1')
      expect(raw).not.toBeNull()
      expect(JSON.parse(raw).matchNotes).toBe('x')
    }, { timeout: 2000 })
  })
})

describe('MatchTracker — draft restore on mount', () => {
  it('restores state from a recent localStorage draft instead of the DB', async () => {
    localStorage.setItem('tf_match_draft_m1', JSON.stringify({
      chrono: 125,
      isChronoRunning: false,
      onFieldPlayers: [{ id: 'of1', player_id: 'p1', entry_minute: 0, exit_minute: null }],
      playerStats: { p1: { match_id: 'm1', player_id: 'p1', goals: 2, assists: 0, shots_on_goal: 0, shots_out: 0, fouls: 0, yellow_cards: 0, red_cards: 0, minutes_played: 0, saves: 0 } },
      rivalStats: { goals: 1, shots_on_goal: 0, fouls: 0, yellow_cards: 0, red_cards: 0 },
      matchNotes: 'Nota de borrador',
      selectedPlayerForChange: null,
      savedAt: Date.now()
    }))
    setDefaults() // DB is empty — the draft should win
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)

    expect(await screen.findByText('En Pista (1/5)')).toBeInTheDocument()
    expect(document.querySelector('.chrono-display')).toHaveTextContent('02:05')
    const row = screen.getByText('Ana García').closest('tr')
    expect(within(row).getAllByRole('spinbutton')[0]).toHaveValue(2)
    expect(screen.getByLabelText('Anotaciones del partido')).toHaveValue('Nota de borrador')
  })

  it('falls back to DB data and clears the draft when it is corrupt', async () => {
    localStorage.setItem('tf_match_draft_m1', 'not-valid-json{{{')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    setDefaults({ onField: [{ id: 'of1', player_id: 'p1', entry_minute: 0, exit_minute: null }] })
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)

    expect(await screen.findByText('En Pista (1/5)')).toBeInTheDocument()
    expect(localStorage.getItem('tf_match_draft_m1')).toBeNull()
  })
})

describe('MatchTracker — finalize', () => {
  it('finalizes the match, computing the score and persisting everything', async () => {
    const user = userEvent.setup()
    setDefaults({ onField: [{ id: 'of1', player_id: 'p1', entry_minute: 0, exit_minute: null }] })
    api.finalizeMatch.mockResolvedValue()
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (1/5)')

    const row = screen.getByText('Ana García').closest('tr')
    await user.click(within(row).getAllByRole('button', { name: '+' })[0]) // Ana scores a goal

    // Wait for the 350ms debounced draft-save to land before finalizing —
    // otherwise a still-pending draft save can fire after finalize's own
    // localStorage.removeItem and silently resurrect the draft.
    await waitFor(() => expect(localStorage.getItem('tf_match_draft_m1')).not.toBeNull())

    await user.click(screen.getByRole('button', { name: 'Finalizar partido' }))
    expect(screen.getByText(/Torrenueva 1 - 0 CD Rival/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Partido finalizado')).toBeInTheDocument()
    expect(api.setPlayerOffField).toHaveBeenCalledWith('of1', 0)
    expect(api.updateMatchNotes).toHaveBeenCalledWith({ match_id: 'm1', notes: '' })
    expect(api.finalizeMatch).toHaveBeenCalledWith(expect.objectContaining({ match_id: 'm1', home_goals: 1, away_goals: 0, notes: '' }))
    expect(localStorage.getItem('tf_match_draft_m1')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Aceptar' }))
  })

  it('shows a warning when a player stat fails to save, but still finalizes', async () => {
    const user = userEvent.setup()
    setDefaults({ onField: [{ id: 'of1', player_id: 'p1', entry_minute: 0, exit_minute: null }] })
    api.upsertMatchPlayerStats.mockRejectedValueOnce(new Error('down')).mockResolvedValue()
    api.finalizeMatch.mockResolvedValue()
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={vi.fn()} />)
    await screen.findByText('En Pista (1/5)')

    await user.click(screen.getByRole('button', { name: 'Finalizar partido' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Partido finalizado con advertencias')).toBeInTheDocument()
    expect(screen.getByText(/1 estadística\(s\) de jugador no se pudieron guardar/)).toBeInTheDocument()
  })

  it('shows an error dialog and does not close the tracker if finalizing fails', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    setDefaults()
    api.finalizeMatch.mockRejectedValue(new Error('sin conexión'))
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={onClose} />)
    await screen.findByText('En Pista (0/5)')

    await user.click(screen.getByRole('button', { name: 'Finalizar partido' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Error al finalizar el partido')).toBeInTheDocument()
    expect(screen.getByText(/sin conexión/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('MatchTracker — leaving without finalizing', () => {
  it('calls onClose from "Salir sin finalizar"', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    setDefaults()
    render(<MatchTracker match={match} teamId="t1" teamName="Torrenueva" team={{}} players={players} onClose={onClose} />)
    await screen.findByText('En Pista (0/5)')
    await user.click(screen.getByRole('button', { name: /Salir sin finalizar/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
