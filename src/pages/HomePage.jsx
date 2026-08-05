import React, {useState} from 'react'
import TeamList from '../components/TeamList'
import TeamPage from '../components/TeamPage'

export default function HomePage({onActiveTeamChange}){
  const [openTeam, setOpenTeam] = useState(null)

  function open(team){
    setOpenTeam(team)
    onActiveTeamChange?.(team)
  }

  function back(){
    setOpenTeam(null)
    onActiveTeamChange?.(null)
  }

  return (
    <div>
      {openTeam ? <TeamPage team={openTeam} onBack={back} /> : <TeamList onOpen={open} />}
    </div>
  )
}
