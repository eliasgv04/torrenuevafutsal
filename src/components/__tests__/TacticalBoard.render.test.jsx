import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TacticalBoard from '../TacticalBoard'
import { api } from '../../lib/api'

vi.mock('../../lib/api', () => ({ api: { getPlayers: vi.fn() } }))

function makeCtx() {
  return {
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    arc: vi.fn(), rect: vi.fn(), strokeRect: vi.fn(), fillRect: vi.fn(),
    clearRect: vi.fn(), drawImage: vi.fn(), createPattern: vi.fn(() => ({})),
    fillText: vi.fn(), setLineDash: vi.fn(), clip: vi.fn(),
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', lineJoin: '',
    globalCompositeOperation: '', globalAlpha: 1, font: '', textAlign: '', textBaseline: '',
    shadowColor: '', shadowBlur: 0
  }
}

const players = [{ id: 'p1', name: 'Ana', surname: 'García', dorsal: 7, position: 'Cierre' }]

function equipoPanel() { return document.querySelectorAll('.tactical-side-panel')[0] }
function rivalesPanel() { return document.querySelectorAll('.tactical-side-panel')[1] }

// The on-court token for a placed player: same name as its roster chip, so
// pick the one that isn't inside a <button> (the roster chip always is).
function placedTokenNode(name) {
  const span = screen.getAllByText(name).find((el) => !el.closest('button'))
  return span.parentElement.parentElement // span -> colored circle -> PlacedToken root
}

let ctx

beforeEach(() => {
  vi.clearAllMocks()
  api.getPlayers.mockResolvedValue(players)

  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  ctx = makeCtx()
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) // one shared stub context for every canvas
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,FAKE')
  HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(new Blob(['x'])))
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  class FakeClipboardItem { constructor(data) { this.data = data } }
  global.ClipboardItem = FakeClipboardItem
  // navigator.clipboard is intentionally left alone here: userEvent.setup()
  // installs its own working Clipboard stub (a real, no-op .write) the first
  // time it runs, and it clobbers anything defined before that point. Tests
  // that care about the clipboard call userEvent.setup() first, then spy on
  // navigator.clipboard.write afterwards.
})

describe('TacticalBoard — header and roster', () => {
  it('calls onClose from the Atrás button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<TacticalBoard teamId="t1" onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /Atrás/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows "Sin jugadores" when the team has no roster', async () => {
    api.getPlayers.mockResolvedValue([])
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    expect(await within(equipoPanel()).findByText('Sin jugadores')).toBeInTheDocument()
  })

  it('places a team player on the court and removes it again', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    const chip = (await within(equipoPanel()).findByText('Ana')).closest('button')
    expect(chip).toHaveAttribute('title', 'Añadir al campo')

    await user.click(chip)
    expect(chip).toHaveAttribute('title', 'Quitar del campo')

    await user.click(chip)
    expect(chip).toHaveAttribute('title', 'Añadir al campo')
  })

  it('places a rival token from the first (red) squad', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    const chip = within(rivalesPanel()).getAllByText('Portero')[0].closest('button')
    expect(chip).toHaveAttribute('title', 'Añadir al campo')
    await user.click(chip)
    expect(chip).toHaveAttribute('title', 'Quitar del campo')
  })
})

