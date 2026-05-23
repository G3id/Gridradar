import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import './styles.css'
import { supabase } from './lib/supabase'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function App() {
  const route = window.location.pathname

  if (route.startsWith('/admin')) return <Admin />
  return <ReportForm />
}

function ReportForm() {
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [coords, setCoords] = useState(null)
  const [file, setFile] = useState(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  function getLocation() {
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
        setMsg('Standort erfasst.')
      },
      () => setMsg('Standort konnte nicht erfasst werden.')
    )
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('Sende Meldung...')

    let photo_url = null

    if (file) {
      const fileName = `reports/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('scrap-photos')
        .upload(fileName, file)

      if (uploadError) {
        setMsg('Foto-Upload fehlgeschlagen: ' + uploadError.message)
        setLoading(false)
        return
      }

      const { data } = supabase.storage.from('scrap-photos').getPublicUrl(fileName)
      photo_url = data.publicUrl
    }

    const { error } = await supabase.from('scrap_reports').insert({
      description,
      phone,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      photo_url,
      status: 'neu',
    })

    if (error) {
      setMsg('Fehler: ' + error.message)
    } else {
      setDescription('')
      setPhone('')
      setCoords(null)
      setFile(null)
      setMsg('Gemeldet. Danke!')
    }

    setLoading(false)
  }

  return (
    <main className="page">
      <section className="card">
        <h1>NOWUM Schrott melden</h1>
        <p>Foto, Standort und kurze Beschreibung senden.</p>

        <form onSubmit={submit}>
          <label>Beschreibung</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
            placeholder="z.B. Waschmaschine, Kabel, Metallteile..."
          />

          <label>Telefon optional</label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Für Rückfragen"
          />

          <label>Foto optional</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => setFile(e.target.files[0])}
          />

          <button type="button" onClick={getLocation}>
            Standort erfassen
          </button>

          {coords && (
            <p>
              Standort: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          )}

          <button disabled={loading} type="submit">
            {loading ? 'Sende...' : 'Schrott melden'}
          </button>
        </form>

        {msg && <p className="msg">{msg}</p>}

        <a className="adminlink" href="/admin">Adminbereich</a>
      </section>
    </main>
  )
}

function Admin() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadReports() {
    setLoading(true)
    const { data, error } = await supabase
      .from('scrap_reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) setReports(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadReports()
  }, [])

  const reportsWithCoords = reports.filter(r => r.lat && r.lng)
  const center = reportsWithCoords.length
    ? [reportsWithCoords[0].lat, reportsWithCoords[0].lng]
    : [51.1657, 10.4515]

  return (
    <main className="admin">
      <header className="adminHeader">
        <h1>NOWUM Admin</h1>
        <a href="/">Neue Meldung</a>
      </header>

      <section className="mapBox">
        <MapContainer center={center} zoom={reportsWithCoords.length ? 12 : 6} className="map">
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {reportsWithCoords.map(report => (
            <Marker key={report.id} position={[report.lat, report.lng]}>
              <Popup>
                <strong>{report.description || 'Schrottfund'}</strong>
                <br />
                Status: {report.status || 'neu'}
                <br />
                {report.phone && <>Telefon: {report.phone}<br /></>}
                {report.created_at && (
                  <>
                    Zeit: {new Date(report.created_at).toLocaleString('de-DE')}
                    <br />
                  </>
                )}
                <a
                  href={`https://www.google.com/maps?q=${report.lat},${report.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  In Google Maps öffnen
                </a>
                {report.photo_url && (
                  <>
                    <br />
                    <img src={report.photo_url} className="popupImg" />
                  </>
                )}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </section>

      <section className="list">
        <h2>Meldungen</h2>

        {loading && <p>Lade...</p>}

        {!loading && reports.length === 0 && <p>Keine Meldungen vorhanden.</p>}

        {reports.map(report => (
          <article className="report" key={report.id}>
            <div>
              <strong>{report.description || 'Ohne Beschreibung'}</strong>
              <p>{new Date(report.created_at).toLocaleString('de-DE')}</p>
              <p>Status: {report.status || 'neu'}</p>
              {report.phone && <p>Telefon: {report.phone}</p>}
              {report.lat && report.lng && (
                <a
                  href={`https://www.google.com/maps?q=${report.lat},${report.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Maps öffnen
                </a>
              )}
            </div>

            {report.photo_url && <img src={report.photo_url} className="thumb" />}
          </article>
        ))}
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)