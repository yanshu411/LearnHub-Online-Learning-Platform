import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Award, BarChart3, BookOpen, Bookmark,
  Check, CheckCheck, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  CirclePlay, Clock3, Code2, Compass, Filter, GraduationCap, Layers3,
  LayoutDashboard, LockKeyhole, LogIn, LogOut, Menu, MoreHorizontal,
  PencilLine, Play, Plus, Rocket, Search, ShieldCheck, Sparkles, Star,
  TrendingUp, UserRound, UsersRound, Video, X, Zap, FileQuestion,
  BookMarked, BookText, BriefcaseBusiness, Palette, Database, Megaphone,
  ExternalLink
} from 'lucide-react'
import './style.css'

let csrfToken = ''
async function api(path, options = {}) {
  const method = options.method || 'GET'
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  if (method !== 'GET') headers['X-CSRF-Token'] = csrfToken
  let response
  try { response = await fetch(`/api${path}`, { credentials: 'include', ...options, headers }) }
  catch { throw new Error('Cannot reach the server. Start the Flask backend first.') }
  let data
  try { data = await response.json() } catch { data = {} }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
  return data
}
const send = (path, body, method = 'POST') => api(path, { method, body: JSON.stringify(body) })

const Categories = ['All', 'Development', 'Design', 'Business', 'Data Science', 'Marketing']
const accents = ['violet', 'blue', 'orange', 'green', 'pink']
const categoryIcons = {
  Development: Code2, Design: Palette, Business: BriefcaseBusiness,
  'Data Science': Database, Marketing: Megaphone
}
const artIcons = { Development: Code2, Design: Palette, Business: BarChart3, 'Data Science': Database, Marketing: Rocket }

