import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MapPin, Camera, LogOut, Plus, Truck, Shield, Bell, CheckCircle, XCircle, Navigation, RefreshCw } from 'lucide-react'
import { supabase } from './lib/supabase.js'
import './styles.css'

const STATUS = {
  new: 'Neu',
  assigned: 'Zugewiesen',
  accepted: 'Angenommen',
  enroute: 'Unterwegs',
  picked_up: 'Abgeholt',
  rejected: 'Abgelehnt'
}

function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const route = window.location.pathname

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      if (!session?.user) {
        setProfile(null)
        setLoading(false)
        return
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(data || null)
      setLoading(false)
    }
    loadProfile()
  }, [session])

  if (route === '/' || route === '/report') return <PublicReport />
  if (route === '/login') return <Login />
  if (loading) return <Shell><p>Lade...</p></Shell>
  if (!session) return <Login />
  if (!profile) return <Shell><p>Kein Profil gefunden. Admin muss deine Rolle freischalten.</p><Logout /></Shell>
  if (route.startsWith('/dealer')) return <DealerDashboard profile={profile} />
  if (route.startsWith('/admin')) return <AdminDashboard profile={profile} />
  return <Shell><Nav profile={profile} /><p>Unbekannte Seite.</p></Shell>
}

function Shell({ children }) {
  return <div className="app"><main className="container">{children}</main></div>
}

function Nav({ profile }) {
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
  return <header className="topbar">
    <div><h1>SchrottRadar</h1><p>{profile?.name || profile?.email} · {profile?.role}</p></div>
    <nav>
      <a href="/report">Melden</a>
      {isAdmin && <a href="/admin">Admin</a>}
      {profile?.role === 'dealer' && <a href="/dealer">Händler</a>}
      <Logout />
    </nav>
  </header>
}

function Logout() {
  return <button className="secondary" onClick={() => supabase.auth.signOut()}><LogOut size={16}/> Logout</button>
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  async function submit(e) {
    e.preventDefault()
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
    else window.location.href = '/admin'
  }
  return <Shell>
    <section className="card narrow">
      <Shield size={34}/>
      <h1>Login</h1>
      <p>Für Admins und Schrotthändler.</p>
      <form onSubmit={submit} className="stack">
        <input placeholder="E-Mail" value={email} onChange={e=>setEmail(e.target.value)} type="email" required />
        <input placeholder="Passwort" value={password} onChange={e=>setPassword(e.target.value)} type="password" required />
        <button>Einloggen</button>
      </form>
      {message && <p className="error">{message}</p>}
    </section>
  </Shell>
}

