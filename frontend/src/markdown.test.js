import { describe, it, expect } from 'vitest'
import { renderMarkdown, escapeHtml } from './markdown'

describe('renderMarkdown', () => {
  it('renders headings, bold and paragraphs', () => {
    const html = renderMarkdown('# Title\n\nSome **bold** text.')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<p>Some <strong>bold</strong> text.</p>')
  })

  it('renders a GFM pipe table', () => {
    const html = renderMarkdown('| Name | Type |\n|---|---|\n| AI | concept |')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>Name</th>')
    expect(html).toContain('<td>concept</td>')
  })

  it('renders unordered and ordered lists', () => {
    expect(renderMarkdown('- a\n- b')).toContain('<ul><li>a</li><li>b</li></ul>')
    expect(renderMarkdown('1. one\n2. two')).toContain('<ol><li>one</li><li>two</li></ol>')
  })

  it('escapes raw HTML so it cannot inject markup', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('drops dangerous link schemes but keeps safe ones', () => {
    const bad = renderMarkdown('[click](javascript:alert(1))')
    expect(bad).not.toContain('href')
    expect(bad).toContain('click')

    const good = renderMarkdown('[site](https://example.com)')
    expect(good).toContain('href="https://example.com"')
    expect(good).toContain('rel="noopener noreferrer"')
  })

  it('escapeHtml escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;')
  })
})