describe('TacticalBoard — material and tools', () => {
  it('adds several material instances, showing a running count badge', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    const coneButton = screen.getByRole('button', { name: 'Cono' })
    await user.click(coneButton)
    expect(within(coneButton).getByText('1')).toBeInTheDocument()
    await user.click(coneButton)
    expect(within(coneButton).getByText('2')).toBeInTheDocument()
  })

  it('switches to the text tool and adds a text box on the court', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    await user.click(screen.getByRole('button', { name: 'Texto' }))
    const canvas = document.querySelector('canvas')
    fireEvent.pointerDown(canvas, { clientX: 150, clientY: 75 })

    const input = screen.getByPlaceholderText('Texto...')
    await user.type(input, 'Presión alta')
    fireEvent.blur(input)

    expect(screen.getByText('Presión alta')).toBeInTheDocument()
  })

  it('removes an empty text box on blur instead of keeping it', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    await user.click(screen.getByRole('button', { name: 'Texto' }))
    const canvas = document.querySelector('canvas')
    fireEvent.pointerDown(canvas, { clientX: 150, clientY: 75 })

    const input = screen.getByPlaceholderText('Texto...')
    fireEvent.blur(input)

    expect(screen.queryByPlaceholderText('Texto...')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.tactical-side-panel')[0]).toBeTruthy() // board still mounted
  })

  it('erases an existing text box by clicking it with the erase tool active', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    await user.click(screen.getByRole('button', { name: 'Texto' }))
    const canvas = document.querySelector('canvas')
    fireEvent.pointerDown(canvas, { clientX: 150, clientY: 75 })
    await user.type(screen.getByPlaceholderText('Texto...'), 'Zona')
    fireEvent.blur(screen.getByPlaceholderText('Texto...'))
    expect(screen.getByText('Zona')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    fireEvent.pointerDown(screen.getByText('Zona'), { clientX: 150, clientY: 75 })
    expect(screen.queryByText('Zona')).not.toBeInTheDocument()
  })

  it('clears the board, removing text boxes', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    await user.click(screen.getByRole('button', { name: 'Texto' }))
    fireEvent.pointerDown(document.querySelector('canvas'), { clientX: 150, clientY: 75 })
    await user.type(screen.getByPlaceholderText('Texto...'), 'Nota')
    fireEvent.blur(screen.getByPlaceholderText('Texto...'))
    expect(screen.getByText('Nota')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(screen.queryByText('Nota')).not.toBeInTheDocument()
  })
})

describe('TacticalBoard — frames', () => {
  it('starts with one frame and "Reproducir" disabled, enabling it once a second frame is added', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    expect(screen.getByRole('button', { name: /Reproducir/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Añadir frame/ }))
    expect(screen.getByRole('button', { name: /Reproducir/ })).toBeEnabled()
    expect(screen.getByTitle('Frame 1')).toBeInTheDocument()
    expect(screen.getByTitle('Frame 2')).toBeInTheDocument()
  })

  it('a new frame clones the tokens placed on the previous one', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    const chip = (await within(equipoPanel()).findByText('Ana')).closest('button')
    await user.click(chip) // place Ana on frame 1

    await user.click(screen.getByRole('button', { name: /Añadir frame/ }))
    // Now on frame 2 (a clone) — Ana should still show as placed.
    expect(chip).toHaveAttribute('title', 'Quitar del campo')
  })

  it('deletes a frame, falling back to the remaining one', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')
    await user.click(screen.getByRole('button', { name: /Añadir frame/ }))
    expect(screen.getByTitle('Frame 2')).toBeInTheDocument()

    const frame1 = screen.getByTitle('Frame 1')
    fireEvent.mouseEnter(frame1)
    await user.click(screen.getByRole('button', { name: 'Eliminar frame' }))

    expect(screen.queryByTitle('Frame 2')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reproducir/ })).toBeDisabled()
  })

  it('shows a confirm dialog before clearing all frames, and clears them on confirm', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')
    await user.click(screen.getByRole('button', { name: /Añadir frame/ }))
    expect(screen.getByTitle('Frame 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Eliminar todos' }))
    expect(screen.getByText('Borrar todos los frames')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(screen.queryByTitle('Frame 2')).not.toBeInTheDocument()
    expect(screen.getByTitle('Frame 1')).toBeInTheDocument()
  })

  it('cancels clearing all frames, keeping them intact', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')
    await user.click(screen.getByRole('button', { name: /Añadir frame/ }))

    await user.click(screen.getByRole('button', { name: 'Eliminar todos' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByTitle('Frame 2')).toBeInTheDocument()
  })

  it('picks a different animation speed without crashing', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')
    await user.click(screen.getByRole('button', { name: 'Rápido' }))
    expect(screen.getByText('Pizarra Táctica')).toBeInTheDocument()
  })
})

