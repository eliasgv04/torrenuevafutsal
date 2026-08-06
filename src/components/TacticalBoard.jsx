import { useState, useRef, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { ArrowLeftIcon, XIcon } from './Icons'

const PIZARRA_URL = import.meta.env.BASE_URL + 'futsalkit-pizarra.jpg'

const RIVAL_PRESETS = [
  { id: 'rv-1', name: 'Portero',     position: 'Portero',     dorsal: null, short: 'Por',   initX: 93, initY: 50 },
  { id: 'rv-2', name: 'Ala Zurdo',   position: 'Ala Zurdo',   dorsal: null, short: 'Ala Z', initX: 62, initY: 20 },
  { id: 'rv-3', name: 'Ala Diestro', position: 'Ala Diestro', dorsal: null, short: 'Ala D', initX: 62, initY: 80 },
  { id: 'rv-4', name: 'Pivot',       position: 'Pivot',       dorsal: null, short: 'Pivot', initX: 52, initY: 50 },
  { id: 'rv-5', name: 'Cierre',      position: 'Cierre',      dorsal: null, short: 'Cierre',initX: 74, initY: 50 },
]

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

// Here we only care about telling the two teams (and our own keeper) apart
// at a glance — not position, unlike Plantilla.
const TEAM_COLOR   = '#ca8a04'
const KEEPER_COLOR = '#15803d'
const RIVAL_COLOR  = '#dc2626'
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

export default function TacticalBoard({ teamId, onClose }) {
  const [players,   setPlayers]   = useState([])
  const [tokens,    setTokens]    = useState([])
  const [textBoxes, setTextBoxes] = useState([])
  const [editingTextId, setEditingTextId] = useState(null)
  const [tool,      setTool]      = useState('draw')
  const [color,     setColor]     = useState('#ffffff')
  const [penSize,   setPenSize]   = useState(4)

  const courtRef    = useRef(null)
  const canvasRef   = useRef(null)
  const imgRef      = useRef(null)
  const imgBounds   = useRef(null) // { left%, top%, width%, height% } of container
  const historyRef  = useRef([])
  const drawingRef  = useRef(false)
  const currentPath = useRef(null)
  const drag        = useRef(null)
  const dragText    = useRef(null)
  const textIdRef   = useRef(0)

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
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, w, h)

    for (const op of historyRef.current) {
      if (op.type === 'path') drawPath(ctx, op, w, h)
      else if (op.type === 'text') drawText(ctx, op, w, h)
    }
  }, [])

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

  // ── Canvas pointer handlers ────────────────────────────────────────
  function canvasPct(e) {
    const c = canvasRef.current
    const r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) / c.width, y: (e.clientY - r.top) / c.height }
  }

  function onCanvasDown(e) {
    if (tool === 'move') return
    if (tool === 'text') {
      e.preventDefault()
      const pt = canvasPct(e)
      addTextBox(
        Math.max(1, Math.min(99, pt.x * 100)),
        Math.max(1, Math.min(99, pt.y * 100)),
      )
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
    if (drawingRef.current && currentPath.current?.points.length > 0) {
      historyRef.current.push(currentPath.current)
    }
    drawingRef.current  = false
    currentPath.current = null
  }

  function clearCanvas() {
    historyRef.current = []
    const c = canvasRef.current
    if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setTextBoxes([])
    setEditingTextId(null)
  }

  // ── Token helpers ──────────────────────────────────────────────────
  const placedIds = new Set(tokens.map(t => t.sourceId))

  function addToken(source, isRival) {
    if (placedIds.has(source.id)) return
    const isPortero = source.position === 'Portero' || source.id === 'rv-1'

    let x, y
    if (isRival) {
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

    setTokens(prev => [...prev, {
      id:       `placed-${source.id}`,
      sourceId: source.id,
      dorsal:   source.dorsal ?? null,
      name:     source.name   || '',
      surname:  source.surname || '',
      position: source.position || '',
      short:    source.short   || null,
      isPortero,
      isRival,
      x, y,
    }])
  }

  function removeToken(tokenId) {
    setTokens(prev => prev.filter(t => t.id !== tokenId))
  }

  function tokenColor(tok) {
    if (tok.isPortero) return KEEPER_COLOR
    return tok.isRival ? RIVAL_COLOR : TEAM_COLOR
  }

  function shortLabel(tok) {
    if (tok.short) return tok.short
    if (tok.isRival) return tok.name.split(' ')[0]
    return tok.name || '?'
  }

  // ── Text box helpers ────────────────────────────────────────────────
  function addTextBox(x, y) {
    const id = `text-${textIdRef.current++}`
    setTextBoxes(prev => [...prev, { id, x, y, text: '', color, fontSize: 12 + penSize * 2 }])
    setEditingTextId(id)
  }

  function updateTextBox(id, text) {
    setTextBoxes(prev => prev.map(t => t.id === id ? { ...t, text } : t))
  }

  function removeTextBox(id) {
    setTextBoxes(prev => prev.filter(t => t.id !== id))
    setEditingTextId(cur => cur === id ? null : cur)
  }

  function commitTextEdit(id) {
    setEditingTextId(null)
    setTextBoxes(prev => {
      const box = prev.find(t => t.id === id)
      if (box && !box.text.trim()) return prev.filter(t => t.id !== id)
      return prev
    })
  }

  function onTextDown(e, id) {
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
    setTextBoxes(prev => prev.map(t => t.id === id ? { ...t, x, y } : t))
  }

  function onTextUp() { dragText.current = null }

  // ── Token drag (pointer capture on token itself) ───────────────────
  function onTokenDown(e, tokenId) {
    if (tool !== 'move') return
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
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, x, y } : t))
  }

  function onTokenUp() { drag.current = null }

  // ── Export ─────────────────────────────────────────────────────────
  async function exportBoard() {
    const court = courtRef.current
    if (!court) return
    const rect = court.getBoundingClientRect()

    const off = document.createElement('canvas')
    off.width  = rect.width
    off.height = rect.height
    const ctx  = off.getContext('2d')

    // 1. Pizarra background
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise(res => { img.onload = res; img.onerror = res; img.src = PIZARRA_URL })
    ctx.drawImage(img, 0, 0, off.width, off.height)

    // 2. Drawing strokes (canvas → offscreen)
    ctx.drawImage(canvasRef.current, 0, 0, off.width, off.height)

    // 3. Tokens
    for (const tok of tokens) {
      const tx = (tok.x / 100) * off.width
      const ty = (tok.y / 100) * off.height

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

    // 4. Text boxes
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    for (const box of textBoxes) {
      if (!box.text) continue
      const tx = (box.x / 100) * off.width
      const ty = (box.y / 100) * off.height
      ctx.font        = `bold ${box.fontSize}px Raleway, sans-serif`
      ctx.fillStyle   = box.color
      ctx.shadowColor = 'rgba(0,0,0,0.7)'
      ctx.shadowBlur  = 4
      ctx.fillText(box.text, tx, ty)
      ctx.shadowBlur = 0
    }

    const url = off.toDataURL('image/png')
    const a   = document.createElement('a')
    a.href     = url
    a.download = 'pizarra-tactica.png'
    a.click()
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

        {/* Mode buttons */}
        {[
          { id: 'draw',  Icon: PencilIcon, label: 'Dibujar' },
          { id: 'text',  Icon: TextIcon,   label: 'Texto'   },
          { id: 'erase', Icon: EraserIcon, label: 'Borrar'  },
          { id: 'move',  Icon: MoveIcon,   label: 'Mover'   },
        ].map(t => {
          const active = tool === t.id
          return (
            <button key={t.id} onClick={() => setTool(t.id)} style={{
              padding: '6px 13px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
              border:     'none',
              background: active ? '#2563EB' : 'rgba(255,255,255,0.12)',
              color:      active ? '#fff' : 'rgba(255,255,255,0.85)',
              fontWeight: active ? 700 : 500,
              fontFamily: 'Poppins, sans-serif',
              transition: 'all 0.15s',
              boxShadow:  active ? '0 2px 8px rgba(37,99,235,0.4)' : 'none',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <t.Icon size={13} color={active ? '#fff' : 'rgba(255,255,255,0.85)'}/>
              {t.label}
            </button>
          )
        })}

        <ToolDivider />

        {/* Color palette */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {PALETTE.map(c => (
            <button key={c} onClick={() => { setColor(c); if (tool !== 'erase') setTool('draw') }} style={{
              width: 22, height: 22, borderRadius: '50%', background: c, padding: 0, cursor: 'pointer',
              border: color === c ? '3px solid #2563EB' : c === '#ffffff' ? '1.5px solid rgba(255,255,255,0.5)' : '1.5px solid rgba(0,0,0,0.2)',
              transform: color === c ? 'scale(1.3)' : 'none', transition: 'transform 0.1s',
              boxShadow: color === c ? '0 0 6px rgba(37,99,235,0.7)' : 'none',
            }}/>
          ))}
          <input type="color" value={color} title="Color personalizado"
            onChange={e => { setColor(e.target.value); setTool('draw') }}
            style={{ width: 26, height: 26, border: '2px solid rgba(255,255,255,0.3)', borderRadius: 6, cursor: 'pointer', padding: 1, background: 'transparent' }}
          />
        </div>

        <ToolDivider />

        {/* Pen sizes */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {PEN_SIZES.map(s => (
            <button key={s} onClick={() => { setPenSize(s); if (tool !== 'erase') setTool('draw') }} style={{
              width: s + 14, height: s + 14, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
              background:  penSize === s ? '#2563EB' : 'rgba(255,255,255,0.35)',
              transform:   penSize === s ? 'scale(1.2)' : 'none', transition: 'all 0.1s',
              minWidth: 16, minHeight: 16,
              boxShadow: penSize === s ? '0 0 6px rgba(37,99,235,0.6)' : 'none',
            }}/>
          ))}
        </div>

        <ToolDivider />

        <button onClick={clearCanvas} style={{
          padding: '6px 13px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
          border: 'none', background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)',
          fontFamily: 'Poppins, sans-serif', transition: 'all 0.15s', fontWeight: 500,
        }}>Limpiar</button>

        <ToolDivider />

        <button onClick={exportBoard} style={{
          padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
          border: 'none', background: '#2563EB', color: '#fff',
          fontFamily: 'Poppins, sans-serif', fontWeight: 700, transition: 'all 0.15s',
          boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
        }}>Exportar PNG</button>
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
            cursor: tool === 'erase' ? ERASER_CURSOR : tool === 'draw' ? 'crosshair' : tool === 'text' ? 'text' : 'default',
          }}
        >
          {/* Background */}
          <img ref={imgRef} src={PIZARRA_URL} alt="pizarra" draggable={false}
            onLoad={computeImgBounds}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', pointerEvents: 'none', userSelect: 'none' }}
          />

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
          />

          {/* Placed tokens */}
          {tokens.map(tok => (
            <div
              key={tok.id}
              onPointerDown={e => onTokenDown(e, tok.id)}
              onPointerMove={e => onTokenMove(e, tok.id)}
              onPointerUp={onTokenUp}
              style={{
                position: 'absolute',
                left:  `calc(${tok.x}% - ${TOKEN_R}px)`,
                top:   `calc(${tok.y}% - ${TOKEN_R}px)`,
                width:  TOKEN_R * 2, height: TOKEN_R * 2, borderRadius: '50%',
                background:   tokenColor(tok),
                border:       '2.5px solid rgba(0,0,0,0.35)',
                boxShadow:    '0 3px 10px rgba(0,0,0,0.55)',
                display:      'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor:       tool === 'move' ? 'grab' : 'default',
                touchAction:  'none', userSelect: 'none', zIndex: 20,
                pointerEvents: tool === 'move' ? 'auto' : 'none',
                transition:   'box-shadow 0.1s',
              }}
            >
              {tok.dorsal != null && (
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                  {tok.dorsal}
                </span>
              )}
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.92)', lineHeight: 1, marginTop: tok.dorsal != null ? 1 : 0, textAlign: 'center', padding: '0 2px', maxWidth: TOKEN_R * 2 - 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {shortLabel(tok)}
              </span>
              {tool === 'move' && (
                <button onClick={e => { e.stopPropagation(); removeToken(tok.id) }} style={{
                  position: 'absolute', top: -8, right: -8,
                  width: 18, height: 18, borderRadius: '50%', border: '1.5px solid #bbb',
                  background: '#fff', color: '#333', fontSize: 10, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, lineHeight: 1,
                }}><XIcon size={10}/></button>
              )}
            </div>
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
                  cursor: tool === 'move' ? 'grab' : tool === 'erase' ? ERASER_CURSOR : 'default',
                  touchAction: 'none', userSelect: 'none', zIndex: 21,
                  pointerEvents: (tool === 'move' || tool === 'erase' || editing) ? 'auto' : 'none',
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
                    border: tool === 'move' ? '1.5px dashed rgba(255,255,255,0.4)' : 'none',
                  }}>
                    {box.text || ' '}
                    {tool === 'move' && (
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

        {/* Right panel – rivals */}
        <SidePanel title="Rivales">
          {RIVAL_PRESETS.map(p => (
            <TokenChip
              key={p.id}
              label={p.name}
              sub={p.short}
              color={RIVAL_COLOR}
              placed={placedIds.has(p.id)}
              onToggle={() => placedIds.has(p.id) ? removeToken(`placed-${p.id}`) : addToken(p, true)}
            />
          ))}
        </SidePanel>

      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────

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

