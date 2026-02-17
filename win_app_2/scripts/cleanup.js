const { execSync } = require('child_process')

// Ports used by the Electron/Vite dev server only
// Backend (3000) and WS proxy (3001) are cleaned up on app quit, not at startup
const DEV_PORTS = [5173, 5174, 5175]

console.log('[Cleanup] Killing any existing Electron/Vite/Backend processes...')

const isWindows = process.platform === 'win32'

function killProcessOnPort(port) {
  try {
    if (isWindows) {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' })
      const lines = result.split('\n').filter(l => l.includes('LISTENING'))
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        const pid = parts[parts.length - 1]
        if (pid && pid !== '0') {
          try {
            execSync(`taskkill /F /PID ${pid} 2>nul`, { stdio: 'ignore' })
            console.log(`[Cleanup] Killed process ${pid} on port ${port}`)
          } catch {}
        }
      }
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' })
    }
  } catch {}
}

try {
  if (isWindows) {
    try {
      execSync('taskkill /F /IM electron.exe 2>nul', { stdio: 'ignore' })
    } catch {}
  } else {
    try {
      execSync('pkill -f electron 2>/dev/null', { stdio: 'ignore' })
    } catch {}
  }

  for (const port of DEV_PORTS) {
    killProcessOnPort(port)
  }

  console.log('[Cleanup] Done!')
} catch (error) {
  // Ignore errors, continue
}

// Small delay to ensure ports are released
setTimeout(() => process.exit(0), 500)