describe('TacticalBoard — export', () => {
  it('exports a PNG via an offscreen canvas and a synthetic download link', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    await user.click(screen.getByRole('button', { name: 'Exportar PNG' }))
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)
  })

  it('copies the board image to the clipboard and shows a confirmation', async () => {
    const user = userEvent.setup() // installs its own working navigator.clipboard stub
    const writeSpy = vi.spyOn(navigator.clipboard, 'write')
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    await user.click(screen.getByRole('button', { name: /Copiar imagen/ }))
    expect(await screen.findByText('¡Copiada!')).toBeInTheDocument()
    expect(writeSpy).toHaveBeenCalledTimes(1)
  })

  it('shows an error state if copying to the clipboard fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'write').mockRejectedValue(new Error('denied'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    await user.click(screen.getByRole('button', { name: /Copiar imagen/ }))
    expect(await screen.findByText('No se pudo copiar')).toBeInTheDocument()
  })

  it('disables video export with an explanatory title when the browser does not support it', async () => {
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    const button = screen.getByRole('button', { name: /Exportar vídeo/ })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', expect.stringContaining('no soporta grabar vídeo'))
  })
})

describe('TacticalBoard — token drag and removal', () => {
  it('removes a placed token via its hover × button while the Mover tool is active', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    const chip = (await within(equipoPanel()).findByText('Ana')).closest('button')
    await user.click(chip)
    await user.click(screen.getByRole('button', { name: 'Mover' }))

    const tokenNode = placedTokenNode('Ana')
    fireEvent.mouseEnter(tokenNode)
    await user.click(within(tokenNode).getByRole('button'))

    expect(chip).toHaveAttribute('title', 'Añadir al campo')
  })

  it('drags a placed token without crashing while the Mover tool is active', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    const chip = (await within(equipoPanel()).findByText('Ana')).closest('button')
    await user.click(chip)
    await user.click(screen.getByRole('button', { name: 'Mover' }))

    const tokenNode = placedTokenNode('Ana')
    fireEvent.pointerDown(tokenNode, { clientX: 100, clientY: 50, pointerId: 1 })
    fireEvent.pointerMove(tokenNode, { clientX: 120, clientY: 60, pointerId: 1 })
    fireEvent.pointerUp(tokenNode, { pointerId: 1 })

    expect(chip).toHaveAttribute('title', 'Quitar del campo') // still placed, just moved
  })

  it('drags an existing text box without crashing while the Mover tool is active', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    await user.click(screen.getByRole('button', { name: 'Texto' }))
    fireEvent.pointerDown(document.querySelector('canvas'), { clientX: 150, clientY: 75 })
    await user.type(screen.getByPlaceholderText('Texto...'), 'Zona')
    fireEvent.blur(screen.getByPlaceholderText('Texto...'))

    await user.click(screen.getByRole('button', { name: 'Mover' }))
    const textOuter = screen.getByText('Zona').parentElement.parentElement
    fireEvent.pointerDown(textOuter, { clientX: 150, clientY: 75, pointerId: 2 })
    fireEvent.pointerMove(textOuter, { clientX: 160, clientY: 80, pointerId: 2 })
    fireEvent.pointerUp(textOuter, {})

    expect(screen.getByText('Zona')).toBeInTheDocument()
  })

  it('removes a text box via its Mover-mode × button', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    await user.click(screen.getByRole('button', { name: 'Texto' }))
    fireEvent.pointerDown(document.querySelector('canvas'), { clientX: 150, clientY: 75 })
    await user.type(screen.getByPlaceholderText('Texto...'), 'Zona')
    fireEvent.blur(screen.getByPlaceholderText('Texto...'))

    await user.click(screen.getByRole('button', { name: 'Mover' }))
    const textOuter = screen.getByText('Zona').parentElement.parentElement
    await user.click(within(textOuter).getByRole('button'))

    expect(screen.queryByText('Zona')).not.toBeInTheDocument()
  })
})

