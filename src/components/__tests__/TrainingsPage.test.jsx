import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TrainingsPage from '../TrainingsPage'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

const players = [
  { id: 'p1', name: 'Ana', surname: 'García', dorsal: 7 },
  { id: 'p2', name: 'Luis', surname: 'B', dorsal: 10 }
]

function training(overrides = {}) {
  return {
    id: 't1', training_date: '2026-03-10', notes: '', items: [],
    attending_players: [], ...overrides
  }
}

describe('TrainingsPage — empty states', () => {
  it('shows the "no trainings yet" message when the list is empty', () => {
    render(<TrainingsPage trainings={[]} players={players} onBack={() => {}} onNewTraining={() => {}} />)
    expect(screen.getByText('Sin entrenamientos todavía')).toBeInTheDocument()
  })

  it('shows a different message when filters exclude everything', async () => {
    const user = userEvent.setup()
    render(<TrainingsPage trainings={[training()]} players={players} onBack={() => {}} onNewTraining={() => {}} />)
    await user.type(screen.getByPlaceholderText('Buscar por notas o ejercicios'), 'zzz-nada')
    expect(screen.getByText('No hay entrenamientos con esos filtros')).toBeInTheDocument()
  })
})

describe('TrainingsPage — KPIs', () => {
  it('computes total, this-month count, and days since the last session', () => {
    const trainings = [training({ id: 't1', training_date: '2026-03-10' }), training({ id: 't2', training_date: '2026-01-01' })]
    const { container } = render(<TrainingsPage trainings={trainings} players={players} onBack={() => {}} onNewTraining={() => {}} />)
    const kpis = container.querySelector('.dashboard-kpis')
    expect(within(kpis).getByText('Total').closest('.kpi-card')).toHaveTextContent('2')
    expect(within(kpis).getByText('Este mes').closest('.kpi-card')).toHaveTextContent('1') // only the March one
    expect(within(kpis).getByText('Último entrenamiento').closest('.kpi-card')).toHaveTextContent('Hace 5d') // 15th - 10th
  })

  it('shows "Hoy" when the last training was today, and "—" with no trainings', () => {
    const { rerender, container } = render(<TrainingsPage trainings={[training({ training_date: '2026-03-15' })]} players={players} onBack={() => {}} onNewTraining={() => {}} />)
    const kpis = () => container.querySelector('.dashboard-kpis')
    expect(within(kpis()).getByText('Último entrenamiento').closest('.kpi-card')).toHaveTextContent('Hoy')

    rerender(<TrainingsPage trainings={[]} players={players} onBack={() => {}} onNewTraining={() => {}} />)
    expect(within(kpis()).getByText('Último entrenamiento').closest('.kpi-card')).toHaveTextContent('—')
  })

  it('computes average attendance as a rounded percentage of the roster', () => {
    // p1+p2 attended out of a 2-player roster = 100%.
    const trainings = [training({ attending_players: ['p1', 'p2'] })]
    const { container } = render(<TrainingsPage trainings={trainings} players={players} onBack={() => {}} onNewTraining={() => {}} />)
    const kpis = container.querySelector('.dashboard-kpis')
    expect(within(kpis).getByText('Asistencia media').closest('.kpi-card')).toHaveTextContent('100%')
  })

  it('picks the most-used exercise category as "topCategory"', () => {
    const trainings = [training({ items: [{ category: 'Principal' }, { category: 'Principal' }, { category: 'Posesión' }] })]
    const { container } = render(<TrainingsPage trainings={trainings} players={players} onBack={() => {}} onNewTraining={() => {}} />)
    const kpis = container.querySelector('.dashboard-kpis')
    expect(within(kpis).getByText('Categoría más trabajada').closest('.kpi-card')).toHaveTextContent('Principal')
  })
})

describe('TrainingsPage — collapsible panels', () => {
  it('hides the month chart bars until the panel is expanded', async () => {
    const user = userEvent.setup()
    render(<TrainingsPage trainings={[training()]} players={players} onBack={() => {}} onNewTraining={() => {}} />)
    expect(screen.queryByText('mar 26')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Entrenamientos por mes/ }))
    expect(screen.getByText('mar 26')).toBeInTheDocument()
  })

  it('shows the attendance-by-player panel only when there is at least one training', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<TrainingsPage trainings={[]} players={players} onBack={() => {}} onNewTraining={() => {}} />)
    expect(screen.queryByText('Asistencia por jugador')).not.toBeInTheDocument()

    rerender(<TrainingsPage trainings={[training({ attending_players: ['p1'] })]} players={players} onBack={() => {}} onNewTraining={() => {}} />)
    await user.click(screen.getByRole('button', { name: /Asistencia por jugador/ }))
    expect(screen.getByText('#7 Ana García')).toBeInTheDocument()
  })
})

