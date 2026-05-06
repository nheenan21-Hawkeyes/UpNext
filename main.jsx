import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import './styles.css'

const demoApps = [
  { id: 'demo-1', company: 'Deloitte', role_title: 'Audit Intern', location: 'Chicago, IL', job_type: 'Internship', source: 'LinkedIn', deadline: '2026-06-15', date_applied: '2026-05-01', status: 'Interviewing', contact_person: 'Recruiting Team', follow_up_date: '2026-05-10', notes: 'Prep behavioral questions', visibility: 'Public' },
  { id: 'demo-2', company: 'SouthGate Companies', role_title: 'Asset Management Intern', location: 'Iowa City, IA', job_type: 'Internship', source: 'Company Website', deadline: '2026-06-01', date_applied: '2026-04-28', status: 'Offer', contact_person: 'Caleb Wilson', follow_up_date: '', notes: 'Strong fit with real estate goals', visibility: 'Public' },
  { id: 'demo-3', company: 'PwC', role_title: 'Tax Intern', location: 'Des Moines, IA', job_type: 'Internship', source: 'Handshake', deadline: '2026-05-25', date_applied: '', status: 'Saved', contact_person: '', follow_up_date: '', notes: 'Need to tailor resume', visibility: 'Private' }
]

const emptyForm = { company: '', role_title: '', location: '', job_type: 'Internship', source: 'LinkedIn', application_link: '', deadline: '', date_applied: '', status: 'Saved', contact_person: '', follow_up_date: '', notes: '', visibility: 'Private', hide_company: false, public_note: '' }

function App() {
  const [session, setSession] = useState(null)
  const [page, setPage] = useState('landing')
  const [apps, setApps] = useState(demoApps)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [jobText, setJobText] = useState('')
  const [jobLink, setJobLink] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user) {
      setPage('dashboard')
      loadData(session.user.id)
    }
  }, [session])

  async function loadData(userId) {
    if (!supabase) return
    setLoading(true)
    const [{ data: appRows }, { data: prof }] = await Promise.all([
      supabase.from('applications').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', userId).single()
    ])
    if (appRows) setApps(appRows)
    if (prof) setProfile(prof)
    setLoading(false)
  }

  async function handleAuth(e) {
    e.preventDefault()
    if (!supabase) return alert('Add Supabase keys in Replit Secrets first.')
    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { data: { full_name: authName } } })
      if (error) return alert(error.message)
      alert('Account created. Check your email if Supabase email confirmation is turned on.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      if (error) return alert(error.message)
    }
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut()
    setSession(null); setProfile(null); setApps(demoApps); setPage('landing')
  }

  function openAdd(app = null) {
    setEditing(app)
    setForm(app ? { ...emptyForm, ...app } : emptyForm)
    setModalOpen(true)
  }

  async function saveApp(e) {
    e.preventDefault()
    const payload = { ...form, user_id: session?.user?.id }
    if (!session || !supabase) {
      const local = editing ? apps.map(a => a.id === editing.id ? { ...payload, id: editing.id } : a) : [{ ...payload, id: crypto.randomUUID() }, ...apps]
      setApps(local); setModalOpen(false); return
    }
    if (editing) {
      const { error } = await supabase.from('applications').update(payload).eq('id', editing.id)
      if (error) return alert(error.message)
    } else {
      const { error } = await supabase.from('applications').insert(payload)
      if (error) return alert(error.message)
    }
    await loadData(session.user.id)
    setModalOpen(false)
  }

  async function deleteApp(id) {
    if (!confirm('Delete this application?')) return
    if (session && supabase && !String(id).startsWith('demo')) {
      const { error } = await supabase.from('applications').delete().eq('id', id)
      if (error) return alert(error.message)
      await loadData(session.user.id)
    } else setApps(apps.filter(a => a.id !== id))
  }

  function saveJobLink() {
    if (!jobLink.trim()) return
    const source = jobLink.includes('linkedin') ? 'LinkedIn' : jobLink.includes('handshake') ? 'Handshake' : jobLink.includes('indeed') ? 'Indeed' : 'Company Website'
    setForm({ ...emptyForm, application_link: jobLink, source, company: 'New Company', role_title: 'New Role' })
    setEditing(null); setModalOpen(true); setJobLink('')
  }

  const filteredApps = useMemo(() => apps.filter(a => {
    const matchesQuery = [a.company, a.role_title, a.location, a.source].join(' ').toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'All' || a.status === filter
    return matchesQuery && matchesFilter
  }), [apps, query, filter])

  const counts = useMemo(() => ({
    total: apps.length,
    Applied: apps.filter(a => a.status === 'Applied').length,
    Interviewing: apps.filter(a => a.status === 'Interviewing').length,
    Offer: apps.filter(a => a.status === 'Offer').length,
    Rejected: apps.filter(a => a.status === 'Rejected').length,
    Saved: apps.filter(a => a.status === 'Saved').length
  }), [apps])

  const ai = useMemo(() => analyzeJob(jobText), [jobText])

  if (page === 'auth') return <AuthPage mode={authMode} setMode={setAuthMode} onSubmit={handleAuth} email={authEmail} setEmail={setAuthEmail} password={authPassword} setPassword={setAuthPassword} name={authName} setName={setAuthName} goHome={() => setPage('landing')} />

  return <>
    {page === 'landing' && <Landing setPage={setPage} setAuthMode={setAuthMode} />}
    {page !== 'landing' && <div className="appShell">
      <aside className="sidebar"><Logo /><nav>{['dashboard','applications','discover','public','friends','ai'].map(p => <button key={p} className={page===p?'active':''} onClick={()=>setPage(p)}>{label(p)}</button>)}</nav><button onClick={logout} className="logout">{session ? 'Log out' : 'Back home'}</button></aside>
      <main className="main"><header><div><h1>{label(page)}</h1><p>{isSupabaseConfigured ? 'Connected to Supabase' : 'Demo mode: add Supabase keys to save real data.'}</p></div><button className="primary" onClick={()=>openAdd()}>+ Add Application</button></header>
        {page==='dashboard' && <Dashboard counts={counts} apps={apps} openAdd={openAdd} />}
        {page==='applications' && <Applications apps={filteredApps} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} openAdd={openAdd} deleteApp={deleteApp} />}
        {page==='discover' && <Discover jobLink={jobLink} setJobLink={setJobLink} saveJobLink={saveJobLink} />}
        {page==='public' && <PublicProfile apps={apps.filter(a=>a.visibility==='Public')} profile={profile} />}
        {page==='friends' && <Friends apps={apps} />}
        {page==='ai' && <AIHelper jobText={jobText} setJobText={setJobText} ai={ai} />}
      </main>
    </div>}
    {modalOpen && <ApplicationModal form={form} setForm={setForm} onClose={()=>setModalOpen(false)} onSubmit={saveApp} editing={editing} />}
  </>
}

