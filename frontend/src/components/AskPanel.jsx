import { useState, useId } from 'react'

const SUGGESTIONS = [
  'What are the main themes here?',
  'Where are the biggest gaps?',
  'Which entities connect different areas?',
]

export default function AskPanel({ onAsk, pending, result, error, onPickSource }) {
  const [q, setQ] = useState('')
  const answerId = useId()

  const submit = (e) => {
    e.preventDefault()
    const trimmed = q.trim()
    if (trimmed) onAsk(trimmed)
  }

  return (
    <div className="ask-panel">
      <h3>Ask the graph</h3>

      <form onSubmit={submit} className="ask-form">
        <label htmlFor="ask-input" className="sr-only">Ask a question about this domain</label>
        <textarea
          id="ask-input"
          rows={3}
          placeholder="Ask anything about this domain…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={pending}
          aria-describedby={result ? answerId : undefined}
        />
        <button
          className="btn btn-primary btn-full"
          type="submit"
          disabled={pending || !q.trim()}
          aria-busy={pending}
        >
          {pending ? <><span className="spinner spinner-sm" aria-hidden="true" />Thinking…</> : 'Ask'}
        </button>
      </form>

      {!result && !pending && (
        <div className="ask-suggestions" aria-label="Suggested questions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="ask-chip"
              onClick={() => { setQ(s); onAsk(s) }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error-msg" role="alert">{error}</p>}

      {result && (
        <div className="ask-answer" id={answerId}>
          {/* aria-live announces the answer to screen readers when it arrives */}
          <div aria-live="polite" aria-atomic="true">
            <div className="ask-answer-label">Answer</div>
            <p className="ask-answer-text">{result.answer}</p>
          </div>

          {result.sources?.length > 0 && (
            <div className="ask-sources">
              <div className="ask-answer-label">Highlighted on the graph</div>
              <div>
                {result.sources.map((s) => (
                  // <button> gives keyboard access + announces as interactive (C-2, WCAG 2.1.1)
                  <button
                    key={s.id}
                    type="button"
                    className="neighbor-chip"
                    onClick={() => onPickSource(s.id)}
                    title={`Centre on ${s.name}`}
                  >
                    {s.name.length > 24 ? s.name.slice(0, 22) + '…' : s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
