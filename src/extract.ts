import Defuddle from 'defuddle/full'
import type { CaptureMessage } from './types'

const result = new Defuddle(document, {
  url: location.href,
  markdown: true,
}).parse()

// Defuddle removes duplicate title text from content and exposes it as
// metadata. Put the page title back into the Markdown document.
const title = result.title || document.title
const markdown = prependDocumentTitle(result.content ?? '', title)

const message: CaptureMessage = {
  type: 'capture',
  payload: {
    markdown,
    title,
    url: location.href,
    capturedAt: new Date().toISOString(),
  },
}

void chrome.runtime.sendMessage(message)

function prependDocumentTitle(markdown: string, title: string): string {
  const body = markdown.trimStart()
  const cleanTitle = title.trim()
  return cleanTitle ? `# ${cleanTitle}\n\n${body}`.trimEnd() : body
}