function Logo(){ return <div className="logo"><span>U</span>UpNext</div> }
function label(p){ return ({dashboard:'Dashboard',applications:'Applications',discover:'Job Discovery',public:'Public Profile',friends:'Friends Feed',ai:'AI Helper'})[p] || p }

function Landing({ setPage, setAuthMode }) { return <div className="landing"><nav><Logo/><div><button onClick={()=>{setAuthMode('login');setPage('auth')}}>Sign In</button><button className="primary" onClick={()=>{setAuthMode('signup');setPage('auth')}}>Get Started</button></div></nav><section className="hero"><p className="pill">Now in public beta</p><h1>Your career journey,<br/><span>organized & ahead.</span></h1><p>Track applications, connect with friends, and stay ahead in your career journey.</p><div><button className="primary big" onClick={()=>{setAuthMode('signup');setPage('auth')}}>Start for free</button><button className="outline big" onClick={()=>setPage('dashboard')}>View demo</button></div></section><section className="features"><div><b>📋 Application Tracker</b><p>Save every role, deadline, follow-up, and status.</p></div><div><b>👥 Friends Network</b><p>Share public progress and see friend updates.</p></div><div><b>⚡ Job Discovery</b><p>Paste LinkedIn, Handshake, Indeed, or company links.</p></div></section></div> }

function AuthPage(props){ const signup = props.mode==='signup'; return <div className="auth"><div className="authPanel"><Logo/><h1>{signup?'Create your account':'Sign in to UpNext'}</h1><p>{signup?'Start tracking your career search.':'Pick up where you left off.'}</p><form onSubmit={props.onSubmit}>{signup && <input placeholder="Full name" value={props.name} onChange={e=>props.setName(e.target.value)} />}<input required type="email" placeholder="Email" value={props.email} onChange={e=>props.setEmail(e.target.value)} /><input required type="password" placeholder="Password" value={props.password} onChange={e=>props.setPassword(e.target.value)} /><button className="primary full">{signup?'Create account':'Sign in'}</button></form><button className="link" onClick={()=>props.setMode(signup?'login':'signup')}>{signup?'Already have an account? Sign in':'Need an account? Sign up'}</button><button className="link" onClick={props.goHome}>Back home</button></div></div> }

function Dashboard({ counts, apps }) { return <><div className="stats"><Card label="Total" value={counts.total}/><Card label="Applied" value={counts.Applied}/><Card label="Interviewing" value={counts.Interviewing}/><Card label="Offers" value={counts.Offer}/></div><section className="card"><h2>Recent Applications</h2><AppTable apps={apps.slice(0,5)} /></section></> }
function Card({label,value}){ return <div className="stat"><small>{label}</small><strong>{value}</strong></div> }
function Applications({ apps, query, setQuery, filter, setFilter, openAdd, deleteApp }) { return <section className="card"><div className="tools"><input placeholder="Search company, role, source..." value={query} onChange={e=>setQuery(e.target.value)} /><select value={filter} onChange={e=>setFilter(e.target.value)}>{['All','Saved','Applied','Interviewing','Offer','Rejected'].map(s=><option key={s}>{s}</option>)}</select></div><AppTable apps={apps} openAdd={openAdd} deleteApp={deleteApp}/></section> }
function AppTable({ apps, openAdd, deleteApp }) { return <div className="table">{apps.map(a=><div className="row" key={a.id}><div><b>{a.hide_company?'Hidden Company':a.company}</b><span>{a.role_title} • {a.location}</span></div><span className={'badge '+a.status.toLowerCase()}>{a.status}</span><span>{a.deadline || 'No deadline'}</span>{openAdd && <div><button onClick={()=>openAdd(a)}>Edit</button><button onClick={()=>deleteApp(a.id)}>Delete</button></div>}</div>)}</div> }

