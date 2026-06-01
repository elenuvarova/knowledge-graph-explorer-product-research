import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProjects, createProject, buildProject, deleteProject } from '../api'

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

export default function HomePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [topic, setTopic] = useState('')
  const [region, setRegion] = useState('Global')
  const [goal, setGoal] = useState('opportunity')
  const [err, setErr] = useState('')

  const { data: projectsData } = useQuery({
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
    onError: (e) => setErr(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setErr('')
    if (!topic.trim()) { setErr('Enter a topic first'); return }
    startMutation.mutate()
  }

  const projects = projectsData || []
  const busy = startMutation.isPending

  return (
    <div className="home">
      <div className="home-hero">
        <h1>Knowledge Graph Explorer</h1>
        <p>Enter a domain — get a structured map of concepts, research, organisations, and product opportunities.</p>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>Topic</label>
          <textarea
            rows={2}
            placeholder="e.g. AI tutoring, CSRD reporting, e-waste circularity…"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="form-selects">
          <div className="form-row">
            <label>Region</label>
            <select value={region} onChange={(e) => setRegion(e.target.value)} disabled={busy}>
              {REGIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Research goal</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} disabled={busy}>
              {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
        </div>
        {err && <p className="error-msg">{err}</p>}
        <button className="btn btn-primary btn-full" type="submit" disabled={busy}>
          {busy ? <><span className="spinner" style={{ width: 14, height: 14 }} />Building map…</> : 'Build knowledge map →'}
        </button>
      </form>

      {projects.length > 0 && (
        <div className="recent-projects">
          <h2>Recent projects</h2>
          {projects.map(p => (
            <div key={p.id} className="project-row" style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/project/${p.id}`)}>
              <span className="project-row-name">{p.topic}</span>
              <span className="project-row-meta">{p.region}</span>
              <StatusBadge status={p.status} />
              <button
                className="btn btn-danger"
                style={{ padding: '0.25rem 0.6rem', fontSize: 12 }}
                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(p.id) }}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