function PublicReport() {
  const [form, setForm] = useState({ name:'', phone:'', description:'' })
  const [coords, setCoords] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function getLocation() {
    setMessage('')
    navigator.geolocation.getCurrentPosition(
      pos => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => setMessage('Standort konnte nicht gelesen werden: ' + err.message),
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMessage('')
    try {
      let photo_url = null
      if (photo) {
        const ext = photo.name.split('.').pop() || 'jpg'
        const path = `reports/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('scrap-photos').upload(path, photo, { upsert:false })
        if (uploadError) throw uploadError
        photo_url = path
      }
      const payload = {
        customer_name: form.name || null,
        customer_phone: form.phone || null,
        description: form.description,
        lat: coords?.lat || null,
        lng: coords?.lng || null,
        accuracy_m: coords?.accuracy || null,
        photo_url,
        status: 'new'
      }
      const { error } = await supabase.from('scrap_reports').insert(payload)
      if (error) throw error
      setMessage('Gemeldet. Danke!')
      setForm({ name:'', phone:'', description:'' }); setCoords(null); setPhoto(null)
    } catch (err) {
      setMessage(err.message)
    } finally { setBusy(false) }
  }

  return <Shell>
    <section className="hero">
      <h1>Schrott melden</h1>
      <p>Foto, Standort und Beschreibung senden. Fahrer-Auswahl gibt es hier nicht.</p>
    </section>
    <section className="card">
      <form onSubmit={submit} className="stack">
        <label>Foto <input type="file" accept="image/*" capture="environment" onChange={e=>setPhoto(e.target.files?.[0] || null)} /></label>
        <textarea required placeholder="Was liegt dort? z.B. Waschmaschine, Kabel, Metallteile..." value={form.description} onChange={e=>setForm({...form, description:e.target.value})}/>
        <div className="grid2">
          <input placeholder="Name optional" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
          <input placeholder="Telefon optional" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/>
        </div>
        <button type="button" className="secondary" onClick={getLocation}><MapPin size={16}/> Standort erfassen</button>
        {coords && <p className="ok">Standort gespeichert: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>}
        <button disabled={busy}>{busy ? 'Sende...' : 'Schrott melden'}</button>
      </form>
      {message && <p className={message.includes('Danke') ? 'ok' : 'error'}>{message}</p>}
      <p className="hint"><a href="/login">Admin/Händler Login</a></p>
    </section>
  </Shell>
}

function AdminDashboard({ profile }) {
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'
  const [reports, setReports] = useState([])
  const [dealers, setDealers] = useState([])
  const [tab, setTab] = useState('reports')
  const [msg, setMsg] = useState('')
  if (!isAdmin) return <Shell><Nav profile={profile}/><p>Kein Admin-Zugriff.</p></Shell>
  async function load() {
    const [{data: r}, {data: d}] = await Promise.all([
      supabase.from('scrap_reports').select('*, assigned_dealer:profiles!scrap_reports_assigned_dealer_id_fkey(id,name,email)').order('created_at',{ascending:false}),
      supabase.from('profiles').select('*').eq('role','dealer').order('created_at',{ascending:false})
    ])
    setReports(r || []); setDealers(d || [])
  }
  useEffect(()=>{ load() }, [])
  useEffect(()=>{
    const ch = supabase.channel('admin-reports').on('postgres_changes',{event:'*', schema:'public', table:'scrap_reports'}, load).subscribe()
    return ()=>supabase.removeChannel(ch)
  }, [])
  async function assign(reportId, dealerId) {
    const dealer = dealers.find(d=>d.id===dealerId)
    const { error } = await supabase.from('scrap_reports').update({ assigned_dealer_id: dealerId || null, status: dealerId ? 'assigned' : 'new' }).eq('id', reportId)
    if (!error && dealerId) await supabase.from('notifications').insert({ dealer_id: dealerId, report_id: reportId, message: `Neuer Schrottauftrag für ${dealer?.name || 'dich'}` })
    if (error) setMsg(error.message); else load()
  }
  return <Shell><Nav profile={profile}/>
    <div className="tabs"><button onClick={()=>setTab('reports')}>Aufträge</button><button onClick={()=>setTab('dealers')}>Fahrer/Händler</button></div>
    {msg && <p className="error">{msg}</p>}
    {tab==='reports' ? <ReportList reports={reports} dealers={dealers} assign={assign} admin /> : <DealerManager reload={load} dealers={dealers} />}
  </Shell>
}

function ReportList({ reports, dealers, assign, admin, dealerMode }) {
  if (!reports.length) return <p>Keine Aufträge.</p>
  return <div className="cards">{reports.map(r => <article className="card" key={r.id}>
    <div className="row between"><h3>{STATUS[r.status] || r.status}</h3><span>{new Date(r.created_at).toLocaleString('de-DE')}</span></div>
    <p>{r.description}</p>
    {(r.customer_name || r.customer_phone) && <p className="hint">Kunde: {r.customer_name || '-'} · {r.customer_phone || '-'}</p>}
    {r.lat && r.lng && <p><a target="_blank" href={mapsUrl(r.lat,r.lng)}><Navigation size={16}/> Google Maps öffnen</a></p>}
    {r.photo_url && <SecureImage path={r.photo_url}/>} 
    {admin && <div className="grid2"><select value={r.assigned_dealer_id || ''} onChange={e=>assign(r.id, e.target.value)}>
      <option value="">Nicht zugewiesen</option>{dealers.map(d=><option value={d.id} key={d.id}>{d.name || d.email}</option>)}
    </select><span className="hint">Aktuell: {r.assigned_dealer?.name || 'niemand'}</span></div>}
    {dealerMode && <DealerStatus report={r}/>} 
  </article>)}</div>
}

function SecureImage({ path }) {
  const [url, setUrl] = useState('')
  useEffect(()=>{ supabase.storage.from('scrap-photos').createSignedUrl(path, 3600).then(({data})=>setUrl(data?.signedUrl || '')) }, [path])
  return url ? <img className="photo" src={url} alt="Schrott Foto"/> : null
}

function DealerManager({ dealers, reload }) {
  const [form, setForm] = useState({ name:'', company:'', email:'', phone:'', password:'' })
  const [msg, setMsg] = useState('')
  async function createDealer(e) {
    e.preventDefault(); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-dealer`, {
      method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}` }, body: JSON.stringify(form)
    })
    const json = await res.json()
    if (!res.ok) setMsg(json.error || 'Fehler')
    else { setMsg('Fahrer/Händler angelegt.'); setForm({ name:'', company:'', email:'', phone:'', password:'' }); reload() }
  }
  return <div className="grid2 alignStart">
    <section className="card"><h2><Plus size={20}/> Fahrer/Händler anlegen</h2><form className="stack" onSubmit={createDealer}>
      <input required placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <input placeholder="Firma" value={form.company} onChange={e=>setForm({...form,company:e.target.value})}/>
      <input required type="email" placeholder="E-Mail" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
      <input placeholder="Telefon" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
      <input required placeholder="Start-Passwort" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
      <button>Anlegen</button>{msg && <p>{msg}</p>}
    </form></section>
    <section className="card"><h2><Truck size={20}/> Bestehende Fahrer</h2>{dealers.map(d=><p key={d.id}>{d.name || d.email}<br/><span className="hint">{d.company || ''} {d.phone || ''}</span></p>)}</section>
  </div>
}

function DealerDashboard({ profile }) {
  const [reports, setReports] = useState([])
  const [notes, setNotes] = useState([])
  async function load() {
    const [{data:r},{data:n}] = await Promise.all([
      supabase.from('scrap_reports').select('*').eq('assigned_dealer_id', profile.id).order('created_at',{ascending:false}),
      supabase.from('notifications').select('*').eq('dealer_id', profile.id).order('created_at',{ascending:false}).limit(10)
    ])
    setReports(r || []); setNotes(n || [])
  }
  useEffect(()=>{ load() }, [profile.id])
  useEffect(()=>{
    const ch = supabase.channel('dealer-reports').on('postgres_changes',{event:'*', schema:'public', table:'scrap_reports', filter:`assigned_dealer_id=eq.${profile.id}`}, load).subscribe()
    return ()=>supabase.removeChannel(ch)
  }, [profile.id])
  return <Shell><Nav profile={profile}/>
    <section className="card"><h2><Bell size={20}/> Benachrichtigungen</h2>{notes.length ? notes.map(n=><p key={n.id}>{n.message}<br/><span className="hint">{new Date(n.created_at).toLocaleString('de-DE')}</span></p>) : <p>Keine Benachrichtigungen.</p>}</section>
    <ReportList reports={reports} dealerMode />
  </Shell>
}

function DealerStatus({ report }) {
  const [busy, setBusy] = useState(false)
  async function setStatus(status) { setBusy(true); await supabase.from('scrap_reports').update({ status }).eq('id', report.id); setBusy(false) }
  return <div className="actions">
    <button disabled={busy} onClick={()=>setStatus('accepted')}><CheckCircle size={16}/> Annehmen</button>
    <button disabled={busy} onClick={()=>setStatus('enroute')}><Truck size={16}/> Unterwegs</button>
    <button disabled={busy} onClick={()=>setStatus('picked_up')}><CheckCircle size={16}/> Abgeholt</button>
    <button disabled={busy} className="danger" onClick={()=>setStatus('rejected')}><XCircle size={16}/> Ablehnen</button>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
