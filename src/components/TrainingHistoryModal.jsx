import React from 'react'
import { parseItemNotes, isFichaTraining } from '../lib/trainingFicha'

export default function TrainingHistoryModal({trainings, onClose, onExportTraining, onEditTraining, onDeleteTraining}){
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{maxWidth:860}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap'}}>
          <h3 style={{margin:0}}>📚 Historial de entrenamientos</h3>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <button className="btn btn-cancel" onClick={onClose} style={{marginTop:0}}>Cerrar</button>
          </div>
        </div>

        {trainings.length === 0 ? (
          <p className="small" style={{marginTop:16}}>No hay entrenamientos guardados todavía.</p>
        ) : (
          <div className="training-history">
            {trainings.map((training)=>{
              const isFicha = isFichaTraining(training)
              return (
                <div key={training.id} className="training-history-card">
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                    <div>
                      <strong>{new Date(training.training_date).toLocaleDateString('es-ES')}</strong>
                      <span className="small" style={{marginLeft:12}}>{training.items?.length || 0} ejercicios</span>
                      {isFicha && <span className="small" style={{marginLeft:8, color:'#0f9d58'}}>· ficha</span>}
                    </div>
                    <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                      {onEditTraining && isFicha && (
                        <button
                          className="btn"
                          onClick={() => onEditTraining(training)}
                          style={{marginTop:0, padding:'6px 12px', fontSize:'12px'}}
                        >
                          ✏️ Editar
                        </button>
                      )}
                      {onExportTraining && (
                        <button
                          className="btn"
                          onClick={() => onExportTraining(training)}
                          style={{marginTop:0, padding:'6px 12px', fontSize:'12px'}}
                        >
                          📥 Exportar PDF
                        </button>
                      )}
                      {onDeleteTraining && (
                        <button
                          className="btn btn-cancel"
                          onClick={() => onDeleteTraining(training)}
                          style={{marginTop:0, padding:'6px 12px', fontSize:'12px'}}
                        >
                          🗑️ Borrar
                        </button>
                      )}
                    </div>
                  </div>

                  {training.notes && <p className="small" style={{marginTop:8}}>{training.notes}</p>}

                  <ul style={{marginTop:8, marginBottom:0, paddingLeft:18}}>
                    {(training.items || []).map((item)=>{
                      const parsed = parseItemNotes(item.notes)
                      return (
                        <li key={item.id || `${training.id}-${item.exercise_id}-${item.order_index || 0}`} style={{marginBottom:8}}>
                          <strong>{item.exercise_name}</strong>
                          {item.category ? ` (${item.category})` : ''}
                          {item.planned_count ? ` - ${item.planned_count} veces` : ''}
                          {item.dimensions ? ` - ${item.dimensions}` : ''}
                          {item.objective ? <div className="small">Objetivo: {item.objective}</div> : null}
                          {parsed.text ? <div className="small">Notas: {parsed.text}</div> : null}
                          {parsed.extra_text ? <div className="small">Notas extra: {parsed.extra_text}</div> : null}
                          {parsed.custom_photo_url ? <div className="small" style={{color:'#0f9d58'}}>📷 foto custom</div> : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
