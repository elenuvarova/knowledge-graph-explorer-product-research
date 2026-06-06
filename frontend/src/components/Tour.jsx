import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

// Dependency-free guided tour: a spotlight cut-out over each target element plus
// a positioned tooltip card. Controlled via `open`; the parent owns first-run /
// replay logic and persistence. Keyboard: → / Enter next, ← back, Esc skip.

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const CARD_W = 300
const EST_H = 196
const GAP = 14

export default function Tour({ steps = [], open, onClose }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const cardRef = useRef(null)

  const step = steps[i]
  const last = i === steps.length - 1

  useEffect(() => { if (open) setI(0) }, [open])

  const measure = useCallback(() => {
    const s = steps[i]
    if (!open || !s) return
    if (!s.target) { setRect(null); return }
    const el = document.querySelector(s.target)
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [open, i, steps])

  // Run the step's side-effect (e.g. switch tab) then measure on the next frame.
  useLayoutEffect(() => {
    if (!open || !step) return
    step.before?.()
    const id = setTimeout(measure, step.before ? 60 : 0)
    return () => clearTimeout(id)
  }, [open, i]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const on = () => measure()
    window.addEventListener('resize', on)
    window.addEventListener('scroll', on, true)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('scroll', on, true)
    }
  }, [open, measure])

  useEffect(() => { if (open) cardRef.current?.focus() }, [open, i])

  const close = useCallback((done) => onClose?.(done), [onClose])
  const next = useCallback(() => { if (last) close(true); else setI((v) => v + 1) }, [last, close])
  const back = useCallback(() => setI((v) => Math.max(0, v - 1)), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false) }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, next, back, close])

  if (!open || !step) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const centered = !rect || step.placement === 'center'

  let cardStyle
  if (centered) {
    cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  } else {
    const left = Math.min(Math.max(rect.left, 12), Math.max(12, vw - CARD_W - 12))
    const below = rect.top + rect.height + GAP
    const above = rect.top - EST_H - GAP
    const top = below + EST_H <= vh - 8 || above < 12
      ? Math.min(below, vh - EST_H - 12)
      : Math.max(12, above)
    cardStyle = { top, left }
  }

  return createPortal(
    <div className={`tour${reduceMotion ? ' tour--still' : ''}`}>
      {/* Click guard — blocks the app behind; the spotlight provides the dim */}
      <div className="tour-guard" onClick={() => close(false)} aria-hidden="true" />
      {rect && !centered ? (
        <div
          className="tour-spotlight"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
          aria-hidden="true"
        />
      ) : (
        <div className="tour-dim" aria-hidden="true" />
      )}

      <div
        className="tour-card"
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Tour step ${i + 1} of ${steps.length}: ${step.title}`}
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tour-card-top">
          <span className="tour-count">{i + 1} / {steps.length}</span>
          <button className="tour-skip" onClick={() => close(false)}>Skip</button>
        </div>
        <div className="tour-title">{step.title}</div>
        <p className="tour-body">{step.body}</p>
        <div className="tour-dots" aria-hidden="true">
          {steps.map((_, n) => <span key={n} className={`tour-dot${n === i ? ' is-active' : ''}`} />)}
        </div>
        <div className="tour-actions">
          {i > 0
            ? <button className="btn btn-secondary btn-sm" onClick={back}>Back</button>
            : <span />}
          <button className="btn btn-primary btn-sm" onClick={next}>{last ? 'Got it' : 'Next'}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
