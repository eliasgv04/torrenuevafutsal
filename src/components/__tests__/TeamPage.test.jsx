import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeamPage from '../TeamPage'
import { api } from '../../lib/api'
import { exportTrainingToPdf } from '../../lib/pdfExport'
import { exportTrainingFichaToPdf } from '../../lib/pdfFicha'

vi.mock('../../lib/api', () => ({
  api: {
    getExercises: vi.fn(), getPlayers: vi.fn(), getTrainings: vi.fn(), getTrainingItemsByTrainingIds: vi.fn(),
    createExercise: vi.fn(), updateExercise: vi.fn(), deleteExercise: vi.fn(),
    createTraining: vi.fn(), updateTraining: vi.fn(), replaceTrainingItems: vi.fn(), deleteTraining: vi.fn()
  }
}))
vi.mock('../../lib/pdfExport', () => ({ exportTrainingToPdf: vi.fn() }))
vi.mock('../../lib/pdfFicha', () => ({ exportTrainingFichaToPdf: vi.fn() }))

vi.mock('../TeamHub', () => ({
  default: (p) => (
    <div>team-hub
      <button onClick={p.onOpenExercises}>go-exercises</button>
      <button onClick={p.onOpenTrainings}>go-trainings</button>
      <button onClick={p.onOpenRoster}>go-roster</button>
      <button onClick={p.onOpenBoard}>go-board</button>
      <button onClick={p.onOpenMatches}>go-matches</button>
      <button onClick={p.onOpenStats}>go-stats</button>
      <button onClick={p.onOpenCalendar}>go-calendar</button>
      <button onClick={p.onOpenSearch}>go-search</button>
      <span>counts:{p.counts.exercises}/{p.counts.trainings}/{p.counts.players}</span>
    </div>
  )
}))
vi.mock('../TeamCalendar', () => ({ default: (p) => <div>team-calendar<button onClick={p.onBack}>back-calendar</button></div> }))
vi.mock('../PlayerManagement', () => ({ default: (p) => <div>player-management-{p.initialPlayerId}<button onClick={p.onClose}>back-roster</button></div> }))
vi.mock('../MatchManagement', () => ({ default: (p) => <div>match-management<button onClick={() => p.onSelectMatch({ id: 'm1' })}>open-tracker</button><button onClick={p.onClose}>back-matches</button></div> }))
vi.mock('../MatchTracker', () => ({ default: (p) => <div>match-tracker-{p.match.id}<button onClick={p.onClose}>back-tracker</button></div> }))
vi.mock('../TacticalBoard', () => ({ default: (p) => <div>tactical-board<button onClick={p.onClose}>back-board</button></div> }))
vi.mock('../TeamStatsView', () => ({ default: (p) => <div>team-stats-view exercises:{p.exercises.length}<button onClick={p.onClose}>back-stats</button></div> }))
vi.mock('../TrainingsPage', () => ({
  default: (p) => (
    <div>trainings-page count:{p.trainings.length}
      <button onClick={p.onBack}>back-trainings</button>
      <button onClick={p.onNewTraining}>new-training</button>
      <button onClick={() => p.onExportTraining(p.trainings[0])}>export-training</button>
      <button onClick={() => p.onEditTraining(p.trainings[0])}>edit-training</button>
      <button onClick={() => p.onDeleteTraining(p.trainings[0])}>delete-training</button>
    </div>
  )
}))
vi.mock('../CreateExerciseModal', () => ({
  default: (p) => (
    <div>create-exercise-modal
      <button onClick={() => (p.onSave || p.onCreate)({ name: 'Rondo', category: 'Principal' })}>submit-exercise</button>
      <button onClick={p.onCancel}>cancel-exercise</button>
    </div>
  )
}))
vi.mock('../ConfirmModal', () => ({
  default: (p) => (
    <div>confirm-{p.title}
      <button onClick={p.onConfirm}>confirm-yes</button>
      <button onClick={p.onCancel}>confirm-no</button>
    </div>
  )
}))
vi.mock('../ExerciseDetailModal', () => ({
  default: (p) => (
    <div>exercise-detail-{p.exercise.id}
      <button onClick={p.onClose}>close-detail</button>
      <button onClick={p.onEdit}>edit-from-detail</button>
      <button onClick={p.onToggleVisibility}>toggle-visibility</button>
    </div>
  )
}))
vi.mock('../TrainingPlannerModal', () => ({
  default: (p) => (
    <div>training-planner{p.initial ? '-edit' : '-create'}
      <button onClick={() => p.onSave({ training_date: '2026-05-01', items: [], selected_players: [], objectives: {}, warmup: '' })}>submit-training</button>
      <button onClick={p.onCancel}>cancel-training</button>
    </div>
  )
}))
vi.mock('../ExerciseForumModal', () => ({ default: (p) => <div>forum-modal<button onClick={p.onClose}>close-forum</button></div> }))
vi.mock('../GlobalSearchModal', () => ({
  default: (p) => (
    <div>global-search-modal
      <button onClick={() => p.onSelectPlayer({ id: 'p1' })}>pick-player</button>
      <button onClick={() => p.onSelectExercise(p.exercises[0])}>pick-exercise</button>
      <button onClick={() => p.onSelectTraining()}>pick-training</button>
    </div>
  )
}))
vi.mock('../ExerciseCard', () => ({
  default: (p) => (
    <div>exercise-card-{p.exercise.id} uses:{p.exercise.totalCount} last:{p.exercise.lastDimensions || '-'} selected:{String(!!p.selected)}
      <button onClick={p.onDelete}>delete-{p.exercise.id}</button>
      <button onClick={p.onToggleSelect}>select-{p.exercise.id}</button>
    </div>
  )
}))

