import { jsPDF } from 'jspdf'

const DEFAULT_ACCENT_START = '#1E3A8A'
const DEFAULT_ACCENT_END = '#2563EB'

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

export function buildPlayerList(training, players){
  const playersArr = Array.isArray(players) ? players : []
  const ids = Array.isArray(training.attending_players) ? training.attending_players : []
  return ids
    .map((id) => {
      const player = playersArr.find((item) => item.id === id)
      if(!player) return null
      const fullName = [player.name, player.surname].filter(Boolean).join(' ')
      const dorsal = player.dorsal ? `#${player.dorsal}` : ''
      return [fullName, dorsal].filter(Boolean).join(' ')
    })
    .filter(Boolean)
}

export function buildObjectivesHtml(objectives){
  if(!objectives || typeof objectives !== 'object') return ''
  const rows = [
    ['Físicos', objectives.fisicos],
    ['Técnicos', objectives.tecnicos],
    ['Tácticos', objectives.tacticos],
    ['Psicológicos', objectives.psicologicos]
  ].filter(([, value]) => cleanText(value))

  if(rows.length === 0) return ''

  return rows.map(([label, value]) => `
    <div class="objective-row">
      <div class="objective-label">${escapeHtml(label)}</div>
      <div class="objective-value">${escapeHtml(safeValue(value))}</div>
    </div>
  `).join('')
}

export async function buildExerciseCardsHtml(items){
  const exercises = Array.isArray(items) ? items : []
  const cards = []

  for(const item of exercises){
    const photo = item.photo_url ? await fetchImageAsDataUrl(item.photo_url) : null
    cards.push(`
      <div class="exercise-card">
        ${photo ? `<img class="exercise-photo" src="${photo}" alt="${escapeHtml(item.exercise_name || 'Ejercicio')}" />` : '<div class="exercise-photo placeholder">Sin foto</div>'}
        <div class="exercise-body">
          <div class="exercise-title">${escapeHtml(safeValue(item.exercise_name, 'Ejercicio'))}</div>
          <div class="exercise-meta">${escapeHtml(safeValue(item.category, 'Sin categoría'))} · ${escapeHtml(safeValue(item.dimensions, 'Sin dimensiones'))}</div>
          ${cleanText(item.objective) ? `<div class="exercise-objective">${escapeHtml(safeValue(item.objective))}</div>` : ''}
          ${cleanText(item.notes) ? `<div class="exercise-notes">${escapeHtml(safeValue(item.notes))}</div>` : ''}
        </div>
      </div>
    `)
  }

  return cards.join('')
}

