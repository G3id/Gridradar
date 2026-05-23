import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') || ''

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const adminClient = createClient(supabaseUrl, serviceKey)

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) throw new Error('Nicht eingeloggt.')

    const { data: requester } = await adminClient.from('profiles').select('role,active').eq('id', userData.user.id).single()
    if (!requester?.active || !['admin','super_admin'].includes(requester.role)) throw new Error('Kein Admin-Zugriff.')

    const { email, password, name, company, phone } = await req.json()
    if (!email || !password || !name) throw new Error('Name, E-Mail und Passwort sind Pflicht.')

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, company, phone }
    })
    if (createError) throw createError

    const { error: profileError } = await adminClient.from('profiles').insert({
      id: created.user.id,
      email,
      name,
      company: company || null,
      phone: phone || null,
      role: 'dealer',
      active: true
    })
    if (profileError) throw profileError

    return new Response(JSON.stringify({ ok: true, user_id: created.user.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
