import React, {useMemo} from 'react'

function getMonthKey(value){
  const d = new Date(value)
  if(Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function getMonthLabel(key){
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('es-ES', {month: 'short', year: '2-digit'})
}

export default function TeamDashboardModal({teamName, exercises, trainings, onClose}){
  const data = useMemo(()=>{
    const totalExercises = exercises.length
    const totalTrainings = trainings.length
    const totalRecords = exercises.reduce((sum, ex)=>sum + (ex.totalCount || 0), 0)
    const totalPlannedItems = trainings.reduce((sum, tr)=>sum + (tr.items?.length || 0), 0)

    const activeExercises = exercises.filter(ex=>typeof ex.effectivenessAvg === 'number' && ex.totalCount > 0)
    const avgEffectiveness = activeExercises.length
      ? Math.round(activeExercises.reduce((sum, ex)=>sum + ex.effectivenessAvg, 0) / activeExercises.length)
      : 0

    const topExercises = [...exercises]
      .sort((a,b)=>(b.totalCount || 0) - (a.totalCount || 0))
      .slice(0, 6)

    const maxTop = topExercises.reduce((max, ex)=>Math.max(max, ex.totalCount || 0), 0) || 1

    const categoryMap = {}
    exercises.forEach((ex)=>{
      const key = ex.category || 'Sin categoría'
      categoryMap[key] = (categoryMap[key] || 0) + (ex.totalCount || 0)
    })
    const categoryData = Object.entries(categoryMap)
      .map(([name, value])=>({name, value}))
      .sort((a,b)=>b.value - a.value)
      .slice(0, 6)
    const maxCategory = categoryData.reduce((max, item)=>Math.max(max, item.value), 0) || 1

    const monthsMap = {}
    trainings.forEach((tr)=>{
      const key = getMonthKey(tr.training_date)
      if(!key) return
      monthsMap[key] = (monthsMap[key] || 0) + 1
    })
    const monthData = Object.entries(monthsMap)
      .map(([key, value])=>({key, label: getMonthLabel(key), value}))
      .sort((a,b)=>a.key.localeCompare(b.key))
      .slice(-8)
    const maxMonth = monthData.reduce((max, item)=>Math.max(max, item.value), 0) || 1

    return {
      totalExercises,
      totalTrainings,
      totalRecords,
      totalPlannedItems,
      avgEffectiveness,
      topExercises,
      maxTop,
      categoryData,
      maxCategory,
      monthData,
      maxMonth
    }
  }, [exercises, trainings])

  return (
    <div className="modal-overlay">
      <div className="modal-content dashboard-modal">
        <div className="dashboard-head">
          <div>
            <h3>Dashboard {teamName ? `- ${teamName}` : ''}</h3>
            <p>Resumen visual de actividad, uso de ejercicios y evolución.</p>
          </div>
          <button className="btn btn-cancel" style={{marginTop:0, padding:'8px 12px', fontSize:'12px'}} onClick={onClose}>✕ Cerrar</button>
        </div>

        <div className="dashboard-kpis">
          <div className="kpi-card"><span>Ejercicios</span><strong>{data.totalExercises}</strong></div>
          <div className="kpi-card"><span>Entrenamientos</span><strong>{data.totalTrainings}</strong></div>
          <div className="kpi-card"><span>Registros</span><strong>{data.totalRecords}</strong></div>
          <div className="kpi-card"><span>Efectividad media</span><strong>{data.avgEffectiveness}%</strong></div>
          <div className="kpi-card"><span>Ejercicios planificados</span><strong>{data.totalPlannedItems}</strong></div>
        </div>

        <div className="dashboard-panels">
          <section className="chart-panel">
            <h4>Ejercicios más trabajados</h4>
            {data.topExercises.length === 0 ? (
              <p className="small">Sin datos suficientes todavía.</p>
            ) : (
              <div className="bars-list">
                {data.topExercises.map((ex)=>(
                  <div key={ex.id} className="bar-row">
                    <div className="bar-label">{ex.name}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{width:`${Math.max(8, Math.round(((ex.totalCount || 0) / data.maxTop) * 100))}%`}} />
                    </div>
                    <div className="bar-value">{ex.totalCount || 0}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="chart-panel">
            <h4>Carga por categoría</h4>
            {data.categoryData.length === 0 ? (
              <p className="small">Sin datos suficientes todavía.</p>
            ) : (
              <div className="bars-list">
                {data.categoryData.map((item)=>(
                  <div key={item.name} className="bar-row">
                    <div className="bar-label">{item.name}</div>
                    <div className="bar-track">
                      <div className="bar-fill bar-fill-alt" style={{width:`${Math.max(8, Math.round((item.value / data.maxCategory) * 100))}%`}} />
                    </div>
                    <div className="bar-value">{item.value}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="chart-panel chart-panel-wide">
            <h4>Entrenamientos por mes</h4>
            {data.monthData.length === 0 ? (
              <p className="small">Sin datos suficientes todavía.</p>
            ) : (
              <div className="month-chart">
                {data.monthData.map((item)=>(
                  <div key={item.key} className="month-col">
                    <div className="month-bar-wrap">
                      <div className="month-bar" style={{height:`${Math.max(14, Math.round((item.value / data.maxMonth) * 120))}px`}} />
                    </div>
                    <span className="month-value">{item.value}</span>
                    <span className="month-label">{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
