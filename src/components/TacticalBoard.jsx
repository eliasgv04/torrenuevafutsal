import { Fragment, useState, useRef, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import ConfirmModal from './ConfirmModal'
import { ArrowLeftIcon, XIcon, CopyIcon, CheckIcon, PlayIcon, PauseIcon, PlusIcon, DownloadIcon } from './Icons'

const PIZARRA_URL = import.meta.env.BASE_URL + 'futsalkit-pizarra.jpg'
const BALL_URL     = import.meta.env.BASE_URL + 'balon-oficial.png'

// Three rival squads (red / blue / purple) so an exercise involving more
// than one opposing team — e.g. a rondo or a multi-team drill — can place
// extra full formations without reusing the same tokens. Each keeps its own
// color throughout (including the keeper) so the squads are easy to tell
// apart on the court.
const RIVAL_RED    = '#dc2626'
const RIVAL_BLUE   = '#3b82f6'
const RIVAL_PURPLE = '#a855f7'

function buildRivalGroup(prefix, color, initXOffset) {
  return [
    { id: `${prefix}-1`, name: 'Portero',     position: 'Portero',     dorsal: null, short: 'Por',    color, initX: 93 - initXOffset, initY: 50 },
    { id: `${prefix}-2`, name: 'Ala Zurdo',   position: 'Ala Zurdo',   dorsal: null, short: 'Ala Z',  color, initX: 62 - initXOffset, initY: 20 },
    { id: `${prefix}-3`, name: 'Ala Diestro', position: 'Ala Diestro', dorsal: null, short: 'Ala D',  color, initX: 62 - initXOffset, initY: 80 },
    { id: `${prefix}-4`, name: 'Pivot',       position: 'Pivot',       dorsal: null, short: 'Pivot',  color, initX: 52 - initXOffset, initY: 50 },
    { id: `${prefix}-5`, name: 'Cierre',      position: 'Cierre',      dorsal: null, short: 'Cierre', color, initX: 74 - initXOffset, initY: 50 },
  ]
}

const RIVAL_GROUPS = [
  { label: 'Rival rojo',   color: RIVAL_RED,    presets: buildRivalGroup('rv-r', RIVAL_RED,    0)  },
  { label: 'Rival azul',   color: RIVAL_BLUE,   presets: buildRivalGroup('rv-a', RIVAL_BLUE,   6)  },
  { label: 'Rival morado', color: RIVAL_PURPLE, presets: buildRivalGroup('rv-b', RIVAL_PURPLE, 12) },
]
const RIVAL_PRESETS = RIVAL_GROUPS.flatMap(g => g.presets)

// Training material — unlike players/rivals, coaches usually need several
// copies on court at once (a slalom needs 6 cones, a passing drill needs
// more than 1 ball), so these are "stamp" chips that add a new instance
// every click rather than the place/remove toggle used for unique
// individuals (players, rivals).
const MATERIAL_PRESETS = [
  { id: 'mat-ball', kind: 'ball', name: 'Balón',         initX: 50, initY: 50 },
  { id: 'mat-goal', kind: 'goal', name: 'Portería',     initX: 6,  initY: 50 },
  { id: 'mat-cone', kind: 'cone', name: 'Cono',          initX: 50, initY: 15 },
  { id: 'mat-ring', kind: 'ring', name: 'Disco abierto', initX: 50, initY: 50 },
]

const MATERIAL_STYLE = {
  goal: { bg: '#f8fafc', icon: '#0f172a' },
  cone: { bg: '#f97316', icon: '#ffffff' },
  ring: { bg: '#38bdf8', icon: '#0f172a' },
  ball: { bg: '#ffffff', icon: '#1a1a1a' },
}

// Formation slots for team players (left half), assigned sequentially
const TEAM_SLOTS = [
  { x: 12, y: 50 }, // portero
  { x: 28, y: 50 }, // cierre
  { x: 40, y: 18 }, // ala zurdo
  { x: 40, y: 82 }, // ala diestro
  { x: 48, y: 50 }, // pivot
  { x: 22, y: 28 },
  { x: 22, y: 72 },
  { x: 35, y: 38 },
  { x: 35, y: 62 },
  { x: 44, y: 30 },
  { x: 44, y: 70 },
  { x: 18, y: 50 },
]

const TEAM_POS_MAP = {
  'Portero':     { x: 12, y: 50 },
  'Cierre':      { x: 28, y: 50 },
  'Ala Zurdo':   { x: 40, y: 18 },
  'Ala Diestro': { x: 40, y: 82 },
  'Ala':         { x: 40, y: 50 },
  'Pivot':       { x: 48, y: 50 },
}

const PALETTE   = ['#ffffff', '#ffd400', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#a855f7', '#1a1a1a']
const PEN_SIZES = [2, 4, 8, 14]

// Here we only care about telling the teams (and our own keeper) apart at a
// glance — not position, unlike Plantilla.
const TEAM_COLOR   = '#ca8a04'
const KEEPER_COLOR = '#15803d'
const TOKEN_R   = 22

// Custom eraser-shaped cursor for the "Borrar" tool (replaces the default cross/cell cursor)
const ERASER_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16l10-10 7 7-3 7z" fill="rgba(15,23,42,0.6)"/><path d="M6.5 17.5l5-5"/></svg>`
const ERASER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(ERASER_CURSOR_SVG)}") 3 19, cell`

const PencilIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
  </svg>
)

const EraserIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 20H7L3 16l10-10 7 7-3 7z"/>
    <path d="M6.5 17.5l5-5"/>
  </svg>
)

const MoveIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
  </svg>
)

const TextIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16M12 6v14"/>
  </svg>
)

const RectangleIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/>
  </svg>
)

const PolygonIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l8 5.5-3 11.5H7L4 8.5z"/>
  </svg>
)

// Material is rendered as its actual silhouette (goal frame, cone, ring)
// rather than an icon stuffed into a colored circle like players/rivals —
// used both at full size on the court and shrunk down as toolbar icons, via
// the same MaterialShape dispatcher below.
// Real futsal goal posts — a vertical bar in alternating blue/white bands,
// not a full goal frame.
function GoalShape({ size, stripes = 6 }) {
  const width = size * 0.75
  const height = size * 2.6
  return (
    <div style={{
      width, height, borderRadius: 3, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      border: '1px solid rgba(0,0,0,0.35)',
      boxShadow: '0 2px 4px rgba(0,0,0,0.45)',
    }}>
      {Array.from({ length: stripes }).map((_, i) => (
        <div key={i} style={{ flex: 1, background: i % 2 === 0 ? '#1d4ed8' : '#ffffff' }} />
      ))}
    </div>
  )
}

function ConeShape({ size, color }) {
  return (
    <div style={{
      width: 0, height: 0,
      borderLeft: `${size * 0.75}px solid transparent`,
      borderRight: `${size * 0.75}px solid transparent`,
      borderBottom: `${size * 1.5}px solid ${color}`,
      filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.45))',
    }} />
  )
}

function RingShape({ size, color }) {
  const thickness = Math.max(4, size * 0.28)
  return (
    <div style={{
      width: size * 1.9, height: size * 1.9, borderRadius: '50%',
      border: `${thickness}px solid ${color}`, boxSizing: 'border-box',
      boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
    }} />
  )
}

function BallShape({ size }) {
  return (
    <div style={{
      width: size * 1.8, height: size * 1.8, borderRadius: '50%', overflow: 'hidden',
      boxShadow: '0 2px 6px rgba(0,0,0,0.45)', border: '2px solid rgba(0,0,0,0.15)', background: '#fff',
    }}>
      <img src={BALL_URL} alt="Balón" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  )
}

