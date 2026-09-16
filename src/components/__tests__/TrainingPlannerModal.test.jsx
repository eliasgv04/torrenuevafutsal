import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TrainingPlannerModal from '../TrainingPlannerModal'
import { writeFicha, buildItemNotes } from '../../lib/trainingFicha'
import { uploadPhoto } from '../../lib/api'

vi.mock('../../lib/api', () => ({ uploadPhoto: vi.fn() }))

const exercises = [
  { id: 'e1', name: 'Rondo', category: 'Inicio balón', objective: 'Calentar' },
  { id: 'e2', name: 'Circuito coordinativo', category: 'Movimientos tácticos/técnicos' },
  { id: 'e3', name: 'Posesión 4v2', category: 'Posesión', photo_url: 'http://cdn/e3.jpg' },
  { id: 'e4', name: 'Rondo Principal', category: 'Principal' },
  { id: 'e5', name: 'Finalización rápida', category: 'Principal' },
  { id: 'e6', name: 'Portero jugador', category: 'Defensa portero jugador' }
]

const players = [
  { id: 'p1', dorsal: 7, name: 'Ana', surname: 'García' },
  { id: 'p2', dorsal: 1, name: 'Luis', surname: 'B' }
]

class FakeFileReader {
  readAsDataURL(file){
    this.result = `data:image/png;base64,FAKE(${file.name})`
    if(this.onload) this.onload({ target: this })
  }
}

function inicioBlock(){
  return screen.getByText('1 · Inicio balón / Lúdico').closest('.planner-mov-block')
}

function mainBlock(){
  return screen.getByText('Parte principal').closest('.planner-section')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TrainingPlannerModal — header and initial data', () => {
  it('shows the create header with one empty slot per section by default', () => {
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Planificar entrenamiento')).toBeInTheDocument()
    expect(screen.getAllByText('— Selecciona ejercicio —').length).toBeGreaterThan(0)
  })

  it('shows the edit header and pre-fills fields from an existing training', () => {
    const initial = {
      training_date: '2026-05-01',
      notes: 'Nota interna',
      attending_players: ['p1'],
      objectives: writeFicha({}, {
        session_time: '18:00', duration: '90 min', place: 'Pabellón Torrenueva', rival: 'CD Manchego',
        video: '', equipment: 'Conos', session_objective: 'Transiciones',
        extra_attendees: [{ id: 'extra-1', name: 'Pepe' }],
        final_extra_text: 'Portero-jugador 5x4',
        teams: [{ name: 'Equipo 1', player_ids: ['p1'] }, { name: 'Equipo 2', player_ids: [] }, { name: 'Equipo 3', player_ids: [] }]
      }),
      items: [
        { exercise_id: 'e4', category: 'Principal', planned_count: 3, dimensions: '28x20', notes: buildItemNotes({ text: 'Nota ejercicio', extra_text: '', custom_photo_url: null }), order_index: 0 }
      ]
    }
    render(<TrainingPlannerModal exercises={exercises} players={players} initial={initial} onSave={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByText('Editar entrenamiento')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-05-01')).toBeInTheDocument()
    expect(screen.getByDisplayValue('90 min')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Pabellón Torrenueva')).toBeInTheDocument()
    expect(screen.getByDisplayValue('CD Manchego')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Nota interna')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Portero-jugador 5x4')).toBeInTheDocument()

    // attendance + extra attendee restored
    expect(screen.getByRole('checkbox', { name: /Ana/ })).toBeChecked()
    expect(document.querySelector('.planner-extra-pill')).toHaveTextContent('Pepe')

    // main slot pre-filled from items
    expect(screen.getByText('Rondo Principal')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Nota ejercicio')).toBeInTheDocument()
  })
})

describe('TrainingPlannerModal — attendance and extra attendees', () => {
  it('toggles attendance and updates the counter', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Asistencia (0)')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /Ana/ }))
    expect(screen.getByText('Asistencia (1)')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /Ana/ }))
    expect(screen.getByText('Asistencia (0)')).toBeInTheDocument()
  })

  it('adds an extra attendee via the button and via Enter, then removes one', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)

    const extraRow = document.querySelector('.planner-extra-row')
    const input = screen.getByPlaceholderText('Ej: Pepe (juvenil)')
    await user.type(input, 'Pepe')
    await user.click(within(extraRow).getByRole('button', { name: '+ Añadir' }))
    expect(document.querySelectorAll('.planner-extra-pill')).toHaveLength(1)
    expect(screen.getByText('Asistencia (1)')).toBeInTheDocument()

    await user.type(input, 'Marta{Enter}')
    expect(document.querySelectorAll('.planner-extra-pill')).toHaveLength(2)
    expect(screen.getByText('Asistencia (2)')).toBeInTheDocument()

    const pepePill = [...document.querySelectorAll('.planner-extra-pill')].find((li) => li.textContent.includes('Pepe'))
    await user.click(within(pepePill).getByRole('button', { name: '×' }))
    expect(document.querySelectorAll('.planner-extra-pill')).toHaveLength(1)
    expect(screen.getByText('Asistencia (1)')).toBeInTheDocument()
  })

  it('does not add a blank extra attendee', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    const extraRow = document.querySelector('.planner-extra-row')
    await user.click(within(extraRow).getByRole('button', { name: '+ Añadir' }))
    expect(screen.getByText('Asistencia (0)')).toBeInTheDocument()
  })
})