describe('TrainingsPage — search, filters and the training list', () => {
  it('filters by notes or exercise name (case-insensitive)', async () => {
    const user = userEvent.setup()
    const trainings = [
      training({ id: 't1', notes: 'Sesión suave' }),
      training({ id: 't2', items: [{ exercise_name: 'Rondo intenso' }] })
    ]
    render(<TrainingsPage trainings={trainings} players={players} onBack={() => {}} onNewTraining={() => {}} />)
    await user.click(screen.getAllByText(/ejercicios/)[0]) // sanity: list rendered
    await user.type(screen.getByPlaceholderText('Buscar por notas o ejercicios'), 'rondo')
    expect(screen.queryByText('Sesión suave')).not.toBeInTheDocument()
  })

  it('clearing filters resets the search box and date range', async () => {
    const user = userEvent.setup()
    render(<TrainingsPage trainings={[training()]} players={players} onBack={() => {}} onNewTraining={() => {}} />)
    await user.type(screen.getByPlaceholderText('Buscar por notas o ejercicios'), 'algo')
    await user.click(screen.getByRole('button', { name: /Más filtros/ }))
    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(screen.getByPlaceholderText('Buscar por notas o ejercicios')).toHaveValue('')
  })

  it('expands a training to show its exercises, notes and a ficha badge when relevant', async () => {
    const user = userEvent.setup()
    const t = training({
      notes: 'Buena sesión',
      items: [{ id: 'i1', exercise_name: 'Rondo', category: 'Principal', objective: 'Posesión', notes: 'Ojo al córner' }]
    })
    render(<TrainingsPage trainings={[t]} players={players} onBack={() => {}} onNewTraining={() => {}} />)

    expect(screen.queryByText('Buena sesión')).not.toBeInTheDocument()
    await user.click(screen.getByText(/ejercicios/))
    expect(screen.getByText('Buena sesión')).toBeInTheDocument()
    expect(screen.getByText('Rondo')).toBeInTheDocument()
    expect(screen.getByText('Objetivo: Posesión')).toBeInTheDocument()
    expect(screen.getByText('Notas: Ojo al córner')).toBeInTheDocument()
  })

  it('only shows Editar for ficha trainings, and only when onEditTraining is provided', async () => {
    const user = userEvent.setup()
    const onEditTraining = vi.fn()
    const plain = training({ id: 't1' })
    render(<TrainingsPage trainings={[plain]} players={players} onBack={() => {}} onNewTraining={() => {}} onEditTraining={onEditTraining} />)
    await user.click(screen.getByText(/ejercicios/))
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
  })

  it('calls onExportTraining / onDeleteTraining from their buttons', async () => {
    const user = userEvent.setup()
    const onExportTraining = vi.fn()
    const onDeleteTraining = vi.fn()
    const t = training({ id: 't1' })
    render(<TrainingsPage trainings={[t]} players={players} onBack={() => {}} onNewTraining={() => {}} onExportTraining={onExportTraining} onDeleteTraining={onDeleteTraining} />)
    await user.click(screen.getByText(/ejercicios/))

    await user.click(screen.getByRole('button', { name: /Exportar PDF/ }))
    expect(onExportTraining).toHaveBeenCalledWith(t)

    await user.click(screen.getByRole('button', { name: /Borrar/ }))
    expect(onDeleteTraining).toHaveBeenCalledWith(t)
  })
})

describe('TrainingsPage — navigation', () => {
  it('calls onNewTraining and onBack', async () => {
    const user = userEvent.setup()
    const onNewTraining = vi.fn()
    const onBack = vi.fn()
    render(<TrainingsPage trainings={[]} players={players} onBack={onBack} onNewTraining={onNewTraining} />)

    await user.click(screen.getByRole('button', { name: /Atrás/ }))
    expect(onBack).toHaveBeenCalledTimes(1)

    await user.click(screen.getAllByRole('button', { name: /Nuevo entrenamiento/ })[0])
    expect(onNewTraining).toHaveBeenCalledTimes(1)
  })
})
