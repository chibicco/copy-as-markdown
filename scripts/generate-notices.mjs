// Generates public/THIRD_PARTY_NOTICES.md from the LICENSE files of the
// runtime dependencies bundled into the extension, so the Web Store zip
// carries the attribution the licenses require. Run: npm run notices
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'THIRD_PARTY_NOTICES.md')

// dompurify is dual-licensed; we take it under Apache-2.0, whose text is
// the package's main LICENSE file.
const LICENSE_CHOICES = {
  dompurify: {
    license: 'Apache-2.0',
    note: 'DOMPurify is dual-licensed under MPL-2.0 OR Apache-2.0; this extension uses it under the Apache License 2.0.',
  },
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const deps = Object.keys(pkg.dependencies).sort()

const sections = deps.map((name) => {
  const dir = join(ROOT, 'node_modules', name)
  const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const licenseFile = ['LICENSE', 'LICENSE.md', 'LICENSE.txt']
    .map((f) => join(dir, f))
    .find(existsSync)
  if (!licenseFile) throw new Error(`no LICENSE file found for ${name}`)
  const choice = LICENSE_CHOICES[name]
  const repository =
    typeof meta.repository === 'string' ? meta.repository : (meta.repository?.url ?? '')
  return [
    `## ${name} ${meta.version}`,
    '',
    `- License: ${choice?.license ?? meta.license}`,
    `- Source: ${repository}`,
    ...(choice ? ['', choice.note] : []),
    '',
    '```',
    readFileSync(licenseFile, 'utf8').trimEnd(),
    '```',
  ].join('\n')
})

const content = [
  '# Third-party notices',
  '',
  'This extension bundles the following open source packages.',
  '',
  sections.join('\n\n'),
  '',
].join('\n')

writeFileSync(OUT, content)
console.log(`wrote ${OUT} (${deps.length} packages)`)
