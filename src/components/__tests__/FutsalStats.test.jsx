import { vi, describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FutsalStats from '../FutsalStats'
import { api } from '../../lib/api'

vi.mock('../../lib/api', () => ({
  api: { getMatches: vi.fn(), getPlayers: vi.fn(), getMatchPlayerStats: vi.fn(), getRivalTeamStats: vi.fn() }
}))

const players = [
  { id: 'p1', name: 'Ana', surname: 'G', dorsal: 7, position: 'Cierre' },
  { id: 'p2', name: 'Luis', surname: 'B', dorsal: 9, position: 'Pivot' }
]

const matches = [
  { id: 'm1', status: 'finished', is_home: true, home_goals: 2, away_goals: 1, match_date: '2026-01-10', rival_team_name: 'CD A', place: 'Casa', jornada: 1 },
  { id: 'm2', status: 'finished', is_home: false, home_goals: 3, away_goals: 3, match_date: '2026-02-10', rival_team_name: 'CD B', place: 'Fuera', jornada: 2 },
  { id: 'm3', status: 'finished', is_home: true, home_goals: 0, away_goals: 1, match_date: '2026-03-10', rival_team_name: 'CD C', place: 'Casa', jornada: 3 },
  { id: 'm4', status: 'scheduled', is_home: true, match_date: '2026-04-10', rival_team_name: 'CD D', place: 'Casa' }
]

const statsByMatch = {
  m1: { player: [{ player_id: 'p1', goals: 2, assists: 0, shots_on_goal: 2 }], rival: { goals: 1, shots_on_goal: 5, fouls: 3 } },
  m2: { player: [{ player_id: 'p1', goals: 1, assists: 1, shots_on_goal: 1 }, { player_id: 'p2', goals: 2, assists: 0 }], rival: { goals: 3, shots_on_goal: 8, fouls: 2 } },
  m3: { player: [], rival: { goals: 1, shots_on_goal: 4, fouls: 5 } }
}

function setDefaults({ matchList = matches, playerList = players } = {}) {
  api.getMatches.mockResolvedValue(matchList)
  api.getPlayers.mockResolvedValue(playerList)
  api.getMatchPlayerStats.mockImplementation((id) => Promise.resolve(statsByMatch[id]?.player || []))
  api.getRivalTeamStats.mockImplementation((id) => Promise.resolve(statsByMatch[id]?.rival || null))
}

function overviewCard(label) {
  // The label text sits in its own <div>, itself matched first by
  // closest('div') — go one level up to the StatCard root that also holds
  // the value.
  return screen.getByText(label).parentElement
}

describe('FutsalStats — loading and header', () => {
  it('shows a loading state before data arrives', () => {
    api.getMatches.mockReturnValue(new Promise(() => {}))
    api.getPlayers.mockReturnValue(new Promise(() => {}))
    render(<FutsalStats teamId="t1" onClose={() => {}} />)
    expect(screen.getByText('Cargando estadísticas...')).toBeInTheDocument()
  })

  it('hides the header entirely when embedded', async () => {
    setDefaults()
    render(<FutsalStats teamId="t1" embedded />)
    await screen.findByText('Resumen')
    expect(screen.queryByText('Estadísticas Futsal')).not.toBeInTheDocument()
  })

  it('calls onClose from the Volver button when not embedded', async () => {
    const user = userEvent.setup()
    setDefaults()
    const onClose = vi.fn()
    render(<FutsalStats teamId="t1" onClose={onClose} />)
    await user.click(await screen.findByRole('button', { name: /Volver/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('FutsalStats — overview tab', () => {
  it('computes W/D/L, goals for/against and points across the 3 finished matches', async () => {
    setDefaults()
    render(<FutsalStats teamId="t1" embedded />)
    await screen.findByText('Resumen')

    expect(overviewCard('Jugados')).toHaveTextContent('3')
    expect(overviewCard('Victorias')).toHaveTextContent('1')
    expect(overviewCard('Empates')).toHaveTextContent('1')
    expect(overviewCard('Derrotas')).toHaveTextContent('1')
    expect(overviewCard('Goles')).toHaveTextContent('5') // 2+3+0
    expect(overviewCard('Encajados')).toHaveTextContent('5') // 1+3+1
    expect(overviewCard('Victorias')).toHaveTextContent('4 pts') // 1*3 + 1
  })

  it('shows the empty state when there are no finished matches', async () => {
    setDefaults({ matchList: [matches[3]] }) // only the scheduled one
    render(<FutsalStats teamId="t1" embedded />)
    expect(await screen.findByText('Sin partidos finalizados')).toBeInTheDocument()
  })

  it('shows the top scorer quick view (Ana leads with 3 goals over 2 matches)', async () => {
    setDefaults()
    render(<FutsalStats teamId="t1" embedded />)
    expect(await screen.findByText('Máximo goleador')).toBeInTheDocument()
    expect(screen.getByText('Ana G')).toBeInTheDocument()
  })

  it('shows one result badge per finished match in the form strip', async () => {
    setDefaults()
    const { container } = render(<FutsalStats teamId="t1" embedded />)
    await screen.findByText('Últimos resultados')
    // ResultBadge renders V/E/D letters — 1 win, 1 draw, 1 loss expected.
    const letters = [...container.querySelectorAll('h4')]
      .find(h => h.textContent === 'Últimos resultados').parentElement.textContent
    expect(letters).toContain('V')
    expect(letters).toContain('E')
    expect(letters).toContain('D')
  })
})

describe('FutsalStats — players tab', () => {
  it('ranks scorers, assisters and minutes leaders correctly', async () => {
    const user = userEvent.setup()
    setDefaults()
    render(<FutsalStats teamId="t1" embedded />)
    await screen.findByText('Resumen')
    await user.click(screen.getByRole('button', { name: 'Jugadores' }))

    const scorersSection = screen.getByText('Goleadores').closest('div')
    expect(within(scorersSection).getByText('Ana G')).toBeInTheDocument()

    const assistersSection = screen.getByText('Asistentes').closest('div')
    expect(within(assistersSection).getByText('Ana G')).toBeInTheDocument() // only Ana has an assist

    expect(screen.queryByText('Porteros — Paradas')).not.toBeInTheDocument() // no keeper/save data in this fixture
  })

  it('lists every player in the full table, even those with zero minutes', async () => {
    const user = userEvent.setup()
    setDefaults()
    render(<FutsalStats teamId="t1" embedded />)
    await screen.findByText('Resumen')
    await user.click(screen.getByRole('button', { name: 'Jugadores' }))

    const table = screen.getByText('Tabla completa de jugadores').closest('div').querySelector('table')
    expect(within(table).getByText('Ana G')).toBeInTheDocument()
    expect(within(table).getByText('Luis B')).toBeInTheDocument()
  })
})

describe('FutsalStats — matches tab', () => {
  it('shows every finished match, most recent first, with the correct scoreline', async () => {
    const user = userEvent.setup()
    setDefaults()
    const { container } = render(<FutsalStats teamId="t1" embedded />)
    await screen.findByText('Resumen')
    await user.click(screen.getByRole('button', { name: 'Partidos' }))

    const rivalHeadings = screen.getAllByText(/^vs CD/)
    expect(rivalHeadings[0]).toHaveTextContent('vs CD C') // most recent (2026-03-10)
    expect(rivalHeadings.map(h => h.textContent)).toEqual(['vs CD C', 'vs CD B', 'vs CD A'])
  })

  it('tags the MVP of a match by goals+assists+shots score', async () => {
    const user = userEvent.setup()
    setDefaults()
    render(<FutsalStats teamId="t1" embedded />)
    await screen.findByText('Resumen')
    await user.click(screen.getByRole('button', { name: 'Partidos' }))

    // m2: Luis scored 2 goals (score 4) vs Ana's 1 goal + 1 assist + 1 shot (score 3.5) -> Luis is MVP.
    expect(screen.getByText(/Luis \(2G 0A\)/)).toBeInTheDocument()
  })

  it('shows the rival team line when rival stats are available', async () => {
    const user = userEvent.setup()
    setDefaults()
    render(<FutsalStats teamId="t1" embedded />)
    await screen.findByText('Resumen')
    await user.click(screen.getByRole('button', { name: 'Partidos' }))
    expect(screen.getByText(/Rival: 1G · 5 t\.puerta · 3 faltas/)).toBeInTheDocument()
  })
})

describe('FutsalStats — charts tab', () => {
  it('renders the results donut with the total played in the center', async () => {
    const user = userEvent.setup()
    setDefaults()
    render(<FutsalStats teamId="t1" embedded />)
    await screen.findByText('Resumen')
    await user.click(screen.getByRole('button', { name: 'Gráficos' }))

    expect(screen.getByText('Distribución de resultados')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // total matches in the donut
  })
})
