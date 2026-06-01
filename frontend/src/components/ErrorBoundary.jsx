import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Surface in the console for debugging; no external logging in this MVP.
    console.error('Uncaught UI error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="full-center" style={{ minHeight: '100vh' }}>
          <div className="state-screen">
            <div className="state-icon is-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="state-title">Something went wrong</div>
            <p className="state-message">The interface hit an unexpected error. Reloading usually fixes it.</p>
            <div className="state-actions">
              <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
              <a className="btn btn-secondary" href="/">Go home</a>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
