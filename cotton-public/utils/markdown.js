function textNode(text) {
  return { type: 'text', text: String(text || '') }
}

function elementNode(name, children, attrs = null) {
  const node = { name, children }
  if (attrs) node.attrs = attrs
  return node
}

function normalizeInlineText(text) {
  return String(text || '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
}

function parseInline(markdown) {
  const source = normalizeInlineText(markdown)
  const nodes = []
  const pattern = /(\*\*|__)(.+?)\1|`([^`]+)`/g
  let lastIndex = 0
  let match

  while ((match = pattern.exec(source))) {
    if (match.index > lastIndex) {
      nodes.push(textNode(source.slice(lastIndex, match.index)))
    }

    if (match[3]) {
      nodes.push(elementNode('span', [textNode(match[3])], {
        style: 'padding:0 4rpx;border-radius:4rpx;background:#F4F0EA;color:#8A5A2B;'
      }))
    } else {
      nodes.push(elementNode('strong', [textNode(match[2])], {
        style: 'font-weight:700;color:#111111;'
      }))
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < source.length) {
    nodes.push(textNode(source.slice(lastIndex)))
  }

  return nodes.length ? nodes : [textNode(source)]
}

function parseLine(line) {
  const raw = String(line || '')
  const trimmed = raw.trim()
  if (!trimmed) return []

  const heading = trimmed.match(/^#{1,6}\s+(.+)$/)
  if (heading) {
    return [
      elementNode('strong', parseInline(heading[1]), {
        style: 'font-weight:700;color:#111111;'
      })
    ]
  }

  const bullet = trimmed.match(/^[-*+]\s+(.+)$/)
  if (bullet) {
    return [textNode('• '), ...parseInline(bullet[1])]
  }

  const ordered = trimmed.match(/^(\d+)[.)]\s+(.+)$/)
  if (ordered) {
    return [textNode(`${ordered[1]}. `), ...parseInline(ordered[2])]
  }

  return parseInline(raw)
}

function markdownToRichTextNodes(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
  const nodes = []

  lines.forEach((line, index) => {
    nodes.push(...parseLine(line))
    if (index < lines.length - 1) nodes.push(elementNode('br', []))
  })

  return nodes.length ? nodes : [textNode('')]
}

module.exports = { markdownToRichTextNodes }
