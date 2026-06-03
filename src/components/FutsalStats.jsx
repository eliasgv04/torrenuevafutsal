import { useState, useEffect, useMemo } from 'react'
import { api } from '../lib/api'
import { ArrowLeftIcon } from './Icons'

// ── SVG helpers ─────────────────────────────────────────────────────────
function donutSegment(cx, cy, outer, inner, startDeg, endDeg) {
  if (endDeg - startDeg < 0.5) return ''
  const r  = d => (d - 90) * Math.PI / 180
  const p  = (rad, radius) => ({ x: cx + radius * Math.cos(r(rad)), y: cy + radius * Math.sin(r(rad)) })
  const p1 = p(startDeg, outer), p2 = p(endDeg, outer)
  const p3 = p(endDeg, inner),   p4 = p(startDeg, inner)
  const lg = endDeg - startDeg > 180 ? 1 : 0
  const f  = n => n.toFixed(2)
  return `M${f(p1.x)},${f(p1.y)} A${outer},${outer} 0 ${lg} 1 ${f(p2.x)},${f(p2.y)} L${f(p3.x)},${f(p3.y)} A${inner},${inner} 0 ${lg} 0 ${f(p4.x)},${f(p4.y)} Z`
}

// ── Sub-components ───────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background:'#fff', borderRadius:14, padding:'14px 18px', boxShadow:'0 4px 16px rgba(31,111,35,0.10)', borderTop:`4px solid ${color||'#1f6f23'}`, textAlign:'center', flex:'1 1 110px', minWidth:100 }}>
      <div style={{ fontSize:28, fontWeight:800, fontFamily:'Poppins', color: color||'#1f6f23', lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11, color:'#666', marginTop:4, fontWeight:600, textTransform:'uppercase', letterSpacing:.5 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'#999', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

function ResultBadge({ result }) {
  const map = { W:['#22c55e','V'], D:['#f59e0b','E'], L:['#ef4444','D'] }
  const [bg, letter] = map[result] || ['#ccc','?']
  return <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:26, height:26, borderRadius:6, background:bg, color:'#fff', fontSize:12, fontWeight:800, fontFamily:'Poppins' }}>{letter}</span>
}

