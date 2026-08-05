import React, { useState } from 'react'
import { ArrowLeftIcon, CalendarIcon, TrophyIcon } from './Icons'
import TeamDashboardModal from './TeamDashboardModal'
import FutsalStats from './FutsalStats'

export default function TeamStatsView({ teamId, teamName, exercises, trainings, onClose }){
  const [tab, setTab] = useState('trainings') // trainings | matches

  return (
    <div>
      <div className="header-top">
        <div>
          <button className="btn btn-back" onClick={onClose}>
            <ArrowLeftIcon size={15}/> Atrás
          </button>
          <h2 style={{display:'inline-block',marginLeft:16,marginTop:0}}>Estadísticas</h2>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button className={tab==='trainings' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('trainings')}>
            <CalendarIcon size={15}/> Entrenamientos
          </button>
          <button className={tab==='matches' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('matches')}>
            <TrophyIcon size={15}/> Partidos
          </button>
        </div>
      </div>

      {tab === 'trainings' ? (
        <TeamDashboardModal teamName={teamName} exercises={exercises} trainings={trainings} embedded />
      ) : (
        <div style={{background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-sm)'}}>
          <FutsalStats teamId={teamId} embedded />
        </div>
      )}
    </div>
  )
}
