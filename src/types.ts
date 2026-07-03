export interface CapturePayload {
  markdown: string
  title: string
  url: string
  capturedAt: string
}

export interface CaptureResult extends CapturePayload {
  id: string
}

export interface CaptureMessage {
  type: 'capture'
  payload: CapturePayload
}

export function captureStorageKey(id: string): string {
  return `capture:${id}`
}
