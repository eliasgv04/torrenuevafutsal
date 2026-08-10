// Called by a Postgres trigger (see supabase/add-access-request-notify.sql)
// right after a row is inserted into access_requests. Sends an email to the
// admin so a new request doesn't go unnoticed. Auth is a shared secret (not
// Supabase JWT verification, since the caller is a DB trigger via pg_net,
// not an end user) checked against the x-hook-secret header.
const HOOK_SECRET = Deno.env.get('HOOK_SECRET')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const NOTIFY_EMAIL = 'eliasgonzalezvaldepenas@gmail.com'

Deno.serve(async (req) => {
  if (req.headers.get('x-hook-secret') !== HOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  let payload
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { team_name, contact_name, contact_email, message } = payload

  const html = `
    <h2>Nueva solicitud de acceso a FutsalKit</h2>
    <p><strong>Equipo/club:</strong> ${escapeHtml(team_name)}</p>
    <p><strong>Nombre:</strong> ${escapeHtml(contact_name)}</p>
    <p><strong>Email de contacto:</strong> ${escapeHtml(contact_email)}</p>
    ${message ? `<p><strong>Mensaje:</strong> ${escapeHtml(message)}</p>` : ''}
    <p>Revisa y confirma el acceso manualmente desde Supabase.</p>
  `

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'FutsalKit <onboarding@resend.dev>',
      to: [NOTIFY_EMAIL],
      subject: `Nueva solicitud de acceso: ${team_name}`,
      html,
    }),
  })

  if (!resendResp.ok) {
    const errText = await resendResp.text()
    console.error('Resend error:', errText)
    return new Response('Email send failed', { status: 502 })
  }

  return new Response('OK', { status: 200 })
})

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}
