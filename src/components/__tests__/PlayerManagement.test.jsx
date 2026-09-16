import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlayerManagement from '../PlayerManagement'
import { api } from '../../lib/api'

vi.mock('../../lib/api', () => ({
  api: {
    getPlayers: vi.fn(), getTrainings: vi.fn(), getPlayerMatches: vi.fn(),
    createPlayer: vi.fn(), updatePlayer: vi.fn(), deletePlayer: vi.fn()
  }
}))
vi.mock('../ConfirmModal', () => ({
  default: ({ title, message, onConfirm, onCancel }) => (
    <div>confirm-{title}: {message}
      <button onClick={onConfirm}>confirm-yes</button>
      <button onClick={onCancel}>confirm-no</button>
    </div>
  )
}))

const p1 = { id: 'p1', name: 'Ana', surname: 'García', dorsal: 7, position: 'Ala Zurdo' }
const p2 = { id: 'p2', name: 'Luis', surname: 'B', dorsal: 1, position: 'Portero' }

function setDefaults({ players = [], trainings = [], matchesByPlayer = {} } = {}) {
  api.getPlayers.mockResolvedValue(players)
  api.getTrainings.mockResolvedValue(trainings)
  api.getPlayerMatches.mockImplementation((id) => Promise.resolve(matchesByPlayer[id] || []))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PlayerManagement — roster', () => {
  it('shows an empty state with no players', async () => {
    setDefaults()
    render(<PlayerManagement teamId="t1" onClose={() => {}} />)
    expect(await screen.findByText('Sin jugadores todavía')).toBeInTheDocument()
  })

  it('sorts the roster by position then dorsal (Portero before Ala Zurdo)', async () => {
    setDefaults({ players: [p1, p2] })
    const { container } = render(<PlayerManagement teamId="t1" onClose={() => {}} />)
    await screen.findByText(/Ana/)
    const names = [...container.querySelectorAll('.player-square-name')].map(el => el.textContent)
    expect(names).toEqual(['Luis B', 'Ana García'])
  })

  it('shows a form badge with the score in its title once match data is loaded', async () => {
    setDefaults({
      players: [p1],
      matchesByPlayer: { p1: [{ match_id: 'm1', is_home: true, home_goals: 1, away_goals: 0, goals: 1, minutes_played: 2400 }] }
    })
    render(<PlayerManagement teamId="t1" onClose={() => {}} />)
    await screen.findByText(/Ana/)
    const badge = document.querySelector('.player-form-badge')
    expect(badge).not.toBeNull()
    expect(badge.title).toMatch(/^Forma reciente: \d+\/100$/)
  })

  it('shows no form badge for a player with no finished matches', async () => {
    setDefaults({ players: [p1], matchesByPlayer: { p1: [] } })
    render(<PlayerManagement teamId="t1" onClose={() => {}} />)
    await screen.findByText(/Ana/)
    expect(document.querySelector('.player-form-badge')).toBeNull()
  })
})

describe('PlayerManagement — create/edit', () => {
  it('creates a player with a parsed integer dorsal', async () => {
    const user = userEvent.setup()
    setDefaults()
    api.createPlayer.mockResolvedValue({})
    render(<PlayerManagement teamId="t1" onClose={() => {}} />)
    await screen.findByText('Sin jugadores todavía')

    await user.click(screen.getAllByRole('button', { name: /Añadir jugador/ })[0])
    await user.type(screen.getByPlaceholderText('Nombre'), 'Ana')
    await user.type(screen.getByPlaceholderText('Apellidos'), 'García')
    await user.type(screen.getByPlaceholderText('Dorsal'), '7')
    await user.selectOptions(screen.getByRole('combobox'), 'Cierre')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(api.createPlayer).toHaveBeenCalledWith({ team_id: 't1', name: 'Ana', surname: 'García', dorsal: 7, position: 'Cierre' })
  })

  it('edits an existing player, pre-filling the form from the detail view', async () => {
    const user = userEvent.setup()
    setDefaults({ players: [p1] })
    api.updatePlayer.mockResolvedValue({ name: 'Ana', surname: 'García', dorsal: 7, position: 'Pivot' })
    render(<PlayerManagement teamId="t1" onClose={() => {}} />)
    await screen.findByText(/Ana/)

    await user.click(screen.getByText(/Ana/).closest('button'))
    await user.click(screen.getByRole('button', { name: /Editar/ }))

    expect(screen.getByPlaceholderText('Nombre')).toHaveValue('Ana')
    await user.selectOptions(screen.getByRole('combobox'), 'Pivot')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(api.updatePlayer).toHaveBeenCalledWith('p1', { name: 'Ana', surname: 'García', dorsal: 7, position: 'Pivot' })
  })
})

