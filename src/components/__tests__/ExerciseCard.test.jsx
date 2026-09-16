import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExerciseCard from '../ExerciseCard'

const baseExercise = { id: 'e1', name: 'Rondo', category: 'Técnica', objective: '', dimensions: '40x20' }

describe('ExerciseCard', () => {
  it('shows the name and a fallback objective text when none is set', () => {
    render(<ExerciseCard exercise={baseExercise} />)
    expect(screen.getByText('Rondo')).toBeInTheDocument()
    expect(screen.getByText('Sin objetivo')).toBeInTheDocument()
  })

  it('shows the actual objective when present', () => {
    render(<ExerciseCard exercise={{ ...baseExercise, objective: 'Posesión' }} />)
    expect(screen.getByText('Posesión')).toBeInTheDocument()
  })

  it('shows a "Público" badge only when the exercise is public', () => {
    render(<ExerciseCard exercise={{ ...baseExercise, is_public: true }} />)
    expect(screen.getByText('Público')).toBeInTheDocument()
  })

  it('prefers lastDimensions over the exercise\'s own dimensions, falling back to "—"', () => {
    const { rerender } = render(<ExerciseCard exercise={{ ...baseExercise, lastDimensions: '28x20' }} />)
    expect(screen.getByText('28x20')).toBeInTheDocument()

    rerender(<ExerciseCard exercise={{ ...baseExercise, dimensions: '40x20', lastDimensions: null }} />)
    expect(screen.getByText('40x20')).toBeInTheDocument()

    rerender(<ExerciseCard exercise={{ ...baseExercise, dimensions: null, lastDimensions: null }} />)
    // Both "Pista" and "Última" (no lastDate in this fixture) fall back to "—".
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('calls onOpenDetail when clicking the card (non-selectable mode)', async () => {
    const user = userEvent.setup()
    const onOpenDetail = vi.fn()
    render(<ExerciseCard exercise={baseExercise} onOpenDetail={onOpenDetail} />)
    await user.click(screen.getByText('Rondo'))
    expect(onOpenDetail).toHaveBeenCalledTimes(1)
  })

  it('in selectable mode, clicking the card toggles selection instead of opening the detail', async () => {
    const user = userEvent.setup()
    const onOpenDetail = vi.fn()
    const onToggleSelect = vi.fn()
    render(<ExerciseCard exercise={baseExercise} selectable onOpenDetail={onOpenDetail} onToggleSelect={onToggleSelect} />)
    await user.click(screen.getByText('Rondo'))
    expect(onToggleSelect).toHaveBeenCalledTimes(1)
    expect(onOpenDetail).not.toHaveBeenCalled()
  })

  it('only renders Editar/Eliminar buttons when their handlers are provided, and never in selectable mode', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const onOpenDetail = vi.fn()
    render(<ExerciseCard exercise={baseExercise} onEdit={onEdit} onDelete={onDelete} onOpenDetail={onOpenDetail} />)

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    // Clicking Editar must not also trigger the card's own onOpenDetail (stopPropagation).
    expect(onOpenDetail).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onOpenDetail).not.toHaveBeenCalled()
  })

  it('opens a Lightbox when clicking the photo in non-selectable mode', async () => {
    const user = userEvent.setup()
    const withPhoto = { ...baseExercise, photo_url: 'http://x/p.png' }
    render(<ExerciseCard exercise={withPhoto} />)
    await user.click(screen.getByAltText('Rondo'))
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument() // Lightbox opened
  })

  it('does not open a Lightbox when clicking the photo in selectable mode', async () => {
    const user = userEvent.setup()
    const withPhoto = { ...baseExercise, photo_url: 'http://x/p.png' }
    render(<ExerciseCard exercise={withPhoto} selectable onToggleSelect={() => {}} />)
    await user.click(screen.getByAltText('Rondo'))
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument()
  })
})
