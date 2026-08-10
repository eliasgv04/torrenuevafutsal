import React from 'react'
import { BoardIcon, DumbbellIcon, TrophyIcon, BarChartIcon } from './Icons'
import PitchLines from './PitchLines'

const FEATURES = [
  { Icon: BoardIcon, label: 'Pizarra táctica' },
  { Icon: DumbbellIcon, label: 'Entrenamientos' },
  { Icon: TrophyIcon, label: 'Partidos en vivo' },
  { Icon: BarChartIcon, label: 'Estadísticas' },
]

export default function LandingPage({ onLogin, onRequestAccess }) {
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
          <button className="btn btn-secondary landing-btn-secondary" onClick={onRequestAccess}>
            Solicitar acceso para tu club
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

      <p className="landing-footer">FutsalKit — hecho para entrenadores de fútbol sala.</p>
    </div>
  )
}
