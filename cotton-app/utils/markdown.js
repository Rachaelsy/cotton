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

  const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
  if (heading) {
    return [
      elementNode('strong', parseInline(heading[2]), {
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

function parseTableCells(line) {
  let source = String(line || '').trim()
  if (!source.includes('|')) return []
  if (source.startsWith('|')) source = source.slice(1)
  if (source.endsWith('|')) source = source.slice(0, -1)
  return source.split('|').map(cell => cell.trim())
}

function isTableDivider(line, expectedColumns) {
  const cells = parseTableCells(line)
  return cells.length === expectedColumns && cells.every(cell => /^:?-{3,}:?$/.test(cell))
}

function tableAlignment(dividerCell) {
  const value = String(dividerCell || '')
  if (value.startsWith(':') && value.endsWith(':')) return 'center'
  if (value.endsWith(':')) return 'right'
  return 'left'
}

function tableNode(header, divider, rows) {
  const alignments = divider.map(tableAlignment)
  const minWidth = Math.max(620, header.length * 190)
  const cellStyle = (index, headerCell = false) => [
    'padding:16rpx 18rpx',
    'border:1rpx solid #DDE6E0',
    `text-align:${alignments[index] || 'left'}`,
    'vertical-align:top',
    'white-space:nowrap',
    headerCell ? 'font-weight:700' : '',
    headerCell ? 'background:#EEF6F1' : 'background:#FFFFFF',
    headerCell ? 'color:#174E3A' : 'color:#27332C'
  ].filter(Boolean).join(';') + ';'
  const rowNode = (cells, name) => elementNode('tr', header.map((_, index) =>
    elementNode(name, parseInline(cells[index] || ''), { style: cellStyle(index, name === 'th') })
  ))

  return elementNode('div', [
    elementNode('table', [
      elementNode('thead', [rowNode(header, 'th')]),
      elementNode('tbody', rows.map(row => rowNode(row, 'td')))
    ], { style: `width:100%;min-width:${minWidth}rpx;border-collapse:collapse;border-spacing:0;font-size:25rpx;line-height:1.55;` })
  ], { style: 'display:block;width:100%;margin:20rpx 0;overflow-x:auto;-webkit-overflow-scrolling:touch;' })
}

function markdownToRichTextNodes(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
  const nodes = []

  let index = 0
  while (index < lines.length) {
    const header = parseTableCells(lines[index])
    let dividerIndex = index + 1
    while (dividerIndex < lines.length && !lines[dividerIndex].trim()) dividerIndex += 1
    if (header.length > 1 && dividerIndex < lines.length && isTableDivider(lines[dividerIndex], header.length)) {
      const divider = parseTableCells(lines[dividerIndex])
      const rows = []
      index = dividerIndex + 1
      while (index < lines.length) {
        if (!lines[index].trim()) { index += 1; continue }
        const cells = parseTableCells(lines[index])
        if (cells.length !== header.length) break
        rows.push(cells)
        index += 1
      }
      nodes.push(tableNode(header, divider, rows))
      if (index < lines.length) nodes.push(elementNode('br', []))
      continue
    }
    nodes.push(...parseLine(lines[index]))
    if (index < lines.length - 1) nodes.push(elementNode('br', []))
    index += 1
  }

  return nodes.length ? nodes : [textNode('')]
}

module.exports = { markdownToRichTextNodes }
