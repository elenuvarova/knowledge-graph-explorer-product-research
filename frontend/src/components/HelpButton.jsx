// Small "?" icon button that (re)launches the guided tour.
export default function HelpButton({ onClick, label = 'Take a tour', className = '' }) {
  return (
    <button
      type="button"
      className={`icon-btn icon-btn-sm ${className}`.trim()}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </button>
  )
}
