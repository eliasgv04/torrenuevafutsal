import { jsPDF } from 'jspdf'

const CLUB_NAME = 'Torrenueva Futsal'
const RGB = {
  primary: [15,157,88],
  accent: [244,180,0],
  text: [31,41,55],
  lightText: [107,114,128],
  border: [229,231,235]
}

async function fetchImageAsDataUrl(url){
  if(!url) return null
  try{
    const res = await fetch(url, {mode: 'cors', credentials: 'omit'})
    if(!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve,reject)=>{
      const r = new FileReader()
      r.onload = ()=>resolve(r.result)
      r.onerror = reject
      r.readAsDataURL(blob)
    })
  }catch(e){
    console.warn('Image fetch failed:', url, e)
    return null
  }
}

export async function exportTrainingToPdf(training, players, teamName){
  try{
    if(!training) throw new Error('No hay datos de entrenamiento')

    const doc = new jsPDF('p','mm','a4')
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    let y = 8

    // HEADER: logo + title + date
    doc.setFillColor(...RGB.primary)
    doc.rect(0, 0, pw, 22, 'F')
    
    // logo pequeño
    const logo = await fetchImageAsDataUrl(window.location.origin + '/logo-192.png')
    if(logo) try{ doc.addImage(logo,'PNG', 8, 2, 10, 10) }catch(e){}

    doc.setTextColor(255,255,255)
    doc.setFont('Helvetica','bold')
    doc.setFontSize(12)
    doc.text('Torrenueva Futsal', pw/2, 9, {align:'center'})
    doc.setFontSize(7)
    const dateStr = new Date(training.training_date).toLocaleDateString('es-ES', {weekday:'short', day:'numeric', month:'short', year:'2-digit'})
    doc.text(dateStr, pw/2, 15, {align:'center'})

    y = 26
    const contentW = pw - 28
    const startX = 14

    // ASISTENCIA - compacto
    if(Array.isArray(training.attending_players) && training.attending_players.length){
      doc.setFont('Helvetica','bold')
      doc.setFontSize(8)
      doc.setTextColor(...RGB.primary)
      doc.text('ASISTENCIA:', startX, y)
      y += 4
      doc.setFont('Helvetica','normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...RGB.text)
      const playersArr = Array.isArray(players) ? players : []
      const playerNames = training.attending_players.map(id => {
        const p = playersArr.find(x => x.id === id)
        return p ? \\ \\ : null
      }).filter(Boolean).join(', ')
      const wrapped = doc.splitTextToSize(playerNames, contentW)
      doc.text(wrapped, startX, y)
      y += Math.max(3, wrapped.length * 2.5) + 4
    }

    // OBJETIVOS
    if(training.objectives && typeof training.objectives === 'object'){
      const hasObj = Object.values(training.objectives).some(v => v)
      if(hasObj){
        doc.setFont('Helvetica','bold')
        doc.setFontSize(8)
        doc.setTextColor(...RGB.primary)
        doc.text('OBJETIVOS:', startX, y)
        y += 4
        doc.setFont('Helvetica','normal')
        doc.setFontSize(6.5)
        doc.setTextColor(...RGB.text)
        const labels = {fisicos:'Fis', tecnicos:'Tec', tacticos:'Tac', psicologicos:'Psi'}
        const objs = []
        for(const k of Object.keys(labels)){
          if(training.objectives[k]){
            objs.push(labels[k] + ': ' + String(training.objectives[k]).substring(0,50))
          }
        }
        const objText = objs.join('; ')
        const wrapped = doc.splitTextToSize(objText, contentW)
        doc.text(wrapped, startX, y)
        y += Math.max(3, wrapped.length * 2.5) + 4
      }
    }

    // VIDEO + EQUIPOS
    if(training.video || training.teams){
      doc.setFont('Helvetica','normal')
      doc.setFontSize(7)
      doc.setTextColor(...RGB.text)
      if(training.video){
        doc.setFont('Helvetica','bold')
        doc.text('Video:', startX, y)
        doc.setFont('Helvetica','normal')
        doc.text(String(training.video).substring(0,60), startX + 18, y)
        y += 3
      }
      if(training.teams){
        doc.setFont('Helvetica','bold')
        doc.text('Equipos:', startX, y)
        doc.setFont('Helvetica','normal')
        doc.text(String(training.teams).substring(0,60), startX + 23, y)
        y += 3
      }
      y += 3
    }

    // EJERCICIOS
    if(Array.isArray(training.items) && training.items.length){
      doc.setFont('Helvetica','bold')
      doc.setFontSize(9)
      doc.setTextColor(...RGB.primary)
      doc.text('EJERCICIOS', startX, y)
      y += 5

      for(const item of training.items){
        if(y > ph - 40){ doc.addPage(); y = 10 }

        let imgW = 0
        let imgH = 0
        
        if(item.photo_url){
          try{
            const imgData = await fetchImageAsDataUrl(item.photo_url)
            if(imgData){
              imgW = 20
              imgH = 18
              try{ doc.addImage(imgData, 'JPEG', startX, y, imgW, imgH) }catch(e){ console.warn('addImage error:', e) }
            }
          }catch(e){ console.warn('Photo fetch failed:', e) }
        }

        const textX = startX + imgW + (imgW > 0 ? 3 : 0)
        const textW = contentW - imgW - (imgW > 0 ? 3 : 0)

        doc.setFont('Helvetica','bold')
        doc.setFontSize(8)
        doc.setTextColor(...RGB.primary)
        doc.text(item.exercise_name || 'Ejercicio', textX, y + 5)

        doc.setFont('Helvetica','normal')
        doc.setFontSize(6.5)
        doc.setTextColor(...RGB.text)
        const cat = item.category ? item.category.substring(0, 20) : '-'
        const dim = item.dimensions ? item.dimensions.substring(0, 20) : '-'
        doc.text(\\ | \\, textX, y + 9)

        if(item.objective){
          const objText = String(item.objective).substring(0, 60)
          const wrapped = doc.splitTextToSize(objText, textW)
          doc.text(wrapped, textX, y + 12)
          const lines = wrapped.length
          y += Math.max(imgH, 3 + lines * 2.5) + 4
        } else {
          y += Math.max(imgH, 14) + 3
        }

        doc.setDrawColor(...RGB.border)
        doc.line(startX, y - 2, pw - 14, y - 2)
      }
    }

    // NOTAS
    if(training.notes && String(training.notes).trim()){
      if(y > ph - 50){ doc.addPage(); y = 10 }
      doc.setFont('Helvetica','bold')
      doc.setFontSize(8)
      doc.setTextColor(...RGB.primary)
      doc.text('NOTAS:', startX, y)
      y += 4
      doc.setFont('Helvetica','normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...RGB.text)
      const wrapped = doc.splitTextToSize(String(training.notes), contentW)
      doc.text(wrapped, startX, y)
    }

    // footer
    doc.setFontSize(7)
    doc.setTextColor(...RGB.lightText)
    doc.text(\\\, pw/2, ph - 4, {align:'center'})

    const safeTeam = (teamName || 'equipo').replace(/\\s+/g,'_')
    const date = new Date(training.training_date).toISOString().slice(0,10)
    doc.save(\entrenamiento_\_\.pdf\)
    console.log('PDF guardado:', \entrenamiento_\_\.pdf\)
  }catch(err){
    console.error('Error PDF:', err)
    alert('Error al generar PDF: ' + (err.message || err))
  }
}
