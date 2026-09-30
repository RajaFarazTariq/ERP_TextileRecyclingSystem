// Decolorization page: dashboard, chemical stock through issuances, tanks, sessions, roles.
import { BASE, SHOTS, choose, createReport, login, logout, settle } from './helpers.mjs'

const NAME = `E2E Peroxide ${Date.now() % 100000}`

export async function decolorizationScenario(browser) {
  const r = createReport('decolorization')
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const page = await context.newPage()
  r.watch(page)

  const chemicalRow = () => page.locator('tbody tr', { hasText: NAME })
  const remaining = async () => (await chemicalRow().locator('td').nth(2).innerText()).trim()

  try {
    await login(page, 'decolor_user')
    await page.goto(`${BASE}/decolorization`)

    // Dashboard
    await page.getByText('Chemical stock levels').waitFor()
    r.check('dashboard shows chemical levels', (await page.getByRole('progressbar').count()) > 0)
    await page.screenshot({ path: `${SHOTS}/decolorization-1-dashboard.png` })

    // Add a chemical: remaining starts at the total
    await page.getByRole('tab', { name: 'Chemicals' }).click()
    await page.getByRole('button', { name: 'Add chemical' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('Chemical name').fill(NAME)
    await dialog.getByLabel('Total stock').fill('100')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Chemical added.').waitFor()
    await page.getByPlaceholder('Search chemicals…').fill(NAME)
    r.check('new chemical starts with remaining = total', (await settle(remaining, '100 Liters')) === '100 Liters', await remaining())

    // Issue 30 → remaining 70
    await page.getByRole('tab', { name: 'Issuances' }).click()
    await page.getByRole('button', { name: 'Issue chemical' }).click()
    dialog = page.getByRole('dialog')
    await choose(dialog, 'Chemical', new RegExp(NAME))
    await choose(dialog, 'Tank', 0)
    await dialog.getByLabel('Quantity').fill('30')
    await dialog.getByRole('button', { name: 'Issue' }).click()
    await page.getByText('Chemical issuance added.').waitFor()
    await page.getByRole('tab', { name: 'Chemicals' }).click()
    await page.getByPlaceholder('Search chemicals…').fill(NAME)
    r.check('issuing takes it out of stock', (await settle(remaining, '70 Liters')) === '70 Liters', await remaining())

    // Issuing more than is left is refused with the available amount
    await page.getByRole('tab', { name: 'Issuances' }).click()
    await page.getByRole('button', { name: 'Issue chemical' }).click()
    dialog = page.getByRole('dialog')
    await choose(dialog, 'Chemical', new RegExp(NAME))
    await choose(dialog, 'Tank', 0)
    await dialog.getByLabel('Quantity').fill('80')
    await dialog.getByRole('button', { name: 'Issue' }).click()
    const refusal = dialog.getByRole('alert')
    await refusal.waitFor()
    r.check('over-issuing is refused with what is available', (await refusal.innerText()).includes('Available: 70'), await refusal.innerText())
    await page.screenshot({ path: `${SHOTS}/decolorization-2-over-issue.png` })
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    // Deleting the issuance returns the stock
    await page.getByPlaceholder('Search chemical, tank, person…').fill(NAME)
    await page.locator('tbody tr').first().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    r.check('delete dialog says the quantity goes back to stock',
      (await page.getByRole('alertdialog').innerText()).includes('returned to chemical stock'))
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await page.getByText('Chemical issuance deleted.').waitFor()
    await page.getByRole('tab', { name: 'Chemicals' }).click()
    await page.getByPlaceholder('Search chemicals…').fill(NAME)
    r.check('deleting the issuance restores stock', (await settle(remaining, '100 Liters')) === '100 Liters', await remaining())

    // Restock: raising the total raises remaining by the same amount
    await chemicalRow().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Total stock').fill('150')
    await dialog.getByRole('button', { name: 'Update' }).click()
    await page.getByText('Chemical updated.').waitFor()
    r.check('restocking raises remaining stock', (await settle(remaining, '150 Liters')) === '150 Liters', await remaining())

    // Clean up
    await chemicalRow().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await page.getByText('Chemical deleted.').waitFor()
    r.check('test chemical deleted', true)

    // Sessions: status filter
    await page.getByRole('tab', { name: 'Sessions' }).click()
    await page.getByRole('combobox', { name: 'Status' }).click()
    await page.getByRole('option', { name: 'Completed' }).click()
    await page.waitForTimeout(200)
    const statuses = new Set(await page.locator('tbody tr td:nth-child(9)').allInnerTexts())
    r.check('session status filter', statuses.size <= 1 && (statuses.size === 0 || statuses.has('Completed')), [...statuses].join(','))

    // Tanks: cards with fill levels
    await page.getByRole('tab', { name: 'Tanks' }).click()
    r.check('tanks show as cards with fill levels', (await page.getByRole('progressbar', { name: /fill level/ }).count()) > 0)
    await page.getByRole('combobox', { name: 'Tank status' }).click()
    await page.getByRole('option', { name: 'Processing' }).click()
    const tankStatuses = new Set(await page.locator('[data-slot="card"] [class*="rounded-full"][class*="text-xs"]').allInnerTexts())
    r.check('tank status filter', tankStatuses.size === 1 && tankStatuses.has('Processing'), [...tankStatuses].join(','))
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${SHOTS}/decolorization-3-tanks.png` })

    const nav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('decolorization user sees only Decolorization', nav.some((t) => t.includes('Decolorization')) && !nav.some((t) => /Warehouse|Sorting|Sales/.test(t)))

    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/decolorization-error.png` }).catch(() => {})
  } finally {
    r.finish()
    await context.close()
  }
  return r.lines
}
