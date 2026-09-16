import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { api } from './api'

const DEFAULT_ACCENT_START = '#1E3A8A'
const DEFAULT_ACCENT_END = '#2563EB'

// Same A4-at-96dpi pixel canvas pdfFicha.js renders to. Rasterizing a single
// fixed-size div with html2canvas and dropping it into the PDF as one image
// is the reliable path in this codebase — jsPDF's own .html()/autoPaging
// (what pdfExport.js and an earlier version of this file used) produced
// blank pages for this content.
const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

export function escapeHtml(value){
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function cleanText(value){
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function safeValue(value, fallback = '-'){
  const text = cleanText(value)
  return text || fallback
}

export async function fetchImageAsDataUrl(url){
  if(!url) return null
  try{
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if(!response.ok) return null
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }catch(error){
    console.warn('Image fetch failed:', url, error)
    return null
  }
}

export function formatMinSec(secs){
  const s = Math.max(0, Number(secs) || 0)
  const m = Math.floor(s / 60), r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function sumStat(rows, key){
  return rows.reduce((sum, r) => sum + (Number(r.st?.[key]) || 0), 0)
}

const POSITION_ORDER = ['Portero', 'Cierre', 'Ala Zurdo', 'Ala Diestro', 'Pivot']
export function positionRank(position){
  const idx = POSITION_ORDER.indexOf(position)
  return idx === -1 ? POSITION_ORDER.length : idx
}

// Div+grid "fake table" instead of a real <table> — pdfExport.js/pdfFicha.js
// never use <table> anywhere, and a real table was the likeliest cause of
// jsPDF's html2canvas pipeline producing blank pages (table layout/pagination
// is a known weak spot for it). All columns use fixed mm widths on purpose.
const PLAYERS_GRID_COLUMNS = '8mm 70mm 12mm 10mm 10mm 10mm 10mm 10mm 10mm 10mm 14mm'

export function buildPlayersRowsHtml(rows){
  if(rows.length === 0){
    return '<div class="players-row"><div class="empty-row">Sin jugadores en la plantilla</div></div>'
  }
  return rows.map(({ player, st }) => `
    <div class="players-row">
      <div class="col-dorsal">#${escapeHtml(player.dorsal)}</div>
      <div class="col-name">${escapeHtml([player.name, player.surname].filter(Boolean).join(' '))}</div>
      <div class="col-pos">${escapeHtml((player.position || '?').slice(0, 3))}</div>
      <div>${st.goals ?? 0}</div>
      <div>${st.assists ?? 0}</div>
      <div>${st.shots_on_goal ?? 0}</div>
      <div>${st.shots_out ?? 0}</div>
      <div>${st.fouls ?? 0}</div>
      <div>${st.yellow_cards ?? 0}</div>
      <div>${st.red_cards ?? 0}</div>
      <div>${escapeHtml(formatMinSec(st.minutes_played))}</div>
    </div>
  `).join('')
}

// Plain block/float layout on purpose — grid tracks using "auto" and
// direction:rtl (an earlier version of this bar) rendered as blank pages
// under jsPDF's html2canvas pipeline, so this sticks to the simplest CSS
// that's proven to work in pdfExport.js: fixed widths, no flex, no grid.
export function buildComparisonRowsHtml(teamName, rivalName, ourTotals, rivalTotals, accentEnd){
  const rows = [
    ['shots_on_goal', 'Tiros a puerta'],
    ['fouls', 'Faltas'],
    ['yellow_cards', 'Amarillas'],
    ['red_cards', 'Rojas'],
  ]
  return rows.map(([key, label]) => {
    const ours = ourTotals[key] ?? 0
    const rival = rivalTotals[key] ?? 0
    const max = Math.max(ours, rival, 1)
    const oursPct = Math.max(4, Math.round((ours / max) * 100))
    const rivalPct = Math.max(4, Math.round((rival / max) * 100))
    return `
      <div class="cmp-stat">
        <div class="cmp-stat-label">${escapeHtml(label)}</div>
        <div class="cmp-bar-line"><span class="cmp-bar-name">${escapeHtml(teamName)}</span><span class="cmp-bar-value">${ours}</span></div>
        <div class="cmp-track"><div class="cmp-fill" style="width:${oursPct}%;background:${accentEnd};"></div></div>
        <div class="cmp-bar-line"><span class="cmp-bar-name">${escapeHtml(rivalName)}</span><span class="cmp-bar-value">${rival}</span></div>
        <div class="cmp-track"><div class="cmp-fill" style="width:${rivalPct}%;background:#dc2626;"></div></div>
      </div>
    `
  }).join('')
}

export function buildHtmlDocument({ match, teamName, logoDataUrl, accentStart, accentEnd, playersRowsHtml, comparisonHtml, homeScore, awayScore, isHome }){
  const matchDate = match.match_date ? new Date(match.match_date).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }) : ''

  // Our team is always shown first, regardless of home/away — must match
  // ourScore/rivalScore below, which are also never swapped by isHome.
  const ourLabel = teamName
  const rivalLabel = match.rival_team_name
  const ourScore = isHome ? homeScore : awayScore
  const rivalScore = isHome ? awayScore : homeScore
  const resultColor = ourScore > rivalScore ? '#16a34a' : ourScore < rivalScore ? '#dc2626' : '#d97706'

  return `
    <div class="pdf-page">
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1f2937; background: #ffffff; }
        .pdf-page { width: 210mm; height: 297mm; padding: 10mm; background: #ffffff; overflow: hidden; }
        .header {
          background: linear-gradient(135deg, ${accentStart} 0%, ${accentEnd} 100%);
          color: #ffffff; border-radius: 4mm; padding: 4mm 4.5mm;
          display: grid; grid-template-columns: 16mm 1fr; align-items: center; gap: 3mm;
          margin-bottom: 4mm;
        }
        .header-logo { width: 16mm; height: 16mm; object-fit: contain; border-radius: 50%; background: rgba(255,255,255,0.16); padding: 1mm; }
        .header-copy { text-align: center; padding-right: 16mm; }
        .club-name { font-size: 13pt; font-weight: 700; line-height: 1.05; margin: 0; }
        .match-title { margin-top: 1mm; font-size: 9pt; font-weight: 700; }
        .club-date { margin-top: 0.8mm; font-size: 7.5pt; font-weight: 600; opacity: 0.95; text-transform: capitalize; }

        .scoreboard {
          display: grid; grid-template-columns: 1fr 14mm 1fr;
          align-items: center; gap: 2mm;
          border: 0.3mm solid #e5e7eb; border-radius: 2.5mm;
          padding: 3.5mm 4mm; margin-bottom: 3mm;
        }
        .score-name { font-size: 8pt; font-weight: 700; color: #374151; text-align: center; }
        .score-name.us { color: ${accentStart}; }
        .score-value { font-size: 16pt; font-weight: 800; text-align: center; color: ${resultColor}; }
        .score-sep { font-size: 11pt; font-weight: 700; color: #9ca3af; text-align: center; }
        .score-meta { grid-column: 1 / -1; text-align: center; font-size: 6.8pt; color: #6b7280; margin-top: 1mm; }

        .section { margin-top: 3mm; }
        .section-title {
          font-size: 8.5pt; font-weight: 700; color: ${accentStart};
          text-transform: uppercase; margin: 0 0 2mm 0;
        }

        .players-grid { border: 0.3mm solid #e5e7eb; border-radius: 2mm; overflow: hidden; }
        .players-header, .players-row {
          display: grid;
          grid-template-columns: ${PLAYERS_GRID_COLUMNS};
        }
        .players-header {
          background: ${accentStart}; color: #ffffff; font-weight: 700; font-size: 6.2pt;
        }
        .players-header > div, .players-row > div { padding: 1.4mm 1mm; text-align: center; }
        .players-row { font-size: 6.4pt; border-top: 0.2mm solid #eef0f2; }
        .players-row:nth-child(even) { background: #fbfcfd; }
        .col-name { text-align: left !important; font-weight: 600; }
        .col-dorsal { font-weight: 700; color: ${accentStart}; }
        .empty-row { text-align: center; color: #9ca3af; padding: 4mm; grid-column: 1 / -1; }

        .cmp-panel {
          border: 0.3mm solid #e5e7eb; border-radius: 2.5mm; padding: 3mm 4mm;
        }
        .cmp-stat { margin-bottom: 2.8mm; }
        .cmp-stat:last-child { margin-bottom: 0; }
        .cmp-stat-label {
          font-size: 6.8pt; font-weight: 700; color: ${accentStart};
          text-transform: uppercase; margin-bottom: 1mm;
        }
        .cmp-bar-line { overflow: hidden; font-size: 6.4pt; font-weight: 700; color: #374151; margin-bottom: 0.6mm; }
        .cmp-bar-name { float: left; }
        .cmp-bar-value { float: right; }
        .cmp-track {
          width: 100%; height: 2.4mm; background: #f1f3f5;
          border-radius: 1.2mm; overflow: hidden; margin-bottom: 1.4mm;
        }
        .cmp-fill { height: 2.4mm; border-radius: 1.2mm; }

        .notes-panel {
          border: 0.3mm solid #e5e7eb; border-radius: 2.5mm; padding: 2.5mm 3mm;
          font-size: 6.6pt; line-height: 1.35; color: #374151; white-space: pre-wrap;
        }

        .footer { margin-top: 4mm; font-size: 6.2pt; text-align: center; color: #6b7280; }
      </style>

      <div class="header">
        ${logoDataUrl ? `<img class="header-logo" src="${logoDataUrl}" alt="Escudo" />` : '<div class="header-logo"></div>'}
        <div class="header-copy">
          <div class="club-name">${escapeHtml(teamName)}</div>
          <div class="match-title">vs ${escapeHtml(safeValue(match.rival_team_name, 'Rival'))}</div>
          <div class="club-date">${escapeHtml(matchDate)}</div>
        </div>
      </div>

      <div class="scoreboard">
        <div>
          <div class="score-name us">${escapeHtml(ourLabel)}</div>
          <div class="score-value">${ourScore}</div>
        </div>
        <div class="score-sep">—</div>
        <div>
          <div class="score-name">${escapeHtml(rivalLabel)}</div>
          <div class="score-value">${rivalScore}</div>
        </div>
        <div class="score-meta">
          ${escapeHtml(safeValue(match.place))} · ${match.is_home === false ? 'Visitante' : 'Local'}${match.jornada ? ` · Jornada ${escapeHtml(match.jornada)}` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Jugadores</div>
        <div class="players-grid">
          <div class="players-header">
            <div>#</div><div class="col-name" style="color:#fff;">Nombre</div><div>Pos.</div>
            <div>G</div><div>A</div><div>T+</div><div>T-</div><div>F</div><div>TA</div><div>TR</div><div>Min</div>
          </div>
          ${playersRowsHtml}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Comparativa con el rival</div>
        <div class="cmp-panel">
          ${comparisonHtml}
        </div>
      </div>

      ${cleanText(match.notes) ? `
        <div class="section">
          <div class="section-title">Anotaciones</div>
          <div class="notes-panel">${escapeHtml(safeValue(match.notes))}</div>
        </div>
      ` : ''}

      <div class="footer">${escapeHtml(teamName)} · Generado automáticamente</div>
    </div>
  `
}

export async function exportMatchToPdf(match, players, team){
  try{
    if(!match) throw new Error('No hay datos del partido')

    const teamName = team?.name || 'Mi equipo'
    const accentStart = team?.gradient_start || DEFAULT_ACCENT_START
    const accentEnd = team?.gradient_end || DEFAULT_ACCENT_END

    const [logoDataUrl, playerStats, rivalStats] = await Promise.all([
      fetchImageAsDataUrl(team?.crest_url),
      api.getMatchPlayerStats(match.id),
      api.getRivalTeamStats(match.id)
    ])

    const playersArr = Array.isArray(players) ? players : []
    const statsByPlayer = {}
    ;(Array.isArray(playerStats) ? playerStats : []).forEach((st) => { statsByPlayer[st.player_id] = st })

    // Every player on the roster, not just those with recorded stats — a
    // player who didn't play still shows up with all-zero stats.
    const rows = playersArr
      .map((player) => ({ player, st: statsByPlayer[player.id] || {} }))
      .sort((a, b) =>
        positionRank(a.player.position) - positionRank(b.player.position) ||
        (a.player.dorsal ?? 0) - (b.player.dorsal ?? 0)
      )

    const isHome = match.is_home !== false
    const totalTeamGoals = sumStat(rows, 'goals')
    const totalRivalGoals = rivalStats?.goals ?? 0
    const homeScore = match.home_goals ?? (isHome ? totalTeamGoals : totalRivalGoals)
    const awayScore = match.away_goals ?? (isHome ? totalRivalGoals : totalTeamGoals)

    const ourTotals = {
      shots_on_goal: sumStat(rows, 'shots_on_goal'),
      fouls: sumStat(rows, 'fouls'),
      yellow_cards: sumStat(rows, 'yellow_cards'),
      red_cards: sumStat(rows, 'red_cards'),
    }
    const rivalTotals = {
      shots_on_goal: rivalStats?.shots_on_goal ?? 0,
      fouls: rivalStats?.fouls ?? 0,
      yellow_cards: rivalStats?.yellow_cards ?? 0,
      red_cards: rivalStats?.red_cards ?? 0,
    }

    const playersRowsHtml = buildPlayersRowsHtml(rows)
    const comparisonHtml = buildComparisonRowsHtml(teamName, safeValue(match.rival_team_name, 'Rival'), ourTotals, rivalTotals, accentEnd)

    const html = buildHtmlDocument({
      match, teamName, logoDataUrl, accentStart, accentEnd,
      playersRowsHtml, comparisonHtml, homeScore, awayScore, isHome
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
      const safeRival = String(match.rival_team_name || 'rival').replace(/\s+/g, '_')
      const date = match.match_date ? new Date(match.match_date).toISOString().slice(0, 10) : 'sin_fecha'
      pdf.save(`partido_${safeTeam}_vs_${safeRival}_${date}.pdf`)
    }finally{
      document.body.removeChild(wrapper)
    }
  }catch(err){
    console.error('Error PDF partido:', err)
    alert('Error al generar PDF: ' + (err.message || err))
  }
}
