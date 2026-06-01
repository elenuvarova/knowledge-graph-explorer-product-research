import { useState } from 'react'

const SUGGESTIONS = [
  'What are the main themes here?',
  'Where are the biggest gaps?',
  'Which entities connect different areas?',
]

export default function AskPanel({ onAsk, pending, result, error, onPickSource }) {
  const [q, setQ] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const trimmed = q.trim()
    if (trimmed) onAsk(trimmed)
  }

  return (
    <div className="ask-panel">
      <h3>Ask the graph</h3>

      <form onSubmit={submit} className="ask-form">
        <textarea
          rows={3}
          placeholder="Ask anything about this domain…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={pending}
        />
        <button className="btn btn-primary btn-full" type="submit" disabled={pending || !q.trim()}>
          {pending ? <><span className="spinner spinner-sm" />Thinking…</> : 'Ask'}
        </button>
      </form>

      {!result && !pending && (
        <div className="ask-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="ask-chip" onClick={() => { setQ(s); onAsk(s) }}>{s}</button>
          ))}
        </div>
      )}

      {error && <p className="error-msg">{error}</p>}

      {result && (
        <div className="ask-answer">
          <div className="ask-answer-label">Answer</div>
          <p className="ask-answer-text">{result.answer}</p>

          {result.sources?.length > 0 && (
            <div className="ask-sources">
              <div className="ask-answer-label">Highlighted on the graph</div>
              <div>
                {result.sources.map((s) => (
                  <span
                    key={s.id}
                    className="neighbor-chip"
                    title={`Centre on ${s.name}`}
                    onClick={() => onPickSource(s.id)}
                  >
                    {s.name.length > 24 ? s.name.slice(0, 22) + '…' : s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
