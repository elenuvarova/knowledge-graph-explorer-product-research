import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EntityCard from './EntityCard'

describe('EntityCard', () => {
  it('shows the placeholder when no entity is selected', () => {
    render(<EntityCard entity={null} />)
    expect(screen.getByText(/Click any node/i)).toBeInTheDocument()
  })

  it('shows a skeleton while loading', () => {
    const { container } = render(<EntityCard loading />)
    expect(container.querySelector('.skeleton')).toBeTruthy()
  })

  it('renders the entity name, type and source', () => {
    render(<EntityCard entity={{
      type: 'concept', fullName: 'Adaptive learning',
      degree: 0.5, bridge_score: 0.2, cluster_id: '0', source: 'openalex',
    }} />)
    expect(screen.getByText('Adaptive learning')).toBeInTheDocument()
    expect(screen.getByText('Concept')).toBeInTheDocument()
    expect(screen.getByText('openalex')).toBeInTheDocument()
  })
})
