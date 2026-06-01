import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StateScreen, InlineError, BuildingScreen } from './states'

describe('StateScreen', () => {
  it('renders title, message and actions', () => {
    render(<StateScreen variant="error" title="Build failed" message="something broke" actions={<button>Try again</button>} />)
    expect(screen.getByText('Build failed')).toBeInTheDocument()
    expect(screen.getByText('something broke')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('InlineError', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<InlineError message="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the message and calls onDismiss', () => {
    const onDismiss = vi.fn()
    render(<InlineError message="Enter a topic" onDismiss={onDismiss} />)
    expect(screen.getByText('Enter a topic')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('BuildingScreen', () => {
  it('shows the heading and the first pipeline step', () => {
    render(<BuildingScreen />)
    expect(screen.getByText('Building your knowledge graph')).toBeInTheDocument()
    expect(screen.getByText('Expanding the topic into search terms')).toBeInTheDocument()
  })
})
