import { useState } from 'react'
import { TYPE_ORDER, typeColor, typeLabel } from '../graphTypes'

// Color key for the graph. Shows only the entity types actually present in the
// current graph, so the legend never lists types the user can't see.
export default function GraphLegend({ nodes = [] }) {
  const [open, setOpen] = useState(true)

  const present = new Set(nodes.map((n) => n.type))
  const types = TYPE_ORDER.filter((t) => present.has(t))
  // Surface any unexpected/extra types after the known ones.
  for (const t of present) if (t && !TYPE_ORDER.includes(t)) types.push(t)

  if (!types.length) return null

  return (
    <div className={`graph-legend${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="graph-legend-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="graph-legend-list"
        title={open ? 'Hide legend' : 'Show legend'}
      >
        <span className="graph-legend-title">Node types</span>
        <span className="graph-legend-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul id="graph-legend-list" className="graph-legend-list">
          {types.map((t) => (
            <li key={t} className="graph-legend-item">
              <span className="type-dot" style={{ background: typeColor(t) }} aria-hidden="true" />
              <span>{typeLabel(t)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
