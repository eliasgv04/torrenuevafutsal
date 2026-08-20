import React, {useState, useEffect, useCallback} from 'react'
import { api } from '../lib/api'
import ApproveRequestModal from './ApproveRequestModal'
import ResetPasswordModal from './ResetPasswordModal'
import ConfirmModal from './ConfirmModal'
import { TrashIcon, XIcon } from './Icons'

const STATUS_LABEL = { approved: 'Aprobada', rejected: 'Rechazada' }

export default function AdminPanel(){
  const [teams,setTeams] = useState([])
  const [requests,setRequests] = useState([])
  const [accounts,setAccounts] = useState([])
  const [loading,setLoading] = useState(true)
  const [approving,setApproving] = useState(null)
  const [rejecting,setRejecting] = useState(null)
  const [deletingAccount,setDeletingAccount] = useState(null)
  const [resettingAccount,setResettingAccount] = useState(null)
  const [logs,setLogs] = useState([])
  const [confirmClearLogs,setConfirmClearLogs] = useState(false)
  const [successMsg,setSuccessMsg] = useState('')
  const [emailWarning,setEmailWarning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [t, r, a, l] = await Promise.all([api.getAllTeamsAdmin(), api.getAccessRequests(), api.getAllAccounts(), api.getAppLogs()])
    setTeams(t)
    setRequests(r)
    setAccounts(a)
    setLogs(l)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const pending  = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status !== 'pending')

  async function handleApprove({email, password, team_id}){
    const result = await api.adminCreateAccount({email, password, team_id, request_id: approving.id})
    setApproving(null)
    setEmailWarning(!result.emailSent)
    setSuccessMsg(
      result.emailSent
        ? `Cuenta creada: ${result.email}. Le hemos enviado las credenciales por email.`
        : `Cuenta creada: ${result.email}. No se pudo enviar el email — pásaselas tú a mano.`
    )
    load()
  }

  async function handleReject(){
    await api.rejectAccessRequest(rejecting.id)
    setRejecting(null)
    load()
  }

  async function handleAddTeam(userId, teamId){
    await api.addTeamToAccount(teamId, userId)
    load()
  }

  async function handleRemoveTeam(userId, teamId){
    await api.removeTeamFromAccount(teamId, userId)
    load()
  }

  async function handleDeleteAccount(){
    await api.deleteAccount(deletingAccount.id)
    setDeletingAccount(null)
    load()
  }

  async function handleClearLogs(){
    await api.clearAppLogs()
    setConfirmClearLogs(false)
    load()
  }

  async function handleResetPassword({password, notifyEmail}){
    const result = await api.resetAccountPassword({
      user_id: resettingAccount.id, new_password: password, notify_email: notifyEmail,
    })
    setResettingAccount(null)
    setEmailWarning(!!notifyEmail && !result.emailSent)
    setSuccessMsg(
      notifyEmail
        ? (result.emailSent
            ? `Contraseña restablecida para ${result.email}. Le hemos avisado por email.`
            : `Contraseña restablecida para ${result.email}. No se pudo enviar el email — pásasela tú a mano.`)
        : `Contraseña restablecida para ${result.email}.`
    )
    load()
  }

  if(loading){
    return <div className="empty-state"><p style={{color:'#fff'}}>Cargando panel de administración...</p></div>
  }

  return (
    <div style={{padding:'24px', maxWidth:960, margin:'0 auto'}}>
      <h2 style={{color:'#fff', fontFamily:"'Poppins', sans-serif", margin:'0 0 4px'}}>Panel de administración</h2>
      <p style={{color:'rgba(255,255,255,0.7)', margin:'0 0 24px'}}>Solicitudes de acceso y equipos existentes.</p>

      {successMsg && (
        <p style={{
          color: emailWarning ? '#f59e0b' : '#16a34a',
          background: emailWarning ? 'rgba(245,158,11,0.12)' : 'rgba(22,163,74,0.12)',
          border: `1px solid ${emailWarning ? 'rgba(245,158,11,0.3)' : 'rgba(22,163,74,0.3)'}`,
          padding:'10px 14px', borderRadius:10, fontWeight:700,
        }}>
          {successMsg}
        </p>
      )}

      <section>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8}}>
          <h3 style={{color:'#fff', fontFamily:"'Poppins', sans-serif", margin:0}}>Errores registrados ({logs.length})</h3>
          {logs.length > 0 && (
            <button className="btn btn-secondary btn-secondary-small" style={{marginTop:0}} onClick={()=>setConfirmClearLogs(true)}>
              Vaciar logs
            </button>
          )}
        </div>
        {logs.length === 0 ? (
          <p style={{color:'rgba(255,255,255,0.6)'}}>Sin errores registrados. Bien.</p>
        ) : (
          <div style={{display:'grid', gap:8, maxHeight:320, overflowY:'auto', marginTop:10}}>
            {logs.map(l => (
              <div key={l.id} className="card" style={{padding:'10px 14px'}}>
                <div style={{display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap'}}>
                  <strong style={{color:'#dc2626', fontSize:13}}>{l.message}{l.code ? ` (${l.code})` : ''}</strong>
                  <span className="small" style={{color:'#999', flexShrink:0}}>{new Date(l.created_at).toLocaleString('es-ES')}</span>
                </div>
                <p className="small" style={{margin:'4px 0 0', color:'#999'}}>{l.user_email || 'Usuario no identificado'}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{marginTop:32}}>
        <h3 style={{color:'#fff', fontFamily:"'Poppins', sans-serif"}}>Solicitudes pendientes ({pending.length})</h3>
        {pending.length === 0 ? (
          <p style={{color:'rgba(255,255,255,0.6)'}}>No hay solicitudes pendientes.</p>
        ) : (
          <div style={{display:'grid', gap:12}}>
            {pending.map(r => (
              <div key={r.id} className="card" style={{padding:16}}>
                <strong>{r.team_name}</strong>
                <p className="small" style={{margin:'4px 0'}}>{r.contact_name} — {r.contact_email}</p>
                {r.message && <p className="small" style={{margin:'4px 0', fontStyle:'italic'}}>"{r.message}"</p>}
                <p className="small" style={{margin:'4px 0', color:'#999'}}>{new Date(r.created_at).toLocaleDateString('es-ES')}</p>
                <div style={{display:'flex', gap:8, marginTop:10}}>
                  <button className="btn btn-primary" style={{marginTop:0}} onClick={()=>setApproving(r)}>Crear cuenta</button>
                  <button className="btn btn-danger" style={{marginTop:0}} onClick={()=>setRejecting(r)}>Rechazar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{marginTop:32}}>
        <h3 style={{color:'#fff', fontFamily:"'Poppins', sans-serif"}}>Equipos ({teams.length})</h3>
        {teams.length === 0 ? (
          <p style={{color:'rgba(255,255,255,0.6)'}}>Todavía no hay equipos creados.</p>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12}}>
            {teams.map(t => (
              <div key={t.id} className="card" style={{padding:'14px', textAlign:'center', fontWeight:700}}>
                {t.name}
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{marginTop:32}}>
        <h3 style={{color:'#fff', fontFamily:"'Poppins', sans-serif"}}>Cuentas ({accounts.length})</h3>
        {accounts.length === 0 ? (
          <p style={{color:'rgba(255,255,255,0.6)'}}>Todavía no hay cuentas creadas.</p>
        ) : (
          <div style={{display:'grid', gap:12}}>
            {accounts.map(acc => (
              <AccountCard
                key={acc.id}
                account={acc}
                allTeams={teams}
                onAddTeam={(teamId)=>handleAddTeam(acc.id, teamId)}
                onRemoveTeam={(teamId)=>handleRemoveTeam(acc.id, teamId)}
                onDelete={()=>setDeletingAccount(acc)}
                onResetPassword={()=>setResettingAccount(acc)}
              />
            ))}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section style={{marginTop:32}}>
          <h3 style={{color:'#fff', fontFamily:"'Poppins', sans-serif"}}>Solicitudes resueltas ({resolved.length})</h3>
          <div style={{display:'grid', gap:8}}>
            {resolved.map(r => (
              <div key={r.id} className="card" style={{padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span>{r.team_name} — {r.contact_email}</span>
                <span className="small" style={{fontWeight:700, color: r.status === 'approved' ? '#16a34a' : '#dc2626'}}>
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {approving && (
        <ApproveRequestModal
          request={approving}
          teams={teams}
          onSubmit={handleApprove}
          onCancel={()=>setApproving(null)}
        />
      )}

      {rejecting && (
        <ConfirmModal
          title="Rechazar solicitud"
          message={`¿Seguro que quieres rechazar la solicitud de "${rejecting.team_name}"?`}
          onConfirm={handleReject}
          onCancel={()=>setRejecting(null)}
        />
      )}

      {deletingAccount && (
        <ConfirmModal
          title="Eliminar cuenta"
          message={`¿Seguro que quieres eliminar la cuenta "${deletingAccount.email}"? Perderá el acceso a todos sus equipos.`}
          onConfirm={handleDeleteAccount}
          onCancel={()=>setDeletingAccount(null)}
        />
      )}

      {resettingAccount && (
        <ResetPasswordModal
          account={resettingAccount}
          onSubmit={handleResetPassword}
          onCancel={()=>setResettingAccount(null)}
        />
      )}

      {confirmClearLogs && (
        <ConfirmModal
          title="Vaciar logs"
          message="¿Seguro que quieres borrar todos los errores registrados?"
          onConfirm={handleClearLogs}
          onCancel={()=>setConfirmClearLogs(false)}
        />
      )}
    </div>
  )
}

// >30 days since the last login is a soft "check on this club" signal, >90
// is a harder "probably inactive" one — just visual cues for the admin,
// nothing else keys off these thresholds.
function daysSince(dateStr){
  if(!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function lastLoginLabel(dateStr){
  const days = daysSince(dateStr)
  if(days === null) return 'Nunca ha entrado'
  if(days <= 0) return 'Último acceso: hoy'
  if(days === 1) return 'Último acceso: ayer'
  return `Último acceso: hace ${days} días`
}

function lastLoginColor(dateStr){
  const days = daysSince(dateStr)
  if(days === null || days > 90) return '#dc2626'
  if(days > 30) return '#f59e0b'
  return '#16a34a'
}

function AccountCard({account, allTeams, onAddTeam, onRemoveTeam, onDelete, onResetPassword}){
  const linkedIds = new Set(account.teams.map(t => t.id))
  const availableTeams = allTeams.filter(t => !linkedIds.has(t.id))
  const [selectedTeam, setSelectedTeam] = useState('')

  function addSelected(){
    if(!selectedTeam) return
    onAddTeam(selectedTeam)
    setSelectedTeam('')
  }

  return (
    <div className="card" style={{padding:16}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', gap:8, flexWrap:'wrap'}}>
        <div>
          <strong>{account.email}</strong>
          {account.is_admin && (
            <span style={{marginLeft:8, fontSize:11, fontWeight:700, color:'#2563EB', background:'rgba(37,99,235,0.12)', padding:'2px 8px', borderRadius:999}}>ADMIN</span>
          )}
          <p className="small" style={{margin:'4px 0', color:'#999'}}>
            Creada el {new Date(account.created_at).toLocaleDateString('es-ES')}
            {' · '}
            <span style={{color: lastLoginColor(account.last_sign_in_at), fontWeight:600}}>
              {lastLoginLabel(account.last_sign_in_at)}
            </span>
          </p>
        </div>
        <div style={{display:'flex', gap:8, flexShrink:0, flexWrap:'wrap'}}>
          <button className="btn btn-secondary btn-secondary-small" style={{marginTop:0}} onClick={onResetPassword}>
            Restablecer contraseña
          </button>
          {!account.is_admin && (
            <button className="btn btn-icon-only" title="Eliminar cuenta" aria-label="Eliminar cuenta" onClick={onDelete} style={{background:'rgba(220,38,38,0.1)', color:'#dc2626'}}>
              <TrashIcon size={15}/>
            </button>
          )}
        </div>
      </div>

      <div style={{display:'flex', flexWrap:'wrap', gap:6, marginTop:10}}>
        {account.teams.length === 0 && <span className="small" style={{color:'#999'}}>Sin equipos vinculados</span>}
        {account.teams.map(t => (
          <span key={t.id} style={{display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, background:'rgba(30,58,138,0.08)', color:'var(--green-dark)', padding:'4px 6px 4px 10px', borderRadius:999}}>
            {t.name}
            <button onClick={()=>onRemoveTeam(t.id)} title={`Quitar acceso a ${t.name}`} aria-label={`Quitar acceso a ${t.name}`} style={{width:16, height:16, borderRadius:'50%', border:'none', background:'rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0}}>
              <XIcon size={9}/>
            </button>
          </span>
        ))}
      </div>

      {availableTeams.length > 0 && (
        <div style={{display:'flex', gap:8, marginTop:10}}>
          <select value={selectedTeam} onChange={e=>setSelectedTeam(e.target.value)} style={{flex:1, margin:0}}>
            <option value="">+ Vincular a un equipo...</option>
            {availableTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn btn-secondary btn-secondary-small" style={{marginTop:0}} disabled={!selectedTeam} onClick={addSelected}>Añadir</button>
        </div>
      )}
    </div>
  )
}
