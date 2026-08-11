import React, {useState, useRef, useEffect} from 'react'
import { UserIcon } from './Icons'

export default function ProfileMenu({email, isAdmin, onChangePassword, onLogout}){
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e){
      if(ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="profile-menu" ref={ref}>
      <button
        className="btn btn-secondary btn-icon-only profile-menu-trigger"
        onClick={() => setOpen(o => !o)}
        title="Cuenta"
        aria-label="Cuenta"
      >
        <UserIcon size={18}/>
      </button>

      {open && (
        <div className="profile-menu-dropdown">
          <div className="profile-menu-header">
            <div className="profile-menu-avatar"><UserIcon size={18}/></div>
            <div>
              <p className="profile-menu-email">{email}</p>
              {isAdmin && <span className="profile-menu-badge">Admin</span>}
            </div>
          </div>
          <button className="profile-menu-item" onClick={() => { setOpen(false); onChangePassword() }}>
            Cambiar contraseña
          </button>
          <button className="profile-menu-item profile-menu-item-danger" onClick={() => { setOpen(false); onLogout() }}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
