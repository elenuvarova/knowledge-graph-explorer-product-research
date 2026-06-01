import { useState } from 'react'

function RiskBadge({ level }) {
  return <span className={`badge risk-${level}`}>{level} risk</span>
}

function OppCard({ opp }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="opp-card">
      <div className="opp-card-header">
        <div className="opp-card-title">{opp.title}</div>
        <RiskBadge level={opp.risk_level} />
      </div>

      {opp.cluster_name && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Cluster: {opp.cluster_name}
          {opp.cluster_size && <span> · {opp.cluster_size} nodes</span>}
        </div>
      )}

      <p className="opp-why">{opp.why_it_matters}</p>

      {expanded && (
        <>
          {opp.risks?.length > 0 && (
            <div>
              <div className="opp-section-label">Risks</div>
              <ul className="opp-list">
                {opp.risks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
          {opp.next_questions?.length > 0 && (
            <div>
              <div className="opp-section-label">Next research questions</div>
              <ul className="opp-list">
                {opp.next_questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}
        </>
      )}

      <div>
        <div className="opp-section-label">Evidence strength</div>
        <div className="opp-score-bar">
          <div className="opp-score-fill" style={{ width: `${(opp.evidence_strength || 0) * 100}%` }} />
        </div>
      </div>

      <div className="opp-footer">
        <span>score {(opp.score || 0).toFixed(3)}</span>
        {opp.generated_by_ai && <span style={{ color: 'var(--accent-bright)' }}>✦ AI</span>}
        <button
          className="btn btn-secondary"
          style={{ padding: '0.2rem 0.6rem', fontSize: 11 }}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? 'Less' : 'More'}
        </button>
      </div>
    </div>
  )
}

export default function OpportunityBoard({ opportunities = [] }) {
  if (!opportunities.length) {
    return (
      <div className="loading-wrap">
        <p style={{ color: 'var(--text-muted)' }}>No opportunities scored yet.</p>
      </div>
    )
  }

  return (
    <div className="opp-board" style={{ height: '100%', overflowY: 'auto' }}>
      <h3>Opportunities · {opportunities.length}</h3>
      <div className="opp-grid">
        {opportunities.map(o => <OppCard key={o.id} opp={o} />)}
      </div>
    </div>
  )
}
