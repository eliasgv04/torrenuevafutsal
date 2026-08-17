import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno&deno-std=0.132.0'

// Called from the "Elige tu plan" screen once a coach has an account but no
// active plan yet. Creates a Stripe Checkout session for a single seasonal
// payment (not a recurring subscription — see supabase/add-subscriptions.sql)
// and hands back the hosted URL to redirect the browser to. The actual
// access grant happens later, server-to-server, in stripe-webhook — never
// here, since a client can always abandon/tamper with the redirect.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const DEFAULT_APP_URL = 'https://eliasgv04.github.io/torrenuevafutsal'

// The client tells us where it was loaded from (production or a local dev
// server) so Stripe can redirect back to the right place — validated
// against an allowlist so this can't be abused to redirect a completed
// payment to an attacker-controlled page.
function resolveAppUrl(candidate: unknown): string {
  if (typeof candidate !== 'string') return DEFAULT_APP_URL
  try {
    const url = new URL(candidate)
    const isProd = url.origin === 'https://eliasgv04.github.io' && url.pathname.startsWith('/torrenuevafutsal')
    const isLocalDev = (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    if (isProd) return `${url.origin}/torrenuevafutsal`
    if (isLocalDev) return `${url.origin}${url.pathname}`.replace(/\/$/, '')
  } catch {
    // fall through to default
  }
  return DEFAULT_APP_URL
}

// Set these once the 3 one-time Prices exist in the Stripe dashboard (Test
// mode first). Keep in sync with src/lib/plans.js.
const PRICE_IDS: Record<string, string | undefined> = {
  single: Deno.env.get('STRIPE_PRICE_SINGLE'),
  triple: Deno.env.get('STRIPE_PRICE_TRIPLE'),
  unlimited: Deno.env.get('STRIPE_PRICE_UNLIMITED'),
}

const PLAN_NAMES: Record<string, string> = {
  single: 'FutsalKit — 1 equipo',
  triple: 'FutsalKit — 3 equipos',
  unlimited: 'FutsalKit — Equipos ilimitados',
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() }) : null

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!stripe) return json({ error: 'Stripe no está configurado todavía' }, 500)

    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt) return json({ error: 'No autenticado' }, 401)

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: { user }, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !user) return json({ error: 'No autenticado' }, 401)

    const { plan, appUrl: requestedAppUrl } = await req.json()
    const priceId = PRICE_IDS[plan]
    if (!priceId) return json({ error: 'Plan desconocido' }, 400)
    const APP_URL = resolveAppUrl(requestedAppUrl)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: existingSub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let customerId = existingSub?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } })
      customerId = customer.id
      await admin.from('subscriptions').upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: 'user_id' })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { user_id: user.id, plan },
      payment_intent_data: {
        description: `${PLAN_NAMES[plan] || 'FutsalKit'} · temporada actual`,
      },
      custom_text: {
        submit: { message: 'Acceso activo durante toda la temporada — sin renovación automática, tú decides si sigues el año que viene.' },
      },
      locale: 'es',
      submit_type: 'pay',
      success_url: `${APP_URL}/?checkout=success`,
      cancel_url: `${APP_URL}/?checkout=cancelled`,
    })

    return json({ url: session.url })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
