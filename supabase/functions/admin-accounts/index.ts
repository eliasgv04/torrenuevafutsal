import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Lists every auth account and deletes one. Both need the service_role key
// (auth.users isn't exposed via PostgREST at all, admin or not), so — same
// as admin-create-account — this only ever runs after independently
// verifying the caller is an admin.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const APP_URL = 'https://eliasgv04.github.io/torrenuevafutsal'

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

    const body = await req.json().catch(() => ({}))
    const action = body.action || 'list'

    if (action === 'list') {
      const { data: usersData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
      if (listErr) return json({ error: listErr.message }, 500)

      const [{ data: teamLinks }, { data: adminRows }, { data: subRows }] = await Promise.all([
        admin.from('team_users').select('user_id, team_id, teams(id, name)'),
        admin.from('admin_users').select('user_id'),
        admin.from('subscriptions').select('user_id, plan, max_teams, status, access_until'),
      ])
      const adminIds = new Set((adminRows || []).map(r => r.user_id))
      const subsByUser = new Map((subRows || []).map(s => [s.user_id, s]))

      const accounts = usersData.users
        .map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at || null,
          is_admin: adminIds.has(u.id),
          teams: (teamLinks || [])
            .filter(l => l.user_id === u.id && l.teams)
            .map(l => ({ id: l.teams.id, name: l.teams.name })),
          subscription: subsByUser.get(u.id) || { status: 'inactive', plan: null, max_teams: null, access_until: null },
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      return json({ accounts })
    }

    // Admin override — grants/revokes free access or manually sets a plan,
    // independent of whatever Stripe says (e.g. the club's own team, or a
    // special arrangement). Never touches Stripe.
    if (action === 'set_plan') {
      const { user_id, status, plan, max_teams } = body
      if (!user_id || !status) return json({ error: 'Falta user_id o status' }, 400)
      if (!['inactive', 'active', 'expired', 'free_override'].includes(status)) {
        return json({ error: 'Status inválido' }, 400)
      }
      const { error: upsertErr } = await admin.from('subscriptions').upsert({
        user_id,
        status,
        plan: plan || null,
        max_teams: max_teams === undefined ? null : max_teams,
        // A manual override isn't seasonal — it doesn't expire on its own,
        // only if/when the admin changes it again.
        access_until: null,
        updated_at: new Date().toISOString(),
      })
      if (upsertErr) return json({ error: upsertErr.message }, 500)
      return json({ ok: true })
    }

    if (action === 'delete') {
      const { user_id } = body
      if (!user_id) return json({ error: 'Falta user_id' }, 400)
      if (user_id === user.id) return json({ error: 'No puedes eliminar tu propia cuenta' }, 400)

      const { data: targetIsAdmin } = await admin
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user_id)
        .maybeSingle()
      if (targetIsAdmin) return json({ error: 'No se puede eliminar una cuenta admin' }, 400)

      const { error: delErr } = await admin.auth.admin.deleteUser(user_id)
      if (delErr) return json({ error: delErr.message }, 400)
      return json({ ok: true })
    }

    if (action === 'reset_password') {
      const { user_id, new_password, notify_email } = body
      if (!user_id || !new_password) return json({ error: 'Falta user_id o contraseña' }, 400)

      const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(user_id, { password: new_password })
      if (updErr) return json({ error: updErr.message }, 400)

      let emailSent = false
      if (notify_email) {
        emailSent = await sendPasswordResetEmail({ to: notify_email, email: updated.user.email, password: new_password })
      }

      return json({ email: updated.user.email, emailSent })
    }

    return json({ error: 'Acción desconocida' }, 400)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

async function sendPasswordResetEmail({ to, email, password }) {
  if (!RESEND_API_KEY) return false
  try {
    const html = `
      <h2>Tu contraseña de FutsalKit se ha restablecido</h2>
      <p>Estos son tus datos de acceso actualizados:</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}<br/>
         <strong>Contraseña:</strong> ${escapeHtml(password)}</p>
      <p><strong>Por seguridad, te recomendamos cambiarla nada más entrar</strong>
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
        subject: 'Tu contraseña de FutsalKit se ha restablecido',
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
