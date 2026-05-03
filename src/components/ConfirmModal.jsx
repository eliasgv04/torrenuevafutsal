import React from 'react'

export default function ConfirmModal({title, message, onConfirm, onCancel}){
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{title || 'Confirmar'}</h3>
        <p style={{marginTop:8}}>{message}</p>
        <div className="modal-buttons">
          <button className="btn btn-danger" onClick={onConfirm}>Eliminar</button>
          <button className="btn btn-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
