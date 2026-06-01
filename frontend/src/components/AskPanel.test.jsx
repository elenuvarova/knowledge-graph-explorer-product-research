import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AskPanel from './AskPanel'

describe('AskPanel', () => {
  it('submits the typed question', () => {
    const onAsk = vi.fn()
    render(<AskPanel onAsk={onAsk} pending={false} result={null} />)
    fireEvent.change(screen.getByPlaceholderText(/Ask anything/i), { target: { value: 'what is x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(onAsk).toHaveBeenCalledWith('what is x')
  })

  it('asks a suggestion when clicked', () => {
    const onAsk = vi.fn()
    render(<AskPanel onAsk={onAsk} pending={false} result={null} />)
    fireEvent.click(screen.getByText('Where are the biggest gaps?'))
    expect(onAsk).toHaveBeenCalledWith('Where are the biggest gaps?')
  })

  it('renders the answer and source chips', () => {
    render(
      <AskPanel
        onAsk={() => {}}
        pending={false}
        result={{ answer: 'A grounded reply', sources: [{ id: '1', name: 'Adaptive learning' }] }}
        onPickSource={() => {}}
      />,
    )
    expect(screen.getByText('A grounded reply')).toBeInTheDocument()
    expect(screen.getByText('Adaptive learning')).toBeInTheDocument()
  })
})
