import { useEffect, useRef } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import Cytoscape from 'cytoscape'

const TYPE_COLOR = {
  concept:      '#a78bfa',  // violet
  organisation: '#34d399',  // emerald
  institution:  '#60a5fa',  // blue
  paper:        '#93c5fd',  // light blue
  regulation:   '#fbbf24',  // amber
  product:      '#f87171',  // red
  person:       '#f472b6',  // pink
  dataset:      '#2dd4bf',  // teal
}
const DEFAULT_COLOR = '#64748b'

const STYLESHEET = [
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      'label': 'data(label)',
      'width': 'data(size)',
      'height': 'data(size)',
      'font-size': 9,
      'color': '#cbd5e1',
      'text-wrap': 'wrap',
      'text-max-width': '75px',
      'text-valign': 'bottom',
      'text-margin-y': 4,
      'text-outline-color': '#0d1117',
      'text-outline-width': 2,
      'border-width': 0,
      'transition-property': 'border-width, border-color, opacity',
      'transition-duration': '0.15s',
    },
  },
  {
    selector: 'node:selected',
    style: {
      'border-width': 3,
      'border-color': '#fff',
    },
  },
  {
    selector: 'node.highlighted',
    style: {
      'border-width': 2.5,
      'border-color': '#fbbf24',
    },
  },
  {
    selector: 'node.dimmed',
    style: { 'opacity': 0.25 },
  },
  {
    selector: 'edge',
    style: {
      'width': 1,
      'line-color': '#30363d',
      'opacity': 0.6,
      'curve-style': 'bezier',
    },
  },
  {
    selector: 'edge.highlighted',
    style: {
      'line-color': '#6e40c9',
      'opacity': 0.9,
      'width': 1.5,
    },
  },
]

const LAYOUT = {
  name: 'cose',
  animate: true,
  animationDuration: 900,
  nodeRepulsion: () => 600000,
  nodeOverlap: 8,
  idealEdgeLength: () => 90,
  edgeElasticity: () => 250,
  gravity: 50,
  numIter: 800,
  initialTemp: 200,
  coolingFactor: 0.99,
  minTemp: 1.0,
  randomize: true,
  fit: true,
  padding: 40,
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
        id: n.id,
        label,
        fullName: n.name,
        type: n.type,
        color: TYPE_COLOR[n.type] || DEFAULT_COLOR,
        size,
        cluster_id: n.cluster_id || '0',
        source: n.source,
        source_url: n.source_url,
        description: n.description,
        degree: n.degree,
        bridge_score: n.bridge_score,
        betweenness: n.betweenness,
      },
    })
  }

  for (const e of edges) {
    els.push({
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        relation_type: e.relation_type,
      },
    })
  }

  return els
}

export default function GraphCanvas({
  nodes = [],
  edges = [],
  selectedId,
  highlightClusterId,
  onNodeClick,
  onCyInit,
}) {
  const cyRef = useRef(null)
  const elements = buildElements(nodes, edges)

  const handleCy = (cy) => {
    cyRef.current = cy
    cy._highlightedCluster = null
    if (onCyInit) onCyInit(cy)

    cy.on('tap', 'node', (evt) => {
      if (onNodeClick) onNodeClick(evt.target.data())
    })

    cy.on('tap', (evt) => {
      if (evt.target === cy && onNodeClick) onNodeClick(null)
    })
  }

  // Highlight selected node
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().removeClass('selected-node')
    if (selectedId) cy.getElementById(selectedId).addClass('selected-node')
  }, [selectedId])

  return (
    <CytoscapeComponent
      elements={elements}
      stylesheet={STYLESHEET}
      layout={LAYOUT}
      cy={handleCy}
      className="cytoscape-container"
      style={{ width: '100%', height: '100%', background: '#0d1117' }}
    />
  )
}
