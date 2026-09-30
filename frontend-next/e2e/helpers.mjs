// Shared pieces for the browser scenarios in this folder.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const BASE = process.env.BASE ?? 'http://localhost:3001'
export const SHOTS = process.env.SHOTS ?? fileURLToPath(new URL('./screenshots/', import.meta.url))
mkdirSync(SHOTS, { recursive: true })

/** Collects PASS/FAIL lines and browser errors for one scenario. */
export function createReport(name) {
  const lines = []
  const problems = []
  return {
    name,
    lines,
    problems,
    check(label, ok, detail = '') {
      lines.push(`${ok ? 'PASS' : 'FAIL'}  [${name}] ${label}${detail ? ` — ${detail}` : ''}`)
      if (!ok) process.exitCode = 1
    },
    watch(page) {
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
      page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`) })
    },
    /** Failed requests the scenario provoked on purpose (e.g. 400 validation, 409 protected delete). */
    finish(expectedStatuses = [400, 409]) {
      const pattern = new RegExp(`Failed to load resource: the server responded with a status of (${expectedStatuses.join('|')})`)
      const unexpected = problems.filter((p) => !pattern.test(p))
      this.check('no browser errors (hydration, runtime)', unexpected.length === 0, unexpected.slice(0, 3).join(' || '))
    },
  }
}

export async function login(page, username, password = 'Demo@1234') {
  await page.goto(`${BASE}/login`)
  await page.getByLabel('Username or email').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

export async function logout(page) {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.waitForURL('**/login')
}

/** Pick an option in a shadcn Select identified by its label. */
export async function choose(scope, label, optionText) {
  await scope.getByLabel(label, { exact: true }).click()
  const option = typeof optionText === 'number'
    ? scope.page().getByRole('option').nth(optionText)
    : scope.page().getByRole('option', { name: optionText })
  await option.click()
}

/**
 * Re-read a value until it equals `expected` (lists refresh just after the
 * success toast). Returns the last value read, so a failing check shows it.
 */
export async function settle(read, expected, timeout = 5000) {
  const until = Date.now() + timeout
  let value = await read()
  while (value !== expected && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    value = await read()
  }
  return value
}
