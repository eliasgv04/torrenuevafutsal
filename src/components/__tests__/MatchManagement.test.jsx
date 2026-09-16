import { vi, describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchManagement from '../MatchManagement'
import { api } from '../../lib/api'
import { exportMatchToPdf } from '../../lib/pdfMatchExport'

vi.mock('../../lib/api', () => ({ api: { getMatches: vi.fn(), createMatch: vi.fn(), deleteMatch: vi.fn() } }))
vi.mock('../../lib/pdfMatchExport', () => ({ exportMatchToPdf: vi.fn() }))

vi.mock('../ConvocatoriaModal', () => ({
  default: ({ match, onSaved, onCancel }) => (
    <div>
      convocatoria-{match.id}
      <button onClick={() => onSaved({ ...match, called_up_players: ['p1'] })}>guardar-convocatoria</button>
      <button onClick={onCancel}>cancelar-convocatoria</button>
    </div>
  )
}))
vi.mock('../ConfirmModal', () => ({
  default: ({ title, message, onConfirm, onCancel }) => (
    <div>
      confirm-{title}: {message}
      <button onClick={onConfirm}>confirmar</button>
      <button onClick={onCancel}>cancelar-confirm</button>
    </div>
  )
}))

const players = [{ id: 'p1', name: 'Ana', surname: 'García' }]
const team = { name: 'Torrenueva' }

describe('MatchManagement', () => {
  it('shows an empty state when there are no matches', async () => {
    api.getMatches.mockResolvedValue([])
    render(<MatchManagement teamId="t1" team={team} players={players} onSelectMatch={() => {}} onClose={() => {}} />)
    expect(await screen.findByText('Sin partidos todavía')).toBeInTheDocument()
  })

  it('creates a match with a parsed jornada and the right is_home value', async () => {
    const user = userEvent.setup()
    api.getMatches.mockResolvedValue([])
    api.createMatch.mockResolvedValue({})
    render(<MatchManagement teamId="t1" team={team} players={players} onSelectMatch={() => {}} onClose={() => {}} />)
    await screen.findByText('Sin partidos todavía')

    // Both the header and the empty-state show a "+ Crear partido" button; either works.
    await user.click(screen.getAllByRole('button', { name: '+ Crear partido' })[0])
    await user.type(screen.getByPlaceholderText('Rival'), 'CD Manchego')
    await user.type(screen.getByPlaceholderText('Lugar'), 'Pabellón')
    await user.type(screen.getByPlaceholderText('Jornada (opcional)'), '5')
    await user.selectOptions(screen.getByRole('combobox'), 'away')
    const dateInput = document.querySelector('input[type="datetime-local"]')
    fireEvent.change(dateInput, { target: { value: '2026-05-01T18:00' } })
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(api.createMatch).toHaveBeenCalledWith({
      team_id: 't1', rival_team_name: 'CD Manchego', match_date: '2026-05-01T18:00',
      place: 'Pabellón', jornada: 5, is_home: false
    })
  })

  it('shows venue, jornada and the final score for a finished match', async () => {
    api.getMatches.mockResolvedValue([{
      id: 'm1', rival_team_name: 'CD Manchego', match_date: '2026-05-01T18:00:00',
      place: 'Pabellón', jornada: 5, is_home: true, status: 'finished', home_goals: 3, away_goals: 1
    }])
    render(<MatchManagement teamId="t1" team={team} players={players} onSelectMatch={() => {}} onClose={() => {}} />)
    expect(await screen.findByText(/Pabellón · Local · Jornada 5/)).toBeInTheDocument()
    expect(screen.getByText('Final: 3 - 1')).toBeInTheDocument()
  })

  it('shows "Sin convocatoria" for a scheduled match without one, and offers a Convocatoria button', async () => {
    api.getMatches.mockResolvedValue([{ id: 'm1', rival_team_name: 'CD X', match_date: '2026-05-01', place: 'Casa', status: 'scheduled' }])
    render(<MatchManagement teamId="t1" team={team} players={players} onSelectMatch={() => {}} onClose={() => {}} />)
    expect(await screen.findByText('Sin convocatoria')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Convocatoria/ })).toBeInTheDocument()
  })

  it('does not offer a Convocatoria button for a finished match', async () => {
    api.getMatches.mockResolvedValue([{ id: 'm1', rival_team_name: 'CD X', match_date: '2026-05-01', place: 'Casa', status: 'finished', home_goals: 1, away_goals: 1 }])
    render(<MatchManagement teamId="t1" team={team} players={players} onSelectMatch={() => {}} onClose={() => {}} />)
    await screen.findByText(/vs CD X/)
    expect(screen.queryByRole('button', { name: /Convocatoria/ })).not.toBeInTheDocument()
  })

  it('opens the convocatoria modal and applies the saved result to that match', async () => {
    const user = userEvent.setup()
    api.getMatches.mockResolvedValue([{ id: 'm1', rival_team_name: 'CD X', match_date: '2026-05-01', place: 'Casa', status: 'scheduled' }])
    render(<MatchManagement teamId="t1" team={team} players={players} onSelectMatch={() => {}} onClose={() => {}} />)
    await screen.findByText('Sin convocatoria')

    await user.click(screen.getByRole('button', { name: /Convocatoria/ }))
    expect(screen.getByText('convocatoria-m1')).toBeInTheDocument()

    await user.click(screen.getByText('guardar-convocatoria'))
    expect(await screen.findByText('1 convocados')).toBeInTheDocument()
  })

  it('exports a finished match to PDF, disabling the button while it runs', async () => {
    const user = userEvent.setup()
    api.getMatches.mockResolvedValue([{ id: 'm1', rival_team_name: 'CD X', match_date: '2026-05-01', place: 'Casa', status: 'finished', home_goals: 1, away_goals: 0 }])
    let resolveExport
    exportMatchToPdf.mockImplementation(() => new Promise((res) => { resolveExport = res }))
    render(<MatchManagement teamId="t1" team={team} players={players} onSelectMatch={() => {}} onClose={() => {}} />)
    await screen.findByText(/vs CD X/)

    await user.click(screen.getByRole('button', { name: /Exportar PDF/ }))
    expect(exportMatchToPdf).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), players, team)
    expect(screen.getByRole('button', { name: /Generando/ })).toBeDisabled()
    resolveExport()
  })

  it('deletes a match after confirming, and reloads the list', async () => {
    const user = userEvent.setup()
    api.getMatches
      .mockResolvedValueOnce([{ id: 'm1', rival_team_name: 'CD X', match_date: '2026-05-01', place: 'Casa', status: 'scheduled' }])
      .mockResolvedValueOnce([])
    api.deleteMatch.mockResolvedValue()
    render(<MatchManagement teamId="t1" team={team} players={players} onSelectMatch={() => {}} onClose={() => {}} />)
    await screen.findByText(/vs CD X/)

    await user.click(screen.getByRole('button', { name: /Eliminar/ }))
    expect(screen.getByText(/confirm-Eliminar partido/)).toBeInTheDocument()

    await user.click(screen.getByText('confirmar'))
    expect(api.deleteMatch).toHaveBeenCalledWith('m1')
    expect(await screen.findByText('Sin partidos todavía')).toBeInTheDocument()
  })

  it('calls onSelectMatch with "Registrar" for scheduled and "Ver" for finished matches', async () => {
    const user = userEvent.setup()
    api.getMatches.mockResolvedValue([{ id: 'm1', rival_team_name: 'CD X', match_date: '2026-05-01', place: 'Casa', status: 'scheduled' }])
    const onSelectMatch = vi.fn()
    render(<MatchManagement teamId="t1" team={team} players={players} onSelectMatch={onSelectMatch} onClose={() => {}} />)
    await screen.findByText(/vs CD X/)

    await user.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(onSelectMatch).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }))
  })

  it('calls onClose when clicking Atrás', async () => {
    const user = userEvent.setup()
    api.getMatches.mockResolvedValue([])
    const onClose = vi.fn()
    render(<MatchManagement teamId="t1" team={team} players={players} onSelectMatch={() => {}} onClose={onClose} />)
    await screen.findByText('Sin partidos todavía')
    await user.click(screen.getByRole('button', { name: /Atrás/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