const team = { id: 't1', name: 'Torrenueva' }

function setDefaults({ exercises = [], players = [], trainings = [] } = {}) {
  api.getExercises.mockResolvedValue(exercises)
  api.getPlayers.mockResolvedValue(players)
  api.getTrainings.mockResolvedValue(trainings)
  api.getTrainingItemsByTrainingIds.mockResolvedValue({})
}

beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

describe('TeamPage — view routing from the hub', () => {
  it('shows the hub with live counts, and can navigate to and back from every view', async () => {
    const user = userEvent.setup()
    setDefaults({ exercises: [{ id: 'e1', name: 'Rondo' }], players: [{ id: 'p1' }], trainings: [{ id: 'tr1', training_date: '2026-01-01' }] })
    render(<TeamPage team={team} onBack={() => {}} />)
    expect(await screen.findByText('counts:1/1/1')).toBeInTheDocument()

    await user.click(screen.getByText('go-roster'))
    expect(screen.getByText(/player-management-/)).toBeInTheDocument()
    await user.click(screen.getByText('back-roster'))
    expect(screen.getByText('team-hub')).toBeInTheDocument()

    await user.click(screen.getByText('go-board'))
    expect(screen.getByText('tactical-board')).toBeInTheDocument()
    await user.click(screen.getByText('back-board'))

    await user.click(screen.getByText('go-calendar'))
    expect(screen.getByText('team-calendar')).toBeInTheDocument()
    await user.click(screen.getByText('back-calendar'))

    await user.click(screen.getByText('go-stats'))
    expect(screen.getByText(/team-stats-view/)).toBeInTheDocument()
  })

  it('opens the match tracker from MatchManagement, and can close back to it', async () => {
    const user = userEvent.setup()
    setDefaults()
    render(<TeamPage team={team} onBack={() => {}} />)
    await screen.findByText('team-hub')

    await user.click(screen.getByText('go-matches'))
    expect(screen.getByText('match-management')).toBeInTheDocument()

    await user.click(screen.getByText('open-tracker'))
    expect(screen.getByText('match-tracker-m1')).toBeInTheDocument()

    await user.click(screen.getByText('back-tracker'))
    expect(screen.getByText('match-management')).toBeInTheDocument()
  })

  it('routes global search selections to the right view', async () => {
    const user = userEvent.setup()
    setDefaults({ exercises: [{ id: 'e1', name: 'Rondo' }] })
    render(<TeamPage team={team} onBack={() => {}} />)
    await screen.findByText('team-hub')

    await user.click(screen.getByText('go-search'))
    await user.click(screen.getByText('pick-exercise'))
    expect(screen.getByText('exercise-detail-e1')).toBeInTheDocument()
  })
})