function Discover({ jobLink,setJobLink,saveJobLink }) { const mock=['Deloitte Audit Intern','PwC Tax Intern','KPMG Advisory Intern','SouthGate Asset Management Intern']; return <section className="card"><h2>Job Discovery</h2><p>Paste links from LinkedIn, Handshake, Indeed, or a company website. Automatic imports can be added later if APIs are approved.</p><div className="tools"><input value={jobLink} onChange={e=>setJobLink(e.target.value)} placeholder="Paste job link here..."/><button className="primary" onClick={saveJobLink}>Save to Tracker</button></div>{mock.map(m=><div className="mockJob" key={m}><b>{m}</b><button onClick={()=>{setJobLink('https://example.com/'+m.replaceAll(' ','-').toLowerCase())}}>Use Link</button></div>)}</section> }
function PublicProfile({ apps, profile }) { return <section className="card"><h2>{profile?.full_name || 'Nate'}'s Public Progress</h2><p>Only applications marked Public show here.</p><AppTable apps={apps}/></section> }
function Friends({ apps }) { return <section className="card"><h2>Friends Feed</h2>{apps.filter(a=>a.visibility==='Public').map(a=><div className="feed" key={a.id}>Nate moved <b>{a.company} — {a.role_title}</b> to <span className="blue">{a.status}</span></div>)}<div className="feed">Emma received an offer from <b>PwC</b></div></section> }
function AIHelper({ jobText,setJobText,ai }) { return <section className="card"><h2>AI Helper</h2><textarea value={jobText} onChange={e=>setJobText(e.target.value)} placeholder="Paste a job description here..."/><div className="aiGrid"><div><h3>Key Skills</h3>{ai.skills.map(x=><p key={x}>• {x}</p>)}</div><div><h3>Interview Questions</h3>{ai.questions.map(x=><p key={x}>• {x}</p>)}</div><div><h3>Networking Message</h3><p>{ai.message}</p></div><div><h3>Cover Letter Outline</h3><p>{ai.outline}</p></div></div></section> }
function analyzeJob(text){ const t=text.toLowerCase(); const skills=['Communication','Organization']; if(t.includes('excel')) skills.push('Excel'); if(t.includes('account')) skills.push('Accounting'); if(t.includes('finance')) skills.push('Finance'); if(t.includes('sql')) skills.push('SQL'); return { skills, questions:['Why are you interested in this role?','Tell me about a time you handled a deadline.','What skills make you a strong fit?','How do you stay organized?','What do you know about our company?'], message:'Hi, I saw your role and I’m interested in learning more. I’m a student building experience in business, analytics, and career growth, and I’d appreciate any advice you have.', outline:'1) Open with why the company/role interests you. 2) Connect your experience to the job description. 3) Mention one specific skill or project. 4) Close with interest in interviewing.' } }
function ApplicationModal({ form,setForm,onClose,onSubmit,editing }) { const set=(k,v)=>setForm({...form,[k]:v}); return <div className="modal"><form className="modalBox" onSubmit={onSubmit}><h2>{editing?'Edit':'Add'} Application</h2><div className="grid2"><input required placeholder="Company" value={form.company} onChange={e=>set('company',e.target.value)}/><input required placeholder="Role title" value={form.role_title} onChange={e=>set('role_title',e.target.value)}/><input placeholder="Location" value={form.location||''} onChange={e=>set('location',e.target.value)}/><input placeholder="Application link" value={form.application_link||''} onChange={e=>set('application_link',e.target.value)}/><select value={form.status} onChange={e=>set('status',e.target.value)}>{['Saved','Applied','Interviewing','Offer','Rejected'].map(s=><option key={s}>{s}</option>)}</select><select value={form.visibility} onChange={e=>set('visibility',e.target.value)}><option>Private</option><option>Public</option></select><input type="date" value={form.deadline||''} onChange={e=>set('deadline',e.target.value)}/><input type="date" value={form.follow_up_date||''} onChange={e=>set('follow_up_date',e.target.value)}/></div><textarea placeholder="Private notes" value={form.notes||''} onChange={e=>set('notes',e.target.value)}/><label><input type="checkbox" checked={!!form.hide_company} onChange={e=>set('hide_company',e.target.checked)}/> Hide company on public profile</label><div className="modalActions"><button type="button" onClick={onClose}>Cancel</button><button className="primary">Save</button></div></form></div> }

createRoot(document.getElementById('root')).render(<App />)
