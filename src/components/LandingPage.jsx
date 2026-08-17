import React, { useState } from 'react'
import { BoardIcon, DumbbellIcon, TrophyIcon, BarChartIcon } from './Icons'
import PitchLines from './PitchLines'
import LegalModal from './LegalModal'
import PlansSection from './PlansSection'

const FEATURES = [
  { Icon: BoardIcon, label: 'Pizarra táctica' },
  { Icon: DumbbellIcon, label: 'Entrenamientos' },
  { Icon: TrophyIcon, label: 'Partidos en vivo' },
  { Icon: BarChartIcon, label: 'Estadísticas' },
]

export default function LandingPage({ onLogin, onRegister, onSelectPlan }) {
  const [legalDoc, setLegalDoc] = useState(null)
  const [showPlans, setShowPlans] = useState(false)

  return (
    <div className="landing-page">
      <PitchLines />

      <div className="landing-hero">
        <div className="landing-brand">
          <img src="./futsalkit-icon.svg" alt="" className="landing-logo" />
          <span className="landing-wordmark">FutsalKit</span>
        </div>
        <p className="landing-eyebrow">Gestión de equipos de fútbol sala</p>
        <h1 className="landing-title">Entrena. Compite. Analiza.</h1>
        <p className="landing-subtitle">
          Pizarra táctica, planificación de entrenamientos, seguimiento de partidos en vivo
          y estadísticas de cada jugador — todo en un mismo sitio.
        </p>
        <div className="landing-ctas">
          <button className="btn btn-primary landing-btn-primary" onClick={onLogin}>Entrar</button>
          <button className="btn btn-secondary landing-btn-secondary" onClick={onRegister}>
            Crear cuenta
          </button>
          <button className="btn btn-secondary landing-btn-secondary" onClick={() => setShowPlans(true)}>
            Ver planes
          </button>
        </div>

        <div className="landing-features">
          {FEATURES.map(({ Icon, label }) => (
            <div className="landing-feature-pill" key={label}>
              <span className="landing-feature-icon"><Icon /></span>
              {label}
            </div>
          ))}
        </div>
      </div>

      <p className="landing-footer">
        FutsalKit — hecho para entrenadores de fútbol sala.
        {' · '}
        <button type="button" className="landing-footer-link" onClick={() => setLegalDoc('privacy')}>
          Política de privacidad
        </button>
        {' · '}
        <button type="button" className="landing-footer-link" onClick={() => setLegalDoc('legal')}>
          Aviso legal
        </button>
      </p>

      {legalDoc && <LegalModal initialDoc={legalDoc} onClose={() => setLegalDoc(null)} />}

      {showPlans && (
        <div className="modal-overlay" onClick={() => setShowPlans(false)}>
          <div className="modal-content modal-wide" style={{ maxWidth: 900, background: 'transparent', boxShadow: 'none' }} onClick={(e) => e.stopPropagation()}>
            <PlansSection
              title="Planes"
              subtitle="Un pago por temporada, sin renovación automática — cuando se te acaba, decides tú si sigues."
              ctaLabel="Elegir este plan"
              onSelectPlan={onSelectPlan}
            />
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button type="button" className="btn btn-cancel" style={{ display: 'inline-flex' }} onClick={() => setShowPlans(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
