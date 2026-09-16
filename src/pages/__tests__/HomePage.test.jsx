import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HomePage from '../HomePage'

const openTeamSpy = vi.hoisted(() => vi.fn())
const backSpy = vi.hoisted(() => vi.fn())

vi.mock('../../components/TeamList', () => ({
  default: ({ onOpen }) => <button onClick={() => onOpen({ id: 't1', name: 'Torrenueva' })}>abrir-equipo</button>
}))
vi.mock('../../components/TeamPage', () => ({
  default: ({ team, onBack }) => <div>Página de {team.name}<button onClick={onBack}>volver</button></div>
}))

describe('HomePage', () => {
  it('shows the team list by default', () => {
    render(<HomePage />)
    expect(screen.getByText('abrir-equipo')).toBeInTheDocument()
  })

  it('switches to the team page and notifies the parent when a team is opened', async () => {
    const user = userEvent.setup()
    const onActiveTeamChange = vi.fn()
    render(<HomePage onActiveTeamChange={onActiveTeamChange} />)

    await user.click(screen.getByText('abrir-equipo'))

    expect(screen.getByText('Página de Torrenueva')).toBeInTheDocument()
    expect(onActiveTeamChange).toHaveBeenCalledWith({ id: 't1', name: 'Torrenueva' })
  })

  it('goes back to the team list and notifies with null', async () => {
    const user = userEvent.setup()
    const onActiveTeamChange = vi.fn()
    render(<HomePage onActiveTeamChange={onActiveTeamChange} />)

    await user.click(screen.getByText('abrir-equipo'))
    await user.click(screen.getByText('volver'))

    expect(screen.getByText('abrir-equipo')).toBeInTheDocument()
    expect(onActiveTeamChange).toHaveBeenLastCalledWith(null)
  })

  it('does not crash when onActiveTeamChange is not provided', async () => {
    const user = userEvent.setup()
    render(<HomePage />)
    await user.click(screen.getByText('abrir-equipo'))
    expect(screen.getByText('Página de Torrenueva')).toBeInTheDocument()
  })
})
