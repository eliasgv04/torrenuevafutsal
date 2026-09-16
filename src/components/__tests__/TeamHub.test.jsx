import { vi, describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeamHub from '../TeamHub'

const team = { name: 'Torrenueva', gradient_start: '#111', gradient_end: '#222' }

function handlers() {
  return {
    onBack: vi.fn(), onOpenExercises: vi.fn(), onOpenTrainings: vi.fn(), onOpenMatches: vi.fn(),
    onOpenRoster: vi.fn(), onOpenBoard: vi.fn(), onOpenStats: vi.fn(), onOpenCalendar: vi.fn(), onOpenSearch: vi.fn()
  }
}

describe('TeamHub', () => {
  it('shows the team name and all 6 section cards', () => {
    render(<TeamHub team={team} counts={{}} {...handlers()} />)
    expect(screen.getByText('Torrenueva')).toBeInTheDocument()
    for (const title of ['Ejercicios', 'Entrenamientos', 'Partidos', 'Plantilla', 'Pizarra táctica', 'Estadísticas']) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it('shows a count badge only for cards that have one', () => {
    render(<TeamHub team={team} counts={{ exercises: 45, trainings: 8 }} {...handlers()} />)
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    // "Partidos", "Pizarra táctica" and "Estadísticas" never carry a count prop.
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('wires each card and header button to its own handler', async () => {
    const user = userEvent.setup()
    const h = handlers()
    render(<TeamHub team={team} counts={{}} {...h} />)

    await user.click(screen.getByText('Ejercicios'))
    expect(h.onOpenExercises).toHaveBeenCalledTimes(1)

    await user.click(screen.getByText('Pizarra táctica'))
    expect(h.onOpenBoard).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(h.onBack).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(h.onOpenSearch).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Calendario' }))
    expect(h.onOpenCalendar).toHaveBeenCalledTimes(1)
  })
})
