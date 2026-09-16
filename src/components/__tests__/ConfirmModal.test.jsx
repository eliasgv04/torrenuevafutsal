import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmModal from '../ConfirmModal'

describe('ConfirmModal', () => {
  it('defaults the title to "Confirmar" when none is given', () => {
    render(<ConfirmModal message="¿Seguro?" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Confirmar' })).toBeInTheDocument()
    expect(screen.getByText('¿Seguro?')).toBeInTheDocument()
  })

  it('shows a custom title when provided', () => {
    render(<ConfirmModal title="Borrar ejercicio" message="x" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Borrar ejercicio' })).toBeInTheDocument()
  })

  it('calls onConfirm when clicking Eliminar, and onCancel when clicking Cancelar', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmModal message="x" onConfirm={onConfirm} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
