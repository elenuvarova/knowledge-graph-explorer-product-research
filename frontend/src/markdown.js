// Minimal, dependency-free, safe Markdown → HTML renderer.
//
// Security model: the input is LLM / template output and is rendered into the
// brief modal (dangerouslySetInnerHTML) and a print window. We therefore
// ESCAPE ALL HTML FIRST, so any raw HTML/script in the markdown becomes inert
// text, and only THEN add our own whitelisted tags. Link hrefs are sanitised
// to http(s)/mailto/relative — javascript: and data: URLs are dropped. No other
// attributes are ever emitted, so there is no HTML-injection surface.
//
// Supported subset (exactly what backend/ai/brief_generator.py emits):
//   # / ## / ### headings · GFM pipe tables · - and 1. lists · --- rules
//   **bold** · *italic* / _italic_ · `code` · [text](url) · paragraphs

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeHref(rawUrl) {
  const url = rawUrl.trim()
  // Allow only protocols we trust, plus relative/anchor links.
  if (/^(https?:|mailto:)/i.test(url)) return url
  if (/^[/#]/.test(url)) return url
  if (/^[a-z0-9._~%-]+(\/|$)/i.test(url) && !/^[a-z][a-z0-9+.-]*:/i.test(url)) return url
  return null // unknown / dangerous scheme (javascript:, data:, …) → drop
}

// Inline formatting. Operates on already HTML-escaped text, so the only markup
// present is what we add here.
function inline(text) {
  let s = text
  // `code` first, so its contents are not re-processed for * or _.
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
  // [label](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const href = safeHref(url)
    if (!href) return label
    const external = /^https?:/i.test(href)
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : ''
    return `<a href="${href}"${attrs}>${label}</a>`
  })
  // **bold** then *italic* / _italic_
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  s = s.replace(/(^|[^\w])_([^_\n]+)_/g, '$1<em>$2</em>')
  return s
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line)
}

function splitRow(line) {
  let l = line.trim()
  if (l.startsWith('|')) l = l.slice(1)
  if (l.endsWith('|')) l = l.slice(0, -1)
  return l.split('|').map((c) => c.trim())
}

export function renderMarkdown(md) {
  if (!md) return ''
  const lines = escapeHtml(md).replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0
  let para = []

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(' '))}</p>`)
      para = []
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // blank line → paragraph break
    if (!line.trim()) { flushPara(); i++; continue }

    // headings
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) { flushPara(); const lvl = h[1].length; out.push(`<h${lvl}>${inline(h[2].trim())}</h${lvl}>`); i++; continue }

    // horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { flushPara(); out.push('<hr>'); i++; continue }

    // GFM table: header row + separator row
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushPara()
      const head = splitRow(line)
      const rows = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i])); i++
      }
      const thead = `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`
      const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
      out.push(`<table>${thead}${tbody}</table>`)
      continue
    }

    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara()
      const items = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, '').trim())}</li>`); i++
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      flushPara()
      const items = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, '').trim())}</li>`); i++
      }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    // otherwise: accumulate into a paragraph
    para.push(line.trim())
    i++
  }
  flushPara()
  return out.join('\n')
}
