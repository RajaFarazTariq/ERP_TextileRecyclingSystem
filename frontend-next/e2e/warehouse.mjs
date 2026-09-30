// Browser test of the new frontend: login, Warehouse page, dialogs, theme, roles.
//
// Needs Django on :8000 with demo data (python manage.py seed_demo_data) and
// this app running (npm run build && npm start -- -p 3001). One-time setup:
// npx playwright install chromium. Run: npm run e2e  (BASE=… to target another URL,
// SHOTS=<folder> to keep screenshots).
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:3001'
const SHOTS = process.env.SHOTS ?? fileURLToPath(new URL('./screenshots/', import.meta.url))
mkdirSync(SHOTS, { recursive: true })
const results = []
const problems = []

function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) process.exitCode = 1
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1366, height: 820 } })
const page = await context.newPage()
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`) })

try {
  // 1. Guard
  await page.goto(`${BASE}/warehouse`)
  check('unauthenticated visit redirects to login', page.url().includes('/login?next=%2Fwarehouse'), page.url())

  // 2. Wrong password
  await page.getByLabel('Username or email').fill('warehouse_user')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  const formAlert = page.locator('form p[role="alert"]')
  await formAlert.waitFor()
  check('bad password shows the server message', (await formAlert.innerText()).includes('Invalid'), await formAlert.innerText())

  // 3. Login → back to the requested page
  await page.getByLabel('Password', { exact: true }).fill('Demo@1234')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/warehouse')
  check('login returns to the requested page', page.url().endsWith('/warehouse'))
  const jsCookies = await page.evaluate(() => document.cookie)
  check('tokens are not readable by page scripts', !/erp_(access|refresh|user)/.test(jsCookies), JSON.stringify(jsCookies))

  // 4. Table
  await page.getByText(/of 300$/).waitFor()
  check('stock table shows all 300 entries, 20 per page', (await page.getByRole('row').count()) === 21)
  await page.screenshot({ path: `${SHOTS}/1-warehouse-light.png`, fullPage: false })

  // 5. Search
  await page.getByPlaceholder('Search vendor, fabric, vehicle…').fill('Ali Traders')
  await page.waitForTimeout(300)
  const vendorCells = await page.locator('tbody tr td:first-child').allInnerTexts()
  check('search filters rows', vendorCells.length > 0 && vendorCells.every((t) => t.includes('Ali Traders')), `${vendorCells.length} rows`)
  await page.getByPlaceholder('Search vendor, fabric, vehicle…').fill('')

  // 6. Status filter (server-side)
  await page.getByRole('combobox', { name: 'Status' }).click()
  // Start listening before the click so a fast response isn't missed
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('status=Approved')),
    page.getByRole('option', { name: 'Approved' }).click(),
  ])
  await page.waitForTimeout(300)
  const statuses = new Set(await page.locator('tbody tr td:nth-child(6)').allInnerTexts())
  check('status filter asks the server and shows only Approved', statuses.size === 1 && statuses.has('Approved'), [...statuses].join(','))

  // 7. Sorting by weight
  const readWeights = async () =>
    (await page.locator('tbody tr td:nth-child(4)').allInnerTexts()).map((t) => Number(t.replace(/[^\d.]/g, '')))
  const ascending = (a) => a.every((w, i) => i === 0 || a[i - 1] <= w)
  const descending = (a) => a.every((w, i) => i === 0 || a[i - 1] >= w)
  await page.getByRole('button', { name: /^Weight/ }).click()
  const first = await readWeights()
  await page.getByRole('button', { name: /^Weight/ }).click()
  const second = await readWeights()
  check('clicking a header sorts, clicking again reverses',
    (descending(first) && ascending(second)) || (ascending(first) && descending(second)),
    `first: ${first.slice(0, 3)}… second: ${second.slice(0, 3)}…`)

  // 8. Validation on an empty stock form
  await page.getByRole('button', { name: 'Add stock' }).click()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  const errors = await page.getByRole('dialog').locator('p.text-destructive').allInnerTexts()
  check('empty stock form shows field errors', errors.length >= 5, errors.slice(0, 3).join(' | '))
  await page.screenshot({ path: `${SHOTS}/2-stock-dialog-validation.png` })
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

  // 9. Add a vendor
  await page.getByRole('tab', { name: 'Vendors' }).click()
  await page.getByRole('button', { name: 'Add vendor' }).click()
  await page.getByLabel('Vendor name').fill('Browser Test Vendor')
  await page.getByLabel('Contact').fill('0300-1234567')
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await page.getByText('Vendor added.').waitFor()
  await page.getByPlaceholder('Search vendors…').fill('Browser Test')
  check('new vendor appears in the list', await page.getByRole('cell', { name: 'Browser Test Vendor' }).isVisible())

  // 10. Delete it (no dependents) → works
  await page.getByRole('button', { name: 'Row actions' }).first().click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await page.getByText('Vendor deleted.').waitFor()
  check('unused vendor can be deleted', true)

  // 11. Delete a vendor that has deliveries → blocked with the reason
  await page.getByPlaceholder('Search vendors…').fill('Ali Traders')
  await page.getByRole('button', { name: 'Row actions' }).first().click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  const reason = page.getByRole('alertdialog').getByRole('alert')
  await reason.waitFor()
  check('vendor with deliveries is protected, reason shown in the dialog',
    (await reason.innerText()).includes('cannot be deleted because other records depend on it'))
  await page.screenshot({ path: `${SHOTS}/3-delete-blocked.png` })
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()

  // 12. Role-aware navigation
  const navLinks = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
  check('warehouse user sees only Warehouse in the menu', !navLinks.some((t) => /Sales|Users|Reports/.test(t)), navLinks.join(','))
  await page.goto(`${BASE}/sales`)
  check('forbidden page redirects home', new URL(page.url()).pathname === '/')

  // 13. Dark mode
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitemradio', { name: 'Dark' }).click()
  check('dark theme applies', await page.evaluate(() => document.documentElement.classList.contains('dark')))
  await page.goto(`${BASE}/warehouse`)
  await page.getByText(/of 300$/).waitFor()
  await page.screenshot({ path: `${SHOTS}/4-warehouse-dark.png` })

  // 14. Mobile layout
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('no horizontal page scroll on a phone', overflow <= 0, `overflow ${overflow}px`)
  await page.screenshot({ path: `${SHOTS}/5-mobile.png` })
  await page.setViewportSize({ width: 1366, height: 820 })

  // 15. Sign out
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.waitForURL('**/login')
  await page.goto(`${BASE}/warehouse`)
  check('after sign-out the app requires login again', page.url().includes('/login'))
} catch (e) {
  check('scenario completed', false, e.message.split('\n')[0])
  await page.screenshot({ path: `${SHOTS}/error.png` }).catch(() => {})
} finally {
  // The wrong-password attempt (400) and the blocked delete (409) are expected
  const unexpected = problems.filter((p) => !/Failed to load resource: the server responded with a status of (400|409)/.test(p))
  check('no browser errors (hydration, runtime)', unexpected.length === 0, unexpected.slice(0, 3).join(' || '))
  console.log(results.join('\n'))
  await browser.close()
}
