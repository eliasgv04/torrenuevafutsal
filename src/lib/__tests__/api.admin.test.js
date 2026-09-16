import { vi, describe, it, expect, beforeEach } from 'vitest'

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) },
  storage: { from: vi.fn() },
  functions: { invoke: vi.fn() }
}))

vi.mock('../supabaseClient', () => ({ supabase: supabaseMock }))

import { api, clearCache } from '../api'
import { chainable } from './supabaseTestUtils'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  clearCache()
})

describe('api.requestAccess', () => {
  it('refuses to even call Supabase without privacy acceptance', async () => {
    await expect(api.requestAccess({ team_name: 'x', contact_name: 'y', contact_email: 'z', privacy_accepted: false }))
      .rejects.toThrow('política de privacidad')
    expect(supabaseMock.from).not.toHaveBeenCalled()
  })

  it('inserts the request, always forcing privacy_accepted to true', async () => {
    const builder = chainable({ error: null })
    supabaseMock.from.mockReturnValueOnce(builder)

    await api.requestAccess({ team_name: 'CD X', contact_name: 'Ana', contact_email: 'a@x.com', message: 'hola', privacy_accepted: true })

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ team_name: 'CD X', privacy_accepted: true }))
  })

  it('propagates an insert error', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ error: { message: 'db down' } }))
    await expect(api.requestAccess({ team_name: 'x', contact_name: 'y', contact_email: 'z', privacy_accepted: true }))
      .rejects.toEqual({ message: 'db down' })
  })
})

describe('api.isAdmin', () => {
  it('reflects a truthy RPC result as a real boolean', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: true, error: null })
    expect(await api.isAdmin()).toBe(true)
  })

  it('treats an RPC error as "not admin" rather than throwing', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'no rows' } })
    expect(await api.isAdmin()).toBe(false)
  })
})

describe('admin table reads (getAllTeamsAdmin / getAccessRequests / getAppLogs)', () => {
  it('return whatever Supabase responds with', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: [{ id: 't1' }], error: null }))
    expect(await api.getAllTeamsAdmin()).toEqual([{ id: 't1' }])

    supabaseMock.from.mockReturnValueOnce(chainable({ data: [{ id: 'r1' }], error: null }))
    expect(await api.getAccessRequests()).toEqual([{ id: 'r1' }])

    const logsBuilder = chainable({ data: [{ id: 'l1' }], error: null })
    supabaseMock.from.mockReturnValueOnce(logsBuilder)
    expect(await api.getAppLogs()).toEqual([{ id: 'l1' }])
    expect(logsBuilder.limit).toHaveBeenCalledWith(200)
  })

  it('propagate the error instead of silently swallowing it (no localStorage fallback for admin data)', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable({ data: null, error: { message: 'forbidden' } }))
    await expect(api.getAllTeamsAdmin()).rejects.toEqual({ message: 'forbidden' })
  })
})

describe('api.rejectAccessRequest', () => {
  it('sets the request status to rejected', async () => {
    const builder = chainable({ error: null })
    supabaseMock.from.mockReturnValueOnce(builder)
    await api.rejectAccessRequest('req1')
    expect(builder.update).toHaveBeenCalledWith({ status: 'rejected' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'req1')
  })
})

describe('Edge-function-backed admin actions', () => {
  it('adminCreateAccount forwards the payload and returns the created account', async () => {
    supabaseMock.functions.invoke.mockResolvedValueOnce({ data: { email: 'a@x.com', emailSent: true }, error: null })
    const result = await api.adminCreateAccount({ email: 'a@x.com', password: 'p', team_id: 't1', request_id: 'r1' })
    expect(result.email).toBe('a@x.com')
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('admin-create-account', {
      body: { email: 'a@x.com', password: 'p', team_id: 't1', request_id: 'r1' }
    })
  })

  it('throws when the function transport itself errors', async () => {
    supabaseMock.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'network' } })
    await expect(api.adminCreateAccount({ email: 'a@x.com', password: 'p' })).rejects.toEqual({ message: 'network' })
  })

  it('throws when the function responds 200 but with a logical error in its payload', async () => {
    supabaseMock.functions.invoke.mockResolvedValueOnce({ data: { error: 'email already exists' }, error: null })
    await expect(api.adminCreateAccount({ email: 'a@x.com', password: 'p' })).rejects.toThrow('email already exists')
  })

  it('getAllAccounts unwraps the accounts array from the function payload', async () => {
    supabaseMock.functions.invoke.mockResolvedValueOnce({ data: { accounts: [{ id: 'u1' }] }, error: null })
    expect(await api.getAllAccounts()).toEqual([{ id: 'u1' }])
  })

  it('deleteAccount and resetAccountPassword both go through the admin-accounts function', async () => {
    supabaseMock.functions.invoke.mockResolvedValueOnce({ data: { ok: true }, error: null })
    await api.deleteAccount('u1')
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('admin-accounts', { body: { action: 'delete', user_id: 'u1' } })

    supabaseMock.functions.invoke.mockResolvedValueOnce({ data: { ok: true }, error: null })
    await api.resetAccountPassword({ user_id: 'u1', new_password: 'x' })
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('admin-accounts', {
      body: { action: 'reset_password', user_id: 'u1', new_password: 'x', notify_email: null }
    })
  })
})

describe('api.addTeamToAccount / api.removeTeamFromAccount', () => {
  it('link and unlink a team via team_users', async () => {
    const insertBuilder = chainable({ error: null })
    supabaseMock.from.mockReturnValueOnce(insertBuilder)
    await api.addTeamToAccount('t1', 'u1')
    expect(insertBuilder.insert).toHaveBeenCalledWith({ team_id: 't1', user_id: 'u1' })

    const deleteBuilder = chainable({ error: null })
    supabaseMock.from.mockReturnValueOnce(deleteBuilder)
    await api.removeTeamFromAccount('t1', 'u1')
    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('team_id', 't1')
  })
})

describe('api.clearAppLogs', () => {
  it('deletes every log row via a neq-the-nil-uuid trick', async () => {
    const builder = chainable({ error: null })
    supabaseMock.from.mockReturnValueOnce(builder)
    await api.clearAppLogs()
    expect(builder.neq).toHaveBeenCalledWith('id', '00000000-0000-0000-0000-000000000000')
  })
})
