const MarkdownIt = require('markdown-it')
const sanitizeHtml = require('sanitize-html')

const markdown = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
  breaks: false
})

function normalizeMarkdown(value, options = {}) {
  let source = String(value || '').replace(/\r\n/g, '\n')
  if (options.stripFirstHeading) source = source.replace(/^\s*#\s+[^\n]+\n+/, '')

  source = source
    .replace(/\\\*\\\*/g, '**')
    .replace(/(^|\n)([ \t]*(?:(?:[-+*]|\d+\.)[ \t]+)?)\*\*([^*\n]*?\S)[ \t\u00a0\u200b\ufeff]+\*\*/g, '$1$2**$3** ')
    .replace(/\*\*([^*\n]+)\*\*(?=\S)/g, '**$1** ')

  const lines = source.split('\n')
  return lines.filter((line, index) => {
    if (line.trim()) return true
    let previousIndex = index - 1
    while (previousIndex >= 0 && !lines[previousIndex].trim()) previousIndex -= 1
    let nextIndex = index + 1
    while (nextIndex < lines.length && !lines[nextIndex].trim()) nextIndex += 1
    const previous = String(lines[previousIndex] || '').trim()
    const next = String(lines[nextIndex] || '').trim()
    const isPipeRow = text => text.startsWith('|') && text.endsWith('|')
    return !(isPipeRow(previous) && isPipeRow(next))
  }).join('\n')
}

function renderMarkdown(value, options = {}) {
  const html = markdown.render(normalizeMarkdown(value, options))
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'del', 'blockquote', 'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'a', 'img', 'hr', 'pre', 'code'
    ],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title'],
      th: ['style'],
      td: ['style'],
      code: ['class']
    },
    allowedStyles: {
      th: { 'text-align': [/^(left|right|center)$/] },
      td: { 'text-align': [/^(left|right|center)$/] }
    },
    allowedSchemes: ['https', 'http'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: 'noopener noreferrer' }
      })
    }
  })
}

module.exports = { normalizeMarkdown, renderMarkdown }
