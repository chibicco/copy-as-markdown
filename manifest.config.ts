import { defineManifest } from '@crxjs/vite-plugin'

// The `author` manifest key has been unsupported since Feb 2024 and is
// silently ignored, so authorship is conveyed via homepage_url instead.
export default defineManifest({
  manifest_version: 3,
  name: 'Copy as Markdown',
  version: '0.1.0',
  description: 'Convert the current page to Markdown and view, copy, or download it.',
  homepage_url: 'https://github.com/chibicco/copy-as-markdown',
  minimum_chrome_version: '102',
  icons: {
    16: 'icons/icon-16.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_title: 'Copy as Markdown',
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  permissions: ['activeTab', 'scripting', 'storage'],
  content_security_policy: {
    // img-src allows remote images inside the sanitized markdown preview;
    // everything else is locked to the extension package.
    extension_pages: "default-src 'self'; img-src https: data:",
  },
})
