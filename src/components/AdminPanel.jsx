import React, {useState, useEffect, useCallback} from 'react'
import { api } from '../lib/api'
import ApproveRequestModal from './ApproveRequestModal'
import ConfirmModal from './ConfirmModal'

const STATUS_LABEL = { approved: 'Aprobada', rejected: 'Rechazada' }

export default function AdminPanel(){
  const [teams,setTeams] = useState([])
  const [requests,setRequests] = useState([])
  const [loading,setLoading] = useState(true)
  const [approving,setApproving] = useState(null)
  const [rejecting,setRejecting] = useState(null)
  const [successMsg,setSuccessMsg] = useState('')
  const [emailWarning,setEmailWarning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [t, r] = await Promise.all([api.getAllTeamsAdmin(), api.getAccessRequests()])
    setTeams(t)
    setRequests(r)
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
    </div>
  )
}
