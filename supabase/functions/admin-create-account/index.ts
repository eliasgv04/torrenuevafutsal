import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Called from AdminPanel.jsx when an admin approves a pending access
// request. Creating an auth user requires the service_role key, which can
// never live in the browser bundle — this function is the only place it's
// used, and it only runs after independently verifying the caller is an
// admin (never trusts a client-supplied "isAdmin" flag).
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const APP_URL = 'https://eliasgv04.github.io/torrenuevafutsal'

// Unlike notify-access-request (called server-to-server from a DB trigger,
// never subject to browser rules), this one is invoked directly from
// AdminPanel.jsx via supabase.functions.invoke() — the browser sends a CORS
// preflight OPTIONS request first, which must get an explicit response or
// the real POST never goes out.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt) return json({ error: 'No autenticado' }, 401)

    // Verify the caller's identity against their own JWT (not the service
    // client — this re-validates the token through GoTrue).
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: { user }, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !user) return json({ error: 'No autenticado' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: adminRow } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!adminRow) return json({ error: 'No autorizado' }, 403)

    const { email, password, team_id, request_id } = await req.json()
    if (!email || !password) return json({ error: 'Falta email o contraseña' }, 400)

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (createErr) return json({ error: createErr.message }, 400)

    if (team_id) {
      const { error: linkErr } = await admin
        .from('team_users')
        .insert({ team_id, user_id: created.user.id })
      if (linkErr) return json({ error: `Cuenta creada, pero fallo al vincular equipo: ${linkErr.message}` }, 500)
    }

    let emailSent = false
    if (request_id) {
      const { data: reqRow } = await admin
        .from('access_requests')
        .select('team_name, contact_name, contact_email')
        .eq('id', request_id)
        .maybeSingle()

      await admin.from('access_requests').update({ status: 'approved' }).eq('id', request_id)

      if (reqRow?.contact_email) {
        emailSent = await sendCredentialsEmail({
          to: reqRow.contact_email,
          contactName: reqRow.contact_name,
          teamName: reqRow.team_name,
          email, password,
        })
      }
    }

    return json({ id: created.user.id, email: created.user.email, emailSent })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

async function sendCredentialsEmail({ to, contactName, teamName, email, password }) {
  if (!RESEND_API_KEY) return false
  try {
    const html = `
      <h2>Tu acceso a FutsalKit ya está listo</h2>
      <p>Hola ${escapeHtml(contactName)},</p>
      <p>Ya puedes entrar a FutsalKit para <strong>${escapeHtml(teamName)}</strong> con estos datos:</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}<br/>
         <strong>Contraseña:</strong> ${escapeHtml(password)}</p>
      <p><strong>Por seguridad, te recomendamos cambiar la contraseña nada más entrar</strong>
         (arriba a la derecha, botón "Cambiar contraseña").</p>
      <p><a href="${APP_URL}">Entrar a FutsalKit</a></p>
    `
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FutsalKit <onboarding@resend.dev>',
        to: [to],
        subject: 'Tu acceso a FutsalKit ya está listo',
        html,
      }),
    })
    return resp.ok
  } catch {
    return false
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
