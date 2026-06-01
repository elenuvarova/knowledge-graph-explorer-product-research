const TYPE_LABEL = {
  concept:      'Concept',
  organisation: 'Organisation',
  institution:  'Institution',
  paper:        'Research paper',
  regulation:   'Regulation',
  product:      'Product',
  person:       'Person',
  dataset:      'Dataset',
}

function Metric({ label, value }) {
  return (
    <div className="entity-metric">
      <div className="entity-metric-label">{label}</div>
      <div className="entity-metric-value">{value}</div>
    </div>
  )
}

export default function EntityCard({ entity }) {
  if (!entity) {
    return (
      <div className="entity-card-placeholder">
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="3" strokeWidth="2" />
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p style={{ fontSize: 13 }}>Click any node to see entity details</p>
      </div>
    )
  }

  const fmt = (n) => n != null ? Number(n).toFixed(3) : '—'

  return (
    <div className="entity-card">
      <div className="entity-type-tag">{TYPE_LABEL[entity.type] || entity.type}</div>
      <div className="entity-name">{entity.fullName || entity.name}</div>

      {entity.description && (
        <p className="entity-desc">{entity.description}</p>
      )}

      <div className="entity-meta">
        <Metric label="Degree" value={fmt(entity.degree)} />
        <Metric label="Bridge" value={fmt(entity.bridge_score)} />
        <Metric label="Cluster" value={entity.cluster_id ?? '—'} />
        <Metric label="Source" value={entity.source ?? '—'} />
      </div>

      {entity.source_url && (
        <div style={{ marginBottom: '1rem' }}>
          <a href={entity.source_url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: 'var(--accent-bright)' }}>
            View source →
          </a>
        </div>
      )}

      {entity.neighbors && entity.neighbors.length > 0 && (
        <div className="entity-neighbors">
          <h4>Connected to ({entity.neighbors.length})</h4>
          {entity.neighbors.map(n => (
            <span key={n.id} className="neighbor-chip" title={n.name}>
              {n.name.length > 22 ? n.name.slice(0, 20) + '…' : n.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
