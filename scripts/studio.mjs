#!/usr/bin/env node
/**
 * `npm run studio`: the grading desk on this machine, in its own window.
 *
 * Starts the site on a private port with STUDIO_ENABLED=1, which is the only
 * thing that makes app/studio render, then opens /studio in Chrome or Edge in
 * app mode (no tabs, no address bar). Closing the window leaves the server
 * running in this terminal; Ctrl+C stops it.
 *
 * Nothing here touches Vercel: the variable is set on the spawned process
 * alone, and the deployed site never sees it.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import http from 'node:http'

const port = process.env.STUDIO_PORT || '3999'
const url = `http://localhost:${port}/studio`

const server = spawn(`npx next dev -p ${port}`, {
  shell: true,
  stdio: 'inherit',
  env: { ...process.env, STUDIO_ENABLED: '1' },
})
server.on('exit', code => process.exit(code ?? 0))
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { server.kill(signal); process.exit(0) })
}

/** True once the dev server answers anything at all on the port. */
function ready() {
  return new Promise(resolve => {
    const req = http.get(url, res => { res.resume(); resolve(true) })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => { req.destroy(); resolve(false) })
  })
}

const BROWSERS = process.platform === 'win32'
  ? [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    ]
  : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/microsoft-edge']

function open() {
  const browser = BROWSERS.find(existsSync)
  if (browser) {
    spawn(browser, [`--app=${url}`, '--new-window', '--window-size=1600,1000'], { detached: true, stdio: 'ignore' }).unref()
    return
  }
  // No app-mode browser found: the default browser, in a normal tab.
  const opener = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]]
  spawn(opener[0], opener[1], { detached: true, stdio: 'ignore' }).unref()
}

// --no-open: start the server and print the address, for a tool or a test that drives its own browser.
const shouldOpen = !process.argv.includes('--no-open')

;(async () => {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await ready()) {
      console.log(`\nGrading desk: ${url}\n`)
      if (shouldOpen) open()
      return
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  console.error(`The site did not start on port ${port} in two minutes. Open ${url} by hand once it does.`)
})()
