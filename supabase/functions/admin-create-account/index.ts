import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Called from AdminPanel.jsx when an admin approves a pending access
// request. Creating an auth user requires the service_role key, which can
// never live in the browser bundle — this function is the only place it's
// used, and it only runs after independently verifying the caller is an
// admin (never trusts a client-supplied "isAdmin" flag).
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

Deno.serve(async (req) => {
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

    if (request_id) {
      await admin.from('access_requests').update({ status: 'approved' }).eq('id', request_id)
    }

    return json({ id: created.user.id, email: created.user.email })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
