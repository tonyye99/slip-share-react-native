// Turns PRIVACY.md into the website's privacy page (public/privacy.html), so
// the policy is written once. Handles only what PRIVACY.md uses: headings,
// paragraphs, - and 1. lists, **bold**, `code`, [links](url) and <email>.

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(text: string): string {
  return escape(text)
    .replace(/&lt;([^\s@&]+@[^\s&]+)&gt;/g, '<a href="mailto:$1">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function body(markdown: string): string {
  const html: string[] = []
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null
  let paragraph: string[] = []

  const flush = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.join(' '))}</p>`)
    paragraph = []
    if (list) html.push(`<${list.tag}>${list.items.map((item) => `<li>${item}</li>`).join('')}</${list.tag}>`)
    list = null
  }

  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd()
    const heading = /^(#{1,3}) (.*)$/.exec(line)
    const bullet = /^- (.*)$/.exec(line)
    const numbered = /^\d+\. (.*)$/.exec(line)
    const nested = /^ {2,}- (.*)$/.exec(line)
    if (!line.trim()) {
      flush()
    } else if (heading) {
      flush()
      html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`)
    } else if (nested && list) {
      const last = list.items.length - 1
      list.items[last] = list.items[last].replace(/(<\/ul>)?$/, (end) =>
        end ? `<li>${inline(nested[1])}</li></ul>` : `<ul><li>${inline(nested[1])}</li></ul>`,
      )
    } else if (bullet || numbered) {
      const tag = bullet ? 'ul' : 'ol'
      if (paragraph.length || (list && list.tag !== tag)) flush()
      list ??= { tag, items: [] }
      list.items.push(inline((bullet ?? numbered)![1]))
    } else if (list) {
      const last = list.items.length - 1
      list.items[last] += ' ' + inline(line.trim())
    } else {
      paragraph.push(line.trim())
    }
  }
  flush()
  return html.join('\n')
}

export function privacyHtml(markdown: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SlipShare Privacy Policy</title>
<!-- Made from PRIVACY.md by scripts/privacy-page.mts. Edit PRIVACY.md, then run it. -->
<style>
  :root { color-scheme: light dark; --text: #10181b; --muted: #55606a; --link: #2563eb; --bg: #ffffff; }
  @media (prefers-color-scheme: dark) { :root { --text: #eef2f4; --muted: #a3adb5; --link: #7aa7ff; --bg: #10181b; } }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 28px; line-height: 1.2; margin: 0 0 8px; }
  h2 { font-size: 20px; margin: 32px 0 8px; }
  a { color: var(--link); }
  li { margin: 4px 0; }
  code { font-size: 14px; }
</style>
</head>
<body>
<main>
${body(markdown)}
</main>
</body>
</html>
`
}
