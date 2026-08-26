import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import {
  parseItemNotes,
  readFicha,
  sectionsFromItems,
  computeSessionNumber,
  SECTION
} from './trainingFicha'

const DEFAULT_ACCENT_START = '#1E3A8A'
const DEFAULT_ACCENT_END = '#2563EB'

// A4 dimensions for the design canvas. We render to this exact aspect ratio
// so the result fits one A4 page perfectly with print-friendly proportions.
const A4_WIDTH_PX = 794   // 210mm at 96dpi
const A4_HEIGHT_PX = 1123 // 297mm at 96dpi

function escapeHtml(value){
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
function cleanText(value){ return String(value ?? '').replace(/\s+/g, ' ').trim() }
function safe(value, fallback = ''){ const t = cleanText(value); return t || fallback }

// Loads the URL as an <img> and repaints it onto a canvas rather than doing
// fetch()+blob()+FileReader — that path inherits whatever (sometimes wrong
// or missing) Content-Type Storage sends back, which can produce a data URL
// the <img> tag refuses to render (shows as a broken image). Drawing to a
// canvas sidesteps that: toDataURL always emits a well-formed image/png.
function fetchAsDataUrl(url){
  if(!url) return Promise.resolve(null)
  if(url.startsWith('data:')) return Promise.resolve(url)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try{
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        canvas.getContext('2d').drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      }catch(_){ resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function pickPhotoUrl(item, exerciseLookup){
  if(!item) return null
  const parsed = parseItemNotes(item.notes)
  if(parsed.custom_photo_url) return parsed.custom_photo_url
  const ex = exerciseLookup?.get?.(item.exercise_id)
  return ex?.photo_url || null
}

function ensureFontsLoaded(){
  return new Promise((resolve) => {
    if(!document.getElementById('ficha-fonts-modern')){
      const link = document.createElement('link')
      link.id = 'ficha-fonts-modern'
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap'
      document.head.appendChild(link)
    }
    if(document.fonts && document.fonts.ready){
      document.fonts.ready.then(() => resolve()).catch(() => resolve())
    }else{
      setTimeout(resolve, 600)
    }
  })
}

function buildHtml({ training, ficha, sessionNumber, teamName, attending, extras, photos, logoDataUrl, accentStart, accentEnd }){
  const sections = sectionsFromItems(training.items || [])
  const inicio = sections[SECTION.WARMUP_INICIO] || []
  const movs = sections[SECTION.WARMUP_MOVIMIENTOS] || []
  const posesion = sections[SECTION.WARMUP_POSESION] || []
  const main = sections[SECTION.MAIN] || []
  const final = sections[SECTION.FINAL] || []

  const playerLookup = new Map(attending.map((p) => [p.id, p]))
  const extraLookup = new Map((extras || []).map((e) => [e.id, e]))

  // Roster: real players (with dorsal) + extras (no dorsal). Single integrated list.
  const rosterEntries = [
    ...attending.map((p) => ({ dorsal: p.dorsal, name: cleanText(p.name) })),
    ...extras.map((e) => ({ dorsal: null, name: cleanText(e.name) }))
  ].filter((e) => e.name)

  function teamMembers(team){
    const names = []
    ;(team.player_ids || []).forEach((id) => {
      const p = playerLookup.get(id)
      if(p){ names.push(cleanText(p.name)); return }
      const ex = extraLookup.get(id)
      if(ex) names.push(cleanText(ex.name))
    })
    return names
  }

  const teams = (ficha.teams || []).slice(0, 3)
  while(teams.length < 3) teams.push({ name: '', player_ids: [] })

  // Used for sections that can hold more than one exercise (Inicio balón,
  // Movimientos) — a compact text list instead of photo cards, since the
  // ficha renders onto a fixed A4 canvas and can't grow to fit N photos.
  function calList(items){
    if(!items || items.length === 0) return '<div class="cal-empty">—</div>'
    return `<div class="cal-mov-list">
      ${items.map((m) => `<div class="cal-mov-item"><span class="cal-mov-bullet"></span><span>${escapeHtml(m.exercise_name || '')}</span></div>`).join('')}
    </div>`
  }

  // Used for Posesión: the photo is the main visual (fills most of the
  // card), the exercise name is just a small caption underneath.
  function calListPhoto(items, photos){
    if(!items || items.length === 0) return '<div class="cal-empty">—</div>'
    return `<div class="cal-photo-list">
      ${items.map((m, idx) => `
        <div class="cal-photo-card">
          ${photos[idx]
            ? `<img class="cal-photo-card-img" src="${photos[idx]}" alt="" />`
            : '<div class="cal-photo-card-img cal-photo-card-img-empty"></div>'}
          <div class="cal-photo-card-name">${escapeHtml(m.exercise_name || '')}</div>
        </div>
      `).join('')}
    </div>`
  }

  function mainCard(item, photo, num){
    if(!item){
      return `<div class="main-card empty"><span class="main-num">${num}</span><span class="main-empty-text">—</span></div>`
    }
    const dims = safe(item.dimensions)
    return `
      <div class="main-card">
        <div class="main-card-text">
          <div class="main-num-row">
            <span class="main-num">${num}</span>
          </div>
          <div class="main-title">${escapeHtml(item.exercise_name || '')}</div>
          ${dims ? `<div class="main-dims">${escapeHtml(dims)}</div>` : ''}
        </div>
        ${photo
          ? `<img class="main-photo" src="${photo}" alt="" />`
          : '<div class="main-photo-empty"></div>'}
      </div>
    `
  }

  const finalItemLines = final.flatMap((item) => {
    const parsed = parseItemNotes(item.notes)
    return [
      `${item.exercise_name}${item.category ? ' · ' + item.category : ''}`,
      parsed.text
    ].filter(Boolean)
  })
  const finalLines = [...finalItemLines, ficha.final_extra_text].filter(Boolean)
  const finalDisplay = finalLines.length ? finalLines.join('\n') : ''

  return `
    <div class="ficha">
      <style>
        .ficha, .ficha *, .ficha *::before, .ficha *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .ficha {
          width: ${A4_WIDTH_PX}px;
          height: ${A4_HEIGHT_PX}px;
          background: #ffffff;
          padding: 26px 30px;
          font-family: 'Inter', -apple-system, system-ui, sans-serif;
          color: #0f172a;
          font-size: 11px;
          line-height: 1.35;
          -webkit-font-smoothing: antialiased;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* ===== HEADER ===== */
        .header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px;
        }
        .head-text { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
        .head-eyebrow {
          font-size: 9px; font-weight: 600; letter-spacing: 1.8px;
          text-transform: uppercase; color: #475569;
        }
        .head-title {
          font-family: 'Sora', sans-serif;
          font-weight: 800; font-size: 24px; line-height: 1;
          color: #0f172a; letter-spacing: -0.4px;
        }
        .head-team {
          display: inline-flex; align-self: flex-start; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: 999px;
          background: ${accentStart}; color: #ffffff;
          font-family: 'Sora', sans-serif; font-weight: 700; font-size: 11px;
          text-transform: uppercase; letter-spacing: 1px;
          margin-top: 2px;
          border: 1px solid ${accentStart};
        }
        .head-team::before {
          content: ''; width: 5px; height: 5px; border-radius: 50%;
          background: ${accentEnd};
        }
        .head-logo {
          width: 60px; height: 60px; object-fit: contain;
          flex-shrink: 0;
        }

        /* ===== META STRIP ===== */
        .meta-strip {
          display: grid; grid-template-columns: repeat(5, 1fr);
          background: #ffffff;
          border-radius: 8px;
          border: 1.2px solid #94a3b8;
          padding: 6px 0;
        }
        .meta-cell {
          padding: 0 10px;
          border-right: 1px solid #cbd5e1;
        }
        .meta-cell:last-child { border-right: none; }
        .meta-label {
          font-family: 'Sora', sans-serif;
          font-size: 8px; font-weight: 700; letter-spacing: 1.3px;
          text-transform: uppercase; color: #475569;
        }
        .meta-value {
          font-family: 'Sora', sans-serif;
          font-weight: 700; font-size: 12px;
          color: #0f172a; margin-top: 2px;
          font-variant-numeric: tabular-nums;
          min-height: 14px;
        }

        /* ===== INFO ROW (video + equipment) ===== */
        .info-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .info-card {
          border: 1.2px solid #94a3b8;
          border-radius: 8px;
          padding: 6px 10px;
          display: flex; flex-direction: column; gap: 2px;
          background: #ffffff;
          min-height: 36px;
        }
        .info-label {
          font-family: 'Sora', sans-serif;
          font-size: 8px; font-weight: 700; letter-spacing: 1.2px;
          text-transform: uppercase; color: #475569;
        }
        .info-value { font-size: 10.5px; color: #0f172a; min-height: 12px; }

        /* ===== ROSTER ROW ===== */
        .roster-row {
          display: grid;
          grid-template-columns: 0.8fr 0.7fr 1fr;
          gap: 8px;
        }
        .panel {
          border: 1.2px solid #94a3b8;
          border-radius: 8px;
          background: #ffffff;
          overflow: hidden;
          display: flex; flex-direction: column;
        }
        .panel-header {
          padding: 5px 10px;
          border-bottom: 1.2px solid #94a3b8;
          font-family: 'Sora', sans-serif;
          font-size: 8.5px; font-weight: 700; letter-spacing: 1.4px;
          text-transform: uppercase; color: #0f172a;
          display: flex; align-items: center; justify-content: space-between;
          background: #f1f5f9;
        }
        .panel-count {
          font-size: 8.5px; color: #475569; font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
        .panel-body { padding: 6px 8px; flex: 1; }

        .roster-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px 8px;
        }
        .roster-item {
          display: flex; align-items: baseline; gap: 4px;
          font-size: 10px;
          padding: 0;
          color: #0f172a;
          line-height: 1.35;
        }
        .roster-dorsal {
          font-family: 'Sora', sans-serif;
          font-weight: 700; color: #0f172a;
          font-variant-numeric: tabular-nums;
          min-width: 16px;
        }
        .roster-name { color: #0f172a; }
        .roster-extra { font-style: italic; }

        .notas-area {
          font-size: 10px; color: #334155;
          line-height: 1.5;
          white-space: pre-wrap;
        }

        .equipos-cols {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
        .equipo-col {
          display: flex; flex-direction: column;
          padding: 4px 0 0;
          border-top: 3px solid #475569;
          background: #ffffff;
        }
        .equipo-col-body {
          padding: 4px 6px 4px;
          display: flex; flex-direction: column; gap: 2px;
        }
        .equipo-name {
          font-size: 10px; color: #0f172a;
          line-height: 1.35;
        }
        .equipo-empty { font-size: 9.5px; color: #94a3b8; font-style: italic; }

        /* ===== OBJETIVO BANNER (light, writable on print) ===== */
        .objective {
          background: #fefce8;
          border: 1.5px solid #fde047;
          color: #0f172a;
          border-radius: 8px;
          padding: 8px 14px;
          display: flex; align-items: center; gap: 14px;
          min-height: 32px;
        }
        .objective-label {
          font-family: 'Sora', sans-serif;
          font-size: 9px; font-weight: 800; letter-spacing: 2px;
          text-transform: uppercase; color: #475569;
          flex-shrink: 0;
        }
        .objective-value {
          font-family: 'Sora', sans-serif;
          font-weight: 600; font-size: 13px;
          color: #0f172a; line-height: 1.25;
          flex: 1;
        }
        .objective-empty {
          flex: 1; min-height: 16px;
        }

        /* ===== SECTION TITLES ===== */
        .section-title {
          font-family: 'Sora', sans-serif;
          font-size: 10.5px; font-weight: 800; letter-spacing: 2.2px;
          text-transform: uppercase; color: #0f172a;
          margin: 2px 0 0;
          display: flex; align-items: center; gap: 10px;
        }
        .section-title::after {
          content: ''; flex: 1; height: 2px; background: #0f172a;
          border-radius: 1px; opacity: 0.85;
        }

        /* ===== CALENTAMIENTO ===== */
        .cal-grid {
          display: grid; grid-template-columns: 1fr 1.2fr 1fr;
          gap: 8px;
        }
        .cal-col {
          border: 1.2px solid #94a3b8;
          border-radius: 8px;
          background: #ffffff;
          padding: 8px;
          display: flex; flex-direction: column; gap: 6px;
          min-height: 100px;
        }
        .cal-col-label {
          font-family: 'Sora', sans-serif;
          font-size: 8.5px; font-weight: 800; letter-spacing: 1.2px;
          text-transform: uppercase; color: #475569;
          padding-bottom: 4px;
          border-bottom: 1px solid #cbd5e1;
        }
        .cal-card { display: flex; flex-direction: column; gap: 4px; }
        .cal-photo-wrap {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          height: 56px;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .cal-photo-wrap img {
          max-height: 100%; max-width: 100%; object-fit: contain;
        }
        .cal-title {
          font-family: 'Sora', sans-serif;
          font-weight: 700; font-size: 11px; color: #0f172a;
          line-height: 1.2;
        }
        .cal-meta { font-size: 9.5px; color: #475569; font-weight: 600; }
        .cal-empty { color: #94a3b8; font-size: 10px; padding: 12px 0; text-align: center; }

        .cal-mov-list {
          display: flex; flex-direction: column; gap: 3px;
          padding-top: 2px;
        }
        .cal-mov-item {
          display: flex; align-items: baseline; gap: 6px;
          font-size: 10.5px; color: #0f172a; line-height: 1.3;
        }
        .cal-mov-bullet {
          width: 5px; height: 5px; border-radius: 50%; background: #0f172a;
          flex-shrink: 0; margin-top: 4px;
        }
        .cal-photo-list {
          display: flex; flex-direction: column; gap: 6px;
        }
        .cal-photo-card-img {
          width: 100%; height: 54px; object-fit: cover; border-radius: 5px;
          border: 1px solid #cbd5e1; background: #f1f5f9; display: block;
        }
        .cal-photo-card-img-empty { background: #f1f5f9; }
        .cal-photo-card-name {
          font-size: 9px; font-weight: 600; color: #0f172a;
          line-height: 1.2; margin-top: 3px;
        }

        /* ===== PARTE PRINCIPAL ===== */
        .main-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .main-card {
          height: 110px;
          display: flex;
          gap: 8px;
          padding: 8px;
          background: #ffffff;
          border: 1.2px solid #94a3b8;
          border-radius: 10px;
          align-items: stretch;
        }
        .main-card.empty {
          align-items: center; justify-content: flex-start;
          color: #94a3b8;
          gap: 8px;
        }
        .main-card-text {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column;
          gap: 4px;
        }
        .main-num-row { display: flex; align-items: center; gap: 6px; }
        .main-num {
          font-family: 'Sora', sans-serif;
          font-weight: 800; font-size: 22px;
          color: #0f172a;
          line-height: 1;
          letter-spacing: -1px;
          font-variant-numeric: tabular-nums;
        }
        .main-card.empty .main-num { color: #cbd5e1; }
        .main-title {
          font-family: 'Sora', sans-serif;
          font-weight: 700; font-size: 13px;
          color: #0f172a; line-height: 1.18;
          word-wrap: break-word;
        }
        .main-dims {
          display: inline-flex; align-self: flex-start;
          padding: 2px 8px;
          border: 1px solid #475569;
          border-radius: 4px;
          background: #ffffff;
          color: #0f172a;
          font-family: 'Sora', sans-serif;
          font-weight: 700; font-size: 9.5px;
          margin-top: auto;
          letter-spacing: 0.5px;
        }
        .main-empty-text { font-size: 10.5px; align-self: center; }
        .main-card .main-photo {
          height: 100%;
          width: auto;
          max-width: 50%;
          object-fit: contain;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          flex-shrink: 0;
        }
        .main-photo-empty {
          width: 0;
        }

        /* ===== PARTE FINAL ===== */
        .final-card {
          background: #ffffff;
          border: 1.2px solid #94a3b8;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 11px;
          line-height: 1.5;
          color: #0f172a;
          white-space: pre-wrap;
          min-height: 40px;
        }
        .final-card.empty { min-height: 40px; }

        .spacer { flex: 1; }
      </style>

      <!-- HEADER -->
      <div class="header">
        <div class="head-text">
          <div class="head-eyebrow">${escapeHtml(teamName)}</div>
          <div class="head-title">Ficha de entrenamiento</div>
          <div class="head-team">${escapeHtml(safe(teamName, 'Equipo'))}</div>
        </div>
        ${logoDataUrl ? `<img class="head-logo" src="${logoDataUrl}" alt="Escudo" />` : ''}
      </div>

      <!-- META STRIP -->
      <div class="meta-strip">
        <div class="meta-cell"><div class="meta-label">Sesión</div><div class="meta-value">${escapeHtml(sessionNumber || '—')}</div></div>
        <div class="meta-cell"><div class="meta-label">Hora</div><div class="meta-value">${escapeHtml(safe(ficha.session_time, '—'))}</div></div>
        <div class="meta-cell"><div class="meta-label">Duración</div><div class="meta-value">${escapeHtml(safe(ficha.duration, '—'))}</div></div>
        <div class="meta-cell"><div class="meta-label">Lugar</div><div class="meta-value">${escapeHtml(safe(ficha.place, '—'))}</div></div>
        <div class="meta-cell"><div class="meta-label">Rival</div><div class="meta-value">${escapeHtml(safe(ficha.rival, '—'))}</div></div>
      </div>

      <!-- INFO ROW -->
      <div class="info-row">
        <div class="info-card">
          <div class="info-label">Vídeo</div>
          <div class="info-value">${escapeHtml(safe(ficha.video, '—'))}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Equipamiento</div>
          <div class="info-value">${escapeHtml(safe(ficha.equipment, '—'))}</div>
        </div>
      </div>

      <!-- ROSTER + NOTAS + EQUIPOS -->
      <div class="roster-row">
        <div class="panel">
          <div class="panel-header">
            <span>Jugadores</span>
            <span class="panel-count">${rosterEntries.length}</span>
          </div>
          <div class="panel-body">
            <div class="roster-grid">
              ${rosterEntries.length === 0
                ? '<div class="roster-item" style="grid-column:1/-1;color:#94a3b8;">Sin asistentes</div>'
                : rosterEntries.map((entry) => `
                  <div class="roster-item">
                    ${entry.dorsal != null && entry.dorsal !== ''
                      ? `<span class="roster-dorsal">${escapeHtml(entry.dorsal)}.</span>`
                      : '<span class="roster-dorsal" style="color:#cbd5e1">·</span>'
                    }
                    <span class="roster-name${entry.dorsal == null || entry.dorsal === '' ? ' roster-extra' : ''}">${escapeHtml(entry.name)}</span>
                  </div>
                `).join('')}
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><span>Notas</span></div>
          <div class="panel-body"><div class="notas-area">${escapeHtml(safe(training.notes))}</div></div>
        </div>

        <div class="panel">
          <div class="panel-header"><span>Equipos</span></div>
          <div class="panel-body">
            <div class="equipos-cols">
              ${teams.map((team, idx) => {
                const names = teamMembers(team)
                return `
                  <div class="equipo-col">
                    <div class="equipo-col-body">
                      ${names.length === 0
                        ? '<div class="equipo-empty">—</div>'
                        : names.map((n) => `<div class="equipo-name">${escapeHtml(n)}</div>`).join('')
                      }
                    </div>
                  </div>
                `
              }).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- OBJETIVO BANNER -->
      <div class="objective">
        <span class="objective-label">Objetivo</span>
        ${ficha.session_objective
          ? `<span class="objective-value">${escapeHtml(ficha.session_objective)}</span>`
          : '<span class="objective-empty"></span>'}
      </div>

      <!-- CALENTAMIENTO -->
      <h2 class="section-title">Calentamiento</h2>
      <div class="cal-grid">
        <div class="cal-col">
          <div class="cal-col-label">Inicio balón / Lúdico</div>
          ${calList(inicio)}
        </div>
        <div class="cal-col">
          <div class="cal-col-label">Movimientos tác/téc</div>
          ${calList(movs)}
        </div>
        <div class="cal-col">
          <div class="cal-col-label">Posesión</div>
          ${calListPhoto(posesion, photos.posesion)}
        </div>
      </div>

      <!-- PARTE PRINCIPAL -->
      <h2 class="section-title">Parte principal</h2>
      <div class="main-grid">
        ${main.length > 0
          ? main.map((item, idx) => mainCard(item, photos.main[idx], idx + 1)).join('')
          : mainCard(null, null, 1)}
      </div>

      <!-- PARTE FINAL -->
      <h2 class="section-title">Parte final</h2>
      <div class="final-card${finalDisplay ? '' : ' empty'}">${escapeHtml(finalDisplay)}</div>
    </div>
  `
}

export async function exportTrainingFichaToPdf(training, players, exercises, team, allTrainings){
  if(!training) throw new Error('No hay datos de entrenamiento')
  const teamName = team?.name || 'Equipo'
  const accentStart = team?.gradient_start || DEFAULT_ACCENT_START
  const accentEnd = team?.gradient_end || DEFAULT_ACCENT_END

  const playerLookup = new Map((players || []).map((p) => [p.id, p]))
  const exerciseLookup = new Map((exercises || []).map((ex) => [ex.id, ex]))
  const ficha = readFicha(training.objectives) || {}
  const sessionNumber = computeSessionNumber(allTrainings || [], training)

  const attending = (training.attending_players || [])
    .map((id) => playerLookup.get(id))
    .filter(Boolean)
    .sort((a, b) => Number(a.dorsal || 0) - Number(b.dorsal || 0))
  const extras = ficha.extra_attendees || []

  const sections = sectionsFromItems(training.items || [])
  const [logoDataUrl, posesionPhotos, mainPhotos] = await Promise.all([
    fetchAsDataUrl(team?.crest_url),
    Promise.all(sections[SECTION.WARMUP_POSESION].map((m) => fetchAsDataUrl(pickPhotoUrl(m, exerciseLookup)))),
    Promise.all(sections[SECTION.MAIN].map((m) => fetchAsDataUrl(pickPhotoUrl(m, exerciseLookup))))
  ])

  await ensureFontsLoaded()

  const html = buildHtml({
    training, ficha,
    sessionNumber: sessionNumber ? String(sessionNumber) : '',
    teamName,
    attending, extras,
    photos: { posesion: posesionPhotos, main: mainPhotos },
    logoDataUrl,
    accentStart,
    accentEnd
  })

  const wrapper = document.createElement('div')
  wrapper.style.position = 'fixed'
  wrapper.style.left = '0'
  wrapper.style.top = '0'
  wrapper.style.width = `${A4_WIDTH_PX}px`
  wrapper.style.height = `${A4_HEIGHT_PX}px`
  wrapper.style.zIndex = '-1'
  wrapper.style.opacity = '0'
  wrapper.style.pointerEvents = 'none'
  wrapper.style.background = '#ffffff'
  wrapper.style.overflow = 'hidden'
  wrapper.innerHTML = html
  document.body.appendChild(wrapper)

  try{
    await new Promise((r) => setTimeout(r, 80))

    const target = wrapper.firstElementChild
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: A4_WIDTH_PX,
      windowHeight: A4_HEIGHT_PX,
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX
    })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()

    const imgData = canvas.toDataURL('image/jpeg', 0.93)
    pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH)

    const safeTeam = String(teamName || 'equipo').replace(/\s+/g, '_')
    const date = training.training_date ? new Date(training.training_date).toISOString().slice(0, 10) : 'sin_fecha'
    pdf.save(`ficha_${safeTeam}_${date}.pdf`)
  }finally{
    document.body.removeChild(wrapper)
  }
}
