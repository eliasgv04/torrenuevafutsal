import { vi, describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeamBrandingModal from '../TeamBrandingModal'

describe('TeamBrandingModal — create mode (no team prop)', () => {
  it('requires a name before the create button is enabled', async () => {
    const user = userEvent.setup()
    render(<TeamBrandingModal onSave={() => {}} onCancel={() => {}} />)

    const createBtn = screen.getByRole('button', { name: 'Crear equipo' })
    expect(createBtn).toBeDisabled()

    await user.type(screen.getByPlaceholderText('Ej: Torrenueva Futsal'), 'CD Manchego')
    expect(createBtn).not.toBeDisabled()
  })

  it('submits the trimmed name and the default gradient', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(() => Promise.resolve())
    render(<TeamBrandingModal onSave={onSave} onCancel={() => {}} />)

    await user.type(screen.getByPlaceholderText('Ej: Torrenueva Futsal'), '  CD Manchego  ')
    await user.click(screen.getByRole('button', { name: 'Crear equipo' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'CD Manchego', gradient_start: '#1E3A8A', gradient_end: '#2563EB', file: null, removed: false
    }))
  })

  it('picking a color preset marks it active and is included on submit', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(() => Promise.resolve())
    render(<TeamBrandingModal onSave={onSave} onCancel={() => {}} />)

    await user.type(screen.getByPlaceholderText('Ej: Torrenueva Futsal'), 'x')
    const rojo = screen.getByRole('button', { name: 'Rojo' })
    await user.click(rojo)
    expect(rojo.className).toContain('active')

    await user.click(screen.getByRole('button', { name: 'Crear equipo' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ gradient_start: '#7F1D1D', gradient_end: '#DC2626' }))
  })
})

describe('TeamBrandingModal — edit mode (existing team)', () => {
  const team = { name: 'Torrenueva', gradient_start: '#1E3A8A', gradient_end: '#2563EB', crest_url: 'http://x/crest.png' }

  it('shows the personalize title and no name field', () => {
    render(<TeamBrandingModal team={team} onSave={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Personalizar Torrenueva')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Ej: Torrenueva Futsal')).not.toBeInTheDocument()
  })

  it('the save button is enabled even without touching anything', () => {
    render(<TeamBrandingModal team={team} onSave={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).not.toBeDisabled()
  })

  it('removing the existing crest marks removed:true on save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(() => Promise.resolve())
    render(<TeamBrandingModal team={team} onSave={onSave} onCancel={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Eliminar escudo' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ file: null, removed: true }))
  })

  it('calls onCancel when clicking Cancelar', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<TeamBrandingModal team={team} onSave={() => {}} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
