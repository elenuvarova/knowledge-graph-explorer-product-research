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

export const deleteProject = async (id) => {
  const r = await fetch(`${BASE}/projects/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
}

export const getBrief = (id) => req(`/projects/${id}/brief`)

export const uploadDocument = (projectId, file) => {
  const form = new FormData()
  form.append('file', file)
  // No explicit Content-Type — the browser sets the multipart boundary.
  return req(`/projects/${projectId}/upload`, { method: 'POST', body: form })
}

export const askQuestion = (projectId, question) =>
  req(`/projects/${projectId}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
