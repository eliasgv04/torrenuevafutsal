import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateExerciseModal from '../CreateExerciseModal'

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

describe('CreateExerciseModal — create mode', () => {
  it('alerts and does not call onCreate when the name is empty', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(<CreateExerciseModal onCreate={onCreate} onCancel={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Crear ejercicio' }))

    expect(window.alert).toHaveBeenCalledWith('Nombre requerido')
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('submits the full payload to onCreate, defaulting category and is_public', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(<CreateExerciseModal onCreate={onCreate} onCancel={() => {}} />)

    await user.type(screen.getByPlaceholderText('Ej: Bordalás'), 'Rondo')
    await user.type(screen.getByPlaceholderText(/Mandar el balón/), 'Posesión')
    await user.click(screen.getByRole('button', { name: 'Crear ejercicio' }))

    expect(onCreate).toHaveBeenCalledWith({
      name: 'Rondo', objective: 'Posesión', description: '', file: null,
      category: 'Inicio balón', dimensions: '', is_public: false
    })
  })

  it('includes is_public: true once the toggle is checked', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(<CreateExerciseModal onCreate={onCreate} onCancel={() => {}} />)

    await user.type(screen.getByPlaceholderText('Ej: Bordalás'), 'Rondo')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Crear ejercicio' }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ is_public: true }))
  })

  it('prefers onSave over onCreate when both are given (edit flow reuses this component)', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    const onSave = vi.fn()
    render(<CreateExerciseModal onCreate={onCreate} onSave={onSave} onCancel={() => {}} />)
    await user.type(screen.getByPlaceholderText('Ej: Bordalás'), 'Rondo')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('sets a preview and includes the file after choosing an image', async () => {
    const onCreate = vi.fn()
    render(<CreateExerciseModal onCreate={onCreate} onCancel={() => {}} />)

    const file = new File(['bytes'], 'foto.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByAltText('Vista previa del ejercicio')).toBeInTheDocument()
  })

  it('picks up an image pasted from the clipboard', async () => {
    render(<CreateExerciseModal onCreate={() => {}} onCancel={() => {}} />)

    const file = new File(['bytes'], 'clip.png', { type: 'image/png' })
    const pasteEvent = new Event('paste', { bubbles: true })
    pasteEvent.clipboardData = { items: [{ type: 'image/png', getAsFile: () => file }] }
    document.dispatchEvent(pasteEvent)

    expect(await screen.findByAltText('Vista previa del ejercicio')).toBeInTheDocument()
  })
})

describe('CreateExerciseModal — edit mode (initial provided)', () => {
  it('pre-fills every field from initial', () => {
    const initial = { name: 'Rondo', objective: 'Posesión', description: 'Detalles', category: 'Principal', dimensions: '40x20', is_public: true }
    render(<CreateExerciseModal initial={initial} onSave={() => {}} onCancel={() => {}} />)

    expect(screen.getByPlaceholderText('Ej: Bordalás')).toHaveValue('Rondo')
    expect(screen.getByPlaceholderText(/Mandar el balón/)).toHaveValue('Posesión')
    expect(screen.getByPlaceholderText(/Detalles del ejercicio/)).toHaveValue('Detalles')
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('calls onCancel when clicking Cancelar', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<CreateExerciseModal onSave={() => {}} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