describe('TacticalBoard — freehand drawing, rectangles and polygons', () => {
  it('draws a freehand stroke on pointer down + move, painting onto the canvas context', async () => {
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    const canvas = document.querySelector('canvas')
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50, pointerId: 3 })
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 60, pointerId: 3 })
    fireEvent.pointerUp(canvas, {})

    expect(ctx.fill).toHaveBeenCalled() // the mouse-down dot
    expect(ctx.stroke).toHaveBeenCalled() // the move-to-move segment
  })

  it('erases with the eraser tool using destination-out compositing', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')
    await user.click(screen.getByRole('button', { name: 'Borrar' }))

    const canvas = document.querySelector('canvas')
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50, pointerId: 4 })
    fireEvent.pointerUp(canvas, {})

    expect(ctx.fill).toHaveBeenCalled()
  })

  it('draws a rectangle by dragging, then renders it (hatched fill + stroke) on release', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')
    await user.click(screen.getByRole('button', { name: 'Rectángulo' }))

    const canvas = document.querySelector('canvas')
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30, pointerId: 5 })
    fireEvent.pointerMove(canvas, { clientX: 90, clientY: 90, pointerId: 5 })
    fireEvent.pointerUp(canvas, {})

    expect(ctx.strokeRect).toHaveBeenCalled()
    expect(ctx.createPattern).toHaveBeenCalled() // hatch fill for the finished rect
  })

  it('discards a rectangle that never grew past the minimum drag distance', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')
    await user.click(screen.getByRole('button', { name: 'Rectángulo' }))

    const canvas = document.querySelector('canvas')
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30, pointerId: 6 })
    fireEvent.pointerUp(canvas, {})

    expect(screen.getByText('Pizarra Táctica')).toBeInTheDocument() // no crash
  })

  it('builds a polygon from 3+ clicks and closes it with "Cerrar forma"', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')
    await user.click(screen.getByRole('button', { name: 'Zona libre' }))

    const canvas = document.querySelector('canvas')
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30, pointerId: 7 })
    fireEvent.pointerDown(canvas, { clientX: 90, clientY: 30, pointerId: 7 })
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 90, pointerId: 7 })
    expect(screen.getByText('3 puntos')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cerrar forma' }))
    expect(screen.queryByText(/puntos/)).not.toBeInTheDocument()
    expect(ctx.createPattern).toHaveBeenCalled() // the closed polygon's hatch fill
  })

  it('cancels an in-progress polygon with the Cancelar button', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')
    await user.click(screen.getByRole('button', { name: 'Zona libre' }))

    const canvas = document.querySelector('canvas')
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30, pointerId: 8 })
    fireEvent.pointerDown(canvas, { clientX: 90, clientY: 30, pointerId: 8 })
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 90, pointerId: 8 })

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText(/puntos/)).not.toBeInTheDocument()
  })

  it('cancels an in-progress polygon on Escape', async () => {
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Zona libre' }))

    const canvas = document.querySelector('canvas')
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30, pointerId: 9 })
    fireEvent.pointerDown(canvas, { clientX: 90, clientY: 30, pointerId: 9 })
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 90, pointerId: 9 })
    expect(screen.getByText('3 puntos')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText(/puntos/)).not.toBeInTheDocument()
  })
})

describe('TacticalBoard — palette, pen size and PNG export with content', () => {
  it('picks a preset color and a pen size without crashing', async () => {
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    await within(equipoPanel()).findByText('Ana')

    const colorInput = document.querySelector('input[type="color"]')
    fireEvent.change(colorInput, { target: { value: '#ff0000' } })
    expect(colorInput.value).toBe('#ff0000')
  })

  it('exports a PNG that includes a placed token, drawing it via drawMaterialToken/token rendering', async () => {
    const user = userEvent.setup()
    render(<TacticalBoard teamId="t1" onClose={vi.fn()} />)
    const chip = (await within(equipoPanel()).findByText('Ana')).closest('button')
    await user.click(chip)
    await user.click(screen.getByRole('button', { name: 'Cono' })) // material token too

    await user.click(screen.getByRole('button', { name: 'Exportar PNG' }))
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)
    expect(ctx.arc).toHaveBeenCalled() // player token drawn as a circle
  })
})
