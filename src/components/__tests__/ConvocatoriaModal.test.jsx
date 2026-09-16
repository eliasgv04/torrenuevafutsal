import { vi, describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConvocatoriaModal from '../ConvocatoriaModal'
import { api } from '../../lib/api'

vi.mock('../../lib/api', () => ({ api: { updateCalledUpPlayers: vi.fn() } }))

const players = [
  { id: 'p1', name: 'Luis', surname: 'A', dorsal: 10, position: 'Pivot' },
  { id: 'p2', name: 'Ana', surname: 'B', dorsal: 1, position: 'Portero' },
  { id: 'p3', name: 'Marc', surname: 'C', dorsal: 5, position: 'Cierre' }
]
const match = { id: 'm1', rival_team_name: 'CD Manchego' }

describe('ConvocatoriaModal', () => {
  it('defaults to everyone called up when the match has no convocatoria yet', () => {
    render(<ConvocatoriaModal match={match} players={players} onSaved={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('3 / 3 convocados')).toBeInTheDocument()
  })

  it('respects an existing convocatoria', () => {
    render(<ConvocatoriaModal match={{ ...match, called_up_players: ['p1'] }} players={players} onSaved={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('1 / 3 convocados')).toBeInTheDocument()
  })

  it('sorts the roster by position (Portero, Cierre, ..., Pivot) then dorsal', () => {
    render(<ConvocatoriaModal match={match} players={players} onSaved={() => {}} onCancel={() => {}} />)
    const names = screen.getAllByText(/^(Luis|Ana|Marc)/).map(el => el.textContent)
    expect(names).toEqual(['Ana B', 'Marc C', 'Luis A']) // Portero, Cierre, Pivot
  })

  it('toggling a checkbox updates the convocados count', async () => {
    const user = userEvent.setup()
    render(<ConvocatoriaModal match={match} players={players} onSaved={() => {}} onCancel={() => {}} />)
    await user.click(screen.getByRole('checkbox', { name: /Ana B/ }))
    expect(screen.getByText('2 / 3 convocados')).toBeInTheDocument()
  })

  it('Todos and Ninguno set the whole selection at once', async () => {
    const user = userEvent.setup()
    render(<ConvocatoriaModal match={{ ...match, called_up_players: [] }} players={players} onSaved={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('0 / 3 convocados')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Todos' }))
    expect(screen.getByText('3 / 3 convocados')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ninguno' }))
    expect(screen.getByText('0 / 3 convocados')).toBeInTheDocument()
  })

  it('saves the selected ids and calls onSaved with the result', async () => {
    const user = userEvent.setup()
    api.updateCalledUpPlayers.mockResolvedValueOnce({ id: 'm1', called_up_players: ['p2'] })
    const onSaved = vi.fn()
    render(<ConvocatoriaModal match={{ ...match, called_up_players: ['p2'] }} players={players} onSaved={onSaved} onCancel={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Guardar convocatoria' }))

    expect(api.updateCalledUpPlayers).toHaveBeenCalledWith({ match_id: 'm1', player_ids: ['p2'] })
    expect(onSaved).toHaveBeenCalledWith({ id: 'm1', called_up_players: ['p2'] })
  })

  it('shows an empty-roster message when there are no players', () => {
    render(<ConvocatoriaModal match={match} players={[]} onSaved={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('No hay jugadores en la plantilla todavía.')).toBeInTheDocument()
  })

  it('calls onCancel when clicking Cancelar', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ConvocatoriaModal match={match} players={players} onSaved={() => {}} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
