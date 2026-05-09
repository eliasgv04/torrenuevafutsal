import React from 'react'

export default function TrainingHistoryModal({trainings, onClose, onExportPdf, onExportExcel, onExportTraining}){
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
            {trainings.map((training)=>(
              <div key={training.id} className="training-history-card">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                  <div>
                    <strong>{new Date(training.training_date).toLocaleDateString('es-ES')}</strong>
                    <span className="small" style={{marginLeft:12}}>{training.items?.length || 0} ejercicios</span>
                  </div>
                  {onExportTraining && (
                    <button 
                      className="btn" 
                      onClick={() => onExportTraining(training)} 
                      style={{marginTop:0, padding:'6px 12px', fontSize:'12px'}}
                    >
                      📥 Exportar PDF
                    </button>
                  )}
                </div>

                {training.notes && <p className="small" style={{marginTop:8}}>{training.notes}</p>}

                <ul style={{marginTop:8, marginBottom:0, paddingLeft:18}}>
                  {(training.items || []).map((item)=>(
                    <li key={item.id || `${training.id}-${item.exercise_id}-${item.order_index || 0}`} style={{marginBottom:8}}>
                      <strong>{item.exercise_name}</strong>
                      {item.category ? ` (${item.category})` : ''}
                      {item.planned_count ? ` - ${item.planned_count} veces` : ''}
                      {item.dimensions ? ` - ${item.dimensions}` : ''}
                      {item.objective ? <div className="small">Objetivo: {item.objective}</div> : null}
                      {item.notes ? <div className="small">Notas: {item.notes}</div> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
