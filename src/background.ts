import extractScript from './extract?script'
import { captureStorageKey, type CaptureMessage, type CaptureResult } from './types'

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return
  chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      files: [extractScript],
    })
    .catch(() => {
      // Injection fails on restricted pages (chrome://, Web Store, etc.)
      showBadgeError(tab.id!)
    })
})

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  // The extract script runs inside arbitrary pages, so treat its messages
  // as untrusted: check the sender and validate the payload shape.
  if (sender.id !== chrome.runtime.id || !sender.tab) return
  if (!isCaptureMessage(message)) return

  const capture: CaptureResult = { id: crypto.randomUUID(), ...message.payload }
  void (async () => {
    await chrome.storage.session.set({ [captureStorageKey(capture.id)]: capture })
    await chrome.tabs.create({
      url: chrome.runtime.getURL(`src/viewer/viewer.html?id=${capture.id}`),
    })
  })()
})

function isCaptureMessage(message: unknown): message is CaptureMessage {
  const m = message as Partial<CaptureMessage> | null | undefined
  return (
    m?.type === 'capture' &&
    typeof m.payload?.markdown === 'string' &&
    typeof m.payload.title === 'string' &&
    typeof m.payload.url === 'string' &&
    typeof m.payload.capturedAt === 'string'
  )
}

function showBadgeError(tabId: number): void {
  void chrome.action.setBadgeText({ tabId, text: '!' })
  void chrome.action.setBadgeBackgroundColor({ tabId, color: '#dc2626' })
  setTimeout(() => {
    void chrome.action.setBadgeText({ tabId, text: '' })
  }, 3000)
}