function MaterialShape({ kind, size = 22 }) {
  const style = MATERIAL_STYLE[kind] || MATERIAL_STYLE.ball
  if (kind === 'goal') return <GoalShape size={size} />
  if (kind === 'cone') return <ConeShape size={size} color={style.bg} />
  if (kind === 'ring') return <RingShape size={size} color={style.bg} />
  return <BallShape size={size} />
}

// Tools that paint in the active palette color (as opposed to erase/text/move,
// which repurpose the color swatches/pen sizes for other things or ignore them).
const DRAW_TOOLS = ['draw', 'rect', 'polygon']

// ── Frame animation ──────────────────────────────────────────────────────
const SPEED_PRESETS = [
  { label: 'Lento',  ms: 2500 },
  { label: 'Normal', ms: 1500 },
  { label: 'Rápido', ms: 800  },
]

// Recording an animated canvas needs both APIs; Safari support is patchy, so
// this gates whether "Exportar vídeo" is even offered.
const VIDEO_EXPORT_SUPPORTED =
  typeof window !== 'undefined' &&
  typeof MediaRecorder !== 'undefined' &&
  !!window.HTMLCanvasElement?.prototype?.captureStream

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

// Blends two frames' tokens/text at progress t (0-1), matched by id. Items
// present in both frames tween between their positions; an item only in the
// starting frame holds its place until the very end of the transition, then
// disappears (it "leaves"); an item only in the ending frame is shown at its
// resting position for the whole transition (it "enters").
function interpolateFrames(a, b, t) {
  function blend(listA, listB) {
    const mapA = new Map(listA.map(item => [item.id, item]))
    const mapB = new Map(listB.map(item => [item.id, item]))
    const ids = new Set([...mapA.keys(), ...mapB.keys()])
    return [...ids].map(id => {
      const from = mapA.get(id), to = mapB.get(id)
      if (from && to) return { ...to, x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
      if (from && !to) return t < 1 ? from : null
      return to
    }).filter(Boolean)
  }
  return { tokens: blend(a.tokens, b.tokens), textBoxes: blend(a.textBoxes, b.textBoxes) }
}

export default function TacticalBoard({ teamId, onClose }) {
  const [players,   setPlayers]   = useState([])
  // Each frame is a snapshot of token/text positions — the building block
  // for the movement animation. Freehand drawings (pencil/rect/polygon)
  // stay global across all frames, unlike tokens/text.
  const [frames, setFrames] = useState([{ id: 'frame-1', tokens: [], textBoxes: [] }])
  const [activeFrameIndex, setActiveFrameIndex] = useState(0)
  const [previewFrame, setPreviewFrame] = useState(null) // interpolated snapshot shown while playing/exporting
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExportingVideo, setIsExportingVideo] = useState(false)
  const [confirmClearFrames, setConfirmClearFrames] = useState(false)
  const [speedMs, setSpeedMs] = useState(1500) // ms per frame-to-frame transition
  const [editingTextId, setEditingTextId] = useState(null)
  const [tool,      setTool]      = useState('draw')
  const [color,     setColor]     = useState('#ffffff')
  const [penSize,   setPenSize]   = useState(4)
  const [polyPointCount, setPolyPointCount] = useState(0)
  const [copyStatus, setCopyStatus] = useState(null) // null | 'done' | 'error'

  const activeFrame = frames[activeFrameIndex] || frames[0]
  const tokens    = previewFrame ? previewFrame.tokens    : activeFrame.tokens
  const textBoxes = previewFrame ? previewFrame.textBoxes : activeFrame.textBoxes

  function setActiveTokens(updater) {
    setFrames(prev => prev.map((f, i) => i !== activeFrameIndex ? f : { ...f, tokens: typeof updater === 'function' ? updater(f.tokens) : updater }))
  }
  function setActiveTextBoxes(updater) {
    setFrames(prev => prev.map((f, i) => i !== activeFrameIndex ? f : { ...f, textBoxes: typeof updater === 'function' ? updater(f.textBoxes) : updater }))
  }

  const courtRef    = useRef(null)
  const canvasRef   = useRef(null)
  const imgRef      = useRef(null)
  const ballImgRef  = useRef(null) // preloaded so drawMaterialToken can draw the real photo, not just the on-screen <img>s
  const imgBounds   = useRef(null) // { left%, top%, width%, height% } of container
  const historyRef  = useRef([])
  const drawingRef  = useRef(false)
  const currentPath = useRef(null)
  const drag        = useRef(null)
  const dragText    = useRef(null)
  const textIdRef   = useRef(0)
  const frameIdRef  = useRef(1)
  const materialIdRef = useRef(0)
  const playbackCancelRef = useRef(false)
  const rectStart   = useRef(null)
  const rectEnd     = useRef(null)
  const polyPoints  = useRef([])
  const hatchCache  = useRef({})

  // Stop any in-flight animation loop if the board unmounts mid-playback.
  useEffect(() => () => { playbackCancelRef.current = true }, [])

  // Compute the rendered bounds of the image within courtRef (for objectFit:contain)
  function computeImgBounds() {
    const img   = imgRef.current
    const court = courtRef.current
    if (!img || !court || !img.naturalWidth) return
    const iR = img.naturalWidth  / img.naturalHeight
    const cW = court.clientWidth
    const cH = court.clientHeight
    const cR = cW / cH
    let w, h, l, t
    if (iR > cR) { w = cW; h = cW / iR; l = 0;            t = (cH - h) / 2 }
    else         { h = cH; w = cH * iR; t = 0;            l = (cW - w) / 2 }
    imgBounds.current = { l: l/cW*100, t: t/cH*100, w: w/cW*100, h: h/cH*100 }
  }

  // Convert image-space % (0-100) to container-space %
  function toCtX(ix) { const b = imgBounds.current; return b ? b.l + ix/100*b.w : ix }
  function toCtY(iy) { const b = imgBounds.current; return b ? b.t + iy/100*b.h : iy }

  // ── Data ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (teamId) api.getPlayers(teamId).then(setPlayers)
  }, [teamId])

  // ── Canvas resize (retained mode) ─────────────────────────────────
  const redrawWithExtra = useCallback((extra) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, w, h)

    for (const op of historyRef.current) {
      if (op.type === 'path') drawPath(ctx, op, w, h)
      else if (op.type === 'text') drawText(ctx, op, w, h)
      else if (op.type === 'rect') drawRectOp(ctx, op, w, h)
      else if (op.type === 'polygon') drawPolygonOp(ctx, op, w, h)
    }
    if (extra) extra(ctx, w, h)
  }, [])

  const redraw = useCallback(() => redrawWithExtra(null), [redrawWithExtra])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
      computeImgBounds()
      redraw()
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [redraw])

  // Cancel an in-progress polygon if the user switches tool or hits Escape
  useEffect(() => {
    if (tool !== 'polygon' && polyPoints.current.length > 0) {
      polyPoints.current = []
      setPolyPointCount(0)
      redraw()
    }
  }, [tool, redraw])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && polyPoints.current.length > 0) cancelPolygon()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Canvas draw helpers ────────────────────────────────────────────
  function drawPath(ctx, op, w, h) {
    ctx.save()
    ctx.beginPath()
    ctx.lineCap  = 'round'
    ctx.lineJoin = 'round'
    if (op.isErase) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
      ctx.lineWidth   = op.size * 4
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = op.color
      ctx.lineWidth   = op.size
    }
    const pts = op.points
    if (pts.length > 0) {
      ctx.moveTo(pts[0].x * w, pts[0].y * h)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h)
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawText(ctx, op, w, h) {
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle   = op.color
    ctx.font        = `bold ${op.fontSize}px Raleway, sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillText(op.text, op.x * w, op.y * h)
    ctx.restore()
  }

  // Diagonal-hatch fill so a marked zone reads as a shaded region without
  // hiding the court underneath — cached per color so dragging a shape
  // around doesn't rebuild the tile pattern on every redraw.
  function getHatchPattern(ctx, color) {
    if (hatchCache.current[color]) return hatchCache.current[color]
    const size = 12
    const tile = document.createElement('canvas')
    tile.width = size; tile.height = size
    const tctx = tile.getContext('2d')
    tctx.strokeStyle = color
    tctx.globalAlpha  = 0.55
    tctx.lineWidth    = 2
    tctx.beginPath()
    tctx.moveTo(0, size); tctx.lineTo(size, 0)
    tctx.moveTo(-size / 2, size / 2); tctx.lineTo(size / 2, -size / 2)
    tctx.moveTo(size / 2, size * 1.5); tctx.lineTo(size * 1.5, size / 2)
    tctx.stroke()
    const pattern = ctx.createPattern(tile, 'repeat')
    hatchCache.current[color] = pattern
    return pattern
  }

  function fillHatched(ctx, color, buildPath) {
    ctx.beginPath()
    buildPath()
    ctx.globalAlpha = 0.08
    ctx.fillStyle   = color
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle   = getHatchPattern(ctx, color)
    ctx.fill()
  }

  function drawRectOp(ctx, op, w, h) {
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    const rx = op.x * w, ry = op.y * h, rw = op.w * w, rh = op.h * h
    fillHatched(ctx, op.color, () => ctx.rect(rx, ry, rw, rh))
    ctx.strokeStyle = op.color
    ctx.lineWidth   = op.size
    ctx.strokeRect(rx, ry, rw, rh)
    ctx.restore()
  }

  function drawPolygonOp(ctx, op, w, h) {
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    const pts = op.points
    fillHatched(ctx, op.color, () => {
      ctx.moveTo(pts[0].x * w, pts[0].y * h)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h)
      ctx.closePath()
    })
    ctx.strokeStyle = op.color
    ctx.lineWidth   = op.size
    ctx.beginPath()
    ctx.moveTo(pts[0].x * w, pts[0].y * h)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h)
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }

  // Live rubber-band preview while a polygon is mid-construction: lines
  // through the placed points, one more to the current cursor, and dots
  // marking each vertex (the first one enlarged as the "click to close" target).
  function drawPolyPreview(ctx, w, h, cursorPt) {
    const pts = polyPoints.current
    if (pts.length === 0) return
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = color
    ctx.lineWidth   = 2
    ctx.beginPath()
    ctx.moveTo(pts[0].x * w, pts[0].y * h)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h)
    if (cursorPt) ctx.lineTo(cursorPt.x * w, cursorPt.y * h)
    ctx.stroke()
    ctx.setLineDash([])
    pts.forEach((p, i) => {
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, i === 0 ? 6 : 4, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    })
    ctx.restore()
  }

  function finishPolygon() {
    if (polyPoints.current.length >= 3) {
      historyRef.current.push({ type: 'polygon', color, size: penSize, points: polyPoints.current })
    }
    polyPoints.current = []
    setPolyPointCount(0)
    redraw()
  }

  function cancelPolygon() {
    polyPoints.current = []
    setPolyPointCount(0)
    redraw()
  }

  // ── Canvas pointer handlers ────────────────────────────────────────
  function canvasPct(e) {
    const c = canvasRef.current
    const r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) / c.width, y: (e.clientY - r.top) / c.height }
  }

  function onCanvasDown(e) {
    if (isPlaying || tool === 'move') return
    if (tool === 'text') {
      e.preventDefault()
      const pt = canvasPct(e)
      addTextBox(
        Math.max(1, Math.min(99, pt.x * 100)),
        Math.max(1, Math.min(99, pt.y * 100)),
      )
      return
    }
    if (tool === 'rect') {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      drawingRef.current = true
      const pt = canvasPct(e)
      rectStart.current = pt
      rectEnd.current   = pt
      return
    }
    if (tool === 'polygon') {
      e.preventDefault()
      const pt  = canvasPct(e)
      const pts = polyPoints.current
      if (pts.length >= 3) {
        const c  = canvasRef.current
        const dx = (pt.x - pts[0].x) * c.width
        const dy = (pt.y - pts[0].y) * c.height
        if (Math.hypot(dx, dy) < 14) { finishPolygon(); return }
      }
      polyPoints.current = [...pts, pt]
      setPolyPointCount(polyPoints.current.length)
      redrawWithExtra((ctx, w, h) => drawPolyPreview(ctx, w, h, pt))
      return
    }
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const pt = canvasPct(e)
    currentPath.current = {
      type: 'path', color, size: penSize,
      isErase: tool === 'erase', points: [pt],
    }
    // Paint a dot on mouse-down for single clicks
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    ctx.save()
    ctx.beginPath()
    ctx.arc(pt.x * c.width, pt.y * c.height, (tool === 'erase' ? penSize * 2 : penSize / 2 + 1), 0, Math.PI * 2)
    if (tool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = color
    }
    ctx.fill()
    ctx.restore()
  }

  function onCanvasMove(e) {
    if (tool === 'rect' && drawingRef.current) {
      const pt = canvasPct(e)
      rectEnd.current = pt
      redrawWithExtra((ctx, w, h) => {
        const s = rectStart.current
        const rx = Math.min(s.x, pt.x) * w, ry = Math.min(s.y, pt.y) * h
        const rw = Math.abs(pt.x - s.x) * w, rh = Math.abs(pt.y - s.y) * h
        ctx.save()
        ctx.setLineDash([6, 4])
        ctx.strokeStyle = color
        ctx.lineWidth   = 2
        ctx.strokeRect(rx, ry, rw, rh)
        ctx.restore()
      })
      return
    }
    if (tool === 'polygon' && polyPoints.current.length > 0) {
      const pt = canvasPct(e)
      redrawWithExtra((ctx, w, h) => drawPolyPreview(ctx, w, h, pt))
      return
    }
    if (!drawingRef.current || !currentPath.current) return
    const pt   = canvasPct(e)
    const prev = currentPath.current.points[currentPath.current.points.length - 1]
    currentPath.current.points.push(pt)

    const c   = canvasRef.current
    const ctx = c.getContext('2d')
    ctx.save()
    ctx.beginPath()
    ctx.lineCap  = 'round'
    ctx.lineJoin = 'round'
    if (currentPath.current.isErase) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
      ctx.lineWidth   = currentPath.current.size * 4
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = currentPath.current.color
      ctx.lineWidth   = currentPath.current.size
    }
    ctx.moveTo(prev.x * c.width, prev.y * c.height)
    ctx.lineTo(pt.x   * c.width, pt.y   * c.height)
    ctx.stroke()
    ctx.restore()
  }

  function onCanvasUp() {
    if (tool === 'rect' && drawingRef.current) {
      drawingRef.current = false
      const s = rectStart.current, en = rectEnd.current
      if (s && en) {
        const w = Math.abs(en.x - s.x), h = Math.abs(en.y - s.y)
        if (w > 0.008 && h > 0.008) {
          historyRef.current.push({
            type: 'rect', color, size: penSize,
            x: Math.min(s.x, en.x), y: Math.min(s.y, en.y), w, h,
          })
        }
      }
      rectStart.current = null
      rectEnd.current   = null
      redraw()
      return
    }
    if (drawingRef.current && currentPath.current?.points.length > 0) {
      historyRef.current.push(currentPath.current)
    }
    drawingRef.current  = false
    currentPath.current = null
  }

  function onCanvasDoubleClick() {
    if (tool === 'polygon' && polyPoints.current.length >= 3) finishPolygon()
  }

  function clearCanvas() {
    if (isPlaying) return
    historyRef.current = []
    polyPoints.current = []
    setPolyPointCount(0)
    const c = canvasRef.current
    if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setActiveTextBoxes([])
    setEditingTextId(null)
  }

  // ── Token helpers ──────────────────────────────────────────────────
  const placedIds = new Set(tokens.map(t => t.sourceId))

  function addToken(source, isRival) {
    if (isPlaying || placedIds.has(source.id)) return
    const isPortero = source.position === 'Portero'

    let x, y
    if (isRival || source.kind) {
      // Rivals and single-instance material (the ball) both use a fixed
      // starting spot rather than the team formation slots below.
      x = toCtX(source.initX ?? 72)
      y = toCtY(source.initY ?? 50)
    } else {
      const mapped = TEAM_POS_MAP[source.position]
      if (mapped) {
        const cx = toCtX(mapped.x), cy = toCtY(mapped.y)
        const alreadyUsed = tokens.filter(t => !t.isRival).some(t => Math.abs(t.x - cx) < 3 && Math.abs(t.y - cy) < 3)
        if (!alreadyUsed) { x = cx; y = cy }
      }
      if (x === undefined) {
        const teamCount = tokens.filter(t => !t.isRival).length
        const slot = TEAM_SLOTS[teamCount % TEAM_SLOTS.length]
        x = toCtX(slot.x); y = toCtY(slot.y)
      }
    }

    setActiveTokens(prev => [...prev, {
      id:       `placed-${source.id}`,
      sourceId: source.id,
      dorsal:   source.dorsal ?? null,
      name:     source.name   || '',
      surname:  source.surname || '',
      position: source.position || '',
      short:    source.short   || null,
      color:    source.color   || null,
      materialKind: source.kind || null,
      isPortero,
      isRival,
      x, y,
    }])
  }

  // Equipment (goal/cone/pole/disc): unlike addToken above, this always adds
  // a fresh instance — a coach placing cones for a slalom needs several on
  // court at once, not a single toggleable one.
  function addMaterialInstance(source) {
    if (isPlaying) return
    const id = `placed-${source.id}-${++materialIdRef.current}`
    setActiveTokens(prev => [...prev, {
      id,
      sourceId: source.id,
      dorsal: null,
      name: source.name,
      short: null,
      color: null,
      materialKind: source.kind,
      isPortero: false,
      isRival: false,
      x: toCtX(source.initX ?? 50),
      y: toCtY(source.initY ?? 50),
    }])
  }

  function removeToken(tokenId) {
    if (isPlaying) return
    setActiveTokens(prev => prev.filter(t => t.id !== tokenId))
  }

  function tokenColor(tok) {
    // Rival tokens keep their squad's own color throughout (including the
    // keeper) so two rival groups placed at once stay visually distinct.
    if (tok.isRival) return tok.color || RIVAL_RED
    if (tok.isPortero) return KEEPER_COLOR
    return TEAM_COLOR
  }

  function shortLabel(tok) {
    if (tok.short) return tok.short
    if (tok.isRival) return tok.name.split(' ')[0]
    return tok.name || '?'
  }

  // ── Text box helpers ────────────────────────────────────────────────
  function addTextBox(x, y) {
    const id = `text-${textIdRef.current++}`
    setActiveTextBoxes(prev => [...prev, { id, x, y, text: '', color, fontSize: 12 + penSize * 2 }])
    setEditingTextId(id)
  }

  function updateTextBox(id, text) {
    setActiveTextBoxes(prev => prev.map(t => t.id === id ? { ...t, text } : t))
  }

  function removeTextBox(id) {
    setActiveTextBoxes(prev => prev.filter(t => t.id !== id))
    setEditingTextId(cur => cur === id ? null : cur)
  }

  function commitTextEdit(id) {
    setEditingTextId(null)
    setActiveTextBoxes(prev => {
      const box = prev.find(t => t.id === id)
      if (box && !box.text.trim()) return prev.filter(t => t.id !== id)
      return prev
    })
  }

  function onTextDown(e, id) {
    if (isPlaying) return
    if (tool === 'erase') {
      e.preventDefault()
      e.stopPropagation()
      removeTextBox(id)
      return
    }
    if (tool !== 'move') return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = courtRef.current.getBoundingClientRect()
    const box  = textBoxes.find(t => t.id === id)
    dragText.current = {
      id,
      offX: e.clientX - rect.left - (box.x / 100) * rect.width,
      offY: e.clientY - rect.top  - (box.y / 100) * rect.height,
    }
  }

  function onTextMove(e, id) {
    if (!dragText.current || dragText.current.id !== id) return
    const rect = courtRef.current.getBoundingClientRect()
    const x = Math.max(1, Math.min(99, ((e.clientX - rect.left - dragText.current.offX) / rect.width)  * 100))
    const y = Math.max(1, Math.min(99, ((e.clientY - rect.top  - dragText.current.offY) / rect.height) * 100))
    setActiveTextBoxes(prev => prev.map(t => t.id === id ? { ...t, x, y } : t))
  }

  function onTextUp() { dragText.current = null }

  // ── Token drag (pointer capture on token itself) ───────────────────
  function onTokenDown(e, tokenId) {
    if (isPlaying || tool !== 'move') return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = courtRef.current.getBoundingClientRect()
    const tok  = tokens.find(t => t.id === tokenId)
    drag.current = {
      id:   tokenId,
      offX: e.clientX - rect.left - (tok.x / 100) * rect.width,
      offY: e.clientY - rect.top  - (tok.y / 100) * rect.height,
    }
  }

  function onTokenMove(e, tokenId) {
    if (!drag.current || drag.current.id !== tokenId) return
    const rect = courtRef.current.getBoundingClientRect()
    const x = Math.max(1, Math.min(99, ((e.clientX - rect.left - drag.current.offX) / rect.width)  * 100))
    const y = Math.max(1, Math.min(99, ((e.clientY - rect.top  - drag.current.offY) / rect.height) * 100))
    setActiveTokens(prev => prev.map(t => t.id === tokenId ? { ...t, x, y } : t))
  }

  function onTokenUp() { drag.current = null }

  // ── Frames ─────────────────────────────────────────────────────────
  function cloneFrame(frame) {
    return {
      id: `frame-${++frameIdRef.current}`,
      tokens:    frame.tokens.map(t => ({ ...t })),
      textBoxes: frame.textBoxes.map(t => ({ ...t })),
    }
  }

  // New frame starts as a copy of the last one in the sequence, so the coach
  // only has to drag pieces to their next positions instead of rebuilding
  // the whole formation from scratch.
  function addFrame() {
    if (isPlaying) return
    setFrames(prev => [...prev, cloneFrame(prev[prev.length - 1])])
    setActiveFrameIndex(frames.length)
  }

  function selectFrame(index) {
    if (isPlaying) return
    setActiveFrameIndex(index)
  }

  function deleteFrame(index) {
    if (isPlaying || frames.length <= 1) return
    const next = frames.filter((_, i) => i !== index)
    setFrames(next)
    if (index < activeFrameIndex) setActiveFrameIndex(activeFrameIndex - 1)
    else if (index === activeFrameIndex) setActiveFrameIndex(Math.min(activeFrameIndex, next.length - 1))
  }

  function deleteAllFrames() {
    setFrames([{ id: `frame-${++frameIdRef.current}`, tokens: [], textBoxes: [] }])
    setActiveFrameIndex(0)
    setConfirmClearFrames(false)
  }

  // Drives both the on-screen preview and the video recording from the same
  // frame-to-frame tween loop — onTick just receives each interpolated
  // snapshot and decides what to do with it (render it, draw it, or both).
  function runSequence(onTick) {
    return new Promise(resolve => {
      playbackCancelRef.current = false
      if (frames.length < 2) { onTick({ tokens: frames[0].tokens, textBoxes: frames[0].textBoxes }); resolve(); return }

      let i = 0
      onTick({ tokens: frames[0].tokens, textBoxes: frames[0].textBoxes })

      function nextSegment() {
        if (playbackCancelRef.current || i >= frames.length - 1) { resolve(); return }
        const from = frames[i], to = frames[i + 1]
        const segStart = performance.now()
        function step(now) {
          if (playbackCancelRef.current) { resolve(); return }
          const t = Math.min(1, (now - segStart) / speedMs)
          onTick(interpolateFrames(from, to, easeInOutQuad(t)))
          if (t < 1) requestAnimationFrame(step)
          else { i++; nextSegment() }
        }
        requestAnimationFrame(step)
      }
      nextSegment()
    })
  }

  async function playPreview() {
    if (isPlaying || frames.length < 2) return
    setIsPlaying(true)
    await runSequence(snapshot => setPreviewFrame(snapshot))
    setPreviewFrame(null)
    setIsPlaying(false)
  }

  function stopPlayback() {
    playbackCancelRef.current = true
  }

  // ── Export ─────────────────────────────────────────────────────────
  // Shared by the static PNG export and the video recorder — draws one full
  // frame (background + persistent pencil layer + given tokens/text) onto
  // any canvas context. Reuses the already-loaded <img> element instead of
  // fetching PIZARRA_URL again, since this runs on every animation tick
  // during a recording (a fresh `new Image()` load per tick would be far
  // too slow).
  // Canvas equivalents of the material icons (PNG/video export can't reuse
  // the SVG components rendered on screen) — simplified shapes, not exact
  // reproductions, since they're small enough that the silhouette reads
  // fine at TOKEN_R scale.
  // Mirrors the CSS shapes in MaterialShape (goal bracket / cone triangle /
  // hollow ring / ball) — PNG/video export can't reuse DOM elements, so
  // these are the canvas-drawn equivalents.
  function drawMaterialToken(ctx, tok, tx, ty) {
    const style = MATERIAL_STYLE[tok.materialKind] || MATERIAL_STYLE.ball
    const r = TOKEN_R
    ctx.save()
    ctx.fillStyle = style.bg
    ctx.strokeStyle = style.bg
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (tok.materialKind === 'goal') {
      // Vertical blue/white striped post, matching the real goal posts.
      const barW = r * 0.75, barH = r * 2.6, stripes = 6
      const stripeH = barH / stripes
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#1d4ed8' : '#ffffff'
        ctx.fillRect(tx - barW / 2, ty - barH / 2 + i * stripeH, barW, stripeH)
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(tx - barW / 2, ty - barH / 2, barW, barH)
    } else if (tok.materialKind === 'cone') {
      ctx.beginPath()
      ctx.moveTo(tx, ty - r * 0.75)
      ctx.lineTo(tx + r * 0.7, ty + r * 0.7)
      ctx.lineTo(tx - r * 0.7, ty + r * 0.7)
      ctx.closePath()
      ctx.fill()
    } else if (tok.materialKind === 'ring') {
      ctx.lineWidth = Math.max(4, r * 0.32)
      ctx.beginPath()
      ctx.arc(tx, ty, r * 0.65, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      // Ball — crop the real photo into a circle; falls back to a plain
      // white disc if it hasn't finished loading yet.
      const rad = r * 0.75
      const img = ballImgRef.current
      ctx.beginPath()
      ctx.arc(tx, ty, rad, 0, Math.PI * 2)
      if (img && img.complete && img.naturalWidth) {
        ctx.save()
        ctx.clip()
        const s = Math.min(img.naturalWidth, img.naturalHeight)
        const sx = (img.naturalWidth - s) / 2
        const sy = (img.naturalHeight - s) / 2
        ctx.drawImage(img, sx, sy, s, s, tx - rad, ty - rad, rad * 2, rad * 2)
        ctx.restore()
      } else {
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(tx, ty, rad, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawBoardSnapshot(ctx, w, h, snapshotTokens, snapshotTextBoxes) {
    ctx.clearRect(0, 0, w, h)
    if (imgRef.current) ctx.drawImage(imgRef.current, 0, 0, w, h)
    if (canvasRef.current) ctx.drawImage(canvasRef.current, 0, 0, w, h)

    for (const tok of snapshotTokens) {
      const tx = (tok.x / 100) * w
      const ty = (tok.y / 100) * h

      if (tok.materialKind) {
        drawMaterialToken(ctx, tok, tx, ty)
        continue
      }

      ctx.beginPath()
      ctx.arc(tx, ty, TOKEN_R, 0, Math.PI * 2)
      ctx.fillStyle = tokenColor(tok)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth   = 2.5
      ctx.stroke()

      ctx.fillStyle   = '#fff'
      ctx.textAlign   = 'center'
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur  = 3

      if (tok.dorsal != null) {
        ctx.font = `bold 13px sans-serif`
        ctx.textBaseline = 'middle'
        ctx.fillText(String(tok.dorsal), tx, ty - 5)
        ctx.font = `8px sans-serif`
        ctx.fillText(shortLabel(tok), tx, ty + 7)
      } else {
        ctx.font = `bold 8px sans-serif`
        ctx.textBaseline = 'middle'
        ctx.fillText(shortLabel(tok), tx, ty)
      }
      ctx.shadowBlur = 0
    }

    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    for (const box of snapshotTextBoxes) {
      if (!box.text) continue
      const tx = (box.x / 100) * w
      const ty = (box.y / 100) * h
      ctx.font        = `bold ${box.fontSize}px Raleway, sans-serif`
      ctx.fillStyle   = box.color
      ctx.shadowColor = 'rgba(0,0,0,0.7)'
      ctx.shadowBlur  = 4
      ctx.fillText(box.text, tx, ty)
      ctx.shadowBlur = 0
    }
  }

  function buildBoardCanvas() {
    const court = courtRef.current
    if (!court) return null
    const rect = court.getBoundingClientRect()
    const off = document.createElement('canvas')
    off.width  = rect.width
    off.height = rect.height
    drawBoardSnapshot(off.getContext('2d'), off.width, off.height, tokens, textBoxes)
    return off
  }

  async function exportBoard() {
    const off = buildBoardCanvas()
    if (!off) return
    const url = off.toDataURL('image/png')
    const a   = document.createElement('a')
    a.href     = url
    a.download = 'pizarra-tactica.png'
    a.click()
  }

  async function copyBoardImage() {
    const off = buildBoardCanvas()
    if (!off) return
    try {
      const blob = await new Promise(res => off.toBlob(res, 'image/png'))
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopyStatus('done')
    } catch (err) {
      console.error('No se pudo copiar la pizarra al portapapeles:', err)
      setCopyStatus('error')
    }
    setTimeout(() => setCopyStatus(null), 1800)
  }

  const VIDEO_MIME_CANDIDATES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

  async function exportVideo() {
    if (isPlaying || frames.length < 2 || !VIDEO_EXPORT_SUPPORTED) return
    const court = courtRef.current
    if (!court) return
    const mimeType = VIDEO_MIME_CANDIDATES.find(m => MediaRecorder.isTypeSupported(m))
    if (!mimeType) {
      alert('Tu navegador no permite grabar vídeo directamente. Prueba con Chrome, Edge o Firefox actualizados.')
      return
    }

    const rect = court.getBoundingClientRect()
    const rec  = document.createElement('canvas')
    rec.width  = rect.width
    rec.height = rect.height
    const ctx  = rec.getContext('2d')
    drawBoardSnapshot(ctx, rec.width, rec.height, frames[0].tokens, frames[0].textBoxes)

    const stream   = rec.captureStream(30)
    const chunks   = []
    const recorder = new MediaRecorder(stream, { mimeType })
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

    setIsPlaying(true)
    setIsExportingVideo(true)
    recorder.start()

    await runSequence(snapshot => {
      setPreviewFrame(snapshot)
      drawBoardSnapshot(ctx, rec.width, rec.height, snapshot.tokens, snapshot.textBoxes)
    })
    const wasCancelled = playbackCancelRef.current
    // Hold the last frame briefly so the recording doesn't cut off mid-beat.
    if (!wasCancelled) await new Promise(res => setTimeout(res, 400))

    recorder.stop()
    await new Promise(res => { recorder.onstop = res })
    stream.getTracks().forEach(t => t.stop())

    if (!wasCancelled) {
      const blob = new Blob(chunks, { type: mimeType })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'pizarra-animacion.webm'
      a.click()
      URL.revokeObjectURL(url)
    }

    setPreviewFrame(null)
    setIsExportingVideo(false)
    setIsPlaying(false)
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', fontFamily: 'Raleway, sans-serif', overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #2563EB 0%, #172554 100%)',
        padding: '10px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.95)', color: '#172554', border: 'none',
          padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
          fontSize: 13, fontWeight: 700, fontFamily: 'Poppins, sans-serif',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}><ArrowLeftIcon size={14}/> Atrás</button>
        <span style={{ color: '#fff', fontFamily: 'Poppins, sans-serif', fontSize: 18, fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
           Pizarra Táctica
        </span>
        {/* placeholder to keep title centered */}
        <div style={{ width: 90 }}/>
      </div>

      {/* ── Drawing toolbar ── */}
      <div style={{
        background: 'linear-gradient(90deg, #172554 0%, #172554 50%, #172554 100%)',
        padding: '8px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, flexWrap: 'wrap',
        boxShadow: '0 3px 12px rgba(0,0,0,0.3)', flexShrink: 0,
        borderBottom: '2px solid rgba(37,99,235,0.4)',
      }}>

        {/* Mode buttons — icon-only, tooltip carries the label */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { id: 'draw',    Icon: PencilIcon,    label: 'Dibujar'     },
            { id: 'rect',    Icon: RectangleIcon, label: 'Rectángulo'  },
            { id: 'polygon', Icon: PolygonIcon,   label: 'Zona libre'  },
            { id: 'text',    Icon: TextIcon,      label: 'Texto'       },
            { id: 'erase',   Icon: EraserIcon,    label: 'Borrar'      },
            { id: 'move',    Icon: MoveIcon,      label: 'Mover'       },
          ].map(t => {
            const active = tool === t.id
            return (
              <button key={t.id} onClick={() => setTool(t.id)} title={t.label} aria-label={t.label} style={{
                width: 34, height: 34, borderRadius: 10, cursor: 'pointer', padding: 0,
                border:     'none',
                background: active ? '#2563EB' : 'rgba(255,255,255,0.12)',
                transition: 'all 0.15s',
                boxShadow:  active ? '0 2px 8px rgba(37,99,235,0.4)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <t.Icon size={16} color={active ? '#fff' : 'rgba(255,255,255,0.85)'}/>
              </button>
            )
          })}
        </div>

        <ToolDivider />

        {/* Color palette */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {PALETTE.map(c => (
            <button key={c} onClick={() => { setColor(c); if (!DRAW_TOOLS.includes(tool)) setTool('draw') }} style={{
              width: 22, height: 22, borderRadius: '50%', background: c, padding: 0, cursor: 'pointer',
              border: color === c ? '3px solid #2563EB' : c === '#ffffff' ? '1.5px solid rgba(255,255,255,0.5)' : '1.5px solid rgba(0,0,0,0.2)',
              transform: color === c ? 'scale(1.3)' : 'none', transition: 'transform 0.1s',
              boxShadow: color === c ? '0 0 6px rgba(37,99,235,0.7)' : 'none',
            }}/>
          ))}
          <input type="color" value={color} title="Color personalizado"
            onChange={e => { setColor(e.target.value); if (!DRAW_TOOLS.includes(tool)) setTool('draw') }}
            style={{ width: 26, height: 26, border: '2px solid rgba(255,255,255,0.3)', borderRadius: 6, cursor: 'pointer', padding: 1, background: 'transparent' }}
          />
        </div>

        <ToolDivider />

        {/* Pen sizes */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {PEN_SIZES.map(s => (
            <button key={s} onClick={() => { setPenSize(s); if (!DRAW_TOOLS.includes(tool)) setTool('draw') }} style={{
              width: s + 14, height: s + 14, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
              background:  penSize === s ? '#2563EB' : 'rgba(255,255,255,0.35)',
              transform:   penSize === s ? 'scale(1.2)' : 'none', transition: 'all 0.1s',
              minWidth: 16, minHeight: 16,
              boxShadow: penSize === s ? '0 0 6px rgba(37,99,235,0.6)' : 'none',
            }}/>
          ))}
        </div>

        <ToolDivider />

        {/* Material — icon-only like the tool buttons, name shows on hover via
            title. All repeatable "stamp" chips now, including the ball. */}
        <div style={{ display: 'flex', gap: 4 }}>
          {MATERIAL_PRESETS.map(m => {
            const count = tokens.filter(t => t.sourceId === m.id).length
            return (
              <button
                key={m.id}
                onClick={() => addMaterialInstance(m)}
                disabled={isPlaying}
                title={m.name} aria-label={m.name}
                style={{
                  position: 'relative', width: 34, height: 34, borderRadius: 10,
                  cursor: isPlaying ? 'not-allowed' : 'pointer', padding: 0,
                  border: 'none', background: 'rgba(255,255,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isPlaying ? 0.5 : 1,
                }}
              >
                <MaterialShape kind={m.kind} size={9} />
                {count > 0 && (
                  <span style={{
                    position: 'absolute', top: -5, right: -5, minWidth: 15, height: 15, borderRadius: 8,
                    background: '#2563EB', color: '#fff', fontSize: 9, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                  }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {tool === 'polygon' && polyPointCount > 0 && (
          <>
            <ToolDivider />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: 'Poppins, sans-serif' }}>
              {polyPointCount} punto{polyPointCount !== 1 ? 's' : ''}
            </span>
            <button onClick={finishPolygon} disabled={polyPointCount < 3} style={{
              padding: '6px 13px', borderRadius: 20, fontSize: 12, cursor: polyPointCount < 3 ? 'not-allowed' : 'pointer',
              border: 'none', background: polyPointCount < 3 ? 'rgba(37,99,235,0.3)' : '#2563EB', color: '#fff',
              fontFamily: 'Poppins, sans-serif', fontWeight: 700, opacity: polyPointCount < 3 ? 0.6 : 1,
            }}>Cerrar forma</button>
            <button onClick={cancelPolygon} style={{
              padding: '6px 13px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
              border: 'none', background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)',
              fontFamily: 'Poppins, sans-serif', fontWeight: 500,
            }}>Cancelar</button>
          </>
        )}

        <ToolDivider />

        <button onClick={clearCanvas} style={{
          padding: '6px 13px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
          border: 'none', background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)',
          fontFamily: 'Poppins, sans-serif', transition: 'all 0.15s', fontWeight: 500,
        }}>Limpiar</button>

        <ToolDivider />

        <button onClick={copyBoardImage} title="Copia la imagen para pegarla (Ctrl+V) al crear un ejercicio" style={{
          padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
          border: 'none',
          background: copyStatus === 'done' ? '#16a34a' : copyStatus === 'error' ? '#dc2626' : 'rgba(255,255,255,0.12)',
          color: copyStatus ? '#fff' : 'rgba(255,255,255,0.85)',
          fontFamily: 'Poppins, sans-serif', fontWeight: 700, transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {copyStatus === 'done' ? <CheckIcon size={13}/> : <CopyIcon size={13}/>}
          {copyStatus === 'done' ? '¡Copiada!' : copyStatus === 'error' ? 'No se pudo copiar' : 'Copiar imagen'}
        </button>

        <button onClick={exportBoard} style={{
          padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
          border: 'none', background: '#2563EB', color: '#fff',
          fontFamily: 'Poppins, sans-serif', fontWeight: 700, transition: 'all 0.15s',
          boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
        }}>Exportar PNG</button>
      </div>

      {/* ── Frames bar (animation) ── */}
      <div style={{
        background: 'rgba(0,0,0,0.4)', padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        borderBottom: '2px solid rgba(37,99,235,0.4)', flexShrink: 0,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, fontFamily: 'Poppins, sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
          Frames
        </span>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {frames.map((f, i) => (
            <FrameChip
              key={f.id}
              index={i}
              active={i === activeFrameIndex}
              dimmed={isPlaying}
              canDelete={frames.length > 1 && !isPlaying}
              onSelect={() => selectFrame(i)}
              onDelete={() => deleteFrame(i)}
            />
          ))}
          <button onClick={addFrame} disabled={isPlaying} title="Añadir frame (parte de la posición del último)" style={{
            width: 32, height: 32, borderRadius: 9, border: 'none', cursor: isPlaying ? 'not-allowed' : 'pointer',
            background: 'rgba(37,99,235,0.3)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isPlaying ? 0.5 : 1, flexShrink: 0,
          }}><PlusIcon size={15}/></button>
        </div>

        <ToolDivider />

        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'Poppins, sans-serif', flexShrink: 0 }}>Velocidad</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {SPEED_PRESETS.map(s => (
            <button key={s.ms} onClick={() => setSpeedMs(s.ms)} disabled={isPlaying} style={{
              padding: '5px 10px', borderRadius: 20, fontSize: 11, cursor: isPlaying ? 'not-allowed' : 'pointer',
              border: 'none', background: speedMs === s.ms ? '#2563EB' : 'rgba(255,255,255,0.12)',
              color: '#fff', fontFamily: 'Poppins, sans-serif', fontWeight: 700, opacity: isPlaying ? 0.5 : 1,
            }}>{s.label}</button>
          ))}
        </div>

        <ToolDivider />

        {!isPlaying ? (
          <button onClick={playPreview} disabled={frames.length < 2} title={frames.length < 2 ? 'Añade al menos 2 frames para reproducir' : 'Reproducir animación'} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: frames.length < 2 ? 'not-allowed' : 'pointer',
            border: 'none', background: frames.length < 2 ? 'rgba(255,255,255,0.1)' : '#16a34a', color: '#fff',
            fontFamily: 'Poppins, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
            opacity: frames.length < 2 ? 0.5 : 1,
          }}><PlayIcon size={13}/> Reproducir</button>
        ) : (
          <button onClick={stopPlayback} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            border: 'none', background: '#dc2626', color: '#fff',
            fontFamily: 'Poppins, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
          }}><PauseIcon size={13}/> {isExportingVideo ? 'Cancelar grabación' : 'Detener'}</button>
        )}

        <button
          onClick={exportVideo}
          disabled={isPlaying || frames.length < 2 || !VIDEO_EXPORT_SUPPORTED}
          title={!VIDEO_EXPORT_SUPPORTED ? 'Tu navegador no soporta grabar vídeo (prueba Chrome, Edge o Firefox)' : frames.length < 2 ? 'Añade al menos 2 frames' : 'Exportar la animación como vídeo'}
          style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12,
            cursor: (isPlaying || frames.length < 2 || !VIDEO_EXPORT_SUPPORTED) ? 'not-allowed' : 'pointer',
            border: 'none', background: '#2563EB', color: '#fff',
            fontFamily: 'Poppins, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
            opacity: (isPlaying || frames.length < 2 || !VIDEO_EXPORT_SUPPORTED) ? 0.5 : 1,
          }}
        ><DownloadIcon size={13}/> {isExportingVideo ? 'Grabando…' : 'Exportar vídeo'}</button>

        <div style={{ marginLeft: 'auto' }}>
          <button onClick={() => setConfirmClearFrames(true)} disabled={isPlaying} title="Borrar todos los frames" style={{
            padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: isPlaying ? 'not-allowed' : 'pointer',
            border: '1px solid rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.12)', color: '#fca5a5',
            fontFamily: 'Poppins, sans-serif', fontWeight: 600, opacity: isPlaying ? 0.5 : 1,
          }}>Eliminar todos</button>
        </div>
      </div>


      {/* ── 3-column main area ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, background: '#172554' }}>

        {/* Left panel – our team */}
        <SidePanel title="Equipo">
          {players.length === 0 && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textAlign: 'center', padding: 4, gridColumn: '1 / -1' }}>Sin jugadores</span>
          )}
          {players.map(p => (
            <TokenChip
              key={p.id}
              label={p.name}
              sub={`${p.dorsal}`}
              color={p.position === 'Portero' ? KEEPER_COLOR : TEAM_COLOR}
              placed={placedIds.has(p.id)}
              onToggle={() => placedIds.has(p.id) ? removeToken(`placed-${p.id}`) : addToken(p, false)}
            />
          ))}
        </SidePanel>

        {/* Court */}
        <div
          ref={courtRef}
          style={{
            flex: 1, position: 'relative', overflow: 'hidden', background: '#172554',
            cursor: tool === 'erase' ? ERASER_CURSOR
              : (tool === 'draw' || tool === 'rect' || tool === 'polygon') ? 'crosshair'
              : tool === 'text' ? 'text' : 'default',
          }}
        >
          {/* Background */}
          <img ref={imgRef} src={PIZARRA_URL} alt="pizarra" draggable={false}
            onLoad={computeImgBounds}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', pointerEvents: 'none', userSelect: 'none' }}
          />
          {/* Hidden preload so drawMaterialToken can draw the real ball photo on
              PNG/video export even before any ball token has been placed on screen. */}
          <img ref={ballImgRef} src={BALL_URL} alt="" style={{ display: 'none' }} />

          {/* Drawing canvas */}
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              pointerEvents: tool !== 'move' ? 'auto' : 'none',
              touchAction: 'none',
            }}
            onPointerDown={onCanvasDown}
            onPointerMove={onCanvasMove}
            onPointerUp={onCanvasUp}
            onPointerLeave={onCanvasUp}
            onDoubleClick={onCanvasDoubleClick}
          />

          {/* Placed tokens */}
          {tokens.map(tok => (
            <PlacedToken
              key={tok.id}
              tok={tok}
              tool={tool}
              isPlaying={isPlaying}
              tokenColor={tokenColor}
              shortLabel={shortLabel}
              onDown={onTokenDown}
              onMove={onTokenMove}
              onUp={onTokenUp}
              onRemove={removeToken}
            />
          ))}

          {/* Text boxes */}
          {textBoxes.map(box => {
            const editing = editingTextId === box.id
            return (
              <div
                key={box.id}
                onPointerDown={e => onTextDown(e, box.id)}
                onPointerMove={e => onTextMove(e, box.id)}
                onPointerUp={onTextUp}
                onDoubleClick={e => { e.stopPropagation(); setEditingTextId(box.id) }}
                style={{
                  position: 'absolute',
                  left: `${box.x}%`, top: `${box.y}%`,
                  transform: 'translate(-50%, -50%)',
                  cursor: isPlaying ? 'default' : tool === 'move' ? 'grab' : tool === 'erase' ? ERASER_CURSOR : 'default',
                  touchAction: 'none', userSelect: 'none', zIndex: 21,
                  pointerEvents: !isPlaying && (tool === 'move' || tool === 'erase' || editing) ? 'auto' : 'none',
                }}
              >
                {editing ? (
                  <input
                    autoFocus
                    value={box.text}
                    placeholder="Texto..."
                    onChange={e => updateTextBox(box.id, e.target.value)}
                    onBlur={() => commitTextEdit(box.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commitTextEdit(box.id) } }}
                    onPointerDown={e => e.stopPropagation()}
                    style={{
                      font: `bold ${box.fontSize}px 'Raleway', sans-serif`,
                      color: box.color, background: 'rgba(0,0,0,0.6)',
                      border: `1.5px dashed ${box.color}`, borderRadius: 4,
                      padding: '2px 6px', outline: 'none', minWidth: 70, maxWidth: 260,
                      textAlign: 'center', pointerEvents: 'auto',
                    }}
                  />
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    font: `bold ${box.fontSize}px 'Raleway', sans-serif`, color: box.color,
                    textShadow: '0 1px 4px rgba(0,0,0,0.75), 0 0 2px rgba(0,0,0,0.9)',
                    whiteSpace: 'pre', padding: '2px 4px', borderRadius: 4,
                    border: tool === 'move' && !isPlaying ? '1.5px dashed rgba(255,255,255,0.4)' : 'none',
                  }}>
                    {box.text || ' '}
                    {tool === 'move' && !isPlaying && (
                      <button onClick={e => { e.stopPropagation(); removeTextBox(box.id) }} style={{
                        width: 16, height: 16, borderRadius: '50%', border: '1.5px solid #bbb',
                        background: '#fff', color: '#333', fontSize: 9, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, lineHeight: 1, flexShrink: 0, pointerEvents: 'auto',
                      }}><XIcon size={9}/></button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Right panel – rivals (two squads, so a 2-team drill can place both) */}
        <SidePanel title="Rivales">
          {RIVAL_GROUPS.map(group => (
            <Fragment key={group.label}>
              <span style={{ gridColumn: '1 / -1', fontSize: 9.5, fontWeight: 700, color: group.color, textAlign: 'center', letterSpacing: '0.4px', marginTop: 2 }}>
                {group.label.toUpperCase()}
              </span>
              {group.presets.map(p => (
                <TokenChip
                  key={p.id}
                  label={p.name}
                  sub={p.short}
                  color={p.color}
                  placed={placedIds.has(p.id)}
                  onToggle={() => placedIds.has(p.id) ? removeToken(`placed-${p.id}`) : addToken(p, true)}
                />
              ))}
            </Fragment>
          ))}
        </SidePanel>

      </div>

      {confirmClearFrames && (
        <ConfirmModal
          title="Borrar todos los frames"
          message="¿Seguro que quieres borrar todos los frames y empezar de nuevo? Los dibujos a lápiz no se verán afectados."
          onConfirm={deleteAllFrames}
          onCancel={() => setConfirmClearFrames(false)}
        />
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────

// A piece placed on the court — player/rival (colored circle + dorsal) or
// material (its own natural shape via MaterialShape). The remove (×) button
// only shows up on hover, for either kind, instead of being permanently
// visible on every token while the "Mover" tool is active.
function PlacedToken({ tok, tool, isPlaying, tokenColor, shortLabel, onDown, onMove, onUp, onRemove }) {
  const [hover, setHover] = useState(false)
  const interactive = tool === 'move' && !isPlaying

  return (
    <div
      onPointerDown={e => onDown(e, tok.id)}
      onPointerMove={e => onMove(e, tok.id)}
      onPointerUp={onUp}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        left: `calc(${tok.x}% - ${TOKEN_R}px)`,
        top:  `calc(${tok.y}% - ${TOKEN_R}px)`,
        width: TOKEN_R * 2, height: TOKEN_R * 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: interactive ? 'grab' : 'default',
        touchAction: 'none', userSelect: 'none', zIndex: 20,
        pointerEvents: interactive ? 'auto' : 'none',
        overflow: 'visible',
      }}
    >
      {tok.materialKind ? (
        <MaterialShape kind={tok.materialKind} size={TOKEN_R} />
      ) : (
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: tokenColor(tok),
          border: '2.5px solid rgba(0,0,0,0.35)',
          boxShadow: '0 3px 10px rgba(0,0,0,0.55)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          transition: 'box-shadow 0.1s',
        }}>
          {tok.dorsal != null && (
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
              {tok.dorsal}
            </span>
          )}
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.92)', lineHeight: 1, marginTop: tok.dorsal != null ? 1 : 0, textAlign: 'center', padding: '0 2px', maxWidth: TOKEN_R * 2 - 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {shortLabel(tok)}
          </span>
        </div>
      )}
      {interactive && hover && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRemove(tok.id) }}
          style={{
            position: 'absolute', top: -8, right: -8,
            width: 18, height: 18, borderRadius: '50%', border: '1.5px solid #bbb',
            background: '#fff', color: '#333', fontSize: 10, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, lineHeight: 1,
          }}
        ><XIcon size={10}/></button>
      )}
    </div>
  )
}

function SidePanel({ title, children }) {
  return (
    <div className="tactical-side-panel" style={{
      background: 'rgba(0,0,0,0.55)', borderRight: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '8px 6px 6px', textAlign: 'center', color: '#2563EB',
        fontSize: 11, fontWeight: 700, fontFamily: 'Poppins, sans-serif',
        borderBottom: '1px solid rgba(255,255,255,0.15)', letterSpacing: '0.5px',
        flexShrink: 0, textTransform: 'uppercase',
      }}>{title}</div>
      <div className="tactical-side-panel-body" style={{
        flex: 1, overflowY: 'auto', padding: '6px',
        display: 'grid', gap: 5,
        alignContent: 'start',
      }}>
        {children}
      </div>
    </div>
  )
}

function TokenChip({ label, sub, color, placed, onToggle }) {
  return (
    <button onClick={onToggle} title={placed ? 'Quitar del campo' : 'Añadir al campo'} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: '7px 4px', borderRadius: 8, cursor: 'pointer', width: '100%',
      border:      placed ? '2px solid #2563EB' : '1.5px solid rgba(255,255,255,0.2)',
      background:  placed ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.06)',
      color: '#fff', transition: 'all 0.15s',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: sub ? 13 : 9, fontWeight: 700, color: '#fff',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        border: placed ? '2.5px solid #2563EB' : '2px solid rgba(255,255,255,0.2)',
        textAlign: 'center', padding: '0 2px', lineHeight: 1.2, flexShrink: 0,
      }}>
        {sub || label.split(' ')[0]}
      </div>
      <span style={{ fontSize: 9.5, lineHeight: 1.2, textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: placed ? '#2563EB' : '#ccc' }}>
        {label}
      </span>
    </button>
  )
}

function ToolDivider() {
  return <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }}/>
}

// Unlike TokenChip (place/remove toggle for a unique item), clicking this
// always adds one more instance — a coach setting up a slalom needs several
// cones on court, not just one. The badge shows how many are placed.
function FrameChip({ index, active, dimmed, canDelete, onSelect, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`Frame ${index + 1}`}
      style={{
        position: 'relative', width: 32, height: 32, borderRadius: 9,
        cursor: dimmed ? 'default' : 'pointer', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? '#2563EB' : 'rgba(255,255,255,0.12)',
        border: active ? '2px solid #93c5fd' : '1.5px solid rgba(255,255,255,0.2)',
        color: '#fff', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 13,
        boxShadow: active ? '0 2px 8px rgba(37,99,235,0.5)' : 'none',
        opacity: dimmed && !active ? 0.5 : 1, transition: 'all 0.15s',
      }}
    >
      {index + 1}
      {canDelete && hover && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Eliminar frame" aria-label="Eliminar frame"
          style={{
            position: 'absolute', top: -8, right: -8,
            width: 18, height: 18, borderRadius: '50%', border: '1.5px solid #bbb',
            background: '#fff', color: '#dc2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, cursor: 'pointer',
          }}
        ><XIcon size={10}/></button>
      )}
    </div>
  )
}

