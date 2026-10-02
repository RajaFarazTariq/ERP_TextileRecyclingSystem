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
  // Loading placeholders must be gone before the picture is taken
  await page.waitForFunction(() => !document.querySelector('main [data-slot="skeleton"]'), null, { timeout: 30000 })
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
    ['/quality', 'quality'],
    ['/production', 'production'],
    ['/maintenance', 'maintenance'],
    ['/sustainability', 'sustainability'],
    ['/procurement', 'purchasing'],
    ['/sales', 'sales'],
    ['/finance', 'finance'],
    ['/approvals', 'approvals'],
    ['/reports', 'reports'],
    ['/documents', 'documents'],
    ['/workforce', 'workforce'],
  ]) {
    await page.goto(`${BASE}${path}`)
    await shoot(page, name)
  }

  // Pages that need a click or a record to show something
  await page.goto(`${BASE}/finance`)
  await page.getByRole('tab', { name: 'Journal' }).click()
  await page.getByPlaceholder('Search number, purpose…').waitFor()
  await shoot(page, 'finance-journal')

  await page.goto(`${BASE}/reports`)
  await page.getByRole('tab', { name: 'Report centre' }).click()
  await shoot(page, 'report-centre')

  // A lot that has been sold, so every stage of the trace has something in it
  // The demo data is random, so pick a lot whose weights only go down from stage to stage
  const lots = await (await page.request.get(`${BASE}/api/django/sorting/fabric-stock`)).json()
  let lot = lots[0].id
  for (const candidate of lots) {
    const t = (await (await page.request.get(`${BASE}/api/django/search/trace?lot=${candidate.id}`)).json()).summary ?? {}
    const steps = [t.weight_in, t.sorted, t.decolorized, t.dried, t.sold].map(Number)
    if (steps.every((kg, i) => kg > 0 && (i === 0 || kg <= steps[i - 1]))) { lot = candidate.id; break }
  }
  await page.goto(`${BASE}/traceability?lot=${lot}`)
  await page.getByRole('button', { name: 'Print' }).waitFor()
  await shoot(page, 'traceability')

  await page.goto(`${BASE}/dashboard`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /Notifications/ }).click()
  await shoot(page, 'notifications')
  await page.keyboard.press('Escape')
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
