import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno&deno-std=0.132.0'

// Called by Stripe's servers (never the browser) after a checkout session
// finishes. This is the ONLY place that ever flips a subscription to
// 'active' — the client redirect from Checkout is not trusted, since a user
// could close the tab, edit the URL, or the redirect could just fail to
// fire. Configure this URL as a Stripe webhook endpoint (Developers →
// Webhooks) listening for `checkout.session.completed`.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')

// One season = 365 days of access from the moment payment is confirmed.
// Keep MAX_TEAMS_BY_PLAN in sync with src/lib/plans.js.
const SEASON_MS = 365 * 24 * 60 * 60 * 1000
const MAX_TEAMS_BY_PLAN: Record<string, number | null> = {
  single: 1,
  triple: 3,
  unlimited: null,
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() }) : null

Deno.serve(async (req) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return new Response('Stripe no configurado', { status: 500 })

  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return new Response(`Firma inválida: ${err}`, { status: 400 })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.user_id
    const plan = session.metadata?.plan

    if (userId && plan && plan in MAX_TEAMS_BY_PLAN) {
      const accessUntil = new Date(Date.now() + SEASON_MS).toISOString()
      const { error } = await admin.from('subscriptions').upsert({
        user_id: userId,
        plan,
        max_teams: MAX_TEAMS_BY_PLAN[plan],
        status: 'active',
        access_until: accessUntil,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      if (error) {
        console.error('No se pudo activar la suscripción:', error)
        return new Response('Error guardando la suscripción', { status: 500 })
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
})
