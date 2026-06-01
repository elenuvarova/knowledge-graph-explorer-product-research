import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getProject, getGraph, getClusters, getOpportunities, getEntity, getBrief } from '../api'
import GraphCanvas from '../components/GraphCanvas'
import EntityCard from '../components/EntityCard'
import ClusterPanel from '../components/ClusterPanel'
import OpportunityBoard from '../components/OpportunityBoard'

const TABS = [
  { id: 'graph',         label: 'Graph' },
  { id: 'clusters',      label: 'Clusters' },
  { id: 'opportunities', label: 'Opps' },
]

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>
}

export default function ProjectPage() {
  const { id } = useParams()
  const [tab, setTab] = useState('graph')
  const [selectedId, setSelectedId] = useState(null)
  const [highlightClusterId, setHighlightClusterId] = useState(null)
  const [cy, setCy] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [brief, setBrief] = useState(null)

  const briefMutation = useMutation({
    mutationFn: () => getBrief(id),
    onSuccess: (data) => setBrief(data),
  })

  const { data: project, error: projErr } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id),
    refetchInterval: (q) => q.state.data?.status === 'building' ? 2500 : false,
  })

  const isReady = project?.status === 'ready'

  const { data: graphData } = useQuery({
    queryKey: ['graph', id],
    queryFn: () => getGraph(id),
    enabled: isReady,
  })

  const { data: clustersData } = useQuery({
    queryKey: ['clusters', id],
    queryFn: () => getClusters(id),
    enabled: isReady,
  })

  const { data: oppsData } = useQuery({
    queryKey: ['opportunities', id],
    queryFn: () => getOpportunities(id),
    enabled: isReady,
  })

  const { data: entityData } = useQuery({
    queryKey: ['entity', id, selectedId],
    queryFn: () => getEntity(id, selectedId),
    enabled: !!selectedId,
  })

  const handleNodeClick = (nodeData) => {
    if (nodeData) {
      setSelectedId(nodeData.id)
      setTab('graph')
      setPanelOpen(true)
    } else {
      setSelectedId(null)
      setPanelOpen(false)
    }
  }

  const handleClusterClick = (clusterId) => {
    const isDeselect = highlightClusterId === clusterId
    setHighlightClusterId(isDeselect ? null : clusterId)
    setPanelOpen(!isDeselect)

    if (!cy) return
    cy.nodes().removeClass('highlighted')
    cy.edges().removeClass('highlighted')

    if (!isDeselect) {
      cy.nodes(`[cluster_id = "${clusterId}"]`).addClass('highlighted')
      cy.nodes(`[cluster_id = "${clusterId}"]`).connectedEdges().addClass('highlighted')
      cy._highlightedCluster = clusterId
      const targets = cy.nodes(`[cluster_id = "${clusterId}"]`)
      if (targets.length) cy.animate({ fit: { eles: targets, padding: 60 }, duration: 400 })
    } else {
      cy._highlightedCluster = null
    }
  }

  const handleTabClick = (tabId) => {
    setTab(tabId)
    if (tabId === 'clusters') {
      setPanelOpen(true)
    } else if (tabId === 'graph') {
      if (!selectedId) setPanelOpen(false)
    } else {
      setPanelOpen(false)
    }
  }

  const closePanel = () => {
    setPanelOpen(false)
    if (tab === 'clusters') {
      setHighlightClusterId(null)
      if (cy) {
        cy.nodes().removeClass('highlighted')
        cy.edges().removeClass('highlighted')
        cy._highlightedCluster = null
      }
    }
  }

  if (projErr) return <div className="home"><p className="error-msg">Failed to load project.</p></div>
  if (!project) return <div className="full-center"><div className="spinner" /></div>

  const oppCount  = oppsData?.opportunities?.length ?? 0
  const nodeCount = graphData?.stats?.node_count ?? 0
  const isBuilding = project.status === 'building' || project.status === 'pending'

  const sidebarLabel = tab === 'clusters' ? 'Clusters' : 'Entity detail'

  return (
    <div className={`project-page${panelOpen ? ' panel-open' : ''}`}>

      {/* ── Header ── */}
      <div className="project-header">
        <Link to="/" className="project-header-back" title="Back">←</Link>
        <span className="project-header-title">{project.topic}</span>
        {nodeCount > 0 && (
          <span className="project-header-count">{nodeCount} nodes</span>
        )}
        <StatusBadge status={project.status} />
        {isReady && (
          <button
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.7rem', fontSize: 'var(--text-xs)', flexShrink: 0 }}
            onClick={() => briefMutation.mutate()}
            disabled={briefMutation.isPending}
          >
            {briefMutation.isPending ? '…' : 'Brief'}
          </button>
        )}
      </div>

      {/* ── Tab bar (separate row) ── */}
      <div className="project-tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => handleTabClick(t.id)}
          >
            {t.label}
            {t.id === 'opportunities' && oppCount > 0 && (
              <span className="tab-count">{oppCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Building banner ── */}
      {project.status === 'building' && (
        <div className="building-banner">
          <span className="spinner" style={{ width: 14, height: 14 }} />
          Fetching Wikidata and OpenAlex, building graph… ~30 seconds
        </div>
      )}

      {/* ── Error banner ── */}
      {project.status === 'error' && (
        <div className="building-banner" style={{ color: 'var(--red)', background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }}>
          Build failed: {project.error_message || 'unknown error'}
        </div>
      )}

      {/* ── Body ── */}
      {isBuilding ? (
        <div className="full-center">
          <div className="loading-wrap">
            <div className="spinner" />
            <span>Building knowledge graph…</span>
          </div>
        </div>

      ) : tab === 'opportunities' ? (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <OpportunityBoard opportunities={oppsData?.opportunities ?? []} />
        </div>

      ) : (
        <div className="graph-view">
          {/* Canvas — always rendered so cluster highlights persist across tabs */}
          <div className="graph-canvas-wrap">
            {graphData ? (
              <GraphCanvas
                nodes={graphData.nodes}
                edges={graphData.edges}
                selectedId={selectedId}
                highlightClusterId={highlightClusterId}
                onNodeClick={handleNodeClick}
                onCyInit={setCy}
              />
            ) : isReady ? (
              <div className="full-center"><div className="spinner" /></div>
            ) : null}
          </div>

          {/* Backdrop — dims canvas when panel is open on mobile */}
          <div className="panel-backdrop" onClick={closePanel} />

          {/* Sidebar / bottom sheet */}
          <div className="graph-sidebar">
            <div className="sidebar-drag-handle" />
            <div className="sidebar-mobile-header">
              <span className="sidebar-mobile-label">{sidebarLabel}</span>
              <button className="sidebar-close" onClick={closePanel} aria-label="Close panel">✕</button>
            </div>

            {tab === 'clusters' ? (
              <ClusterPanel
                clusters={clustersData?.clusters ?? []}
                activeClusterId={highlightClusterId}
                onClusterClick={handleClusterClick}
              />
            ) : (
              <EntityCard entity={entityData} />
            )}
          </div>
        </div>
      )}
      {/* Brief modal */}
      {brief && (
        <div className="brief-overlay" onClick={() => setBrief(null)}>
          <div className="brief-modal" onClick={e => e.stopPropagation()}>
            <div className="brief-modal-header">
              <span className="brief-modal-title">Research Brief</span>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.7rem', fontSize: 'var(--text-xs)' }}
                  onClick={() => {
                    const blob = new Blob([brief.markdown], { type: 'text/markdown' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = brief.filename
                    a.click()
                    URL.revokeObjectURL(a.href)
                  }}
                >
                  Download .md
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.7rem', fontSize: 'var(--text-xs)' }}
                  onClick={() => {
                    const win = window.open('', '_blank')
                    win.document.write(`<!DOCTYPE html><html><head><title>${brief.filename}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:780px;margin:40px auto;padding:0 24px;color:#111;line-height:1.7}
  h1{font-size:2em;border-bottom:2px solid #eee;padding-bottom:.3em;margin-bottom:.5em}
  h2{font-size:1.35em;border-bottom:1px solid #eee;padding-bottom:.2em;margin-top:2em}
  h3{font-size:1.1em;margin-top:1.5em}
  table{border-collapse:collapse;width:100%;margin:1em 0}
  th,td{border:1px solid #ddd;padding:7px 12px;text-align:left}
  th{background:#f7f7f7;font-weight:600}
  code{background:#f5f5f5;padding:2px 5px;border-radius:3px;font-size:.9em}
  hr{border:none;border-top:1px solid #eee;margin:2em 0}
  @media print{body{margin:20px}button{display:none}}
</style></head><body>
<button onclick="window.print()" style="margin-bottom:24px;padding:8px 16px;cursor:pointer">Print / Save PDF</button>
<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap;font-size:15px">${brief.markdown.replace(/</g,'&lt;')}</pre>
</body></html>`)
                    win.document.close()
                  }}
                >
                  Print
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.7rem', fontSize: 'var(--text-xs)' }}
                  onClick={() => setBrief(null)}
                >
                  ✕
                </button>
              </div>
            </div>
            <pre className="brief-content">{brief.markdown}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
