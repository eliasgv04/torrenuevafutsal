import { vi, describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExerciseForumModal from '../ExerciseForumModal'
import { api } from '../../lib/api'

vi.mock('../../lib/api', () => ({ api: { getPublicExercises: vi.fn() } }))

describe('ExerciseForumModal', () => {
  it('shows a loading state before the exercises arrive', () => {
    api.getPublicExercises.mockReturnValue(new Promise(() => {}))
    render(<ExerciseForumModal onClose={() => {}} />)
    expect(screen.getByText('Cargando foro...')).toBeInTheDocument()
  })

  it('shows an empty-forum message when there are no public exercises', async () => {
    api.getPublicExercises.mockResolvedValue([])
    render(<ExerciseForumModal onClose={() => {}} />)
    expect(await screen.findByText('Todavía no hay ejercicios públicos')).toBeInTheDocument()
  })

  it('lists exercises with who shared them', async () => {
    api.getPublicExercises.mockResolvedValue([
      { id: 'e1', name: 'Rondo', objective: 'Posesión', category: 'Técnica', team_name: 'Juvenil' }
    ])
    render(<ExerciseForumModal onClose={() => {}} />)
    expect(await screen.findByText('Rondo')).toBeInTheDocument()
    expect(screen.getByText('Juvenil')).toBeInTheDocument()
  })

  it('filters by name, category or team as the user types', async () => {
    const user = userEvent.setup()
    api.getPublicExercises.mockResolvedValue([
      { id: 'e1', name: 'Rondo', category: 'Técnica', team_name: 'Juvenil' },
      { id: 'e2', name: 'Transiciones', category: 'Táctica', team_name: 'Alevín' }
    ])
    render(<ExerciseForumModal onClose={() => {}} />)
    await screen.findByText('Rondo')

    await user.type(screen.getByPlaceholderText(/Buscar por nombre/), 'alevín')

    expect(screen.queryByText('Rondo')).not.toBeInTheDocument()
    expect(screen.getByText('Transiciones')).toBeInTheDocument()
  })

  it('shows a "no results" message distinct from the "no public exercises" one', async () => {
    const user = userEvent.setup()
    api.getPublicExercises.mockResolvedValue([{ id: 'e1', name: 'Rondo', team_name: 'Juvenil' }])
    render(<ExerciseForumModal onClose={() => {}} />)
    await screen.findByText('Rondo')

    await user.type(screen.getByPlaceholderText(/Buscar por nombre/), 'zzz-nada')

    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })

  it('closes on overlay click and on the Cerrar button, but not when clicking inside the content', async () => {
    const user = userEvent.setup()
    api.getPublicExercises.mockResolvedValue([])
    const onClose = vi.fn()
    const { container } = render(<ExerciseForumModal onClose={onClose} />)
    await waitFor(() => expect(screen.queryByText('Cargando foro...')).not.toBeInTheDocument())

    await user.click(screen.getByText('Foro de ejercicios'))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(container.querySelector('.modal-overlay'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
