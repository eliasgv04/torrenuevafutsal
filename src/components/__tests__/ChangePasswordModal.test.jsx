import { vi, describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChangePasswordModal from '../ChangePasswordModal'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { auth: { updateUser: vi.fn() } }
}))

async function fillAndSubmit(user, password, confirm) {
  await user.type(screen.getByLabelText('Nueva contraseña'), password)
  await user.type(screen.getByLabelText('Repite la contraseña'), confirm)
  await user.click(screen.getByRole('button', { name: 'Guardar' }))
}

describe('ChangePasswordModal', () => {
  it('rejects a password shorter than 6 characters without calling Supabase', async () => {
    const user = userEvent.setup()
    render(<ChangePasswordModal onDone={() => {}} onCancel={() => {}} />)
    await fillAndSubmit(user, 'abc', 'abc')
    expect(screen.getByText('La contraseña debe tener al menos 6 caracteres')).toBeInTheDocument()
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('rejects mismatched passwords', async () => {
    const user = userEvent.setup()
    render(<ChangePasswordModal onDone={() => {}} onCancel={() => {}} />)
    await fillAndSubmit(user, 'abcdef', 'abcdeg')
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('shows a success screen after a valid change, and Cerrar calls onDone', async () => {
    const user = userEvent.setup()
    supabase.auth.updateUser.mockResolvedValueOnce({ error: null })
    const onDone = vi.fn()
    render(<ChangePasswordModal onDone={onDone} onCancel={() => {}} />)

    await fillAndSubmit(user, 'abcdef', 'abcdef')

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'abcdef' })
    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('shows a generic error when Supabase refuses the change', async () => {
    const user = userEvent.setup()
    supabase.auth.updateUser.mockResolvedValueOnce({ error: { message: 'weak password' } })
    render(<ChangePasswordModal onDone={() => {}} onCancel={() => {}} />)

    await fillAndSubmit(user, 'abcdef', 'abcdef')

    expect(await screen.findByText('No se pudo cambiar la contraseña. Inténtalo de nuevo.')).toBeInTheDocument()
  })

  it('calls onCancel when clicking Cancelar', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ChangePasswordModal onDone={() => {}} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
