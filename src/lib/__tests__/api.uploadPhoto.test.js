import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) },
  storage: { from: vi.fn() },
  functions: { invoke: vi.fn() }
}))

vi.mock('../supabaseClient', () => ({ supabase: supabaseMock }))

import { uploadPhoto } from '../api'

class FakeFileReader {
  readAsDataURL(file) {
    this.result = `data:image/png;base64,FAKE(${file.name})`
    if (this.onload) this.onload()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('uploadPhoto', () => {
  it('uploads to Supabase storage and returns the public URL', async () => {
    supabaseMock.storage.from.mockReturnValue({
      upload: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://cdn.x/photos/foto.png' } }))
    })
    const file = new File(['x'], 'foto.png', { type: 'image/png' })

    const url = await uploadPhoto(file)

    expect(url).toBe('https://cdn.x/photos/foto.png')
    expect(supabaseMock.storage.from).toHaveBeenCalledWith('photos')
  })

  it('falls back to a data URL when the Supabase upload itself returns an error', async () => {
    const originalFileReader = global.FileReader
    global.FileReader = FakeFileReader
    try {
      supabaseMock.storage.from.mockReturnValue({
        upload: vi.fn(() => Promise.resolve({ data: null, error: { message: 'quota exceeded' } })),
        getPublicUrl: vi.fn()
      })
      const file = new File(['x'], 'foto.png', { type: 'image/png' })

      const url = await uploadPhoto(file)

      expect(url).toBe('data:image/png;base64,FAKE(foto.png)')
      expect(supabaseMock.storage.from().getPublicUrl).not.toHaveBeenCalled()
    } finally {
      global.FileReader = originalFileReader
    }
  })

  it('falls back to a data URL when the upload call itself throws', async () => {
    const originalFileReader = global.FileReader
    global.FileReader = FakeFileReader
    try {
      supabaseMock.storage.from.mockReturnValue({
        upload: vi.fn(() => Promise.reject(new Error('network down'))),
        getPublicUrl: vi.fn()
      })
      const file = new File(['x'], 'foto.png', { type: 'image/png' })

      const url = await uploadPhoto(file)
      expect(url).toBe('data:image/png;base64,FAKE(foto.png)')
    } finally {
      global.FileReader = originalFileReader
    }
  })
})
