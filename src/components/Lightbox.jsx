import React, { useEffect } from 'react'
import { XIcon } from './Icons'

export default function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} title="Cerrar" aria-label="Cerrar">
        <XIcon size={18} />
      </button>
      <img src={src} alt={alt} className="lightbox-img" onClick={e => e.stopPropagation()} />
    </div>
  )
}
