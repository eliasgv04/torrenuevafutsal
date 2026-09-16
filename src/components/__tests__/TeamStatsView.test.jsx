import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeamStatsView from '../TeamStatsView'

vi.mock('../TeamDashboardModal', () => ({ default: () => <div>dashboard-entrenamientos</div> }))
vi.mock('../FutsalStats', () => ({ default: () => <div>futsal-stats-partidos</div> }))

describe('TeamStatsView', () => {
  it('shows the training dashboard tab by default', () => {
    render(<TeamStatsView teamId="t1" teamName="Torrenueva" exercises={[]} trainings={[]} onClose={() => {}} />)
    expect(screen.getByText('dashboard-entrenamientos')).toBeInTheDocument()
    expect(screen.queryByText('futsal-stats-partidos')).not.toBeInTheDocument()
  })

  it('switches to the match stats tab on click', async () => {
    const user = userEvent.setup()
    render(<TeamStatsView teamId="t1" teamName="Torrenueva" exercises={[]} trainings={[]} onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: /Partidos/ }))

    expect(screen.getByText('futsal-stats-partidos')).toBeInTheDocument()
    expect(screen.queryByText('dashboard-entrenamientos')).not.toBeInTheDocument()
  })

  it('highlights the active tab button', async () => {
    const user = userEvent.setup()
    render(<TeamStatsView teamId="t1" teamName="Torrenueva" exercises={[]} trainings={[]} onClose={() => {}} />)

    const trainingsBtn = screen.getByRole('button', { name: /Entrenamientos/ })
    const matchesBtn = screen.getByRole('button', { name: /Partidos/ })
    expect(trainingsBtn.className).toContain('btn-primary')
    expect(matchesBtn.className).not.toContain('btn-primary')

    await user.click(matchesBtn)
    expect(matchesBtn.className).toContain('btn-primary')
  })

  it('calls onClose when clicking Atrás', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<TeamStatsView teamId="t1" teamName="Torrenueva" exercises={[]} trainings={[]} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /Atrás/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
