import { useEffect, useMemo, useRef, useCallback } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import Cytoscape from 'cytoscape'
import cola from 'cytoscape-cola'
import { TYPE_COLOR, DEFAULT_COLOR } from '../graphTypes'

// Register the cola physics layout once (guard against HMR double-registration).
try { Cytoscape.use(cola) } catch { /* already registered */ }

function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  } catch { return fallback }
}

// Stylesheet is rebuilt per theme so labels/edges read from the design tokens.
function makeStylesheet() {
  const label   = cssVar('--graph-label', '#cbd5e1')
  const outline = cssVar('--graph-label-out', '#0d1117')
  const edge    = cssVar('--graph-edge', '#30363d')
  const accent  = cssVar('--accent-bright', '#a78bfa')
  const select  = cssVar('--text', '#e6edf3')

  return [
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        'label': 'data(label)',
        'width': 'data(size)',
        'height': 'data(size)',
        'font-size': 9,
        'min-zoomed-font-size': 7,
        'color': label,
        'text-wrap': 'wrap',
        'text-max-width': '78px',
        'text-valign': 'bottom',
        'text-margin-y': 4,
        'text-outline-color': outline,
        'text-outline-width': 2,
        'border-width': 0,
        'overlay-padding': 8,
        'overlay-opacity': 0,
        'transition-property': 'border-width, border-color, opacity, background-color',
        'transition-duration': '0.15s',
      },
    },
    { selector: 'node:selected', style: { 'border-width': 3, 'border-color': select } },
    { selector: 'node.highlighted', style: { 'border-width': 2.5, 'border-color': '#fbbf24' } },
    { selector: 'node.faded', style: { 'opacity': 0.16 } },
    {
      selector: 'edge',
      style: { 'width': 1, 'line-color': edge, 'opacity': 0.65, 'curve-style': 'bezier' },
    },
    { selector: 'edge.highlighted', style: { 'line-color': accent, 'opacity': 0.9, 'width': 1.6 } },
    { selector: 'edge.faded', style: { 'opacity': 0.06 } },
  ]
}

// Initial layout — locks grabbing while settling so accidental drags
// during the first animation don't disturb the physics.
const COLA = {
  name: 'cola',
  animate: true,
  refresh: 2,
  fit: true,
  padding: 48,
  nodeSpacing: 10,
  edgeLength: 95,
  randomize: false,
  handleDisconnected: true,
  convergenceThreshold: 0.04,
  maxSimulationTime: 1400,
  ungrabifyWhileSimulating: true,
}

// Live layout started on grab — runs until the node is released.
// handleDisconnected:false puts ALL nodes in one physics simulation, so
// dragging any node creates ripples across the whole graph (including small
// isolated nodes that have no direct edges to the dragged one).
// ungrabifyWhileSimulating must be false so the user can keep dragging.
const COLA_LIVE = {
  name: 'cola',
  animate: true,
  refresh: 1,
  infinite: true,
  fit: false,
  nodeSpacing: 22,
  edgeLength: 85,
  handleDisconnected: false,
  ungrabifyWhileSimulating: false,
}


function buildElements(nodes, edges) {
  const els = []
  for (const n of nodes) {
    const degree = n.degree || 0
    const bridge = n.bridge_score || 0
    const size = Math.max(16, Math.min(52, 16 + degree * 160 + bridge * 40))
    const label = n.name.length > 24 ? n.name.slice(0, 22) + '…' : n.name
    els.push({
      data: {
        id: n.id, label, fullName: n.name, type: n.type,
        color: TYPE_COLOR[n.type] || DEFAULT_COLOR, size,
        cluster_id: n.cluster_id || '0',
        source: n.source, source_url: n.source_url, description: n.description,
        degree: n.degree, bridge_score: n.bridge_score, betweenness: n.betweenness,
      },
    })
  }
  for (const e of edges) {
    els.push({ data: { id: e.id, source: e.source, target: e.target, relation_type: e.relation_type } })
  }
  return els
}

