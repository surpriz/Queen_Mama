const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

/**
 * Custom sign function for electron-builder.
 * Uses signtool.exe with Certum SimplySign cloud certificate.
 * SimplySign Desktop must be running and authenticated before this is called.
 *
 * Required env vars:
 *   CERTUM_THUMBPRINT - SHA-1 thumbprint of the EV certificate
 *
 * If CERTUM_THUMBPRINT is not set, signing is skipped (dev builds).
 */
exports.default = async function sign(configuration) {
  const thumbprint = process.env.CERTUM_THUMBPRINT
  if (!thumbprint) {
    console.log(`[sign] Skipping code signing (CERTUM_THUMBPRINT not set): ${path.basename(configuration.path)}`)
    return
  }

  const filePath = configuration.path
  const fileName = path.basename(filePath)

  // Skip files that don't need signing
  const ext = path.extname(filePath).toLowerCase()
  if (!['.exe', '.dll', '.msi'].includes(ext)) {
    console.log(`[sign] Skipping non-signable file: ${fileName}`)
    return
  }

  const signtool = findSignTool()
  if (!signtool) {
    throw new Error('[sign] signtool.exe not found. Install Windows SDK.')
  }

  console.log(`[sign] Signing ${fileName}...`)

  const args = [
    'sign',
    '/sha1', thumbprint,
    '/fd', 'sha256',
    '/tr', 'http://time.certum.pl',
    '/td', 'sha256',
    '/v',
    filePath
  ]

  try {
    const result = execSync(`"${signtool}" ${args.map(a => `"${a}"`).join(' ')}`, {
      encoding: 'utf8',
      timeout: 120_000 // 2 min timeout per file
    })
    console.log(`[sign] Successfully signed ${fileName}`)
    if (result) console.log(result.trim())
  } catch (err) {
    console.error(`[sign] Failed to sign ${fileName}:`, err.message)
    // Retry once after a short delay (cloud HSM can be slow)
    console.log(`[sign] Retrying ${fileName} in 5s...`)
    await new Promise(r => setTimeout(r, 5000))
    try {
      execSync(`"${signtool}" ${args.map(a => `"${a}"`).join(' ')}`, {
        encoding: 'utf8',
        timeout: 120_000
      })
      console.log(`[sign] Successfully signed ${fileName} (retry)`)
    } catch (retryErr) {
      throw new Error(`[sign] Failed to sign ${fileName} after retry: ${retryErr.message}`)
    }
  }
}

function findSignTool() {
  const windowsKitsRoot = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin'
  if (!fs.existsSync(windowsKitsRoot)) return null

  // Find the latest SDK version
  const versions = fs.readdirSync(windowsKitsRoot)
    .filter(d => d.startsWith('10.'))
    .sort()
    .reverse()

  for (const version of versions) {
    const signtoolPath = path.join(windowsKitsRoot, version, 'x64', 'signtool.exe')
    if (fs.existsSync(signtoolPath)) {
      return signtoolPath
    }
  }
  return null
}
