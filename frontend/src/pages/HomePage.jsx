import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProjects, createProject, buildProject, deleteProject } from '../api'
import ThemeToggle from '../components/ThemeToggle'
import { InlineError, Toast, StateScreen } from '../components/states'

const GOALS = [
  { value: 'market', label: 'Market understanding' },
  { value: 'opportunity', label: 'Product opportunity' },
  { value: 'competitors', label: 'Competitor landscape' },
  { value: 'policy', label: 'Policy / regulation' },
  { value: 'research', label: 'Research landscape' },
]

const REGIONS = ['Global', 'EU', 'UK', 'US', 'Asia']

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>
}

function ProjectsSkeleton() {
  return (
    <div className="recent-projects">
      <div className="skeleton skeleton-line" style={{ width: '30%', height: 10, marginBottom: 16 }} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" style={{ height: 52 }} />
      ))}
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [topic, setTopic] = useState('')
  const [region, setRegion] = useState('Global')
  const [goal, setGoal] = useState('opportunity')
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')

  const { data: projectsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  })

  const startMutation = useMutation({
    mutationFn: async () => {
      const project = await createProject({ topic: topic.trim(), region, goal })
      await buildProject(project.id)
      return project
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      navigate(`/project/${project.id}`)
    },
    onError: (e) => setErr(e.message || 'Could not start the build. Please try again.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
    onError: () => setToast('Could not delete the project. Please try again.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setErr('')
    if (!topic.trim()) { setErr('Enter a topic to explore first.'); return }
    startMutation.mutate()
  }

  const projects = projectsData || []
  const busy = startMutation.isPending

  return (
    <div className="home">
      <div className="home-topbar">
        <ThemeToggle />
      </div>

      <div className="home-hero">
        <h1>Knowledge Graph Explorer</h1>
        <p>Enter a domain — get a structured map of its concepts, research, organisations and product opportunities.</p>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="topic">Topic</label>
          <textarea
            id="topic"
            rows={2}
            placeholder="e.g. AI tutoring, CSRD reporting, e-waste circularity…"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="form-selects">
          <div className="form-row">
            <label htmlFor="region">Region</label>
            <select id="region" value={region} onChange={(e) => setRegion(e.target.value)} disabled={busy}>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="goal">Research goal</label>
            <select id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} disabled={busy}>
              {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
        </div>

        <InlineError message={err} onDismiss={() => setErr('')} />

        <button className="btn btn-primary btn-full" type="submit" disabled={busy}>
          {busy ? <><span className="spinner spinner-sm" />Building map…</> : 'Build knowledge map →'}
        </button>
      </form>

      {isLoading && <ProjectsSkeleton />}

      {isError && (
        <div className="recent-projects">
          <StateScreen
            variant="error"
            title="Couldn't load your projects"
            message="The server didn't respond. Check your connection and try again."
            actions={<button className="btn btn-secondary" onClick={() => refetch()}>Retry</button>}
          />
        </div>
      )}

      {!isLoading && !isError && projects.length > 0 && (
        <div className="recent-projects">
          <h2>Recent projects</h2>
          {projects.map((p) => (
            // Row is an inert container; the main area is a keyboard-operable button
            // and the delete is a sibling button — avoids button-in-interactive-div (C-2).
            <div key={p.id} className="project-row">
              <button
                type="button"
                className="project-row-main"
                onClick={() => navigate(`/project/${p.id}`)}
                aria-label={`Open project: ${p.topic}`}
              >
                <span className="project-row-name">{p.topic}</span>
                <span className="project-row-meta">{p.region}</span>
                <StatusBadge status={p.status} />
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(p.id)}
                aria-label={`Delete ${p.topic}`}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  )
}