export function buildHtmlDocument({ training, players, teamName, logoDataUrl, accentStart, accentEnd, exercisesHtml, playersHtml, objectivesHtml }){
  const trainingDate = new Date(training.training_date).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return `
    <div class="pdf-page">
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Arial, Helvetica, sans-serif;
          color: #1f2937;
          background: #ffffff;
        }
        .pdf-page {
          width: 190mm;
          min-height: 277mm;
          padding: 6mm;
          background: #ffffff;
        }
        .header {
          background: linear-gradient(135deg, ${accentStart} 0%, ${accentEnd} 100%);
          color: #ffffff;
          border-radius: 4mm;
          padding: 4mm 4.5mm;
          display: grid;
          grid-template-columns: 16mm 1fr;
          align-items: center;
          gap: 3mm;
          margin-bottom: 4mm;
        }
        .header-logo {
          width: 16mm;
          height: 16mm;
          object-fit: contain;
          border-radius: 50%;
          background: rgba(255,255,255,0.16);
          padding: 1mm;
        }
        .header-copy {
          text-align: center;
          padding-right: 16mm;
        }
        .club-name {
          font-size: 14pt;
          font-weight: 700;
          line-height: 1.05;
          margin: 0;
        }
        .club-date {
          margin-top: 1mm;
          font-size: 7.5pt;
          font-weight: 600;
          opacity: 0.95;
          text-transform: capitalize;
        }
        .top-grid {
          display: grid;
          grid-template-columns: 1fr 45mm;
          gap: 4mm;
          align-items: start;
          margin-bottom: 3mm;
        }
        .panel {
          border: 0.3mm solid #e5e7eb;
          border-radius: 2.5mm;
          padding: 2.5mm 3mm;
          background: #ffffff;
        }
        .panel-title {
          color: ${accentStart};
          font-size: 8pt;
          font-weight: 700;
          letter-spacing: 0.02em;
          margin: 0 0 1.5mm 0;
          text-transform: uppercase;
        }
        .attendance-list {
          font-size: 6.6pt;
          line-height: 1.25;
          display: grid;
          gap: 1mm;
        }
        .attendance-item {
          padding-left: 0.5mm;
        }
        .notes-box {
          min-height: 72mm;
          border: 0.3mm solid #e5e7eb;
          border-radius: 2.5mm;
          padding: 2.5mm 3mm;
          background: #ffffff;
        }
        .notes-lines {
          margin-top: 2mm;
          height: 64mm;
          border: 0.3mm solid #f0f2f4;
          border-radius: 2mm;
          background-image: linear-gradient(to bottom, transparent 0, transparent 5.4mm, rgba(229,231,235,0.85) 5.4mm, rgba(229,231,235,0.85) 5.7mm, transparent 5.7mm);
          background-size: 100% 5.7mm;
        }
        .section {
          margin-top: 2.5mm;
        }
        .objectives-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5mm 3mm;
        }
        .objective-row {
          border-left: 1.5mm solid ${accentEnd};
          padding: 1.2mm 0 1.2mm 2mm;
          background: #fbfcfd;
          border-radius: 1.5mm;
        }
        .objective-label {
          font-size: 6.2pt;
          font-weight: 700;
          color: ${accentStart};
          margin-bottom: 0.6mm;
        }
        .objective-value {
          font-size: 6.4pt;
          line-height: 1.22;
          color: #1f2937;
        }
        .mini-boxes {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3mm;
          margin-top: 2.5mm;
        }
        .mini-box {
          min-height: 12mm;
          border: 0.3mm solid #e5e7eb;
          border-radius: 2.5mm;
          padding: 2mm 2.4mm;
        }
        .mini-label {
          font-size: 7pt;
          font-weight: 700;
          color: ${accentStart};
          margin-bottom: 1mm;
        }
        .mini-value {
          font-size: 6.4pt;
          color: #374151;
          line-height: 1.22;
          white-space: pre-wrap;
        }
        .section-title {
          font-size: 8.5pt;
          font-weight: 700;
          color: ${accentStart};
          text-transform: uppercase;
          margin: 0 0 2mm 0;
        }
        .exercise-list {
          display: grid;
          gap: 2.4mm;
        }
        .exercise-card {
          border: 0.3mm solid #e5e7eb;
          border-left: 1.5mm solid ${accentStart};
          border-radius: 3mm;
          padding: 2.5mm;
          display: grid;
          grid-template-columns: 24mm 1fr;
          gap: 2.5mm;
          align-items: start;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .exercise-photo {
          width: 24mm;
          height: 18mm;
          object-fit: cover;
          border-radius: 2mm;
          border: 0.3mm solid #f4f4f4;
          background: #f8fafc;
        }
        .exercise-photo.placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 6pt;
          color: #6b7280;
          text-align: center;
        }
        .exercise-title {
          font-size: 7.6pt;
          font-weight: 700;
          color: ${accentStart};
          margin-bottom: 0.8mm;
        }
        .exercise-meta {
          font-size: 6.2pt;
          color: #6b7280;
          margin-bottom: 1mm;
        }
        .exercise-objective {
          font-size: 6.4pt;
          line-height: 1.25;
          margin-bottom: 1mm;
        }
        .exercise-notes {
          font-size: 6.1pt;
          line-height: 1.22;
          color: #374151;
          font-style: italic;
        }
        .footer {
          margin-top: 3mm;
          font-size: 6.2pt;
          text-align: center;
          color: #6b7280;
        }
      </style>

      <div class="header">
        ${logoDataUrl ? `<img class="header-logo" src="${logoDataUrl}" alt="Escudo" />` : '<div class="header-logo"></div>'}
        <div class="header-copy">
          <div class="club-name">${escapeHtml(teamName)}</div>
          <div class="club-date">${escapeHtml(trainingDate)}</div>
        </div>
      </div>

      <div class="top-grid">
        <div>
          <div class="panel section">
            <div class="panel-title">Asistencia</div>
            <div class="attendance-list">
              ${playersHtml || '<div class="attendance-item">Sin asistencia registrada</div>'}
            </div>
          </div>

          <div class="panel section">
            <div class="panel-title">Objetivos de la sesión</div>
            <div class="objectives-grid">
              ${objectivesHtml || '<div style="font-size:6.5pt;color:#6b7280;">Sin objetivos registrados</div>'}
            </div>
          </div>

          <div class="mini-boxes">
            <div class="mini-box">
              <div class="mini-label">Video</div>
              <div class="mini-value">${escapeHtml(safeValue(training.video, 'Sin vídeo'))}</div>
            </div>
            <div class="mini-box">
              <div class="mini-label">Equipos</div>
              <div class="mini-value">${escapeHtml(safeValue(training.teams, 'Sin equipos'))}</div>
            </div>
          </div>
        </div>

        <div class="notes-box">
          <div class="panel-title">Apuntes</div>
          <div style="font-size:6.4pt;color:#6b7280;line-height:1.3;">Espacio libre para escribir a mano.</div>
          <div class="notes-lines"></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Ejercicios</div>
        <div class="exercise-list">
          ${exercisesHtml || '<div style="font-size:6.5pt;color:#6b7280;">Sin ejercicios</div>'}
        </div>
      </div>

      <div class="footer">
        ${escapeHtml(teamName)} · Generado automáticamente
      </div>
    </div>
  `
}