describe('TrainingPlannerModal — teams', () => {
  it('assigns an attending player to a team and then clears them by clicking the same button again', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('checkbox', { name: /Ana/ }))

    const assignRow = screen.getByText('#7 Ana').closest('.planner-team-assign-row')
    await user.click(within(assignRow).getByRole('button', { name: '1' }))

    const teamCards = document.querySelectorAll('.planner-team-card')
    expect(within(teamCards[0]).getByText(/Ana/)).toBeInTheDocument()

    await user.click(within(assignRow).getByRole('button', { name: '1' }))
    expect(within(teamCards[0]).queryByText(/Ana/)).not.toBeInTheDocument()
    expect(within(teamCards[0]).getByText('(vacío)')).toBeInTheDocument()
  })

  it('removes a player from their team via the pill × button', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('checkbox', { name: /Ana/ }))
    const assignRow = screen.getByText('#7 Ana').closest('.planner-team-assign-row')
    await user.click(within(assignRow).getByRole('button', { name: '1' }))

    const teamCards = document.querySelectorAll('.planner-team-card')
    await user.click(within(teamCards[0]).getByRole('button', { name: '×' }))
    expect(within(teamCards[0]).getByText('(vacío)')).toBeInTheDocument()
  })

  it('un-attending a player removes them from their assigned team', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('checkbox', { name: /Ana/ }))
    const assignRow = screen.getByText('#7 Ana').closest('.planner-team-assign-row')
    await user.click(within(assignRow).getByRole('button', { name: '1' }))

    await user.click(screen.getByRole('checkbox', { name: /Ana/ }))
    const teamCards = document.querySelectorAll('.planner-team-card')
    expect(within(teamCards[0]).getByText('(vacío)')).toBeInTheDocument()
  })

  it('removing an extra attendee also removes them from their team', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Ej: Pepe (juvenil)'), 'Pepe{Enter}')

    // No players are attending in this test, so ".planner-team-assign-name" only ever matches Pepe's row.
    const assignRow = document.querySelector('.planner-team-assign-name').closest('.planner-team-assign-row')
    await user.click(within(assignRow).getByRole('button', { name: '1' }))
    const teamCards = document.querySelectorAll('.planner-team-card')
    expect(within(teamCards[0]).getByText('Pepe')).toBeInTheDocument()

    const extraPill = document.querySelector('.planner-extra-pill')
    await user.click(within(extraPill).getByRole('button', { name: '×' }))

    expect(screen.queryByText('Pepe')).not.toBeInTheDocument()
    expect(within(teamCards[0]).getByText('(vacío)')).toBeInTheDocument()
  })
})

