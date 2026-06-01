import { useState, useRef, lazy, Suspense } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProject, getGraph, getClusters, getOpportunities, getEntity, getBrief, buildProject, uploadDocument, askQuestion } from '../api'

// Cytoscape + cola are heavy; load them only when a graph actually renders.
const GraphCanvas = lazy(() => import('../components/GraphCanvas'))
import EntityCard from '../components/EntityCard'
import ClusterPanel from '../components/ClusterPanel'
import OpportunityBoard from '../components/OpportunityBoard'
import AskPanel from '../components/AskPanel'
import ThemeToggle from '../components/ThemeToggle'
import { BuildingScreen, StateScreen } from '../components/states'
import { useTheme } from '../theme'

const TABS = [
  { id: 'graph',         label: 'Graph' },
  { id: 'clusters',      label: 'Clusters' },
  { id: 'opportunities', label: 'Opps' },
  { id: 'ask',           label: 'Ask' },
]

// Escape every HTML-significant character. The brief markdown is LLM-generated
// and the filename derives from the user-supplied topic, so both must be
// neutralised before being written into the print window's DOM (stored XSS).
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>
}

export default function ProjectPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { theme } = useTheme()
  const fileInputRef = useRef(null)
  const [tab, setTab] = useState('graph')
  const [selectedId, setSelectedId] = useState(null)
  const [highlightClusterId, setHighlightClusterId] = useState(null)
  const [cy, setCy] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [brief, setBrief] = useState(null)
  const [askResult, setAskResult] = useState(null)

  const briefMutation = useMutation({
    mutationFn: () => getBrief(id),
    onSuccess: (data) => setBrief(data),
    onError: (e) => alert(`Could not generate brief: ${e.message}`),
  })

  const rebuildMutation = useMutation({
    mutationFn: () => buildProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  })

  const uploadMutation = useMutation({
    mutationFn: (file) => uploadDocument(id, file),
    onSuccess: () => {
      // Status flips to building; mark the dependent views stale so they refetch
      // the enriched graph once the project is ready again.
      qc.invalidateQueries({ queryKey: ['project', id] })
      qc.invalidateQueries({ queryKey: ['graph', id] })
      qc.invalidateQueries({ queryKey: ['clusters', id] })
      qc.invalidateQueries({ queryKey: ['opportunities', id] })
    },
    onError: (e) => alert(`Upload failed: ${e.message}`),
  })

  const onPickFile = (e) => {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
    e.target.value = ''
  }

  const highlightNodes = (ids) => {
    if (!cy) return
    cy.nodes().removeClass('highlighted')
    cy.edges().removeClass('highlighted')
    cy.elements().removeClass('faded')
    let coll = cy.collection()
    ;(ids || []).forEach((nid) => { coll = coll.union(cy.getElementById(nid)) })
    coll.addClass('highlighted')
    coll.connectedEdges().addClass('highlighted')
    cy._highlightedCluster = '__ask__'  // keep hover-fade from clearing it
    if (coll.length) cy.animate({ fit: { eles: coll, padding: 60 }, duration: 400 })
  }

  const askMutation = useMutation({
    mutationFn: (question) => askQuestion(id, question),
    onSuccess: (data) => { setAskResult(data); highlightNodes(data.highlighted_nodes) },
  })

  const centreNode = (nid) => {
    if (!cy) return
    const n = cy.getElementById(nid)
    if (n && n.length) cy.animate({ center: { eles: n }, zoom: Math.max(cy.zoom(), 1.1), duration: 300 })
  }

  const clearAskHighlight = () => {
    if (cy && cy._highlightedCluster === '__ask__') {
      cy.nodes().removeClass('highlighted')
      cy.edges().removeClass('highlighted')
      cy._highlightedCluster = null
    }
  }

  const { data: project, error: projErr, refetch: refetchProject } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id),
    refetchInterval: (q) => (q.state.data?.status === 'building' ? 2500 : false),
  })

  const isReady = project?.status === 'ready'

  const { data: graphData } = useQuery({
    queryKey: ['graph', id], queryFn: () => getGraph(id), enabled: isReady,
  })
  const { data: clustersData } = useQuery({
    queryKey: ['clusters', id], queryFn: () => getClusters(id), enabled: isReady,
  })
  const { data: oppsData } = useQuery({
    queryKey: ['opportunities', id], queryFn: () => getOpportunities(id), enabled: isReady,
  })
  const { data: entityData } = useQuery({
    queryKey: ['entity', id, selectedId], queryFn: () => getEntity(id, selectedId), enabled: !!selectedId,
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
    cy.elements().removeClass('faded')
    cy.nodes().removeClass('highlighted')
    cy.edges().removeClass('highlighted')

    if (!isDeselect) {
      const inCluster = cy.nodes(`[cluster_id = "${clusterId}"]`)
      inCluster.addClass('highlighted')
      inCluster.connectedEdges().addClass('highlighted')
      cy._highlightedCluster = clusterId
      if (inCluster.length) cy.animate({ fit: { eles: inCluster, padding: 60 }, duration: 400 })
    } else {
      cy._highlightedCluster = null
    }
  }

  const handleTabClick = (tabId) => {
    setTab(tabId)
    if (tabId !== 'ask') clearAskHighlight()
    if (tabId === 'clusters' || tabId === 'ask') setPanelOpen(true)
    else if (tabId === 'graph') { if (!selectedId) setPanelOpen(false) }
    else setPanelOpen(false)
  }

  const closePanel = () => {
    setPanelOpen(false)
    if (tab === 'ask') clearAskHighlight()
    if (tab === 'clusters') {
      setHighlightClusterId(null)
      if (cy) {
        cy.nodes().removeClass('highlighted')
        cy.edges().removeClass('highlighted')
        cy.elements().removeClass('faded')
        cy._highlightedCluster = null
      }
    }
  }

  // ── Project-level error / not-found ──
  if (projErr) {
    const notFound = /404/.test(projErr.message || '')
    return (
      <div className="project-page">
        <div className="project-header">
          <Link to="/" className="project-header-back" title="Back">←</Link>
          <span className="project-header-title">Project</span>
          <div className="header-actions"><ThemeToggle size="sm" /></div>
        </div>
        <StateScreen
          variant="error"
          title={notFound ? 'Project not found' : 'Could not load this project'}
          message={notFound
            ? "This project doesn't exist or may have been deleted."
            : "The server didn't respond. Check your connection and try again."}
          actions={
            <>
              {!notFound && <button className="btn btn-primary" onClick={() => refetchProject()}>Retry</button>}
              <Link className="btn btn-secondary" to="/">Go home</Link>
            </>
          }
        />
      </div>
    )
  }

  if (!project) {
    return <div className="full-center" style={{ minHeight: '100vh' }}><div className="spinner" /></div>
  }

  const oppCount  = oppsData?.opportunities?.length ?? 0
  const nodeCount = graphData?.stats?.node_count ?? 0
  const isBuilding = project.status === 'building' || project.status === 'pending'
  const sidebarLabel = tab === 'clusters' ? 'Clusters' : tab === 'ask' ? 'Ask the graph' : 'Entity detail'

  return (
    <div className={`project-page${panelOpen ? ' panel-open' : ''}`}>

      {/* ── Header ── */}
      <div className="project-header">
        <Link to="/" className="project-header-back" title="Back">←</Link>
        <span className="project-header-title">{project.topic}</span>
        {nodeCount > 0 && <span className="project-header-count">{nodeCount} nodes</span>}
        <StatusBadge status={project.status} />
        <div className="header-actions">
          {isReady && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.csv,.txt,.md"
                hidden
                onChange={onPickFile}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                title="Add a PDF or CSV to enrich the graph"
              >
                {uploadMutation.isPending ? '…' : 'Upload'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => briefMutation.mutate()}
                disabled={briefMutation.isPending}
              >
                {briefMutation.isPending ? '…' : 'Brief'}
              </button>
            </>
          )}
          <ThemeToggle size="sm" />
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="project-tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => handleTabClick(t.id)}
          >
            {t.label}
            {t.id === 'opportunities' && oppCount > 0 && <span className="tab-count">{oppCount}</span>}
          </button>
        ))}
      </div>

      {/* ── Body ── */}
      {isBuilding ? (
        <BuildingScreen />

      ) : project.status === 'error' ? (
        <StateScreen
          variant="error"
          title="Build failed"
          message={project.error_message || 'Something went wrong while building this graph.'}
          actions={
            <>
              <button className="btn btn-primary" onClick={() => rebuildMutation.mutate()} disabled={rebuildMutation.isPending}>
                {rebuildMutation.isPending ? 'Restarting…' : 'Try again'}
              </button>
              <Link className="btn btn-secondary" to="/">Go home</Link>
            </>
          }
        />

      ) : isReady && graphData && nodeCount === 0 ? (
        <StateScreen
          variant="empty"
          title="No graph to show"
          message="This topic didn't return enough open data to build a graph. Try a broader or more specific topic."
          actions={<Link className="btn btn-secondary" to="/">New topic</Link>}
        />

      ) : tab === 'opportunities' ? (
        <OpportunityBoard opportunities={oppsData?.opportunities ?? []} loading={isReady && !oppsData} />

      ) : (
        <div className="graph-view">
          {/* Canvas — always mounted so cluster highlights persist across tabs */}
          <div className="graph-canvas-wrap">
            {graphData ? (
              <Suspense fallback={<div className="full-center"><div className="spinner" /></div>}>
                <GraphCanvas
                  nodes={graphData.nodes}
                  edges={graphData.edges}
                  theme={theme}
                  selectedId={selectedId}
                  onNodeClick={handleNodeClick}
                  onCyInit={setCy}
                />
                <div className="graph-hint">Drag nodes · scroll to zoom · double-click to fit</div>
              </Suspense>
            ) : (
              <div className="full-center"><div className="spinner" /></div>
            )}
          </div>

          {/* Backdrop — dims canvas when the panel is open on mobile */}
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
                loading={isReady && !clustersData}
              />
            ) : tab === 'ask' ? (
              <AskPanel
                onAsk={(q) => askMutation.mutate(q)}
                pending={askMutation.isPending}
                result={askResult}
                error={askMutation.isError ? (askMutation.error?.message || 'Ask failed') : ''}
                onPickSource={centreNode}
              />
            ) : (
              <EntityCard entity={entityData} loading={!!selectedId && !entityData} />
            )}
          </div>
        </div>
      )}

      {/* ── Brief modal ── */}
      {brief && (
        <div className="brief-overlay" onClick={() => setBrief(null)}>
          <div className="brief-modal" onClick={(e) => e.stopPropagation()}>
            <div className="brief-modal-header">
              <span className="brief-modal-title">Research Brief</span>
              <div className="brief-modal-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const blob = new Blob([brief.markdown], { type: 'text/markdown' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = brief.filename
                    a.click()
                    URL.revokeObjectURL(a.href)
                  }}
                >
                  <span className="btn-label">Download</span> .md
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const win = window.open('', '_blank')
                    if (!win) { alert('Please allow pop-ups to print the brief.'); return }
                    win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(brief.filename)}</title>
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
<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap;font-size:15px">${escapeHtml(brief.markdown)}</pre>
</body></html>`)
                    win.document.close()
                  }}
                >
                  Print
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setBrief(null)} aria-label="Close">✕</button>
              </div>
            </div>
            <pre className="brief-content">{brief.markdown}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