function DonutChart({ wins, draws, losses }) {
  const total = wins + draws + losses
  if (!total) return <div style={{textAlign:'center',color:'#999',fontSize:12,padding:'20px'}}>Sin partidos finalizados</div>
  const segs = [
    { v: wins,   color:'#22c55e', label:'Victorias' },
    { v: draws,  color:'#f59e0b', label:'Empates'   },
    { v: losses, color:'#ef4444', label:'Derrotas'  },
  ]
  let cursor = 0
  return (
    <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap',justifyContent:'center'}}>
      <svg viewBox="0 0 120 120" width={120} height={120}>
        {segs.map((s, i) => {
          const startDeg = cursor / total * 360
          const endDeg   = (cursor + s.v) / total * 360
          cursor += s.v
          if (!s.v) return null
          return <path key={i} d={donutSegment(60, 60, 52, 32, startDeg, endDeg)} fill={s.color}/>
        })}
        <text x="60" y="57" textAnchor="middle" fontSize="18" fontWeight="800" fontFamily="Poppins" fill="#1f6f23">{total}</text>
        <text x="60" y="69" textAnchor="middle" fontSize="8"  fill="#888">partidos</text>
      </svg>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {segs.map((s,i) => (
          <div key={i} style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{width:12,height:12,borderRadius:3,background:s.color,display:'inline-block'}}/>
            <span style={{fontSize:12,color:'#555'}}>{s.label}: <strong>{s.v}</strong> ({total?Math.round(s.v/total*100):0}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GoalsBarChart({ data }) {
  if (!data.length) return <div style={{textAlign:'center',color:'#999',fontSize:12,padding:'20px'}}>Sin datos</div>
  const last = data.slice(-10)
  const maxG  = Math.max(5, ...last.map(m => Math.max(m.ourGoals, m.rivalGoals)))
  const W = 320, H = 130, padL = 24, padB = 28, padT = 8, padR = 8
  const cW = W - padL - padR, cH = H - padT - padB
  const bw = Math.min(16, cW / last.length / 2 - 3)

  return (
    <div>
      <div style={{display:'flex',gap:12,marginBottom:6,justifyContent:'center'}}>
        <span style={{display:'flex',alignItems:'center',gap:4,fontSize:11}}><span style={{width:10,height:10,background:'#22c55e',borderRadius:2,display:'inline-block'}}/> A favor</span>
        <span style={{display:'flex',alignItems:'center',gap:4,fontSize:11}}><span style={{width:10,height:10,background:'#ef4444',borderRadius:2,display:'inline-block'}}/> En contra</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{maxWidth:W,display:'block',margin:'0 auto'}}>
        {/* Y gridlines */}
        {Array.from({length:maxG+1},(_,v)=>v).filter(v=>v%Math.ceil(maxG/5)===0||v===0).map(v=>(
          <g key={v}>
            <line x1={padL} y1={padT+cH-(v/maxG)*cH} x2={padL+cW} y2={padT+cH-(v/maxG)*cH} stroke="#eee" strokeWidth="1"/>
            <text x={padL-4} y={padT+cH-(v/maxG)*cH+3} textAnchor="end" fontSize="7.5" fill="#aaa">{v}</text>
          </g>
        ))}
        {/* Bars */}
        {last.map((m, i) => {
          const cx = padL + (i + 0.5) * cW / last.length
          const oH = (m.ourGoals   / maxG) * cH
          const rH = (m.rivalGoals / maxG) * cH
          const date = new Date(m.match_date)
          const label = `${date.getDate()}/${date.getMonth()+1}`
          return (
            <g key={i}>
              {/* Goals scored (green) */}
              {oH > 0 && <rect x={cx-bw-1} y={padT+cH-oH} width={bw} height={oH} fill="#22c55e" rx="2">
                <title>{m.ourGoals} goles a favor</title>
              </rect>}
              {oH === 0 && <rect x={cx-bw-1} y={padT+cH-1} width={bw} height={1} fill="#22c55e" rx="1"/>}
              {/* Goals conceded (red) */}
              {rH > 0 && <rect x={cx+1}    y={padT+cH-rH} width={bw} height={rH} fill="#ef4444" rx="2">
                <title>{m.rivalGoals} goles en contra</title>
              </rect>}
              {rH === 0 && <rect x={cx+1}    y={padT+cH-1} width={bw} height={1} fill="#ef4444" rx="1"/>}
              {/* Values */}
              {oH > 0 && <text x={cx-bw/2-1} y={padT+cH-oH-2} textAnchor="middle" fontSize="7" fill="#16a34a" fontWeight="700">{m.ourGoals}</text>}
              {rH > 0 && <text x={cx+bw/2+1} y={padT+cH-rH-2} textAnchor="middle" fontSize="7" fill="#dc2626" fontWeight="700">{m.rivalGoals}</text>}
              {/* Date label */}
              <text x={cx} y={H-4} textAnchor="middle" fontSize="7.5" fill="#888">{label}</text>
            </g>
          )
        })}
        {/* X axis */}
        <line x1={padL} y1={padT+cH} x2={padL+cW} y2={padT+cH} stroke="#ddd" strokeWidth="1"/>
      </svg>
    </div>
  )
}

function PlayerRankRow({ rank, player, value, sub, highlight }) {
  const medals = ['🥇','🥈','🥉']
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background: highlight?'rgba(255,212,0,0.12)':'transparent', borderRadius:8, borderLeft: highlight?'3px solid #ffd400':'3px solid transparent' }}>
      <span style={{fontSize:16,width:22,textAlign:'center'}}>{medals[rank-1]||rank}</span>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:700}}>{player.name} {player.surname}</div>
        <div style={{fontSize:11,color:'#888'}}>#{player.dorsal} · {player.position}</div>
      </div>
      <div style={{textAlign:'right'}}>
        <div style={{fontSize:18,fontWeight:800,fontFamily:'Poppins',color:'#1f6f23'}}>{value}</div>
        {sub && <div style={{fontSize:10,color:'#aaa'}}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function FutsalStats({ teamId, onClose }) {
  const [matches,      setMatches]      = useState([])
  const [allStats,     setAllStats]     = useState({}) // matchId → { playerStats[], rivalStats }
  const [players,      setPlayers]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState('overview') // overview | players | matches | charts

  useEffect(() => { loadAll() }, [teamId])

  async function loadAll() {
    setLoading(true)
    try {
      const [matchList, playerList] = await Promise.all([
        api.getMatches(teamId),
        api.getPlayers(teamId)
      ])
      setPlayers(playerList)
      const finished = matchList.filter(m => m.status === 'finished')
      setMatches(matchList)
      const statsMap = {}
      await Promise.all(finished.map(async m => {
        const [pStats, rStats] = await Promise.all([
          api.getMatchPlayerStats(m.id),
          api.getRivalTeamStats(m.id)
        ])
        statsMap[m.id] = { playerStats: pStats || [], rivalStats: rStats }
      }))
      setAllStats(statsMap)
    } catch (err) {
      console.error('Error cargando estadísticas:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Computed stats ────────────────────────────────────────────────────
  const finished = useMemo(() => matches.filter(m => m.status === 'finished'), [matches])

  const matchData = useMemo(() => finished.map(m => {
    const isHome   = m.is_home !== false
    const ourGoals = isHome ? (m.home_goals ?? 0) : (m.away_goals ?? 0)
    const rivGoals = isHome ? (m.away_goals ?? 0) : (m.home_goals ?? 0)
    const result   = ourGoals > rivGoals ? 'W' : ourGoals < rivGoals ? 'L' : 'D'
    const { playerStats=[], rivalStats=null } = allStats[m.id] || {}
    // MVP: player with most goals+assists in this match
    let mvp = null, mvpScore = -1
    playerStats.forEach(ps => {
      const sc = (ps.goals||0)*2 + (ps.assists||0) + (ps.shots_on_goal||0)*0.5
      if (sc > mvpScore) { mvpScore = sc; mvp = ps }
    })
    return { ...m, ourGoals, rivGoals, result, playerStats, rivalStats, mvp, mvpScore }
  }), [finished, allStats])

  const teamStats = useMemo(() => {
    const wins   = matchData.filter(m=>m.result==='W').length
    const draws  = matchData.filter(m=>m.result==='D').length
    const losses = matchData.filter(m=>m.result==='L').length
    const gf     = matchData.reduce((s,m)=>s+m.ourGoals,0)
    const gc     = matchData.reduce((s,m)=>s+m.rivGoals,0)
    const cs     = matchData.filter(m=>m.rivGoals===0).length  // clean sheets
    const pts    = wins*3 + draws
    return { wins, draws, losses, gf, gc, gd:gf-gc, cs, pts, played:matchData.length }
  }, [matchData])

  const playerAggregates = useMemo(() => {
    const agg = {}
    players.forEach(p => { agg[p.id] = { ...p, goals:0, assists:0, shots_on_goal:0, shots_out:0, fouls:0, yellow_cards:0, red_cards:0, minutes_played:0, saves:0, matches:0 } })
    finished.forEach(m => {
      const { playerStats=[] } = allStats[m.id] || {}
      playerStats.forEach(ps => {
        if (!agg[ps.player_id]) return
        agg[ps.player_id].goals         += ps.goals         || 0
        agg[ps.player_id].assists       += ps.assists       || 0
        agg[ps.player_id].shots_on_goal += ps.shots_on_goal || 0
        agg[ps.player_id].shots_out     += ps.shots_out     || 0
        agg[ps.player_id].fouls         += ps.fouls         || 0
        agg[ps.player_id].yellow_cards  += ps.yellow_cards  || 0
        agg[ps.player_id].red_cards     += ps.red_cards     || 0
        agg[ps.player_id].minutes_played+= ps.minutes_played|| 0
        agg[ps.player_id].saves         += ps.saves         || 0
        agg[ps.player_id].matches++
      })
    })
    return Object.values(agg)
  }, [players, finished, allStats])

  const scorers  = useMemo(() => [...playerAggregates].sort((a,b)=>b.goals-a.goals||b.assists-a.assists).filter(p=>p.goals>0||p.matches>0).slice(0,5), [playerAggregates])
  const keepers  = useMemo(() => [...playerAggregates].filter(p=>p.position==='Portero'||p.saves>0).sort((a,b)=>b.saves-a.saves).slice(0,3), [playerAggregates])
  const minLeaders= useMemo(()=>[...playerAggregates].sort((a,b)=>b.minutes_played-a.minutes_played).filter(p=>p.minutes_played>0).slice(0,5),[playerAggregates])

  const form = useMemo(() => [...matchData].sort((a,b)=>new Date(b.match_date)-new Date(a.match_date)).slice(0,8).reverse(), [matchData])

  function fmtMins(secs) {
    const m = Math.floor(secs/60), s = secs%60
    return s ? `${m}m ${s}s` : `${m}m`
  }

  const tabs = [
    { id:'overview', label:'Resumen'   },
    { id:'players',  label:'Jugadores' },
    { id:'matches',  label:'Partidos'  },
    { id:'charts',   label:'Gráficos'  },
  ]

  if (loading) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:300,flexDirection:'column',gap:12}}>
        <div style={{width:36,height:36,border:'4px solid #e5e7eb',borderTopColor:'#1f6f23',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
        <span style={{color:'#666',fontSize:14}}>Cargando estadísticas...</span>
      </div>
    )
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#ffd400 0%,#1f6f23 100%)',padding:'12px 16px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <button onClick={onClose} style={{background:'rgba(255,255,255,0.9)',border:'none',padding:'6px 12px',borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontWeight:700,color:'#1f6f23',fontSize:13,fontFamily:'Poppins'}}>
          <ArrowLeftIcon size={14}/> Volver
        </button>
        <h2 style={{margin:0,color:'#fff',fontFamily:'Poppins',fontSize:18,fontWeight:700}}>Estadísticas Futsal</h2>
        <div style={{marginLeft:'auto',display:'flex',gap:6}}>
          <span style={{background:'rgba(255,255,255,0.2)',color:'#fff',padding:'4px 10px',borderRadius:20,fontSize:12,fontWeight:600}}>{matches.length} partidos</span>
          <span style={{background:'rgba(255,255,255,0.2)',color:'#fff',padding:'4px 10px',borderRadius:20,fontSize:12,fontWeight:600}}>{players.length} jugadores</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',background:'#fff',borderBottom:'2px solid #f0f0f0',flexShrink:0,overflowX:'auto'}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            flex:'1 1 auto',padding:'10px 4px',border:'none',background:'transparent',cursor:'pointer',
            fontSize:13,fontWeight:activeTab===t.id?700:500,fontFamily:'Poppins',
            color:activeTab===t.id?'#1f6f23':'#888',
            borderBottom:activeTab===t.id?'3px solid #1f6f23':'3px solid transparent',
            whiteSpace:'nowrap',minWidth:80,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:'auto',padding:'16px',background:'#f8faf8'}}>

        {/* ── OVERVIEW ── */}
        {activeTab==='overview' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>

            {/* Stat cards */}
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <StatCard label="Jugados"    value={teamStats.played}  color="#6366f1"/>
              <StatCard label="Victorias"  value={teamStats.wins}    color="#22c55e" sub={`${teamStats.pts} pts`}/>
              <StatCard label="Empates"    value={teamStats.draws}   color="#f59e0b"/>
              <StatCard label="Derrotas"   value={teamStats.losses}  color="#ef4444"/>
              <StatCard label="Goles"      value={teamStats.gf}      color="#1f6f23" sub="a favor"/>
              <StatCard label="Encajados"  value={teamStats.gc}      color="#dc2626" sub="en contra"/>
              <StatCard label="Diferencia" value={(teamStats.gd>0?'+':'')+teamStats.gd} color={teamStats.gd>=0?'#22c55e':'#ef4444'}/>
              <StatCard label="P. cero"    value={teamStats.cs}      color="#0ea5e9" sub="portería a 0"/>
            </div>

            {/* Promedio */}
            {teamStats.played > 0 && (
              <div style={{background:'#fff',borderRadius:12,padding:'12px 16px',boxShadow:'0 2px 8px rgba(0,0,0,0.06)',display:'flex',gap:20,flexWrap:'wrap'}}>
                <div><span style={{fontSize:11,color:'#888',textTransform:'uppercase',fontWeight:600}}>Promedio goles</span> <strong>{(teamStats.gf/teamStats.played).toFixed(1)}</strong></div>
                <div><span style={{fontSize:11,color:'#888',textTransform:'uppercase',fontWeight:600}}>Promedio encajados</span> <strong>{(teamStats.gc/teamStats.played).toFixed(1)}</strong></div>
                <div><span style={{fontSize:11,color:'#888',textTransform:'uppercase',fontWeight:600}}>% victorias</span> <strong>{Math.round(teamStats.wins/Math.max(1,teamStats.played)*100)}%</strong></div>
                <div><span style={{fontSize:11,color:'#888',textTransform:'uppercase',fontWeight:600}}>Puntos</span> <strong>{teamStats.pts}</strong></div>
              </div>
            )}

            {/* Form strip */}
            {form.length > 0 && (
              <div style={{background:'#fff',borderRadius:12,padding:'14px 16px',boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
                <h4 style={{margin:'0 0 10px',fontSize:13,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,color:'#555'}}>Últimos resultados</h4>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                  {form.map((m,i) => (
                    <div key={m.id} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                      <ResultBadge result={m.result}/>
                      <span style={{fontSize:9,color:'#aaa'}}>{m.ourGoals}-{m.rivGoals}</span>
                      <span style={{fontSize:8,color:'#bbb',maxWidth:28,textAlign:'center',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.rival_team_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top scorer quick view */}
            {scorers[0] && (
              <div style={{background:'linear-gradient(135deg,#1f6f23,#2d8a32)',borderRadius:12,padding:'14px 16px',color:'#fff'}}>
                <div style={{fontSize:11,opacity:.8,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>Máximo goleador</div>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:44,height:44,borderRadius:'50%',background:'#ffd400',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800,color:'#1a1a1a',fontFamily:'Poppins'}}>
                    {scorers[0].dorsal}
                  </div>
                  <div>
                    <div style={{fontSize:16,fontWeight:700,fontFamily:'Poppins'}}>{scorers[0].name} {scorers[0].surname}</div>
                    <div style={{fontSize:12,opacity:.8}}>{scorers[0].position}</div>
                  </div>
                  <div style={{marginLeft:'auto',textAlign:'right'}}>
                    <div style={{fontSize:28,fontWeight:800,fontFamily:'Poppins',color:'#ffd400',lineHeight:1}}>{scorers[0].goals}</div>
                    <div style={{fontSize:11,opacity:.7}}>goles</div>
                  </div>
                </div>
              </div>
            )}

            {finished.length === 0 && (
              <div style={{textAlign:'center',padding:'40px 20px',color:'#999'}}>
                <div style={{fontSize:40,marginBottom:8}}>📊</div>
                <div style={{fontWeight:600}}>Sin partidos finalizados</div>
                <div style={{fontSize:13,marginTop:4}}>Las estadísticas aparecerán cuando finalices partidos.</div>
              </div>
            )}
          </div>
        )}

        {/* ── PLAYERS ── */}
        {activeTab==='players' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>

            {/* Goleadores */}
            <SectionCard title="Goleadores" icon="⚽">
              {scorers.length===0 ? <Empty/> : scorers.map((p,i)=>(
                <PlayerRankRow key={p.id} rank={i+1} player={p} value={p.goals} sub={p.assists>0?`${p.assists} asist.`:null} highlight={i===0}/>
              ))}
            </SectionCard>

            {/* Asistentes */}
            <SectionCard title="Asistentes" icon="🤝">
              {(() => {
                const top = [...playerAggregates].sort((a,b)=>b.assists-a.assists||b.goals-a.goals).filter(p=>p.assists>0).slice(0,5)
                return top.length===0 ? <Empty/> : top.map((p,i)=>(
                  <PlayerRankRow key={p.id} rank={i+1} player={p} value={p.assists} sub={p.goals>0?`${p.goals} goles`:null} highlight={i===0}/>
                ))
              })()}
            </SectionCard>

            {/* Porteros */}
            {keepers.length > 0 && (
              <SectionCard title="Porteros — Paradas" icon="🧤">
                {keepers.map((p,i)=>(
                  <PlayerRankRow key={p.id} rank={i+1} player={p} value={p.saves} sub={`${p.matches} part.`} highlight={i===0}/>
                ))}
              </SectionCard>
            )}

            {/* Minutos */}
            <SectionCard title="Más minutos jugados" icon="⏱">
              {minLeaders.length===0 ? <Empty/> : minLeaders.map((p,i)=>(
                <PlayerRankRow key={p.id} rank={i+1} player={p} value={Math.floor(p.minutes_played/60)+'m'} sub={`${p.matches} partidos`} highlight={i===0}/>
              ))}
            </SectionCard>

            {/* Full table */}
            <SectionCard title="Tabla completa de jugadores">
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'#f0f4f0'}}>
                      {['#','Jugador','PJ','G','A','T+','T-','F','A','R','Min'].map(h=>(
                        <th key={h} style={{padding:'6px 8px',textAlign:'center',color:'#555',fontWeight:700,fontSize:11,whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...playerAggregates].sort((a,b)=>b.goals-a.goals||b.assists-a.assists).map((p,i)=>(
                      <tr key={p.id} style={{background:i%2===0?'#fff':'#f8faf8',borderBottom:'1px solid #eee'}}>
                        <td style={{padding:'5px 8px',textAlign:'center',fontWeight:700}}>{p.dorsal}</td>
                        <td style={{padding:'5px 8px',whiteSpace:'nowrap'}}>{p.name} {p.surname}</td>
                        <td style={{padding:'5px 8px',textAlign:'center'}}>{p.matches}</td>
                        <td style={{padding:'5px 8px',textAlign:'center',fontWeight:p.goals>0?700:400,color:p.goals>0?'#1f6f23':'#999'}}>{p.goals}</td>
                        <td style={{padding:'5px 8px',textAlign:'center'}}>{p.assists}</td>
                        <td style={{padding:'5px 8px',textAlign:'center'}}>{p.shots_on_goal}</td>
                        <td style={{padding:'5px 8px',textAlign:'center'}}>{p.shots_out}</td>
                        <td style={{padding:'5px 8px',textAlign:'center'}}>{p.fouls}</td>
                        <td style={{padding:'5px 8px',textAlign:'center',color:p.yellow_cards>0?'#d97706':'#999'}}>{p.yellow_cards}</td>
                        <td style={{padding:'5px 8px',textAlign:'center',color:p.red_cards>0?'#ef4444':'#999'}}>{p.red_cards}</td>
                        <td style={{padding:'5px 8px',textAlign:'center',fontSize:11}}>{Math.floor(p.minutes_played/60)}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── MATCHES ── */}
        {activeTab==='matches' && (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {matchData.length===0 && <Empty text="Sin partidos finalizados"/>}
            {[...matchData].sort((a,b)=>new Date(b.match_date)-new Date(a.match_date)).map(m => {
              const mvpPlayer = m.mvp ? players.find(p=>p.id===m.mvp.player_id) : null
              return (
                <div key={m.id} style={{background:'#fff',borderRadius:12,padding:'14px 16px',boxShadow:'0 2px 8px rgba(0,0,0,0.06)',borderLeft:`4px solid ${m.result==='W'?'#22c55e':m.result==='D'?'#f59e0b':'#ef4444'}`}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                    <ResultBadge result={m.result}/>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14}}>vs {m.rival_team_name}</div>
                      <div style={{fontSize:11,color:'#888'}}>{new Date(m.match_date).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})} · {m.place} · J{m.jornada||'?'}</div>
                    </div>
                    <div style={{fontSize:28,fontWeight:800,fontFamily:'Poppins',letterSpacing:2}}>
                      <span style={{color:'#1f6f23'}}>{m.ourGoals}</span>
                      <span style={{color:'#ccc',margin:'0 4px'}}>-</span>
                      <span style={{color:'#ef4444'}}>{m.rivGoals}</span>
                    </div>
                  </div>
                  {/* Player goals */}
                  {m.playerStats.filter(ps=>ps.goals>0).length>0 && (
                    <div style={{marginTop:8,display:'flex',gap:8,flexWrap:'wrap'}}>
                      {m.playerStats.filter(ps=>ps.goals>0).map(ps=>{
                        const pl=players.find(p=>p.id===ps.player_id)
                        return pl ? <span key={ps.player_id} style={{fontSize:12,background:'#f0f7f0',padding:'3px 8px',borderRadius:20,color:'#1f6f23',fontWeight:600}}>⚽ {pl.name} {ps.goals>1?`×${ps.goals}`:''}</span> : null
                      })}
                    </div>
                  )}
                  {/* MVP */}
                  {mvpPlayer && m.mvpScore > 0 && (
                    <div style={{marginTop:6,display:'flex',alignItems:'center',gap:6}}>
                      <span style={{fontSize:11,color:'#aaa'}}>MVP del partido:</span>
                      <span style={{fontSize:12,fontWeight:700,color:'#1f6f23',background:'rgba(255,212,0,0.15)',padding:'2px 8px',borderRadius:20}}>
                        ⭐ {mvpPlayer.name} ({m.mvp.goals}G {m.mvp.assists}A)
                      </span>
                    </div>
                  )}
                  {m.rivalStats && (
                    <div style={{marginTop:6,fontSize:11,color:'#aaa'}}>
                      Rival: {m.rivalStats.goals}G · {m.rivalStats.shots_on_goal} t.puerta · {m.rivalStats.fouls} faltas
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── CHARTS ── */}
        {activeTab==='charts' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>

            <SectionCard title="Distribución de resultados">
              <DonutChart wins={teamStats.wins} draws={teamStats.draws} losses={teamStats.losses}/>
            </SectionCard>

            <SectionCard title="Goles por partido (últimos 10)">
              <GoalsBarChart data={matchData.sort((a,b)=>new Date(a.match_date)-new Date(b.match_date))}/>
            </SectionCard>

            {/* Goals breakdown */}
            {scorers.length > 0 && (
              <SectionCard title="Reparto de goles del equipo">
                {(() => {
                  const total = Math.max(1, teamStats.gf)
                  return scorers.slice(0,6).map((p,i)=>(
                    <div key={p.id} style={{marginBottom:8}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3,fontSize:12}}>
                        <span>{p.name} {p.surname}</span>
                        <span style={{fontWeight:700,color:'#1f6f23'}}>{p.goals} ({Math.round(p.goals/total*100)}%)</span>
                      </div>
                      <div style={{height:8,background:'#f0f0f0',borderRadius:4,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${p.goals/total*100}%`,background:`hsl(${140-i*20},65%,45%)`,borderRadius:4,transition:'width 0.5s ease'}}/>
                      </div>
                    </div>
                  ))
                })()}
              </SectionCard>
            )}

            {/* Form line */}
            {form.length > 1 && (
              <SectionCard title="Evolución de goles marcados / encajados">
                {(() => {
                  const pts = form.map((m,i)=>({ x:i, scored:m.ourGoals, conceded:m.rivGoals }))
                  const maxG = Math.max(5, ...pts.map(p=>Math.max(p.scored,p.conceded)))
                  const W=300,H=100,pL=16,pB=20,pT=8,pR=8
                  const cW=W-pL-pR, cH=H-pT-pB
                  const px = (i)=>pL+i/(pts.length-1)*cW
                  const py = (v)=>pT+cH-(v/maxG)*cH
                  const scored_d   = pts.map((p,i)=>`${i===0?'M':'L'}${px(i).toFixed(1)},${py(p.scored).toFixed(1)}`).join(' ')
                  const conceded_d = pts.map((p,i)=>`${i===0?'M':'L'}${px(i).toFixed(1)},${py(p.conceded).toFixed(1)}`).join(' ')
                  return (
                    <div>
                      <div style={{display:'flex',gap:12,marginBottom:6,justifyContent:'center'}}>
                        <span style={{display:'flex',alignItems:'center',gap:4,fontSize:11}}><span style={{width:16,height:3,background:'#22c55e',display:'inline-block',borderRadius:2}}/> Marcados</span>
                        <span style={{display:'flex',alignItems:'center',gap:4,fontSize:11}}><span style={{width:16,height:3,background:'#ef4444',display:'inline-block',borderRadius:2}}/> Encajados</span>
                      </div>
                      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:'block',maxWidth:W,margin:'0 auto'}}>
                        {[0,Math.ceil(maxG/2),maxG].map(v=>(
                          <line key={v} x1={pL} y1={py(v)} x2={pL+cW} y2={py(v)} stroke="#eee" strokeWidth="1" strokeDasharray="3,3"/>
                        ))}
                        <path d={scored_d}   fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d={conceded_d} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        {pts.map((p,i)=>(
                          <g key={i}>
                            <circle cx={px(i)} cy={py(p.scored)}   r="3.5" fill="#22c55e"/>
                            <circle cx={px(i)} cy={py(p.conceded)} r="3.5" fill="#ef4444"/>
                            <text x={px(i)} y={H-4} textAnchor="middle" fontSize="7.5" fill="#aaa">
                              {new Date(form[i].match_date).getDate()}/{new Date(form[i].match_date).getMonth()+1}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  )
                })()}
              </SectionCard>
            )}
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

// ── Util sub-components ──────────────────────────────────────────────────
function SectionCard({ title, icon, children }) {
  return (
    <div style={{background:'#fff',borderRadius:12,padding:'14px 16px',boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
      {title && <h4 style={{margin:'0 0 12px',fontSize:13,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,color:'#444',display:'flex',alignItems:'center',gap:6}}>
        {icon && <span>{icon}</span>}{title}
      </h4>}
      {children}
    </div>
  )
}

function Empty({ text = 'Sin datos' }) {
  return <div style={{textAlign:'center',padding:'16px',color:'#aaa',fontSize:13}}>{text}</div>
}