describe('TrainingPlannerModal — slot groups', () => {
  it('adds a slot, and only a slot with an exercise selected shows a "Quitar" button', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    const block = inicioBlock()

    await user.click(within(block).getByRole('button', { name: '— Selecciona ejercicio —' }))
    await user.click(screen.getByText('Rondo'))
    await user.click(within(block).getByRole('button', { name: '+ Añadir' }))

    expect(within(block).getAllByText('— Selecciona ejercicio —')).toHaveLength(1) // the new, still-empty slot
    expect(within(block).getAllByRole('button', { name: 'Quitar' })).toHaveLength(1) // only the filled one

    await user.click(within(block).getByRole('button', { name: 'Quitar' }))
    expect(within(block).getByText('— Selecciona ejercicio —')).toBeInTheDocument()
    expect(within(block).queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument()
  })

  it('resets a lone empty slot to "Vaciar" and hides the clear button once truly empty with nothing to clear', () => {
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    const block = inicioBlock()
    // a single empty slot with no exercise selected shows no clear button at all
    expect(within(block).queryByRole('button', { name: 'Vaciar' })).not.toBeInTheDocument()
    expect(within(block).queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument()
  })
})

describe('TrainingPlannerModal — exercise picker', () => {
  it('opens, filters by search, and selects an exercise by click', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    const block = inicioBlock()

    await user.click(within(block).getByRole('button', { name: '— Selecciona ejercicio —' }))
    expect(screen.getByPlaceholderText('Buscar ejercicio...')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Buscar ejercicio...'), 'Rondo')
    expect(screen.getByText('Rondo')).toBeInTheDocument()

    await user.click(screen.getByText('Rondo'))
    expect(within(block).getByRole('button', { name: 'Rondo' })).toBeInTheDocument()
  })

  it('shows "Sin coincidencias" when the search matches nothing', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    const block = inicioBlock()
    await user.click(within(block).getByRole('button', { name: '— Selecciona ejercicio —' }))
    await user.type(screen.getByPlaceholderText('Buscar ejercicio...'), 'zzz-nope')
    expect(screen.getByText('Sin coincidencias')).toBeInTheDocument()
  })

  it('navigates and selects with the keyboard (ArrowDown + Enter)', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    const block = inicioBlock()
    await user.click(within(block).getByRole('button', { name: '— Selecciona ejercicio —' }))
    // Only one exercise is categorized as "Inicio balón" (Rondo), so ArrowDown then Enter picks it.
    await user.keyboard('{ArrowDown}{Enter}')
    expect(within(block).getByRole('button', { name: 'Rondo' })).toBeInTheDocument()
  })

  it('closes the dropdown on Escape without selecting anything', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    const block = inicioBlock()
    await user.click(within(block).getByRole('button', { name: '— Selecciona ejercicio —' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByPlaceholderText('Buscar ejercicio...')).not.toBeInTheDocument()
    expect(within(block).getByRole('button', { name: '— Selecciona ejercicio —' })).toBeInTheDocument()
  })

  it('closes the dropdown when clicking outside it', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    const block = inicioBlock()
    await user.click(within(block).getByRole('button', { name: '— Selecciona ejercicio —' }))
    expect(screen.getByPlaceholderText('Buscar ejercicio...')).toBeInTheDocument()

    await user.click(screen.getByText('Datos de la sesión'))
    expect(screen.queryByPlaceholderText('Buscar ejercicio...')).not.toBeInTheDocument()
  })

  it('shows the exercise photo thumbnail in the posesión slot once an exercise with a photo is picked', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    const block = screen.getByText('3 · Posesión').closest('.planner-mov-block')
    await user.click(within(block).getByRole('button', { name: '— Selecciona ejercicio —' }))
    await user.click(screen.getByText('Posesión 4v2'))
    // alt="" gives the <img> a "presentation" role, not "img" — query by tag instead.
    expect(block.querySelector('.planner-slot-thumb img')).toHaveAttribute('src', 'http://cdn/e3.jpg')
  })
})

describe('TrainingPlannerModal — main section (full slot detail)', () => {
  it('shows planned count, dimensions and notes once an exercise is selected in the main slot', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
    await user.click(within(mainBlock()).getByRole('button', { name: '— Selecciona ejercicio —' }))
    await user.click(screen.getByText('Rondo Principal'))

    expect(screen.getByPlaceholderText('Veces')).toHaveValue(1)
    expect(screen.getByDisplayValue('40x20')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Notas para este ejercicio')).toBeInTheDocument()
  })

  it('adds and reorders main slots with the up/down arrow buttons', async () => {
    const user = userEvent.setup()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '+ Añadir ejercicio' }))
    const wraps = document.querySelectorAll('.planner-main-slot-wrap')
    expect(wraps).toHaveLength(2)

    await user.click(within(wraps[0]).getByRole('button', { name: '— Selecciona ejercicio —' }))
    await user.click(screen.getByText('Rondo Principal'))
    await user.click(within(wraps[1]).getByRole('button', { name: '— Selecciona ejercicio —' }))
    await user.click(screen.getByText('Finalización rápida'))

    expect(within(wraps[0]).getByRole('button', { name: 'Mover arriba' })).toBeDisabled()
    await user.click(within(wraps[0]).getByRole('button', { name: 'Mover abajo' }))

    const namesAfter = [...document.querySelectorAll('.planner-main-slot-wrap')].map((w) => w.querySelector('.picker-text').textContent)
    expect(namesAfter).toEqual(['Finalización rápida', 'Rondo Principal'])
  })

  it('uploads and clears a custom photo for a main slot', async () => {
    const originalFileReader = global.FileReader
    global.FileReader = FakeFileReader
    try{
      const user = userEvent.setup()
      render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={vi.fn()} />)
      await user.click(within(mainBlock()).getByRole('button', { name: '— Selecciona ejercicio —' }))
      await user.click(screen.getByText('Rondo Principal'))

      const file = new File(['x'], 'foto.png', { type: 'image/png' })
      const fileInput = document.querySelector('input[type="file"]')
      await user.upload(fileInput, file)

      const img = await screen.findByAltText('custom')
      expect(img).toHaveAttribute('src', 'data:image/png;base64,FAKE(foto.png)')

      await user.click(screen.getByRole('button', { name: 'Quitar foto' }))
      expect(screen.queryByAltText('custom')).not.toBeInTheDocument()
    }finally{
      global.FileReader = originalFileReader
    }
  })
})

