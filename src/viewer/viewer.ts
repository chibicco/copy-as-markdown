import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { captureStorageKey, type CaptureResult } from '../types'

const pageTitle = document.getElementById('page-title') as HTMLHeadingElement
const pageUrl = document.getElementById('page-url') as HTMLAnchorElement
const tabPreview = document.getElementById('tab-preview') as HTMLButtonElement
const tabMarkdown = document.getElementById('tab-markdown') as HTMLButtonElement
const frontmatterToggle = document.getElementById('frontmatter') as HTMLInputElement
const copyButton = document.getElementById('copy') as HTMLButtonElement
const downloadButton = document.getElementById('download') as HTMLButtonElement
const empty = document.getElementById('empty') as HTMLParagraphElement
const preview = document.getElementById('preview') as HTMLElement
const editor = document.getElementById('editor') as HTMLTextAreaElement

void init()

async function init(): Promise<void> {
  const capture = await loadCapture()
  if (!capture) {
    empty.hidden = false
    for (const el of [preview, editor, copyButton, downloadButton]) el.hidden = true
    return
  }

  // Everything in the capture comes from an arbitrary web page. Titles and
  // URLs only ever go through textContent/attributes; the rendered markdown
  // goes through DOMPurify.
  document.title = `${capture.title} - Copy as Markdown`
  pageTitle.textContent = capture.title
  pageUrl.textContent = capture.url
  pageUrl.href = capture.url
  editor.value = capture.markdown
  renderPreview()

  tabPreview.addEventListener('click', () => switchView('preview'))
  tabMarkdown.addEventListener('click', () => switchView('markdown'))
  copyButton.addEventListener('click', () => void copyMarkdown(capture))
  downloadButton.addEventListener('click', () => downloadMarkdown(capture))
}

async function loadCapture(): Promise<CaptureResult | null> {
  const id = new URLSearchParams(location.search).get('id')
  if (!id) return null
  const key = captureStorageKey(id)
  const items = await chrome.storage.session.get(key)
  return (items[key] as CaptureResult | undefined) ?? null
}

function switchView(view: 'preview' | 'markdown'): void {
  const showPreview = view === 'preview'
  if (showPreview) renderPreview()
  preview.hidden = !showPreview
  editor.hidden = showPreview
  tabPreview.setAttribute('aria-selected', String(showPreview))
  tabMarkdown.setAttribute('aria-selected', String(!showPreview))
}

function renderPreview(): void {
  const html = marked.parse(editor.value, { async: false })
  preview.innerHTML = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

function outputMarkdown(capture: CaptureResult): string {
  const body = editor.value.trimEnd() + '\n'
  return frontmatterToggle.checked ? frontmatter(capture) + body : body
}

function frontmatter(capture: CaptureResult): string {
  const quote = (value: string) =>
    `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
  return [
    '---',
    `title: ${quote(capture.title)}`,
    `source: ${quote(capture.url)}`,
    `captured: ${capture.capturedAt}`,
    '---',
    '',
    '',
  ].join('\n')
}

async function copyMarkdown(capture: CaptureResult): Promise<void> {
  await navigator.clipboard.writeText(outputMarkdown(capture))
  const label = copyButton.textContent
  copyButton.textContent = 'Copied ✓'
  copyButton.disabled = true
  setTimeout(() => {
    copyButton.textContent = label
    copyButton.disabled = false
  }, 1500)
}

function downloadMarkdown(capture: CaptureResult): void {
  const blob = new Blob([outputMarkdown(capture)], {
    type: 'text/markdown;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filenameFor(capture.title)}.md`
  link.click()
  URL.revokeObjectURL(url)
}

function filenameFor(title: string): string {
  const name = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return name || 'page'
}
