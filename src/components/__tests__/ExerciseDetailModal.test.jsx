import { vi, describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExerciseDetailModal from '../ExerciseDetailModal'

const exercise = { id: 'e1', name: 'Rondo', objective: 'Posesión' }

describe('ExerciseDetailModal', () => {
  it('shows the name/objective, and the Público badge only when public', () => {
    const { rerender } = render(<ExerciseDetailModal exercise={exercise} trainings={[]} onClose={() => {}} />)
    expect(screen.getByText('Rondo')).toBeInTheDocument()
    expect(screen.queryByText('Público')).not.toBeInTheDocument()

    rerender(<ExerciseDetailModal exercise={{ ...exercise, is_public: true }} trainings={[]} onClose={() => {}} />)
    expect(screen.getByText('Público')).toBeInTheDocument()
  })

  it('shows the description only when present', () => {
    const { rerender } = render(<ExerciseDetailModal exercise={exercise} trainings={[]} onClose={() => {}} />)
    expect(screen.queryByText('Descripción')).not.toBeInTheDocument()

    rerender(<ExerciseDetailModal exercise={{ ...exercise, description: 'Detalles...' }} trainings={[]} onClose={() => {}} />)
    expect(screen.getByText('Descripción')).toBeInTheDocument()
    expect(screen.getByText('Detalles...')).toBeInTheDocument()
  })

  it('calls onClose and onEdit (only when onEdit is provided)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ExerciseDetailModal exercise={exercise} trainings={[]} onClose={onClose} />)
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onEdit when the Editar button is shown', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<ExerciseDetailModal exercise={exercise} trainings={[]} onClose={() => {}} onEdit={onEdit} />)
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('does not show a visibility toggle without onToggleVisibility, and disables it while pending', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ExerciseDetailModal exercise={exercise} trainings={[]} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: /Hacer público|Hacer privado/ })).not.toBeInTheDocument()

    let resolveToggle
    const onToggleVisibility = vi.fn(() => new Promise((res) => { resolveToggle = res }))
    rerender(<ExerciseDetailModal exercise={exercise} trainings={[]} onClose={() => {}} onToggleVisibility={onToggleVisibility} />)

    const toggleBtn = screen.getByRole('button', { name: 'Hacer público' })
    await user.click(toggleBtn)
    expect(onToggleVisibility).toHaveBeenCalledTimes(1)
    expect(toggleBtn).toBeDisabled()

    resolveToggle()
  })

  it('opens a Lightbox when clicking the photo', async () => {
    const user = userEvent.setup()
    const { container } = render(<ExerciseDetailModal exercise={{ ...exercise, photo_url: 'http://x/p.png' }} trainings={[]} onClose={() => {}} />)
    expect(container.querySelector('.lightbox-overlay')).not.toBeInTheDocument()
    await user.click(screen.getByAltText('Rondo'))
    expect(container.querySelector('.lightbox-overlay')).toBeInTheDocument()
  })

  it('shows an empty-usage message when the exercise has never been used', () => {
    render(<ExerciseDetailModal exercise={exercise} trainings={[]} onClose={() => {}} />)
    expect(screen.getByText('Usado en entrenamientos (0)')).toBeInTheDocument()
    expect(screen.getByText('Este ejercicio todavía no se ha incluido en ningún entrenamiento')).toBeInTheDocument()
  })

  it('lists the trainings that used the exercise, most recent first, with dimensions when set', () => {
    const trainings = [
      { id: 't1', training_date: '2026-01-01', items: [{ exercise_id: 'e1', dimensions: '40x20' }] },
      { id: 't2', training_date: '2026-06-01', items: [{ exercise_id: 'e1' }] },
      { id: 't3', training_date: '2026-03-01', items: [{ exercise_id: 'other' }] } // does not use this exercise
    ]
    render(<ExerciseDetailModal exercise={exercise} trainings={trainings} onClose={() => {}} />)

    expect(screen.getByText('Usado en entrenamientos (2)')).toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    // Most recent (t2, 2026-06-01, no dimensions) comes first, with no " — " suffix.
    expect(items[0].textContent).not.toContain('—')
    expect(items[1].textContent).toContain('40x20')
  })
})