describe('TeamPage — exercise bank', () => {
  it('shows the exercise bank with usage stats derived from training history', async () => {
    const user = userEvent.setup()
    setDefaults({
      exercises: [{ id: 'e1', name: 'Rondo' }],
      trainings: [{ id: 'tr1', training_date: '2026-01-01', items: [{ exercise_id: 'e1', dimensions: '40x20' }] }]
    })
    api.getTrainingItemsByTrainingIds.mockResolvedValue({ tr1: [{ exercise_id: 'e1', dimensions: '40x20' }] })
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-exercises'))

    expect(await screen.findByText(/exercise-card-e1 uses:1 last:40x20/)).toBeInTheDocument()
  })

  it('creates an exercise, and rejects a duplicate name without calling the API', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    setDefaults({ exercises: [{ id: 'e1', name: 'Rondo' }] })
    api.createExercise.mockResolvedValue({ id: 'e2', name: 'Rondo' })
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-exercises'))
    await screen.findByText(/exercise-card-e1/)

    await user.click(screen.getByText('+ Nuevo ejercicio'))
    await user.click(screen.getByText('submit-exercise')) // mock always submits name "Rondo"

    expect(window.alert).toHaveBeenCalledWith('Ya existe un ejercicio con ese nombre. Usa otro distinto.')
    expect(api.createExercise).not.toHaveBeenCalled()
  })

  it('deletes an exercise after confirming', async () => {
    const user = userEvent.setup()
    setDefaults({ exercises: [{ id: 'e1', name: 'Rondo' }] })
    api.deleteExercise.mockResolvedValue()
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-exercises'))
    await screen.findByText(/exercise-card-e1/)

    await user.click(screen.getByText('delete-e1'))
    expect(screen.getByText('confirm-Eliminar Rondo')).toBeInTheDocument()

    await user.click(screen.getByText('confirm-yes'))
    expect(api.deleteExercise).toHaveBeenCalledWith('e1')
    expect(screen.queryByText(/exercise-card-e1/)).not.toBeInTheDocument()
  })

  it('toggles an exercise\'s visibility from its detail modal', async () => {
    const user = userEvent.setup()
    setDefaults({ exercises: [{ id: 'e1', name: 'Rondo', is_public: false }] })
    api.updateExercise.mockResolvedValue({ is_public: true })
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-search'))
    await user.click(screen.getByText('pick-exercise'))

    await user.click(screen.getByText('toggle-visibility'))
    expect(api.updateExercise).toHaveBeenCalledWith('e1', { is_public: true })
  })

  it('toggles select mode, copies to clipboard and clears selection', async () => {
    const user = userEvent.setup()
    setDefaults({ exercises: [{ id: 'e1', name: 'Rondo' }] })
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-exercises'))
    await screen.findByText(/exercise-card-e1/)

    await user.click(screen.getByTitle('Seleccionar ejercicios'))
    expect(screen.getByText('Toca los ejercicios que quieras copiar o eliminar')).toBeInTheDocument()
  })

  it('filters exercises by search text', async () => {
    const user = userEvent.setup()
    setDefaults({ exercises: [{ id: 'e1', name: 'Rondo' }, { id: 'e2', name: 'Estiramientos' }] })
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-exercises'))
    await screen.findByText(/exercise-card-e1/)

    await user.type(screen.getByPlaceholderText('Buscar por nombre, objetivo o categoría'), 'estiramientos')
    expect(screen.queryByText(/exercise-card-e1 /)).not.toBeInTheDocument()
    expect(screen.getByText(/exercise-card-e2/)).toBeInTheDocument()
  })

  it('selects exercises in select mode and bulk-deletes them after confirming', async () => {
    const user = userEvent.setup()
    setDefaults({ exercises: [{ id: 'e1', name: 'Rondo' }, { id: 'e2', name: 'Estiramientos' }] })
    api.deleteExercise.mockResolvedValue()
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-exercises'))
    await screen.findByText(/exercise-card-e1/)

    await user.click(screen.getByTitle('Seleccionar ejercicios'))
    await user.click(screen.getByText('select-e1'))
    await user.click(screen.getByText('select-e2'))
    expect(screen.getByText('2 ejercicios seleccionados')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(screen.getByText('confirm-Eliminar 2 ejercicios')).toBeInTheDocument()

    await user.click(screen.getByText('confirm-yes'))
    expect(api.deleteExercise).toHaveBeenCalledWith('e1')
    expect(api.deleteExercise).toHaveBeenCalledWith('e2')
    expect(screen.queryByText(/exercise-card-e1/)).not.toBeInTheDocument()
    expect(screen.queryByText(/exercise-card-e2/)).not.toBeInTheDocument()
  })

  it('cancels a bulk delete from the confirm dialog, keeping the exercises', async () => {
    const user = userEvent.setup()
    setDefaults({ exercises: [{ id: 'e1', name: 'Rondo' }] })
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-exercises'))
    await screen.findByText(/exercise-card-e1/)

    await user.click(screen.getByTitle('Seleccionar ejercicios'))
    await user.click(screen.getByText('select-e1'))
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    await user.click(screen.getByText('confirm-no'))

    expect(api.deleteExercise).not.toHaveBeenCalled()
    expect(screen.getByText(/exercise-card-e1/)).toBeInTheDocument()
  })

  it('edits an exercise from its detail modal', async () => {
    const user = userEvent.setup()
    setDefaults({ exercises: [{ id: 'e1', name: 'Rondo' }] })
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-search'))
    await user.click(screen.getByText('pick-exercise'))
    expect(screen.getByText('exercise-detail-e1')).toBeInTheDocument()

    await user.click(screen.getByText('edit-from-detail'))
    expect(screen.queryByText('exercise-detail-e1')).not.toBeInTheDocument()
    expect(screen.getByText('create-exercise-modal')).toBeInTheDocument()
  })

  it('opens the exercise forum modal', async () => {
    const user = userEvent.setup()
    setDefaults()
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-exercises'))
    await screen.findByText('Sin ejercicios aún')

    await user.click(screen.getByRole('button', { name: 'Foro' }))
    expect(screen.getByText('forum-modal')).toBeInTheDocument()
    await user.click(screen.getByText('close-forum'))
    expect(screen.queryByText('forum-modal')).not.toBeInTheDocument()
  })

  it('shows a loading state before the exercise bank resolves', async () => {
    const user = userEvent.setup()
    let resolveExercises
    api.getExercises.mockReturnValue(new Promise((res) => { resolveExercises = res }))
    api.getPlayers.mockResolvedValue([])
    api.getTrainings.mockResolvedValue([])
    api.getTrainingItemsByTrainingIds.mockResolvedValue({})
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-exercises'))

    expect(screen.getByText('Cargando ejercicios…')).toBeInTheDocument()
    resolveExercises([])
    expect(await screen.findByText('Sin ejercicios aún')).toBeInTheDocument()
  })

  it('filters the exercise bank by category and by date range, then clears the filters', async () => {
    const user = userEvent.setup()
    setDefaults({
      exercises: [{ id: 'e1', name: 'Rondo', category: 'Principal' }, { id: 'e2', name: 'Estiramientos', category: 'Final' }],
      trainings: [{ id: 'tr1', training_date: '2026-01-10', items: [{ exercise_id: 'e1', dimensions: '40x20' }] }]
    })
    api.getTrainingItemsByTrainingIds.mockResolvedValue({ tr1: [{ exercise_id: 'e1', dimensions: '40x20' }] })
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-exercises'))
    await screen.findByText(/exercise-card-e1/)

    await user.click(screen.getByRole('button', { name: /Más filtros/ }))
    await user.selectOptions(screen.getByRole('combobox'), 'Final')
    expect(screen.queryByText(/exercise-card-e1/)).not.toBeInTheDocument()
    expect(screen.getByText(/exercise-card-e2/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(screen.getByText(/exercise-card-e1/)).toBeInTheDocument()
    expect(screen.getByText(/exercise-card-e2/)).toBeInTheDocument()
  })

  it('shows an empty state when the filters exclude every exercise', async () => {
    const user = userEvent.setup()
    setDefaults({ exercises: [{ id: 'e1', name: 'Rondo' }] })
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-exercises'))
    await screen.findByText(/exercise-card-e1/)

    await user.type(screen.getByPlaceholderText('Buscar por nombre, objetivo o categoría'), 'zzz-nada')
    expect(await screen.findByText('No hay ejercicios con esos filtros')).toBeInTheDocument()
  })

  it('paginates the exercise bank with "Mostrar más"', async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: 31 }, (_, i) => ({ id: `e${i}`, name: `Ejercicio ${i}` }))
    setDefaults({ exercises: many })
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-exercises'))
    await screen.findByText(/exercise-card-e0/)

    expect(screen.getByText('30 de 31 ejercicios')).toBeInTheDocument()
    expect(screen.queryByText(/exercise-card-e30/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Mostrar más/ }))
    expect(screen.getByText(/exercise-card-e30/)).toBeInTheDocument()
  })

  it('copies selected exercises to the clipboard, then pastes them back as new ones', async () => {
    const user = userEvent.setup()
    setDefaults({ exercises: [{ id: 'e1', name: 'Rondo', objective: 'Calentar', category: 'Principal', dimensions: '40x20' }] })
    api.createExercise.mockResolvedValue({ id: 'e2', name: 'Rondo' })
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-exercises'))
    await screen.findByText(/exercise-card-e1/)

    await user.click(screen.getByTitle('Seleccionar ejercicios'))
    await user.click(screen.getByText('select-e1'))
    await user.click(screen.getByRole('button', { name: /Copiar/ }))

    const pasteButton = await screen.findByRole('button', { name: /Pegar \(1\)/ })
    await user.click(pasteButton)
    expect(api.createExercise).toHaveBeenCalledWith(expect.objectContaining({ team_id: 't1', name: 'Rondo' }))
  })
})

