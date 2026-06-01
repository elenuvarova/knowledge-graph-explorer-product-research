const BASE = '/api'

async function req(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, opts)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

export const getProjects = () => req('/projects')
export const getProject = (id) => req(`/projects/${id}`)
export const getGraph = (id) => req(`/projects/${id}/graph`)
export const getClusters = (id) => req(`/projects/${id}/clusters`)
export const getOpportunities = (id) => req(`/projects/${id}/opportunities`)
export const getEntity = (projectId, entityId) =>
  req(`/projects/${projectId}/entities/${entityId}`)

export const createProject = (body) =>
  req('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export const buildProject = (id) =>
  req(`/projects/${id}/build`, { method: 'POST' })

export const deleteProject = (id) =>
  fetch(`${BASE}/projects/${id}`, { method: 'DELETE' })

export const getBrief = (id) => req(`/projects/${id}/brief`)
