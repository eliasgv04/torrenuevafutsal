import { vi, describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeamDashboardModal from '../TeamDashboardModal'

describe('TeamDashboardModal', () => {
  it('embedded mode renders no header/close button', () => {
    render(<TeamDashboardModal exercises={[]} trainings={[]} embedded onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: /Cerrar/ })).not.toBeInTheDocument()
  })

  it('modal mode shows the team name and closes on click', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<TeamDashboardModal teamName="Torrenueva" exercises={[]} trainings={[]} onClose={onClose} />)
    expect(screen.getByText('Dashboard - Torrenueva')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Cerrar/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('computes the 4 KPI totals from the given exercises/trainings', () => {
    const exercises = [{ id: 'e1', totalCount: 3 }, { id: 'e2', totalCount: 2 }]
    const trainings = [{ id: 't1', items: [1, 2] }, { id: 't2', items: [1] }]
    const { container } = render(<TeamDashboardModal exercises={exercises} trainings={trainings} embedded />)
    const kpis = container.querySelector('.dashboard-kpis')

    expect(within(kpis).getByText('Ejercicios').closest('.kpi-card')).toHaveTextContent('2')
    expect(within(kpis).getByText('Entrenamientos').closest('.kpi-card')).toHaveTextContent('2')
    expect(within(kpis).getByText('Usos totales').closest('.kpi-card')).toHaveTextContent('5') // 3+2
    expect(within(kpis).getByText('Ejercicios planificados').closest('.kpi-card')).toHaveTextContent('3') // 2+1
  })

  it('shows the "not enough data" message per panel when there is nothing to chart', () => {
    render(<TeamDashboardModal exercises={[]} trainings={[]} embedded />)
    expect(screen.getAllByText('Sin datos suficientes todavía.')).toHaveLength(3)
  })

  it('ranks the top exercises by usage and shows at most 6', () => {
    const exercises = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, name: `Ex${i}`, totalCount: i }))
    render(<TeamDashboardModal exercises={exercises} trainings={[]} embedded />)

    const panel = screen.getByText('Ejercicios más trabajados').closest('section')
    expect(panel.querySelectorAll('.bar-row')).toHaveLength(6)
    // Highest usage (Ex7) must be the first bar.
    expect(panel.querySelector('.bar-row').textContent).toContain('Ex7')
  })

  it('groups usage by category, falling back to "Sin categoría"', () => {
    const exercises = [
      { id: 'e1', category: 'Técnica', totalCount: 5 },
      { id: 'e2', category: null, totalCount: 2 }
    ]
    render(<TeamDashboardModal exercises={exercises} trainings={[]} embedded />)
    const panel = screen.getByText('Carga por categoría').closest('section')
    expect(panel).toHaveTextContent('Técnica')
    expect(panel).toHaveTextContent('Sin categoría')
  })

  it('groups trainings per month and keeps only the last 8 months', () => {
    const trainings = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`, training_date: `2026-${String(i + 1).padStart(2, '0')}-01`
    }))
    render(<TeamDashboardModal exercises={[]} trainings={trainings} embedded />)
    const panel = screen.getByText('Entrenamientos por mes').closest('section')
    expect(panel.querySelectorAll('.month-col')).toHaveLength(8)
  })
})