// Respect the user's motion preference: disable Cytoscape physics animation and
// cy.animate() calls when prefers-reduced-motion is active (WCAG 2.3.3 / M-1).
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function GraphCanvas({
  nodes = [], edges = [], theme = 'dark',
  selectedId, onNodeClick, onCyInit,
}) {
  const cyRef = useRef(null)
  const liveLayout = useRef(null)
  // Stable ref so Cytoscape event handlers always call the current prop.
  const onNodeClickRef = useRef(onNodeClick)
  useEffect(() => { onNodeClickRef.current = onNodeClick }, [onNodeClick])

  const elements = useMemo(() => buildElements(nodes, edges), [nodes, edges])
  const presetLayout = useMemo(() => ({ name: 'preset' }), [])
  const initialStylesheet = useMemo(() => makeStylesheet(), [])

  const handleCy = useCallback((cy) => {
    cyRef.current = cy
    cy._highlightedCluster = null
    if (onCyInit) onCyInit(cy)

    // Phase 1: settle nodes into position (finite, fits viewport).
    // Phase 2: once settled, switch to infinite physics so nodes stay alive
    // even without user interaction. Skipped under prefers-reduced-motion.
    const bootLayout = cy.layout({ ...COLA, animate: !prefersReducedMotion })
    bootLayout.one('layoutstop', () => {
      if (prefersReducedMotion) return
      liveLayout.current = cy.layout(COLA_LIVE)
      liveLayout.current.run()
    })
    bootLayout.run()

    cy.on('tap', 'node', (evt) => { onNodeClickRef.current?.(evt.target.data()) })

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.batch(() => cy.elements().removeClass('faded'))
        onNodeClickRef.current?.(null)
      }
    })

    cy.on('dbltap', (evt) => {
      if (evt.target === cy) cy.animate({ fit: { padding: 48 }, duration: prefersReducedMotion ? 0 : 400 })
    })

    // Hover → fade non-neighbours. Debounced 40 ms so fast mouse movement
    // doesn't fire a cascade of batch style recalculations.
    let hoverTimer = null
    cy.on('mouseover', 'node', (evt) => {
      if (cy._highlightedCluster) return
      clearTimeout(hoverTimer)
      hoverTimer = setTimeout(() => {
        const keep = evt.target.closedNeighborhood()
        cy.batch(() => cy.elements().difference(keep).addClass('faded'))
      }, 40)
    })
    cy.on('mouseout', 'node', () => {
      if (cy._highlightedCluster) return
      clearTimeout(hoverTimer)
      cy.batch(() => cy.elements().removeClass('faded'))
    })
    // No grab/free handlers needed — COLA_LIVE runs continuously after boot.
  }, [onCyInit])

  // Stop live layout if the component unmounts while a node is being dragged.
  useEffect(() => () => { if (liveLayout.current) liveLayout.current.stop() }, [])

  useEffect(() => {
    const cy = cyRef.current
    if (cy) cy.style(makeStylesheet())
  }, [theme])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      cy.nodes().unselect()
      if (selectedId) cy.getElementById(selectedId).select()
    })
  }, [selectedId])

  const nodeCount = nodes.length
  const edgeCount = edges.length

  return (
    // role="img" gives the canvas an accessible name and announces it as a graphic.
    // Full keyboard node-navigation (roving tabindex within Cytoscape) is a planned
    // follow-up; until then, the Clusters and Entity panels offer equivalent data.
    <div
      role="img"
      aria-label={`Knowledge graph: ${nodeCount} nodes, ${edgeCount} connections. Use the Clusters tab or click a node to inspect entities.`}
      style={{ width: '100%', height: '100%' }}
    >
      <p className="sr-only">
        This is an interactive force-directed graph showing {nodeCount} entities and {edgeCount} relationships.
        Use the Clusters tab in the sidebar to explore groups of related nodes, or the Ask tab to query the graph.
      </p>
      <CytoscapeComponent
        elements={elements}
        stylesheet={initialStylesheet}
        layout={presetLayout}
        cy={handleCy}
        className="cytoscape-container"
        style={{ width: '100%', height: '100%' }}
        minZoom={0.2}
        maxZoom={2.5}
        boxSelectionEnabled={false}
      />
    </div>
  )
}
