import Defuddle from 'defuddle/full'
import type { CaptureMessage } from './types'

const result = new Defuddle(document, {
  url: location.href,
  markdown: true,
}).parse()

const message: CaptureMessage = {
  type: 'capture',
  payload: {
    markdown: result.content ?? '',
    title: result.title || document.title,
    url: location.href,
    capturedAt: new Date().toISOString(),
  },
}

void chrome.runtime.sendMessage(message)
