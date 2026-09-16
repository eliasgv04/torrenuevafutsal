import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeamCalendar from '../TeamCalendar'
import { api } from '../../lib/api'

vi.mock('../../lib/api', () => ({ api: { getTrainings: vi.fn(), getMatches: vi.fn() } }))

beforeEach(() => {
  // Fake only Date (not setTimeout/setInterval) — findByText/waitFor rely on
  // real timers internally for their polling, and hang forever if those are
  // faked too.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('TeamCalendar', () => {
  it('shows a loading state before trainings/matches arrive', () => {
    api.getTrainings.mockReturnValue(new Promise(() => {}))
    api.getMatches.mockReturnValue(new Promise(() => {}))
    render(<TeamCalendar teamId="t1" team={{}} onBack={() => {}} />)
    expect(screen.getByText('Cargando calendario…')).toBeInTheDocument()
  })

  it('shows the current month label once loaded', async () => {
    api.getTrainings.mockResolvedValue([])
    api.getMatches.mockResolvedValue([])
    render(<TeamCalendar teamId="t1" team={{}} onBack={() => {}} />)
    expect(await screen.findByText('marzo de 2026')).toBeInTheDocument()
  })

  it('shows an event pill for a training day and for a match day', async () => {
    api.getTrainings.mockResolvedValue([{ id: 'tr1', training_date: '2026-03-10', attending_players: ['p1', 'p2'] }])
    api.getMatches.mockResolvedValue([{ id: 'm1', match_date: '2026-03-20', rival_team_name: 'CD Manchego', place: 'Casa' }])
    render(<TeamCalendar teamId="t1" team={{}} onBack={() => {}} />)

    expect(await screen.findByText('Entreno')).toBeInTheDocument()
    expect(screen.getByText('vs CD Manchego')).toBeInTheDocument()
  })

  it('shows "+N más" when a day has more than 2 events', async () => {
    api.getTrainings.mockResolvedValue([
      { id: 't1', training_date: '2026-03-10' }, { id: 't2', training_date: '2026-03-10' }
    ])
    api.getMatches.mockResolvedValue([{ id: 'm1', match_date: '2026-03-10', rival_team_name: 'X', place: 'Casa' }])
    render(<TeamCalendar teamId="t1" team={{}} onBack={() => {}} />)
    expect(await screen.findByText('+1 más')).toBeInTheDocument()
  })

  it('selecting a day filters the agenda to just that day, and toggles off on a second click', async () => {
    const user = userEvent.setup()
    api.getTrainings.mockResolvedValue([{ id: 't1', training_date: '2026-03-10', attending_players: ['p1'] }])
    api.getMatches.mockResolvedValue([{ id: 'm1', match_date: '2026-03-20', rival_team_name: 'CD Manchego', place: 'Casa' }])
    const { container } = render(<TeamCalendar teamId="t1" team={{}} onBack={() => {}} />)
    await screen.findByText('Entreno')

    const day10 = screen.getByText('10').closest('.calendar-day')
    await user.click(day10)

    expect(screen.getByText(/10 de marzo/)).toBeInTheDocument() // agenda title switches to the selected date
    // The match on the 20th still shows as a pill on its own grid cell, but
    // must be filtered out of the agenda list below the grid (day 10 only
    // has the training, so the list itself must exist here).
    const agenda = container.querySelector('.calendar-agenda-list')
    expect(agenda).not.toBeNull()
    expect(within(agenda).queryByText(/vs CD Manchego/)).not.toBeInTheDocument()

    await user.click(day10)
    expect(screen.getByText('Eventos de marzo de 2026')).toBeInTheDocument()
  })

  it('describes a training by its attendee count, with correct singular/plural', async () => {
    api.getTrainings.mockResolvedValue([{ id: 't1', training_date: '2026-03-10', attending_players: ['p1'] }])
    api.getMatches.mockResolvedValue([])
    render(<TeamCalendar teamId="t1" team={{}} onBack={() => {}} />)
    expect(await screen.findByText('1 jugador convocado')).toBeInTheDocument()
  })

  it('describes a finished match with venue, jornada and final score', async () => {
    api.getTrainings.mockResolvedValue([])
    api.getMatches.mockResolvedValue([{
      id: 'm1', match_date: '2026-03-10', rival_team_name: 'CD Manchego', place: 'Pabellón',
      is_home: true, jornada: 5, status: 'finished', home_goals: 3, away_goals: 1
    }])
    render(<TeamCalendar teamId="t1" team={{}} onBack={() => {}} />)
    expect(await screen.findByText('Pabellón · Local · Jornada 5 · Final 3-1')).toBeInTheDocument()
  })

  it('shows an empty-agenda message when the month has no events', async () => {
    api.getTrainings.mockResolvedValue([])
    api.getMatches.mockResolvedValue([])
    render(<TeamCalendar teamId="t1" team={{}} onBack={() => {}} />)
    expect(await screen.findByText('Sin entrenamientos ni partidos este mes.')).toBeInTheDocument()
  })

  it('navigates to the next/previous month', async () => {
    const user = userEvent.setup()
    api.getTrainings.mockResolvedValue([])
    api.getMatches.mockResolvedValue([])
    render(<TeamCalendar teamId="t1" team={{}} onBack={() => {}} />)
    await screen.findByText('marzo de 2026')

    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(screen.getByText('abril de 2026')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    expect(screen.getByText('febrero de 2026')).toBeInTheDocument()
  })

  it('calls onBack when clicking Atrás', async () => {
    const user = userEvent.setup()
    api.getTrainings.mockResolvedValue([])
    api.getMatches.mockResolvedValue([])
    const onBack = vi.fn()
    render(<TeamCalendar teamId="t1" team={{}} onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: /Atrás/ }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