function CourseArt({ course, large = false }) {
  const Icon = artIcons[course.category] || Layers3
  return <div className={`course-art art-${course.accent || 'violet'} ${large ? 'large' : ''}`}>
    <div className="art-grid" />
    <div className="art-orb art-orb-one" /><div className="art-orb art-orb-two" />
    <div className="art-icon"><Icon size={large ? 56 : 42} strokeWidth={1.6} /></div>
    <span className="art-decoration">✳</span>
  </div>
}
function Avatar({ name = 'User', size = 'normal' }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || 'U'
  return <span className={`avatar avatar-${size}`}>{initials}</span>
}
function Metric({ icon: Icon, title, value, hint, tint = 'purple' }) {
  return <div className="metric-card"><div className={`metric-icon tint-${tint}`}><Icon size={21}/></div><p>{title}</p><div className="metric-bottom"><strong>{value}</strong><span>{hint}</span></div></div>
}
function ProgressBar({ value, color = 'purple' }) {
  return <div className="progress-track"><div className={`progress-fill progress-${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
}
function CourseCard({ course, onClick, progress }) {
  return <button className="course-card" onClick={() => onClick(course.id)}>
    <CourseArt course={course} />
    <div className="course-card-body"><div className="tag-row"><span className={`category-tag cat-${course.accent}`}>{course.category}</span><span className="level-label">{course.level}</span></div>
      <h3>{course.title}</h3><p className="line-clamp">{course.description}</p>
      <div className="course-by"><Avatar name={course.instructor} size="small" /> <span>{course.instructor}</span></div>
      {typeof progress === 'number' ? <div className="card-progress"><div className="progress-caption"><span>Your progress</span><b>{progress}%</b></div><ProgressBar value={progress} /></div> : <div className="card-footer"><span><BookOpen size={14} />{course.lesson_count} lessons</span><span><Clock3 size={14} />{course.minutes} min</span><strong><ArrowUpRight size={18} /></strong></div>}
    </div>
  </button>
}
function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}
function Modal({ title, subtitle, onClose, children, wide = false }) {
  useEffect(() => { const key = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key) }, [onClose])
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
    <div className="modal-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={19}/></button></div>{children}</div></div>
}
function toEmbed(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (!['youtube.com','www.youtube.com','youtu.be','www.youtube-nocookie.com'].includes(u.hostname) || u.protocol !== 'https:') return null
    const id = u.hostname === 'youtu.be' ? u.pathname.split('/')[1] : u.pathname.startsWith('/embed/') ? u.pathname.split('/')[2] : u.searchParams.get('v')
    return /^[a-zA-Z0-9_-]{11}$/.test(id || '') ? `https://www.youtube-nocookie.com/embed/${id}` : null
  } catch { return null }
}
function App() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [courses, setCourses] = useState([])
  const [dash, setDash] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [detail, setDetail] = useState(null)
  const [lessonIndex, setLessonIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [quizResult, setQuizResult] = useState(null)
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const notify = (message) => { setNotice(message); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => setNotice(''), 4400) }
  const invoke = async fn => { try { setWorking(true); await fn() } catch (e) { notify(e.message) } finally { setWorking(false) } }
  const loadDashboard = async (active = user) => {
    if (!active) { setDash(null); return }
    setDash(await api('/dashboard'))
  }
  const loadCourses = async () => setCourses((await api('/courses')).courses)
  const openCourse = async (id) => {
    try { const d = await api(`/courses/${id}`); setDetail(d.course); setLessonIndex(0); setAnswers({}); setQuizResult(null); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    catch (e) { notify(e.message) }
  }
  const refreshDetail = async (id) => setDetail((await api(`/courses/${id}`)).course)

  useEffect(() => {
    (async () => {
      try {
        csrfToken = (await api('/csrf')).csrf
        const me = await api('/auth/me')
        setUser(me.user)
        const list = await api('/courses')
        setCourses(list.courses)
        if (me.user) setDash(await api('/dashboard'))
      } catch (e) { notify(e.message) }
      finally { setLoading(false) }
    })()
  }, [])

  const visibleCourses = useMemo(() => courses.filter(c =>
    (!search || `${c.title} ${c.description} ${c.category}`.toLowerCase().includes(search.toLowerCase())) &&
    (category === 'All' || c.category === category)), [courses, search, category])
  const activeLesson = detail?.lessons?.[lessonIndex]
  const isOwner = Boolean(user && detail && user.role === 'instructor' && user.id === detail.instructor_id)
  const enrolled = Boolean(detail?.enrolled)
  const isStudent = user?.role === 'student'

  const goPage = (newPage) => { setPage(newPage); setDetail(null); setSidebarOpen(false); window.scrollTo(0,0) }

  const authSubmit = async (event, type) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const payload = Object.fromEntries(form.entries())
    await invoke(async () => {
      const result = await send(`/auth/${type}`, payload)
      setUser(result.user); setModal(null); setPage('dashboard'); setDetail(null)
      await loadDashboard(result.user)
      notify(`Welcome${type === 'register' ? ' to LearnHub' : ' back'}, ${result.user.name.split(' ')[0]}!`)
    })
  }
  const logout = () => invoke(async () => { await send('/auth/logout', {}); setUser(null); setDash(null); setDetail(null); setPage('explore'); notify('Logged out successfully.') })
  const enroll = () => { if (!user) return setModal('login'); if (!isStudent) return notify('Instructor accounts cannot enroll in courses.'); invoke(async () => { await send(`/courses/${detail.id}/enroll`, {}); await Promise.all([refreshDetail(detail.id),loadDashboard()]); notify('You’re enrolled! Your learning journey begins now.') }) }
  const complete = () => invoke(async () => { await send(`/lessons/${activeLesson.id}/complete`, {}); await Promise.all([refreshDetail(detail.id), loadDashboard()]); notify('Lesson complete — keep going!') })
  const submitQuiz = () => invoke(async () => { const result = await send(`/lessons/${activeLesson.id}/quiz`, { answers }); setQuizResult(result); notify(`You scored ${result.score} out of ${result.total}!`) })
  const createCourse = event => { event.preventDefault(); const f = Object.fromEntries(new FormData(event.currentTarget).entries()); invoke(async () => { const d = await send('/courses', f); await Promise.all([loadDashboard(),loadCourses()]); setModal(null); await openCourse(d.course.id); notify('Course created! Add your first lesson next.') }) }
  const addLesson = event => { event.preventDefault(); const f = Object.fromEntries(new FormData(event.currentTarget).entries()); invoke(async () => { await send(`/courses/${detail.id}/lessons`, f); await refreshDetail(detail.id); setModal(null); notify('Lesson added successfully!') }) }
  const addQuestion = event => { event.preventDefault(); const f = Object.fromEntries(new FormData(event.currentTarget).entries()); invoke(async () => { await send(`/lessons/${activeLesson.id}/questions`, { prompt: f.prompt, options: [f.a, f.b, f.c, f.d], correct: f.correct }); await refreshDetail(detail.id); setModal(null); notify('Quiz question added!') }) }
  const togglePublished = () => invoke(async () => { await send(`/courses/${detail.id}`, { published: !detail.published }, 'PATCH'); await Promise.all([refreshDetail(detail.id),loadDashboard(),loadCourses()]); notify('Course visibility updated.') })

  return <div className="app-shell">
    {sidebarOpen && <button className="mobile-overlay" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => goPage('dashboard')}><span className="brand-logo"><GraduationCap size={27}/></span><span>learn<span className="brand-purple">hub</span><small>your learning space</small></span></button>
      <div className="nav-kicker">WORKSPACE</div>
      <nav className="sidebar-nav">
        <button className={!detail && page === 'dashboard' ? 'nav-active' : ''} onClick={() => goPage('dashboard')}><LayoutDashboard size={19}/> Dashboard</button>
        <button className={!detail && page === 'explore' ? 'nav-active' : ''} onClick={() => goPage('explore')}><Compass size={19}/> Explore Courses</button>
        <button className={!detail && page === 'learning' ? 'nav-active' : ''} onClick={() => goPage('learning')}><BookMarked size={19}/> My Learning</button>
        {user?.role === 'instructor' && <button className={!detail && page === 'studio' ? 'nav-active' : ''} onClick={() => goPage('studio')}><PencilLine size={19}/> Instructor Studio</button>}
      </nav>
      <div className="sidebar-bottom"><div className="help-tile"><span className="help-emoji">✦</span><h4>Make progress today</h4><p>Small lessons, big possibilities. Keep your streak alive!</p><button onClick={() => goPage('explore')}>Explore courses <ArrowRight size={15}/></button></div><div className="side-foot"><ShieldCheck size={15}/> Built for curious minds</div></div>
    </aside>
    <div className="main-wrap">
      <header className="topbar"><button className="mobile-menu icon-btn" onClick={() => setSidebarOpen(x => !x)} aria-label="Open menu"><Menu size={23}/></button><div className="breadcrumb">Workspace <ChevronRight size={14}/> <strong>{detail ? 'Course overview' : page === 'explore' ? 'Explore courses' : page === 'learning' ? 'My learning' : page === 'studio' ? 'Instructor studio' : 'Dashboard'}</strong></div><div className="topbar-right"><span className="top-label"><Sparkles size={15}/> Keep learning, keep growing</span>{user ? <div className="user-menu"><Avatar name={user.name}/><div><b>{user.name}</b><small>{user.role === 'instructor' ? 'Instructor' : 'Student'}</small></div><button className="logout-btn" title="Log out" onClick={logout}><LogOut size={18}/></button></div> : <button className="btn btn-primary btn-small" onClick={() => setModal('login')}>Sign in <ArrowRight size={16}/></button>}</div></header>
      <main className="main-content">
        {loading ? <div className="loading-state"><span className="spinner"/>Getting LearnHub ready…</div> : detail ? <>
          <button className="back-link" onClick={() => setDetail(null)}><ArrowLeft size={17}/> Back to {page === 'studio' ? 'studio' : 'courses'}</button>
          <div className="detail-header"><div className="detail-copy"><div className="tag-row"><span className={`category-tag cat-${detail.accent}`}>{detail.category}</span><span className="level-label">{detail.level}</span></div><h1>{detail.title}</h1><p>{detail.description}</p><div className="detail-metadata"><span><Avatar name={detail.instructor} size="small"/> {detail.instructor}</span><span><BookOpen size={16}/>{detail.lesson_count} lessons</span><span><Clock3 size={16}/>{detail.minutes} minutes</span><span><UsersRound size={16}/>{detail.students} learners</span></div>
            {!enrolled ? <button className="btn btn-primary" onClick={enroll}>Enroll for free <ArrowRight size={17}/></button> : <span className="enrolled-label"><CheckCircle2 size={17}/>{isOwner ? 'You manage this course' : 'You are enrolled'}</span>}
          </div><div className="detail-graphic"><CourseArt course={detail} large/></div></div>
          <div className="detail-layout"><section className="lesson-panel"><div className="lesson-panel-head"><h2>Course content</h2><span>{detail.lesson_count} lessons</span></div><div className="lesson-list">{detail.lessons.length ? detail.lessons.map((lesson, i) => <button key={lesson.id} onClick={() => {setLessonIndex(i); setAnswers({}); setQuizResult(null)}} className={`lesson-item ${i === lessonIndex ? 'lesson-selected' : ''}`}><div className={`lesson-number ${lesson.completed ? 'lesson-done' : ''}`}>{lesson.completed ? <Check size={16}/> : String(i+1).padStart(2,'0')}</div><div><strong>{lesson.title}</strong><span><Clock3 size={13}/>{lesson.minutes} min {lesson.has_quiz && ' · Quiz'}</span></div>{i === lessonIndex ? <ChevronRight size={16}/> : null}</button>) : <div className="empty-lessons">No lessons yet. {isOwner ? 'Add the first lesson to get started.' : 'Check back soon.'}</div>}</div>{isOwner && <button className="btn btn-outline add-lesson" onClick={() => setModal('lesson')}><Plus size={16}/> Add lesson</button>}</section>
            <section className="lesson-content"><div className="content-overline"><BookOpen size={17}/> LEARNING MATERIAL</div>{!enrolled ? <div className="locked-view"><div className="locked-icon"><LockKeyhole size={29}/></div><h2>Unlock the full course</h2><p>Enroll for free to access every lesson, knowledge check, and your progress dashboard.</p><button className="btn btn-primary" onClick={enroll}>Start learning <ArrowRight size={17}/></button></div> : activeLesson ? <><div className="lesson-title-row"><div><span className="eyebrow">LESSON {lessonIndex + 1} OF {detail.lessons.length}</span><h2>{activeLesson.title}</h2><span className="lesson-duration"><Clock3 size={15}/>{activeLesson.minutes} minute lesson</span></div>{activeLesson.completed && <span className="completed-pill"><CheckCircle2 size={15}/> Completed</span>}</div>
              {toEmbed(activeLesson.video_url) && <div className="video-frame"><iframe src={toEmbed(activeLesson.video_url)} title="Lesson video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div>}
              <div className="lesson-text">{activeLesson.content.split('\n').filter(Boolean).map((p,i)=><p key={i}>{p}</p>)}</div>
              <div className="lesson-actions"><button className="btn btn-outline" disabled={lessonIndex === 0} onClick={() => {setLessonIndex(n => n-1);setAnswers({});setQuizResult(null)}}><ChevronLeft size={16}/> Previous</button><div className="lesson-actions-right">{isStudent && !activeLesson.completed && <button className="btn btn-primary" onClick={complete} disabled={working}><Check size={16}/> Mark complete</button>}{lessonIndex < detail.lessons.length - 1 && <button className="btn btn-light" onClick={() => {setLessonIndex(n => n+1);setAnswers({});setQuizResult(null)}}>Next lesson <ChevronRight size={16}/></button>}</div></div>
              {activeLesson.questions?.length > 0 && <div className="quiz-box"><div className="quiz-head"><div className="quiz-symbol"><FileQuestion size={21}/></div><div><h3>Knowledge check</h3><p>Test what you learned in this lesson.</p></div></div>{activeLesson.questions.map((q, i)=><div className="quiz-question" key={q.id}><strong>{i+1}. {q.prompt}</strong><div className="options">{q.options.map((opt, oi)=><label key={oi} className={`quiz-option ${answers[q.id] === 'ABCD'[oi] ? 'selected-answer' : ''}`}><input type="radio" name={`q-${q.id}`} checked={answers[q.id] === 'ABCD'[oi]} onChange={() => {setAnswers(old=>({...old,[q.id]:'ABCD'[oi]}));setQuizResult(null)}}/><span>{'ABCD'[oi]}</span>{opt}</label>)}</div></div>)}{isStudent && <button className="btn btn-primary" disabled={working || Object.keys(answers).length !== activeLesson.questions.length} onClick={submitQuiz}>Submit quiz <ArrowRight size={16}/></button>}{quizResult && <div className="quiz-result"><Award size={20}/> You scored <b>{quizResult.score}/{quizResult.total}</b>. {quizResult.score === quizResult.total ? 'Excellent work!' : 'Review the lesson and try again.'}</div>}{isOwner && <button className="btn btn-outline" onClick={()=>setModal('question')}><Plus size={16}/> Add question</button>}</div>}
              {isOwner && activeLesson.questions?.length === 0 && <button className="btn btn-outline" onClick={() => setModal('question')}><Plus size={16}/> Add a quiz question</button>}
            </> : <div className="locked-view"><BookText size={34}/><h2>No lessons yet</h2><p>{isOwner ? 'Add a lesson to start building your curriculum.' : 'This course is being prepared.'}</p></div>}
            {isOwner && <div className="publish-bar"><div><strong>Course visibility</strong><p>{detail.published ? 'Published and visible in the catalog' : 'Hidden from the catalog'}</p></div><button className="btn btn-outline btn-small" onClick={togglePublished}>{detail.published ? 'Unpublish' : 'Publish'}</button></div>}
            </section></div>
        </> : <>
          {page === 'dashboard' && <>
            <div className="welcome"><span className="eyebrow">YOUR LEARNING WORKSPACE</span><h1>Good to see you{user ? `, ${user.name.split(' ')[0]}` : ''} <span className="wave">✳</span></h1><p>Every lesson is one step closer to where you want to be.</p></div>
            <div className="hero"><div className="hero-copy"><span className="hero-chip"><Sparkles size={14}/> THE FUTURE IS YOURS TO BUILD</span><h2>Learn today.<br/><em>Lead tomorrow.</em></h2><p>Discover practical courses, develop new skills, and make meaningful progress at your pace.</p><button className="btn hero-button" onClick={() => goPage('explore')}>Explore courses <ArrowUpRight size={18}/></button></div><div className="hero-visual"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-glow"/><div className="hero-stack"><div className="stack-card stack-back"/><div className="stack-card stack-mid"/><div className="stack-card stack-front"><span><GraduationCap size={37}/></span><span className="stack-lines"><i/><i/><i/></span><b>+</b></div></div><span className="hero-spark spark-a">✦</span><span className="hero-spark spark-b">✧</span><span className="hero-spark spark-c">✳</span></div></div>
            {user ? <><div className="section-title section-top"><div><h2>Your learning at a glance</h2><p>Here’s how you’re progressing</p></div></div><div className="stats-grid">{user.role === 'student' ? <><Metric icon={BookMarked} title="Enrolled courses" value={dash?.stats?.enrolled ?? '—'} hint="Your active courses" tint="purple"/><Metric icon={Award} title="Courses completed" value={dash?.stats?.completed ?? '—'} hint="Keep it going" tint="green"/><Metric icon={CheckCircle2} title="Lessons finished" value={dash?.stats?.lessons ?? '—'} hint="Every step counts" tint="orange"/></> : <><Metric icon={BookOpen} title="Courses created" value={dash?.stats?.courses ?? '—'} hint="Your curriculum" tint="purple"/><Metric icon={UsersRound} title="Student enrollments" value={dash?.stats?.students ?? '—'} hint="Across your courses" tint="green"/><Metric icon={Layers3} title="Lessons published" value={dash?.stats?.lessons ?? '—'} hint="Knowledge shared" tint="orange"/></>}</div></> : <div className="sign-in-banner"><div><LockKeyhole size={19}/><span>Sign in to save your courses, track progress, and unlock quizzes.</span></div><button className="btn btn-primary btn-small" onClick={() => setModal('register')}>Get started <ArrowRight size={15}/></button></div>}
            {user && (dash?.courses?.length > 0) && <section className="content-section"><div className="section-title"><div><h2>{user.role === 'student' ? 'Continue learning' : 'Your teaching studio'}</h2><p>Pick up where you left off</p></div><button className="text-button" onClick={() => goPage(user.role === 'student' ? 'learning' : 'studio')}>View all <ArrowRight size={17}/></button></div><div className="courses-grid">{dash.courses.slice(0,3).map(c=><CourseCard key={c.id} course={c} progress={user.role === 'student' ? c.progress : undefined} onClick={openCourse}/>)}</div></section>}
            <section className="content-section"><div className="section-title"><div><h2>Explore popular courses</h2><p>Handpicked learning paths to help you grow</p></div><button className="text-button" onClick={() => goPage('explore')}>Browse all <ArrowRight size={17}/></button></div><div className="courses-grid">{courses.slice(0,3).map(c=><CourseCard key={c.id} course={c} onClick={openCourse}/>)}</div></section>
          </>}
          {page === 'explore' && <><PageHeader eyebrow="EXPLORE & DISCOVER" title="Find your next big skill" description="Expert-led lessons, made for the curious. Discover something worth learning."/><div className="filter-bar"><div className="search-field"><Search size={19}/><input placeholder="Search courses..." value={search} onChange={e=>setSearch(e.target.value)}/>{search && <button className="icon-btn" onClick={()=>setSearch('')}><X size={17}/></button>}</div><div className="category-pills">{Categories.map(cat=><button key={cat} className={`pill ${category === cat ? 'pill-active':''}`} onClick={()=>setCategory(cat)}>{cat}</button>)}</div></div><div className="results-label">Showing <strong>{visibleCourses.length}</strong> {visibleCourses.length === 1 ? 'course' : 'courses'}</div><div className="courses-grid">{visibleCourses.map(c=><CourseCard key={c.id} course={c} onClick={openCourse}/>)}</div>{!visibleCourses.length && <div className="empty-state"><Search size={32}/><h3>No courses found</h3><p>Try a different keyword or category.</p><button className="btn btn-outline" onClick={()=>{setSearch('');setCategory('All')}}>Clear filters</button></div>}</>}
          {page === 'learning' && <><PageHeader eyebrow="YOUR JOURNEY" title="My learning" description="All your courses and progress in one place."/>{!user ? <div className="empty-state"><LockKeyhole size={32}/><h3>Sign in to see your learning</h3><p>Your courses and progress will appear here.</p><button className="btn btn-primary" onClick={()=>setModal('login')}>Sign in</button></div> : user.role !== 'student' ? <div className="empty-state"><BookOpen size={32}/><h3>You’re in instructor mode</h3><p>Head to Instructor Studio to manage your courses.</p><button className="btn btn-primary" onClick={()=>goPage('studio')}>Open studio</button></div> : dash?.courses?.length ? <div className="courses-grid">{dash.courses.map(c=><CourseCard key={c.id} course={c} progress={c.progress} onClick={openCourse}/>)}</div> : <div className="empty-state"><GraduationCap size={36}/><h3>Your learning journey starts here</h3><p>Browse the catalog and enroll in your first course.</p><button className="btn btn-primary" onClick={()=>goPage('explore')}>Explore courses <ArrowRight size={16}/></button></div>}</>}
          {page === 'studio' && <><PageHeader eyebrow="CREATOR WORKSPACE" title="Instructor studio" description="Create meaningful courses and share knowledge with learners." action={user?.role === 'instructor' ? <button className="btn btn-primary" onClick={()=>setModal('course')}><Plus size={17}/> Create course</button> : null}/>{user?.role !== 'instructor' ? <div className="empty-state"><PencilLine size={32}/><h3>Instructor access only</h3><p>Register with an Instructor account to build courses.</p><button className="btn btn-primary" onClick={()=>setModal('register')}>Create instructor account</button></div> : <><div className="stats-grid studio-stats"><Metric icon={BookOpen} title="Your courses" value={dash?.stats?.courses ?? 0} hint="Created by you"/><Metric icon={UsersRound} title="Total enrollments" value={dash?.stats?.students ?? 0} hint="Across courses" tint="green"/><Metric icon={Layers3} title="Lessons created" value={dash?.stats?.lessons ?? 0} hint="Shared with learners" tint="orange"/></div>{dash?.courses?.length ? <div className="courses-grid">{dash.courses.map(c=><CourseCard key={c.id} course={c} onClick={openCourse}/>)}</div> : <div className="empty-state"><PencilLine size={32}/><h3>Create your first course</h3><p>Start with a title, a description and your first lesson.</p><button className="btn btn-primary" onClick={()=>setModal('course')}>Create course <Plus size={17}/></button></div>}</>}</>}
        </>}
        <footer className="footer"><span>© {new Date().getFullYear()} LearnHub. Made for lifelong learners.</span><span><span className="footer-dot"/> Your next chapter starts here.</span></footer>
      </main>
    </div>
    {notice && <div className="toast"><Sparkles size={18}/>{notice}<button onClick={()=>setNotice('')}><X size={16}/></button></div>}
    {(modal === 'login' || modal === 'register') && <Modal title={modal === 'register' ? 'Join the LearnHub community' : 'Welcome back'} subtitle={modal === 'register' ? 'Start your next learning chapter for free.' : 'Sign in to continue your learning journey.'} onClose={()=>setModal(null)}><form className="dialog-form" onSubmit={e=>authSubmit(e,modal)}>{modal === 'register' && <><label>Full name<input name="name" placeholder="Alex Morgan" required minLength={2} maxLength={90}/></label></>}<label>Email address<input type="email" name="email" placeholder="alex@example.com" required/></label><label>Password<input type="password" name="password" placeholder="At least 8 characters" required minLength={8}/></label>{modal === 'register' && <label>I want to<select name="role"><option value="student">Learn as a student</option><option value="instructor">Create courses as an instructor</option></select></label>}<button className="btn btn-primary btn-full" disabled={working}>{working ? 'One moment...' : modal === 'register' ? 'Create account' : 'Sign in'} <ArrowRight size={17}/></button><p className="auth-switch">{modal === 'register' ? 'Already have an account?' : 'New to LearnHub?'} <button type="button" onClick={()=>setModal(modal === 'register' ? 'login' : 'register')}>{modal === 'register' ? 'Sign in' : 'Create an account'}</button></p></form></Modal>}
    {modal === 'course' && <Modal title="Create a new course" subtitle="Share what you know with the world." onClose={()=>setModal(null)} wide><form className="dialog-form" onSubmit={createCourse}><label>Course title<input name="title" required minLength={5} maxLength={140} placeholder="e.g. Mastering React Fundamentals"/></label><label>Course description<textarea name="description" rows={4} minLength={20} maxLength={2500} required placeholder="What will students learn? Describe the outcomes and topics."/></label><div className="form-grid"><label>Category<select name="category">{Categories.slice(1).map(c=><option key={c}>{c}</option>)}</select></label><label>Difficulty<select name="level"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label></div><div className="swatch-field">Course cover color<div className="color-swatches">{accents.map((a,i)=><label key={a} className={`swatch swatch-${a}`}><input type="radio" name="accent" value={a} defaultChecked={i===0} aria-label={a}/><Check size={16}/></label>)}</div></div><button className="btn btn-primary btn-full" disabled={working}>Create course <Plus size={17}/></button></form></Modal>}
    {modal === 'lesson' && <Modal title="Add a lesson" subtitle="Write a lesson for your course curriculum." onClose={()=>setModal(null)} wide><form className="dialog-form" onSubmit={addLesson}><label>Lesson title<input name="title" required minLength={4} maxLength={140} placeholder="e.g. Getting started with components"/></label><label>Lesson content<textarea name="content" rows={7} required minLength={30} maxLength={12000} placeholder="Explain the topic, include examples, and give the learner something to practice."/></label><div className="form-grid"><label>Minutes<input type="number" min="1" max="240" name="minutes" defaultValue="15" required/></label><label>YouTube URL (optional)<input name="video_url" type="url" placeholder="https://www.youtube.com/watch?v=..."/></label></div><button className="btn btn-primary btn-full" disabled={working}>Add lesson <Plus size={17}/></button></form></Modal>}
    {modal === 'question' && <Modal title="Add a quiz question" subtitle="Check learner understanding with a multiple-choice question." onClose={()=>setModal(null)} wide><form className="dialog-form" onSubmit={addQuestion}><label>Question<input name="prompt" minLength={8} maxLength={350} required placeholder="e.g. What is the purpose of ...?"/></label><div className="form-grid"><label>Option A<input name="a" required maxLength={180}/></label><label>Option B<input name="b" required maxLength={180}/></label><label>Option C<input name="c" required maxLength={180}/></label><label>Option D<input name="d" required maxLength={180}/></label></div><label>Correct answer<select name="correct"><option value="A">Option A</option><option value="B">Option B</option><option value="C">Option C</option><option value="D">Option D</option></select></label><button className="btn btn-primary btn-full" disabled={working}>Save question <Plus size={17}/></button></form></Modal>}
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
