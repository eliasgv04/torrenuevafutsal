import React, {useState, useRef, useEffect} from 'react'

export default function InputModal({title, placeholder, onConfirm, onCancel}){
  const [input,setInput] = useState('')
  const inputRef = useRef(null)

  useEffect(()=>{
    inputRef.current?.focus()
  },[])

  function submit(){
    if(!input.trim()) return alert('Por favor ingresa un valor')
    onConfirm(input.trim())
  }

  function handleKeyPress(e){
    if(e.key === 'Enter') submit()
    if(e.key === 'Escape') onCancel()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{title}</h3>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          autoFocus
        />
        <div className="modal-buttons">
          <button className="btn btn-primary" onClick={submit}>Confirmar</button>
          <button className="btn btn-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
