// Sorting page: dashboard, start a session, completion rules, fabric lots, roles.
import { BASE, SHOTS, choose, createReport, login, logout } from './helpers.mjs'

export async function sortingScenario(browser) {
  const r = createReport('sorting')
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const page = await context.newPage()
  r.watch(page)

  try {
    await login(page, 'sorting_user')
    await page.goto(`${BASE}/sorting`)

    // Dashboard
    await page.getByText('Output efficiency').waitFor()
    await page.locator('.recharts-bar-rectangle').first().waitFor()
    r.check('dashboard shows rates and a chart', (await page.locator('.recharts-bar-rectangle').count()) > 0)
    await page.screenshot({ path: `${SHOTS}/sorting-1-dashboard.png` })

    // Start a session
    await page.getByRole('tab', { name: 'Sessions' }).click()
    await page.getByText(/ of \d+$/).waitFor()
    await page.getByRole('button', { name: 'Start session' }).click()
    const dialog = page.getByRole('dialog')
    await choose(dialog, 'Fabric lot', 0)
    await choose(dialog, 'Supervisor', /sorting_user/)
    await choose(dialog, 'Unit', 0)
    await dialog.getByLabel('Quantity taken (kg)').fill('10')
    await dialog.getByLabel('Notes').fill('Browser test session')
    await dialog.getByRole('button', { name: 'Start session' }).click()
    await page.getByText('Sorting session added.').waitFor()
    r.check('a new session can be started', true)

    // Newest first: the new session is the first row
    const firstRow = page.locator('tbody tr').first()
    r.check('new session is listed as In Progress', (await firstRow.innerText()).includes('In Progress'))

    // Completing with more than was taken is refused by the server, shown on the field
    await firstRow.getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Complete' }).click()
    const complete = page.getByRole('dialog')
    await complete.getByLabel('Quantity sorted (kg)').fill('9')
    await complete.getByLabel('Waste (kg)').fill('5')
    await complete.getByRole('button', { name: 'Mark complete' }).click()
    const fieldError = complete.locator('p.text-destructive').first()
    await fieldError.waitFor()
    r.check('sorted + waste above the input is refused', (await fieldError.innerText()).includes('more than'), await fieldError.innerText())
    await page.screenshot({ path: `${SHOTS}/sorting-2-complete-refused.png` })

    // A valid completion
    await complete.getByLabel('Waste (kg)').fill('1')
    await complete.getByRole('button', { name: 'Mark complete' }).click()
    await page.getByText('Sorting session completed.').waitFor()
    await page.waitForTimeout(300)
    r.check('session completes and shows 90% efficiency',
      /Completed/.test(await firstRow.innerText()) && /90\.0%/.test(await firstRow.innerText()), await firstRow.innerText())

    // Clean up the test session (no dependents)
    await firstRow.getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await page.getByText('Sorting session deleted.').waitFor()
    r.check('test session deleted', true)

    // Fabric lots: remaining quantity is explained, not editable
    await page.getByRole('tab', { name: 'Fabric lots' }).click()
    await page.locator('tbody tr').first().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    r.check('fabric edit explains how remaining changes',
      (await page.getByRole('dialog').innerText()).includes('changes through sorting sessions'))
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

    // Role-aware menu
    const nav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('sorting user sees only Sorting', nav.some((t) => t.includes('Sorting')) && !nav.some((t) => /Warehouse|Sales|Users/.test(t)), nav.join(','))

    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/sorting-error.png` }).catch(() => {})
  } finally {
    r.finish()
    await context.close()
  }
  return r.lines
}