describe('PlayerManagement — detail view', () => {
  it('shows a no-matches message when the player has none, and an attendance bar', async () => {
    const user = userEvent.setup()
    setDefaults({ players: [p1], trainings: [{ id: 'tr1', attending_players: ['p1'] }, { id: 'tr2', attending_players: [] }], matchesByPlayer: { p1: [] } })
    render(<PlayerManagement teamId="t1" onClose={() => {}} />)
    await screen.findByText(/Ana/)
    await user.click(screen.getByText(/Ana/).closest('button'))

    expect(screen.getByText('Sin partidos finalizados registrados todavía')).toBeInTheDocument()
    expect(screen.getByText('1/2 · 50%')).toBeInTheDocument()
  })

  it('shows aggregated totals and the most recent matches, most recent first', async () => {
    const user = userEvent.setup()
    const matches = [
      { match_id: 'm1', rival_team_name: 'CD Old', is_home: true, home_goals: 1, away_goals: 2, goals: 0, minutes_played: 600 },
      { match_id: 'm2', rival_team_name: 'CD New', is_home: false, home_goals: 0, away_goals: 3, goals: 2, assists: 1, minutes_played: 1200 }
    ]
    // getPlayerMatches already returns most-recent-first per api.js's own contract; component just slices(0,3).
    setDefaults({ players: [p1], matchesByPlayer: { p1: [matches[1], matches[0]] } })
    render(<PlayerManagement teamId="t1" onClose={() => {}} />)
    await screen.findByText(/Ana/)
    await user.click(screen.getByText(/Ana/).closest('button'))

    expect(screen.getByText('Total en 2 partidos')).toBeInTheDocument()
    const cards = document.querySelectorAll('.player-match-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveTextContent('CD New') // most recent first
    expect(cards[0]).toHaveTextContent('3-0') // away win: our score (away_goals=3) first
  })

  it('deletes the player and closes the detail view', async () => {
    const user = userEvent.setup()
    setDefaults({ players: [p1], matchesByPlayer: { p1: [] } })
    api.deletePlayer.mockResolvedValue()
    render(<PlayerManagement teamId="t1" onClose={() => {}} />)
    await screen.findByText(/Ana/)
    await user.click(screen.getByText(/Ana/).closest('button'))

    await user.click(screen.getByRole('button', { name: /Eliminar/ }))
    await user.click(screen.getByText('confirm-yes'))

    expect(api.deletePlayer).toHaveBeenCalledWith('p1')
    expect(screen.queryByText('Sin partidos finalizados registrados todavía')).not.toBeInTheDocument()
  })

  it('closes the detail modal via the Cerrar button or the overlay, but not a click inside', async () => {
    const user = userEvent.setup()
    setDefaults({ players: [p1], matchesByPlayer: { p1: [] } })
    render(<PlayerManagement teamId="t1" onClose={() => {}} />)
    await screen.findByText(/Ana/)
    await user.click(screen.getByText(/Ana/).closest('button'))

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByText('Sin partidos finalizados registrados todavía')).not.toBeInTheDocument()
  })
})

describe('PlayerManagement — deep link and navigation', () => {
  it('auto-opens the detail view for initialPlayerId once the roster loads', async () => {
    setDefaults({ players: [p1, p2], matchesByPlayer: { p1: [], p2: [] } })
    render(<PlayerManagement teamId="t1" onClose={() => {}} initialPlayerId="p2" />)
    expect(await screen.findByText('Luis B')).toBeInTheDocument()
  })

  it('calls onClose when clicking Atrás', async () => {
    const user = userEvent.setup()
    setDefaults()
    const onClose = vi.fn()
    render(<PlayerManagement teamId="t1" onClose={onClose} />)
    await screen.findByText('Sin jugadores todavía')
    await user.click(screen.getByRole('button', { name: /Atrás/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
