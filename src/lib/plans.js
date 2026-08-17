// Single source of truth for the 3 seasonal plans — used by the landing
// page's pricing section, the plan-picker after signup, and AdminPanel's
// manual override UI. Prices are per season (one payment, no auto-renewal).
export const PLANS = [
  {
    id: 'single',
    name: '1 equipo',
    price: 10,
    max_teams: 1,
    features: ['1 equipo', 'Pizarra táctica', 'Entrenamientos y partidos', 'Estadísticas de jugadores'],
  },
  {
    id: 'triple',
    name: '3 equipos',
    price: 20,
    max_teams: 3,
    features: ['Hasta 3 equipos', 'Pizarra táctica', 'Entrenamientos y partidos', 'Estadísticas de jugadores'],
  },
  {
    id: 'unlimited',
    name: 'Equipos ilimitados',
    price: 30,
    max_teams: null,
    features: ['Equipos ilimitados', 'Pizarra táctica', 'Entrenamientos y partidos', 'Estadísticas de jugadores'],
  },
]

export function planLabel(planId) {
  return PLANS.find(p => p.id === planId)?.name || planId || 'Sin plan'
}