describe('TeamPage — trainings', () => {
  it('creates a training via the planner and reloads the history', async () => {
    const user = userEvent.setup()
    setDefaults({ trainings: [] })
    api.createTraining.mockResolvedValue({ id: 'tr1' })
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-trainings'))
    await screen.findByText('trainings-page count:0')

    await user.click(screen.getByText('new-training'))
    await user.click(screen.getByText('submit-training'))

    expect(api.createTraining).toHaveBeenCalledWith(expect.objectContaining({ team_id: 't1', training_date: '2026-05-01' }))
  })

  it('edits a training: updates fields and replaces its items', async () => {
    const user = userEvent.setup()
    setDefaults({ trainings: [{ id: 'tr1', training_date: '2026-01-01' }] })
    api.updateTraining.mockResolvedValue({})
    api.replaceTrainingItems.mockResolvedValue(true)
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-trainings'))
    await screen.findByText('trainings-page count:1')

    await user.click(screen.getByText('edit-training'))
    await user.click(screen.getByText('submit-training'))

    expect(api.updateTraining).toHaveBeenCalledWith('tr1', expect.objectContaining({ training_date: '2026-05-01' }))
    expect(api.replaceTrainingItems).toHaveBeenCalledWith('tr1', [])
  })

  it('deletes a training after confirming', async () => {
    const user = userEvent.setup()
    setDefaults({ trainings: [{ id: 'tr1', training_date: '2026-01-01' }] })
    api.deleteTraining.mockResolvedValue()
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-trainings'))
    await screen.findByText('trainings-page count:1')

    await user.click(screen.getByText('delete-training'))
    await user.click(screen.getByText('confirm-yes'))
    expect(api.deleteTraining).toHaveBeenCalledWith('tr1')
  })

  it('exports a ficha-style training via exportTrainingFichaToPdf, and a plain one via exportTrainingToPdf', async () => {
    const user = userEvent.setup()
    setDefaults({ trainings: [{ id: 'tr1', training_date: '2026-01-01', objectives: { _ficha: { version: 2, teams: [{ name: 'A', player_ids: [] }, { name: 'B', player_ids: [] }, { name: 'C', player_ids: [] }] } }, items: [] }] })
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-trainings'))
    await screen.findByText('trainings-page count:1')

    await user.click(screen.getByText('export-training'))
    expect(exportTrainingFichaToPdf).toHaveBeenCalled()
    expect(exportTrainingToPdf).not.toHaveBeenCalled()
  })

  it('alerts instead of exporting a plain training with no exercises', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    setDefaults({ trainings: [{ id: 'tr1', training_date: '2026-01-01', items: [] }] })
    render(<TeamPage team={team} onBack={() => {}} />)
    await user.click(await screen.findByText('go-trainings'))
    await screen.findByText('trainings-page count:1')

    await user.click(screen.getByText('export-training'))
    expect(window.alert).toHaveBeenCalledWith('El entrenamiento no tiene ejercicios')
    expect(exportTrainingToPdf).not.toHaveBeenCalled()
  })
})
