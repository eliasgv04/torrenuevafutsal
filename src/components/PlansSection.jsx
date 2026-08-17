import React from 'react'
import { PLANS } from '../lib/plans'
import { CheckIcon } from './Icons'

export default function PlansSection({ onSelectPlan, ctaLabel = 'Elegir plan', loadingPlan = null, title, subtitle }) {
  return (
    <div className="plans-section">
      {title && <h2 className="plans-title">{title}</h2>}
      {subtitle && <p className="plans-subtitle">{subtitle}</p>}
      <div className="plans-grid">
        {PLANS.map(plan => (
          <div key={plan.id} className={`plan-card${plan.id === 'triple' ? ' plan-card-highlight' : ''}`}>
            {plan.id === 'triple' && <span className="plan-badge">Más popular</span>}
            <h3 className="plan-name">{plan.name}</h3>
            <p className="plan-price"><span>{plan.price}€</span> / temporada</p>
            <ul className="plan-features">
              {plan.features.map(f => (
                <li key={f}><CheckIcon size={13} color="var(--green-light)" /> {f}</li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 'auto', fontSize: 13, whiteSpace: 'nowrap', padding: '10px 8px' }}
              disabled={loadingPlan === plan.id}
              onClick={() => onSelectPlan(plan.id)}
            >
              {loadingPlan === plan.id ? 'Cargando…' : ctaLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
