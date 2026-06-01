import { useEffect, useState } from 'react'

/* ── Icons ── */
export function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
export function GhostIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg className="build-step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/* ── Centred state screen (error / empty / not-found) ── */
export function StateScreen({ variant = 'empty', icon, title, message, actions }) {
  return (
    <div className="state-screen">
      <div className={`state-icon is-${variant}`}>{icon || (variant === 'error' ? <AlertIcon /> : <GhostIcon />)}</div>
      {title && <div className="state-title">{title}</div>}
      {message && <p className="state-message">{message}</p>}
      {actions && <div className="state-actions">{actions}</div>}
    </div>
  )
}

/* ── Inline, dismissible error banner ── */
export function InlineError({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="inline-error" role="alert">
      <AlertIcon />
      <span className="inline-error-text">{message}</span>
      {onDismiss && (
        <button className="inline-error-close" onClick={onDismiss} aria-label="Dismiss">×</button>
      )}
    </div>
  )
}

/* ── Transient toast ── */
export function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => onClose?.(), 4000)
    return () => clearTimeout(t)
  }, [message, onClose])
  if (!message) return null
  return (
    <div className="toast" role="status">
      <span>{message}</span>
      <button className="toast-close" onClick={onClose} aria-label="Dismiss"><CloseIcon /></button>
    </div>
  )
}

/* ── Skeletons ── */
export function SkeletonLine({ width = '100%', height = 12 }) {
  return <div className="skeleton skeleton-line" style={{ width, height }} />
}
export function ClusterSkeleton({ rows = 5 }) {
  return (
    <div className="cluster-panel">
      <SkeletonLine width="40%" height={10} />
      <div style={{ height: 12 }} />
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton skeleton-card" />)}
    </div>
  )
}
export function OppSkeleton({ cards = 4 }) {
  return (
    <div className="opp-board">
      <SkeletonLine width="30%" height={10} />
      <div style={{ height: 16 }} />
      <div className="opp-grid">
        {Array.from({ length: cards }).map((_, i) => <div key={i} className="skeleton skeleton-opp" />)}
      </div>
    </div>
  )
}
export function EntitySkeleton() {
  return (
    <div className="entity-card">
      <SkeletonLine width="35%" height={18} />
      <div style={{ height: 8 }} />
      <SkeletonLine width="70%" height={20} />
      <div style={{ height: 16 }} />
      <SkeletonLine width="100%" /><SkeletonLine width="92%" /><SkeletonLine width="60%" />
      <div style={{ height: 16 }} />
      <div className="entity-meta">
        <div className="skeleton" style={{ height: 52, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 52, borderRadius: 6 }} />
      </div>
    </div>
  )
}

/* ── Staged building screen ──
   The backend reports only "building", so these stages advance on a timer to
   show what the pipeline is doing during the ~30s build. They are the real
   pipeline steps, in order. */
const BUILD_STEPS = [
  'Expanding the topic into search terms',
  'Fetching concepts from Wikidata',
  'Querying OpenAlex for research & institutions',
  'Resolving & de-duplicating entities',
  'Building the graph & computing metrics',
  'Detecting knowledge clusters',
  'Scoring product opportunities',
  'Writing AI insights',
]

export function BuildingScreen() {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i < BUILD_STEPS.length - 1 ? i + 1 : i))
    }, 3800)
    return () => clearInterval(id)
  }, [])

  return (
    // role="status" / aria-live="polite" announces build progress to screen readers (S-5)
    <div className="build-screen" role="status" aria-live="polite" aria-atomic="false">
      <div className="build-screen-head">
        <div className="spinner" aria-hidden="true" />
        <div className="build-title">Building your knowledge graph</div>
        <div className="build-subtitle">Pulling open data and mapping the domain</div>
      </div>

      <div className="build-steps">
        {BUILD_STEPS.map((label, i) => {
          const state = i < active ? 'is-done' : i === active ? 'is-active' : ''
          return (
            <div key={label} className={`build-step ${state}`}>
              <span className="build-step-icon">
                {i < active ? <CheckIcon /> : <span className="build-step-dot" />}
              </span>
              <span>{label}</span>
            </div>
          )
        })}
      </div>

      <div className="build-note">This usually takes about 30 seconds.</div>
    </div>
  )
}