describe('TrainingPlannerModal — submit', () => {
  it('builds items in section order, skips empty slots, and calls onSave with the ficha payload', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={onSave} onCancel={vi.fn()} />)

    // pick exercise in "Inicio balón" (first section)
    const inicio = inicioBlock()
    await user.click(within(inicio).getByRole('button', { name: '— Selecciona ejercicio —' }))
    await user.click(screen.getByText('Rondo'))

    // pick exercise in main section, with a custom planned_count/dimensions/notes
    await user.click(within(mainBlock()).getByRole('button', { name: '— Selecciona ejercicio —' }))
    await user.click(screen.getByText('Rondo Principal'))
    const countInput = screen.getByPlaceholderText('Veces')
    await user.clear(countInput)
    await user.type(countInput, '3')
    await user.type(screen.getByPlaceholderText('Notas para este ejercicio'), 'Insistir en apoyos')

    await user.click(screen.getByRole('checkbox', { name: /Ana/ }))
    await user.type(screen.getByPlaceholderText('Ej: Pabellón Torrenueva'), 'Pabellón Torrenueva')

    await user.click(screen.getByRole('button', { name: 'Guardar entrenamiento' }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.selected_players).toEqual(['p1'])
    expect(payload.warmup).toBe('')
    expect(payload.objectives._ficha.place).toBe('Pabellón Torrenueva')
    expect(payload.items).toHaveLength(2)
    expect(payload.items[0]).toMatchObject({ exercise_id: 'e1', exercise_name: 'Rondo', order_index: 0 })
    expect(payload.items[1]).toMatchObject({ exercise_id: 'e4', exercise_name: 'Rondo Principal', planned_count: 3, dimensions: '40x20', order_index: 1 })
    expect(payload.items[1].notes).toContain('Insistir en apoyos')
  })

  it('uploads a pending custom photo before saving and embeds the resulting URL in the item notes', async () => {
    const originalFileReader = global.FileReader
    global.FileReader = FakeFileReader
    try{
      const user = userEvent.setup()
      const onSave = vi.fn()
      uploadPhoto.mockResolvedValue('http://cdn/uploaded.jpg')
      render(<TrainingPlannerModal exercises={exercises} players={players} onSave={onSave} onCancel={vi.fn()} />)

      await user.click(within(mainBlock()).getByRole('button', { name: '— Selecciona ejercicio —' }))
      await user.click(screen.getByText('Rondo Principal'))
      const file = new File(['x'], 'foto.png', { type: 'image/png' })
      await user.upload(document.querySelector('input[type="file"]'), file)
      await screen.findByAltText('custom')

      await user.click(screen.getByRole('button', { name: 'Guardar entrenamiento' }))

      expect(uploadPhoto).toHaveBeenCalledWith(file)
      const payload = onSave.mock.calls[0][0]
      expect(payload.items[0].notes).toContain('http://cdn/uploaded.jpg')
    }finally{
      global.FileReader = originalFileReader
    }
  })

  it('alerts and does not call onSave when the photo upload fails', async () => {
    const originalFileReader = global.FileReader
    global.FileReader = FakeFileReader
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try{
      const user = userEvent.setup()
      const onSave = vi.fn()
      uploadPhoto.mockRejectedValue(new Error('boom'))
      render(<TrainingPlannerModal exercises={exercises} players={players} onSave={onSave} onCancel={vi.fn()} />)

      await user.click(within(mainBlock()).getByRole('button', { name: '— Selecciona ejercicio —' }))
      await user.click(screen.getByText('Rondo Principal'))
      const file = new File(['x'], 'foto.png', { type: 'image/png' })
      await user.upload(document.querySelector('input[type="file"]'), file)
      await screen.findByAltText('custom')

      await user.click(screen.getByRole('button', { name: 'Guardar entrenamiento' }))

      expect(await screen.findByRole('button', { name: 'Guardar entrenamiento' })).toBeEnabled()
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('boom'))
      expect(onSave).not.toHaveBeenCalled()
    }finally{
      global.FileReader = originalFileReader
    }
  })

  it('calls onCancel from the Cancelar button', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<TrainingPlannerModal exercises={exercises} players={players} onSave={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
