import { vi, describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GlobalSearchModal from '../GlobalSearchModal'

const players = [{ id: 'p1', name: 'Ana', surname: 'García', dorsal: 7, position: 'Cierre' }]
const exercises = [{ id: 'e1', name: 'Rondo', objective: 'Posesión', category: 'Técnica' }]
const trainings = [{ id: 't1', training_date: '2026-05-01', notes: 'Buena sesión' }]

function baseProps(overrides = {}) {
  return {
    players, exercises, trainings,
    onClose: vi.fn(), onSelectPlayer: vi.fn(), onSelectExercise: vi.fn(), onSelectTraining: vi.fn(),
    ...overrides
  }
}

describe('GlobalSearchModal', () => {
  it('shows a hint and no results before typing anything', () => {
    render(<GlobalSearchModal {...baseProps()} />)
    expect(screen.getByText('Escribe para buscar en toda la app del equipo.')).toBeInTheDocument()
    expect(screen.queryByText('Jugadores')).not.toBeInTheDocument()
  })

  it('finds a player by name and a training by its notes', async () => {
    const user = userEvent.setup()
    render(<GlobalSearchModal {...baseProps()} />)
    await user.type(screen.getByPlaceholderText(/Buscar jugadores/), 'ana')
    expect(screen.getByText('Ana García')).toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText(/Buscar jugadores/))
    await user.type(screen.getByPlaceholderText(/Buscar jugadores/), 'buena')
    expect(screen.getByText('Buena sesión')).toBeInTheDocument()
  })

  it('shows a "no results" hint when nothing matches a non-empty query', async () => {
    const user = userEvent.setup()
    render(<GlobalSearchModal {...baseProps()} />)
    await user.type(screen.getByPlaceholderText(/Buscar jugadores/), 'zzz-nada')
    expect(screen.getByText('Sin resultados para "zzz-nada"')).toBeInTheDocument()
  })

  it('caps each result group at 8 matches', async () => {
    const user = userEvent.setup()
    const manyExercises = Array.from({ length: 12 }, (_, i) => ({ id: `e${i}`, name: `Rondo ${i}` }))
    render(<GlobalSearchModal {...baseProps({ exercises: manyExercises })} />)
    await user.type(screen.getByPlaceholderText(/Buscar jugadores/), 'rondo')
    expect(screen.getAllByText(/^Rondo \d+$/)).toHaveLength(8)
  })

  it('calls the matching onSelect* handler when clicking a result', async () => {
    const user = userEvent.setup()
    const onSelectPlayer = vi.fn()
    render(<GlobalSearchModal {...baseProps({ onSelectPlayer })} />)
    await user.type(screen.getByPlaceholderText(/Buscar jugadores/), 'ana')
    await user.click(screen.getByText('Ana García'))
    expect(onSelectPlayer).toHaveBeenCalledWith(players[0])
  })

  it('closes on overlay click and the X button, but not on a click inside the content', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { container } = render(<GlobalSearchModal {...baseProps({ onClose })} />)

    await user.click(screen.getByText('Escribe para buscar en toda la app del equipo.'))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(container.querySelector('.modal-overlay'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
