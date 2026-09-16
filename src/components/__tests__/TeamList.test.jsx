import { vi, describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeamList from '../TeamList'
import { api, uploadPhoto } from '../../lib/api'

vi.mock('../../lib/api', () => ({
  api: { getTeams: vi.fn(), deleteTeam: vi.fn(), createTeam: vi.fn(), updateTeam: vi.fn() },
  uploadPhoto: vi.fn()
}))

vi.mock('../TeamBrandingModal', () => ({
  default: ({ team, onSave, onCancel }) => (
    <div>
      branding-modal-{team ? 'edit' : 'create'}
      <button onClick={() => onSave({ name: 'Nuevo CD', gradient_start: '#000', gradient_end: '#111', file: null, removed: false })}>guardar-branding</button>
      <button onClick={onCancel}>cancelar-branding</button>
    </div>
  )
}))

vi.mock('../ConfirmModal', () => ({
  default: ({ title, onConfirm, onCancel }) => (
    <div>
      confirm-{title}
      <button onClick={onConfirm}>confirmar-borrado</button>
      <button onClick={onCancel}>cancelar-borrado</button>
    </div>
  )
}))

describe('TeamList', () => {
  it('loads and shows teams from the API', async () => {
    api.getTeams.mockResolvedValue([{ id: 't1', name: 'Torrenueva' }])
    render(<TeamList onOpen={() => {}} />)
    expect(await screen.findByText('Torrenueva')).toBeInTheDocument()
  })

  it('shows an empty state when there are no teams', async () => {
    api.getTeams.mockResolvedValue([])
    render(<TeamList onOpen={() => {}} />)
    expect(await screen.findByText('No hay equipos aún')).toBeInTheDocument()
  })

  it('opens a team when its card is clicked', async () => {
    const user = userEvent.setup()
    api.getTeams.mockResolvedValue([{ id: 't1', name: 'Torrenueva' }])
    const onOpen = vi.fn()
    render(<TeamList onOpen={onOpen} />)
    await user.click(await screen.findByText('Torrenueva'))
    expect(onOpen).toHaveBeenCalledWith({ id: 't1', name: 'Torrenueva' })
  })

  it('deleting a team asks for confirmation without opening it, then removes it from the list', async () => {
    const user = userEvent.setup()
    api.getTeams.mockResolvedValue([{ id: 't1', name: 'Torrenueva' }])
    api.deleteTeam.mockResolvedValue()
    const onOpen = vi.fn()
    render(<TeamList onOpen={onOpen} />)
    await screen.findByText('Torrenueva')

    await user.click(screen.getByRole('button', { name: 'Eliminar equipo' }))
    expect(onOpen).not.toHaveBeenCalled() // stopPropagation kept the card click from firing too
    expect(screen.getByText('confirm-Eliminar Torrenueva')).toBeInTheDocument()

    await user.click(screen.getByText('confirmar-borrado'))
    expect(api.deleteTeam).toHaveBeenCalledWith('t1')
    expect(screen.queryByText('Torrenueva')).not.toBeInTheDocument()
  })

  it('creating a team uploads the photo (if any) and adds the result to the list', async () => {
    const user = userEvent.setup()
    api.getTeams.mockResolvedValue([])
    uploadPhoto.mockResolvedValue('http://x/crest.png')
    api.createTeam.mockResolvedValue({ id: 't-new', name: 'Nuevo CD', crest_url: 'http://x/crest.png' })
    render(<TeamList onOpen={() => {}} />)
    await screen.findByText('No hay equipos aún')

    await user.click(screen.getByRole('button', { name: '+ Nuevo equipo' }))
    expect(screen.getByText('branding-modal-create')).toBeInTheDocument()

    await user.click(screen.getByText('guardar-branding'))

    expect(api.createTeam).toHaveBeenCalledWith('Nuevo CD', { gradient_start: '#000', gradient_end: '#111', crest_url: null })
    expect(await screen.findByText('Nuevo CD')).toBeInTheDocument()
  })

  it('editing branding updates the existing team in place', async () => {
    const user = userEvent.setup()
    api.getTeams.mockResolvedValue([{ id: 't1', name: 'Torrenueva', crest_url: null }])
    api.updateTeam.mockResolvedValue({ name: 'Nuevo CD' })
    render(<TeamList onOpen={() => {}} />)
    await screen.findByText('Torrenueva')

    await user.click(screen.getByRole('button', { name: 'Personalizar equipo' }))
    expect(screen.getByText('branding-modal-edit')).toBeInTheDocument()

    await user.click(screen.getByText('guardar-branding'))

    expect(api.updateTeam).toHaveBeenCalledWith('t1', { gradient_start: '#000', gradient_end: '#111', crest_url: null })
    expect(await screen.findByText('Nuevo CD')).toBeInTheDocument()
  })
})
