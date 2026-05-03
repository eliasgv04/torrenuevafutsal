import React, {useState} from 'react'
import TeamList from '../components/TeamList'
import TeamPage from '../components/TeamPage'

export default function HomePage(){
  const [openTeam, setOpenTeam] = useState(null)
  return (
    <div>
      {openTeam ? <TeamPage team={openTeam} onBack={()=>setOpenTeam(null)} /> : <TeamList onOpen={t=>setOpenTeam(t)} />}
    </div>
  )
}
