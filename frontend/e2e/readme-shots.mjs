// Takes the screenshots used in the README (docs/screenshots/). Needs the same setup as the
// e2e tests, ideally on a freshly seeded database:  node e2e/readme-shots.mjs
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

import { BASE, login } from './helpers.mjs'

const OUT = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url))
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const shoot = async (page, name, { full = false } = {}) => {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: full })
  console.log('saved', name)
}

try {
  // Desktop, dark (default) theme
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', colorScheme: 'dark' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`)
  await shoot(page, 'login')
  await login(page, 'admin', 'Admin@1234')
  for (const [path, name] of [
    ['/dashboard', 'dashboard'],
    ['/warehouse', 'warehouse'],
    ['/sorting', 'sorting'],
    ['/decolorization', 'decolorization'],
    ['/drying', 'drying'],
    ['/procurement', 'purchasing'],
    ['/sales', 'sales'],
    ['/reports', 'reports'],
  ]) {
    await page.goto(`${BASE}${path}`)
    await shoot(page, name)
  }
  await page.goto(`${BASE}/dashboard`)
  await page.waitForLoadState('networkidle')
  await page.keyboard.press('Control+k')
  await page.getByRole('dialog').waitFor()
  await shoot(page, 'command-menu')
  await page.keyboard.press('Escape')

  // Light theme
  await page.evaluate(() => localStorage.setItem('theme', 'light'))
  await page.goto(`${BASE}/dashboard`)
  await shoot(page, 'dashboard-light')
  await ctx.close()

  // Phone
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce', colorScheme: 'dark' })
  const p = await phone.newPage()
  await login(p, 'admin', 'Admin@1234')
  await p.goto(`${BASE}/dashboard`)
  await shoot(p, 'mobile')
  await phone.close()
} finally {
  await browser.close()
}
