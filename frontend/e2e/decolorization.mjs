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

    // Receiving a lot adds its quantity to stock and sets the chemical's cost
    await page.getByRole('tab', { name: 'Lots' }).click()
    await page.getByRole('button', { name: 'Receive lot' }).click()
    dialog = page.getByRole('dialog')
    await choose(dialog, 'Chemical', new RegExp(NAME))
    await dialog.getByLabel('Lot number').fill(`LOT-${NAME.slice(-5)}`)
    await dialog.getByLabel('Quantity').fill('50')
    await dialog.getByLabel('Cost per unit').fill('20')
    await dialog.getByRole('button', { name: 'Receive' }).click()
    await page.getByText('Chemical lot added.').waitFor()
    await page.getByRole('tab', { name: 'Chemicals' }).click()
    await page.getByPlaceholder('Search chemicals…').fill(NAME)
    r.check('receiving a lot adds to stock', (await settle(remaining, '200 Liters')) === '200 Liters', await remaining())
    r.check('the lot sets the cost per unit', (await chemicalRow().locator('td').nth(4).innerText()).trim() === 'Rs. 20')

    // Recipes: changing the chemicals saves a new version
    const recipe = `E2E Recipe ${NAME.slice(-5)}`
    const recipeRow = () => page.locator('tbody tr', { hasText: recipe })
    const version = async () => (await recipeRow().locator('td').nth(2).innerText()).trim()
    await page.getByRole('tab', { name: 'Recipes' }).click()
    await page.getByRole('button', { name: 'New recipe' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name', { exact: true }).fill(recipe)
    await choose(dialog, 'Chemical 1', new RegExp(NAME))
    await dialog.getByLabel('Quantity 1').fill('5')
    await dialog.getByLabel('Temperature').fill('80')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Recipe added.').waitFor()
    r.check('new recipe starts at version 1', (await settle(version, 'v1')) === 'v1', await version())
    await recipeRow().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Quantity 1').fill('6')
    await dialog.getByLabel('What changed').fill('Stronger bath')
    await dialog.getByRole('button', { name: 'Update' }).click()
    await page.getByText('Recipe updated.').waitFor()
    r.check('changing a recipe saves version 2', (await settle(version, 'v2')) === 'v2', await version())
    await recipeRow().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    dialog = page.getByRole('dialog')
    r.check('the recipe keeps its history', (await dialog.getByText(/^Version [12]$/).count()) === 2
      && (await dialog.getByText('Stronger bath').count()) === 1)
    await page.screenshot({ path: `${SHOTS}/decolorization-4-recipe.png` })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await recipeRow().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await page.getByText('Recipe deleted.').waitFor()

    // Deleting the lot takes its quantity back out
    await page.getByRole('tab', { name: 'Lots' }).click()
    await page.getByPlaceholder('Search lot, chemical, supplier…').fill(NAME)
    await page.locator('tbody tr').first().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await page.getByText('Chemical lot deleted.').waitFor()
    await page.getByRole('tab', { name: 'Chemicals' }).click()
    await page.getByPlaceholder('Search chemicals…').fill(NAME)
    r.check('deleting the lot takes the stock back out', (await settle(remaining, '150 Liters')) === '150 Liters', await remaining())

    // Usage report and a batch's planned-against-issued view
    await page.getByRole('tab', { name: 'Usage' }).click()
    await page.getByText('Cost per kg treated').waitFor()
    r.check('usage report shows the chemical cost', (await page.getByText('Chemical cost', { exact: true }).count()) === 1)
    await page.screenshot({ path: `${SHOTS}/decolorization-5-usage.png` })
    await page.getByRole('tab', { name: 'Sessions' }).click()
    await page.locator('tbody tr').first().getByRole('button', { name: 'Row actions' }).click()
    r.check('only an admin is offered batch approval', (await page.getByRole('menuitem', { name: 'Approve batch' }).count()) === 0)
    await page.getByRole('menuitem', { name: 'Chemicals used' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByText('Chemical cost').waitFor()
    r.check('a batch shows planned against issued chemicals', (await dialog.getByRole('columnheader', { name: 'Planned' }).count()) === 1
      || (await dialog.getByText('No chemicals have been issued').count()) === 1)
    await page.screenshot({ path: `${SHOTS}/decolorization-6-consumption.png` })
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })

    // Clean up
    await page.getByRole('tab', { name: 'Chemicals' }).click()
    await page.getByPlaceholder('Search chemicals…').fill(NAME)
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
    const statuses = new Set(await page.locator('tbody tr td:nth-child(11)').allInnerTexts())
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
