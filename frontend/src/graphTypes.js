// Single source of truth for entity-type colours and labels, shared by the
// graph canvas (node fill), the entity card (type tag) and the graph legend.
// Keep in sync with backend entity `type` values in models.py.

export const TYPE_COLOR = {
  concept:      '#a78bfa', // violet
  organisation: '#34d399', // emerald
  institution:  '#60a5fa', // blue
  paper:        '#93c5fd', // light blue
  regulation:   '#fbbf24', // amber
  product:      '#f87171', // red
  person:       '#f472b6', // pink
  dataset:      '#2dd4bf', // teal
}

export const DEFAULT_COLOR = '#64748b'

export const TYPE_LABEL = {
  concept:      'Concept',
  organisation: 'Organisation',
  institution:  'Institution',
  paper:        'Research paper',
  regulation:   'Regulation',
  product:      'Product',
  person:       'Person',
  dataset:      'Dataset',
}

// Stable display order for the legend (most common types first).
export const TYPE_ORDER = [
  'concept', 'paper', 'institution', 'organisation',
  'regulation', 'product', 'person', 'dataset',
]

export function typeColor(type) {
  return TYPE_COLOR[type] || DEFAULT_COLOR
}

export function typeLabel(type) {
  return TYPE_LABEL[type] || (type ? type[0].toUpperCase() + type.slice(1) : 'Other')
}