export async function exportTrainingToPdf(training, players, team){
  try{
    if(!training) throw new Error('No hay datos de entrenamiento')

    const teamName = team?.name || 'Mi equipo'
    const accentStart = team?.gradient_start || DEFAULT_ACCENT_START
    const accentEnd = team?.gradient_end || DEFAULT_ACCENT_END

    const logoDataUrl = await fetchImageAsDataUrl(team?.crest_url)
    const playersHtml = buildPlayerList(training, players)
      .map((player) => `<div class="attendance-item">${escapeHtml(player)}</div>`)
      .join('')
    const objectivesHtml = buildObjectivesHtml(training.objectives)
    const exercisesHtml = await buildExerciseCardsHtml(training.items)

    const wrapper = document.createElement('div')
    wrapper.style.position = 'fixed'
    wrapper.style.left = '-10000px'
    wrapper.style.top = '0'
    wrapper.style.width = '190mm'
    wrapper.innerHTML = buildHtmlDocument({
      training,
      players,
      teamName,
      logoDataUrl,
      accentStart,
      accentEnd,
      exercisesHtml,
      playersHtml,
      objectivesHtml
    })
    document.body.appendChild(wrapper)

    const doc = new jsPDF('p', 'mm', 'a4')
    await doc.html(wrapper, {
      x: 0,
      y: 0,
      width: 190,
      windowWidth: 1080,
      autoPaging: 'text',
      html2canvas: {
        scale: 0.9,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      },
      callback: (pdf) => {
        const safeTeam = String(teamName || 'equipo').replace(/\s+/g, '_')
        const date = new Date(training.training_date).toISOString().slice(0, 10)
        pdf.save(`entrenamiento_${safeTeam}_${date}.pdf`)
      }
    })

    document.body.removeChild(wrapper)
  }catch(err){
    console.error('Error PDF:', err)
    alert('Error al generar PDF: ' + (err.message || err))
  }
}
