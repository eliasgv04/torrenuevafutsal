import { vi, describe, it, expect, afterEach } from 'vitest'
import { fetchWithTimeout } from '../supabaseClient'

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('calls fetch with the same url', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true }))
    vi.stubGlobal('fetch', fetchSpy)

    await fetchWithTimeout('http://x/y', {})

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe('http://x/y')
  })

  it('injects an abort signal when the caller did not already provide one', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true }))
    vi.stubGlobal('fetch', fetchSpy)

    await fetchWithTimeout('http://x/y', { method: 'GET' })

    const optionsUsed = fetchSpy.mock.calls[0][1]
    expect(optionsUsed.method).toBe('GET')
    expect(optionsUsed.signal).toBeInstanceOf(AbortSignal)
  })

  it('leaves the options untouched when the caller already supplied a signal', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true }))
    vi.stubGlobal('fetch', fetchSpy)
    const ownController = new AbortController()
    const options = { method: 'GET', signal: ownController.signal }

    await fetchWithTimeout('http://x/y', options)

    expect(fetchSpy.mock.calls[0][1]).toBe(options) // same object, not rebuilt
  })

  it('aborts the injected signal after 60s if the request is still pending', async () => {
    vi.useFakeTimers()
    let capturedSignal
    vi.stubGlobal('fetch', vi.fn((url, opts) => {
      capturedSignal = opts.signal
      return new Promise(() => {}) // never resolves on its own
    }))

    fetchWithTimeout('http://x/y', {})
    await vi.advanceTimersByTimeAsync(60_000)

    expect(capturedSignal.aborted).toBe(true)
  })

  it('clears the timeout once the request settles, so it never aborts afterwards', async () => {
    vi.useFakeTimers()
    let capturedSignal
    vi.stubGlobal('fetch', vi.fn((url, opts) => {
      capturedSignal = opts.signal
      return Promise.resolve({ ok: true })
    }))

    await fetchWithTimeout('http://x/y', {})
    await vi.advanceTimersByTimeAsync(60_000)

    expect(capturedSignal.aborted).toBe(false)
  })
})
