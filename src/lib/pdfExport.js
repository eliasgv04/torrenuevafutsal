import { jsPDF } from 'jspdf'

const CLUB_NAME = 'Torrenueva Futsal'
const COLORS = {
  primary: '#1e3a8a',    // Azul oscuro
  secondary: '#3b82f6',  // Azul
  accent: '#f59e0b',     // Ámbar
  text: '#1f2937',
  lightText: '#6b7280',
  border: '#e5e7eb'
}

export function exportTrainingToPdf(training, players, teamName) {
  try {
    if (!training) {
      console.error('No training data provided')
      throw new Error('No hay datos de entrenamiento')
    }

    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPosition = 10

    // Header with club info
    doc.setFillColor(parseInt(COLORS.primary.slice(1), 16) >> 16 & 255, 
                     parseInt(COLORS.primary.slice(1), 16) >> 8 & 255, 
                     parseInt(COLORS.primary.slice(1), 16) & 255)
    doc.rect(0, 0, pageWidth, 35, 'F')
    
    // Club name
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(24)
    doc.setTextColor(255, 255, 255)
    doc.text(CLUB_NAME, pageWidth / 2, 15, { align: 'center' })
    
    // Date and session info
    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    const trainingDate = new Date(training.training_date).toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    doc.text(`Entrenamiento - ${trainingDate}`, pageWidth / 2, 26, { align: 'center' })
    
    yPosition = 38

    // Players section
    if (training.attending_players && Array.isArray(training.attending_players) && training.attending_players.length > 0) {
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(30, 58, 138)
      doc.text('ASISTENCIA', 15, yPosition)
      
      yPosition += 6
      
      const playersArr = Array.isArray(players) ? players : []
      const selectedPlayerData = training.attending_players
        .map(playerId => {
          const player = playersArr.find(p => p.id === playerId)
          return player ? `${player.name || ''} ${player.surname || ''} (#${player.dorsal || '-'})`.trim() : null
        })
        .filter(Boolean)
      
      if (selectedPlayerData.length > 0) {
        doc.setFont('Helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(31, 41, 55)
        
        const playerCols = 2
        const playersPerCol = Math.ceil(selectedPlayerData.length / playerCols)
        let colX = 15
        let colY = yPosition
        let playerIndex = 0
        
        for (let col = 0; col < playerCols; col++) {
          colY = yPosition
          for (let i = 0; i < playersPerCol && playerIndex < selectedPlayerData.length; i++) {
            doc.text(`☐ ${selectedPlayerData[playerIndex]}`, colX, colY)
            colY += 5
            playerIndex++
          }
          colX += (pageWidth - 30) / playerCols
        }
        
        yPosition += (playersPerCol * 5) + 6
      }
    }

    // Objectives section
    if (training.objectives && typeof training.objectives === 'object' && Object.values(training.objectives).some(v => v)) {
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(30, 58, 138)
      doc.text('OBJETIVOS DE LA SESIÓN', 15, yPosition)
      
      yPosition += 6
      
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(31, 41, 55)
      
      const objectiveLabels = {
        fisicos: '📊 Objetivos Físicos',
        tecnicos: '🎯 Objetivos Técnicos',
        tacticos: '📋 Tácticos/Estrategia',
        psicologicos: '🧠 Objetivos Psicológicos'
      }
      
      for (const [key, label] of Object.entries(objectiveLabels)) {
        if (training.objectives[key]) {
          doc.setFont('Helvetica', 'bold')
          doc.setFontSize(9)
          doc.setTextColor(59, 130, 246)
          doc.text(label + ':', 15, yPosition)
          yPosition += 4
          
          doc.setFont('Helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(107, 114, 128)
          const wrapped = doc.splitTextToSize(String(training.objectives[key]), pageWidth - 30)
          doc.text(wrapped, 15, yPosition)
          yPosition += wrapped.length * 3.5 + 2
        }
      }
      
      yPosition += 2
    }

    // Warmup section
    if (training.warmup && String(training.warmup).trim()) {
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(30, 58, 138)
      doc.text('CALENTAMIENTO', 15, yPosition)
      
      yPosition += 6
      
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(31, 41, 55)
      const warmupWrapped = doc.splitTextToSize(String(training.warmup), pageWidth - 30)
      doc.text(warmupWrapped, 15, yPosition)
      yPosition += warmupWrapped.length * 4 + 4
    }

    // Check if we need a new page
    if (yPosition > pageHeight - 80) {
      doc.addPage()
      yPosition = 10
    }

    // Exercises section
    if (training.items && Array.isArray(training.items) && training.items.length > 0) {
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(30, 58, 138)
      doc.text('EJERCICIOS', 15, yPosition)
      
      yPosition += 8
      
      training.items.forEach((item, index) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 50) {
          doc.addPage()
          yPosition = 10
        }

        // Exercise number and name
        doc.setFont('Helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(59, 130, 246)
        doc.text(`${index + 1}. ${item.exercise_name || 'Ejercicio sin nombre'}`, 15, yPosition)
        yPosition += 5

        // Exercise details grid
        doc.setFont('Helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(31, 41, 55)
        
        const details = [
          { label: 'Categoría:', value: item.category || '-' },
          { label: 'Repeticiones:', value: item.planned_count || '-' },
          { label: 'Dimensiones:', value: item.dimensions || '-' }
        ]
        
        let detailX = 15
        details.forEach((detail, idx) => {
          doc.setFont('Helvetica', 'bold')
          doc.text(detail.label, detailX, yPosition)
          doc.setFont('Helvetica', 'normal')
          doc.setTextColor(107, 114, 128)
          doc.text(String(detail.value), detailX + 35, yPosition)
          detailX += 60
          if (idx === 2) {
            detailX = 15
            yPosition += 4
          }
        })
        
        yPosition += 4
        
        // Objective
        if (item.objective && String(item.objective).trim()) {
          doc.setFont('Helvetica', 'bold')
          doc.setFontSize(8)
          doc.setTextColor(30, 58, 138)
          doc.text('Objetivo:', 15, yPosition)
          yPosition += 3
          
          doc.setFont('Helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(31, 41, 55)
          const objWrapped = doc.splitTextToSize(String(item.objective), pageWidth - 30)
          doc.text(objWrapped, 15, yPosition)
          yPosition += objWrapped.length * 3 + 1
        }
        
        // Notes
        if (item.notes && String(item.notes).trim()) {
          doc.setFont('Helvetica', 'bold')
          doc.setFontSize(8)
          doc.setTextColor(30, 58, 138)
          doc.text('Notas:', 15, yPosition)
          yPosition += 3
          
          doc.setFont('Helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(31, 41, 55)
          const notesWrapped = doc.splitTextToSize(String(item.notes), pageWidth - 30)
          doc.text(notesWrapped, 15, yPosition)
          yPosition += notesWrapped.length * 3 + 3
        }

        // Space between exercises
        yPosition += 4
        
        // Divider line
        doc.setDrawColor(229, 231, 235)
        doc.line(15, yPosition, pageWidth - 15, yPosition)
        yPosition += 5
      })
    }

    // General notes section
    if (training.notes && String(training.notes).trim()) {
      if (yPosition > pageHeight - 40) {
        doc.addPage()
        yPosition = 10
      }
      
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(30, 58, 138)
      doc.text('NOTAS DE LA SESIÓN', 15, yPosition)
      
      yPosition += 5
      
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(31, 41, 55)
      const notesWrapped = doc.splitTextToSize(String(training.notes), pageWidth - 30)
      doc.text(notesWrapped, 15, yPosition)
    }

    // Footer
    doc.setFontSize(8)
    doc.setTextColor(107, 114, 128)
    doc.text(`${CLUB_NAME} - Generado automáticamente`, pageWidth / 2, pageHeight - 5, { align: 'center' })

    // Generate filename and save
    const safeTeamName = (teamName || 'equipo').replace(/\s+/g, '_')
    const dateStr = new Date(training.training_date).toISOString().slice(0, 10)
    const filename = `entrenamiento_${safeTeamName}_${dateStr}.pdf`
    
    console.log('Saving PDF:', filename)
    doc.save(filename)
    console.log('PDF saved successfully')
    
  } catch (error) {
    console.error('Error generating PDF:', error)
    alert('Error al generar el PDF: ' + error.message)
  }
}
        doc.setTextColor(COLORS.primary)
        doc.text('Notas:', 15, yPosition)
        yPosition += 3
        
        doc.setFont('Helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(COLORS.text)
        const notesWrapped = doc.splitTextToSize(item.notes, pageWidth - 30)
        doc.text(notesWrapped, 15, yPosition)
        yPosition += notesWrapped.length * 3 + 3
      }

      // Space between exercises
      yPosition += 4
      
      // Divider line
      doc.setDrawColor(COLORS.border)
      doc.line(15, yPosition, pageWidth - 15, yPosition)
      yPosition += 5
    })
  }

  // General notes section
  if (training.notes) {
    if (yPosition > pageHeight - 40) {
      doc.addPage()
      yPosition = 10
    }
    
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(COLORS.primary)
    doc.text('NOTAS DE LA SESIÓN', 15, yPosition)
    
    yPosition += 5
    
    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(COLORS.text)
    const notesWrapped = doc.splitTextToSize(training.notes, pageWidth - 30)
    doc.text(notesWrapped, 15, yPosition)
  }

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(COLORS.lightText)
  doc.text(`${CLUB_NAME} - Generado automáticamente`, pageWidth / 2, pageHeight - 5, { align: 'center' })

  const safeTeamName = teamName.replace(/\s+/g, '_')
  const dateStr = new Date(training.training_date).toISOString().slice(0, 10)
  doc.save(`entrenamiento_${safeTeamName}_${dateStr}.pdf`)
}
