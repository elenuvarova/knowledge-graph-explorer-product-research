import { ClusterSkeleton } from './states'

export default function ClusterPanel({ clusters = [], activeClusterId, onClusterClick, loading }) {
  if (loading) return <ClusterSkeleton />

  if (!clusters.length) {
    return (
      <div className="cluster-panel">
        <p className="cluster-hint">No clusters were detected for this graph.</p>
      </div>
    )
  }

  const maxScore = Math.max(...clusters.map((c) => c.opportunity_score || 0), 0.001)

  return (
    <div className="cluster-panel">
      <h3>Clusters · {clusters.length}</h3>
      {clusters.map((c) => (
        <div
          key={c.id}
          className={`cluster-item${activeClusterId === c.cluster_id ? ' active' : ''}`}
          onClick={() => onClusterClick(c.cluster_id)}
        >
          <div className="cluster-name">{c.name}</div>
          <div className="cluster-stats">
            <span>{c.size} nodes</span>
            <span>{c.research_count} research</span>
            {c.product_count > 0 && <span>{c.product_count} products</span>}
          </div>
          <div className="cluster-bar">
            <div className="cluster-bar-fill" style={{ width: `${(c.opportunity_score / maxScore) * 100}%` }} />
          </div>
        </div>
      ))}
      {activeClusterId && <p className="cluster-hint">Click the active cluster again to deselect.</p>}
    </div>
  )
}
