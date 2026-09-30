// Dashboard and Reports: live figures, report tabs, Excel downloads, audit log filters and paging.
import { BASE, SHOTS, createReport, login, logout } from './helpers.mjs'

export async function reportsScenario(browser) {
  const r = createReport('reports')
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 }, acceptDownloads: true })
  const page = await context.newPage()
  r.watch(page)

  const download = async (buttonName) => {
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: buttonName }).click()])
    return file.suggestedFilename()
  }

  try {
    await login(page, 'admin', 'Admin@1234')

    // Dashboard
    await page.goto(`${BASE}/dashboard`)
    await page.getByText('Sellable stock').waitFor()
    await page.locator('.recharts-bar-rectangle').first().waitFor()
    r.check('dashboard shows live figures and a chart', (await page.locator('.recharts-bar-rectangle').count()) > 0)
    r.check('attention panel lists low chemicals', (await page.getByText(/is below 25%/).count()) > 0)
    r.check('recent activity comes from the audit log', (await page.locator('li', { hasText: /LOGIN|CREATE|UPDATE/ }).count()) > 0)
    await page.screenshot({ path: `${SHOTS}/reports-1-dashboard.png` })

    // Daily production + Excel
    await page.goto(`${BASE}/reports`)
    await page.getByText('Deliveries received that day').waitFor()
    const daily = await download('Export Excel')
    r.check('daily production exports to Excel', /^daily_production_.*\.xlsx$/.test(daily), daily)

    // Monthly sales
    await page.getByRole('tab', { name: 'Monthly sales' }).click()
    await page.getByText('Orders by status').waitFor()
    const monthly = await download('Export Excel')
    r.check('monthly sales shows figures and exports', /\.xlsx$/.test(monthly), monthly)

    // Waste analysis: chart, table, invalid range
    await page.getByRole('tab', { name: 'Waste analysis' }).click()
    await page.getByLabel('From').fill('2024-01-01')
    await page.getByText('Waste by fabric').waitFor()
    r.check('waste analysis shows a chart and per-fabric rows', (await page.locator('tbody tr').count()) > 0)
    const waste = await download('Export Excel')
    r.check('waste analysis exports to Excel', /\.xlsx$/.test(waste), waste)
    await page.getByLabel('From').fill('2030-01-01')
    r.check('an inverted date range is explained', await page.getByText('Choose a start date on or before the end date.').isVisible())
    await page.screenshot({ path: `${SHOTS}/reports-2-waste.png` })

    // Audit log: filter by action, page through, export
    await page.getByRole('tab', { name: 'Audit log' }).click()
    await page.getByText('All entries').waitFor()
    await page.getByRole('combobox', { name: 'Action' }).click()
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('action=LOGIN')),
      page.getByRole('option', { name: 'login', exact: true }).click(),
    ])
    await page.waitForTimeout(300)
    const actions = new Set(await page.locator('tbody tr td:nth-child(3)').allInnerTexts())
    r.check('audit log filters by action', actions.size === 1 && actions.has('LOGIN'), [...actions].join(','))
    await page.getByRole('combobox', { name: 'Action' }).click()
    await page.getByRole('option', { name: 'All actions' }).click()
    await page.waitForTimeout(300)
    const firstPage = await page.locator('tbody tr').first().innerText()
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('page=2') && res.ok()),
      page.getByRole('button', { name: 'Next page' }).click(),
    ])
    await page.getByText(/page 2 of/).waitFor()
    await page.waitForTimeout(300)
    r.check('audit log pages through the server', (await page.locator('tbody tr').first().innerText()) !== firstPage)
    const audit = await download('Export (500 rows)')
    r.check('audit log exports to Excel', /\.xlsx$/.test(audit), audit)
    await page.screenshot({ path: `${SHOTS}/reports-3-audit.png` })

    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/reports-error.png` }).catch(() => {})
  } finally {
    r.finish()
    await context.close()
  }
  return r.lines
}
