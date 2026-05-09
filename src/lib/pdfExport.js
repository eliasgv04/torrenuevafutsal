import { jsPDF } from 'jspdf'

const CLUB_NAME = 'Torrenueva Futsal'
// club colors (green + yellow)
const RGB = {
  primary: [15,157,88],
  accent: [244,180,0],
  text: [31,41,55],
  lightText: [107,114,128],
  border: [229,231,235]
}

async function fetchImageAsDataUrl(url){
  try{
    const res = await fetch(url)
    if(!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve,reject)=>{
      const r = new FileReader()
      r.onload = ()=>resolve(r.result)
      r.onerror = reject
      r.readAsDataURL(blob)
    })
  }catch(e){
    return null
  }
}

export async function exportTrainingToPdf(training, players, teamName){
  try{
    if(!training) throw new Error('No hay datos de entrenamiento')

    const doc = new jsPDF('p','mm','a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let y = 12

    // logo
    const logo = await fetchImageAsDataUrl('/logo-192.png')
    if(logo){ try{ doc.addImage(logo,'PNG',14,8,20,20) }catch(e){} }

    // header background
    doc.setFillColor(...RGB.primary)
    doc.rect(0,0,pageWidth,28,'F')
    doc.setTextColor(255,255,255)
    doc.setFont('Helvetica','bold')
    doc.setFontSize(14)
    doc.text('Torrenueva Futsal', pageWidth/2, 14, {align:'center'})
    doc.setFontSize(8)
    doc.text(new Date(training.training_date).toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long', year:'numeric'}), pageWidth/2, 20, {align:'center'})

    y = 34

    // right-side blank area for handwriting notes
    const notesX = pageWidth - 64
    const notesW = 50
    doc.setDrawColor(...RGB.border)
    doc.rect(notesX, 32, notesW, pageHeight - 44)
    doc.setFontSize(8)
    doc.setTextColor(...RGB.lightText)
    doc.text('Espacio para apuntes', notesX + 4, 36)

    // ASSISTANCE (vertical, no ampersands)
    if(Array.isArray(training.attending_players) && training.attending_players.length){
      doc.setFontSize(10)
      doc.setTextColor(...RGB.primary)
      doc.setFont('Helvetica','bold')
      doc.text('ASISTENCIA', 14, y)
      y += 6
      doc.setFont('Helvetica','normal')
      doc.setFontSize(8)
      doc.setTextColor(...RGB.text)
      const playersArr = Array.isArray(players) ? players : []
      training.attending_players.forEach(id =>{
        const p = playersArr.find(x=>x.id===id)
        if(p){ doc.text(`${p.name || ''} ${p.surname || ''} (#${p.dorsal || '-'})`, 14, y); y += 5 }
      })
      y += 4
    }

    // OBJECTIVES - compact, no strange chars
    if(training.objectives && typeof training.objectives === 'object'){
      doc.setFont('Helvetica','bold')
      doc.setTextColor(...RGB.primary)
      doc.setFontSize(10)
      doc.text('OBJETIVOS DE LA SESIÓN', 14, y)
      y += 6
      doc.setFont('Helvetica','normal')
      doc.setFontSize(8)
      doc.setTextColor(...RGB.text)
      const labels = {fisicos:'Físicos', tecnicos:'Técnicos', tacticos:'Tácticos/Estrategia', psicologicos:'Psicológicos'}
      for(const k of Object.keys(labels)){
        if(training.objectives[k]){
          doc.setFont('Helvetica','bold')
          doc.text(labels[k]+':', 14, y)
          y += 4
          doc.setFont('Helvetica','normal')
          const wrapped = doc.splitTextToSize(String(training.objectives[k]), notesX - 28)
          doc.text(wrapped, 14, y)
          y += wrapped.length * 3.5 + 6
        }
      }
    }

    // small boxes: Video / Equipos
    const boxW = 80
    const boxH = 16
    doc.setFontSize(9)
    doc.setFont('Helvetica','bold')
    doc.setTextColor(...RGB.primary)
    doc.rect(14, y, boxW, boxH)
    doc.text('Video', 16, y+6)
    doc.setFont('Helvetica','normal')
    doc.setFontSize(8)
    if(training.video) doc.text(String(training.video), 18, y+11)

    doc.setFont('Helvetica','bold')
    doc.rect(14 + boxW + 6, y, boxW, boxH)
    doc.text('Equipos', 16 + boxW + 6, y+6)
    doc.setFont('Helvetica','normal')
    doc.setFontSize(8)
    if(training.teams) doc.text(String(training.teams), 18 + boxW + 6, y+11)
    y += boxH + 8

    // EXERCISES - compact vertical, include photo if present, omit repetitions
    if(Array.isArray(training.items) && training.items.length){
      doc.setFont('Helvetica','bold')
      doc.setTextColor(...RGB.primary)
      doc.setFontSize(11)
      doc.text('EJERCICIOS', 14, y)
      y += 8
      for(const item of training.items){
        if(y > pageHeight - 70){ doc.addPage(); y = 18 }
        // photo
        let photoW = 0
        if(item.photo_url){
          try{
            const data = await fetchImageAsDataUrl(item.photo_url)
            if(data){ doc.addImage(data,'PNG',14,y,36,26); photoW = 40 }
          }catch(e){}
        }
        const tx = 14 + photoW
        doc.setFont('Helvetica','bold')
        doc.setFontSize(10)
        doc.setTextColor(...RGB.primary)
        doc.text(item.exercise_name || 'Ejercicio', tx, y + 6)
        doc.setFont('Helvetica','normal')
        doc.setFontSize(8)
        doc.setTextColor(...RGB.text)
        const cat = item.category || '-'
        const dim = item.dimensions || '-'
        doc.text(`${cat} • ${dim}`, tx, y + 11)
        if(item.objective){
          const wrapped = doc.splitTextToSize(String(item.objective), notesX - tx - 6)
          doc.text(wrapped, tx, y + 16)
          y += Math.max(34, wrapped.length * 4 + 12)
        } else {
          y += 34
        }
        doc.setDrawColor(...RGB.border)
        doc.line(14, y - 6, notesX - 6, y - 6)
      }
    }

    // SESSION NOTES
    if(training.notes){
      if(y > pageHeight - 80){ doc.addPage(); y = 18 }
      doc.setFont('Helvetica','bold')
      doc.setTextColor(...RGB.primary)
      doc.setFontSize(10)
      doc.text('NOTAS DE LA SESIÓN', 14, y)
      y += 6
      doc.setFont('Helvetica','normal')
      doc.setFontSize(8)
      const wrapped = doc.splitTextToSize(String(training.notes), notesX - 28)
      doc.text(wrapped, 14, y)
      y += wrapped.length * 3.5 + 6
    }

    // footer
    doc.setFontSize(8)
    doc.setTextColor(...RGB.lightText)
    doc.text(`${CLUB_NAME} - Generado automáticamente`, pageWidth/2, pageHeight - 6, {align:'center'})
    const safeTeam = (teamName || 'equipo').replace(/\s+/g,'_')
    const dateStr = new Date(training.training_date).toISOString().slice(0,10)
    doc.save(`entrenamiento_${safeTeam}_${dateStr}.pdf`)
  }catch(err){
    console.error('Error generating PDF', err)
    alert('Error al generar PDF: ' + (err.message || err))
  }
}
