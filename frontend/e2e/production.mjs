// Production: bill of materials -> order -> release -> stages on the floor -> material use -> completion with cost,
// and who may plan and who may run stages.
import { BASE, SHOTS, choose, createReport, login, logout, settle } from './helpers.mjs'

const TAG = Date.now() % 100000
const PRODUCT = `E2E fibre ${TAG}`
const BOM = `E2E recipe ${TAG}`

export async function productionScenario(browser) {
  const r = createReport('production')
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const page = await context.newPage()
  r.watch(page)

  const api = async (path) => (await page.request.get(`${BASE}/api/django/${path}`)).json()
  const order = async () => (await api('production/orders')).find((o) => o.product_name === PRODUCT)
  const stage = (name) => page.locator('ol > li', { hasText: name }).first()
  const completeStage = async (name, input, output, waste) => {
    await stage(name).getByRole('button', { name: 'Start' }).click()
    await page.getByText('Step started.').first().waitFor()
    await stage(name).getByRole('button', { name: 'Complete' }).click()
    const dialog = page.getByRole('dialog')
    if (input) await dialog.getByLabel('Input (kg)').fill(input)
    await dialog.getByLabel('Output (kg)').fill(output)
    await dialog.getByLabel('Waste (kg)').fill(waste)
    await dialog.getByLabel('Hours worked').fill('2')
    return dialog
  }

  try {
    // 1. The admin sets up a recipe and plans an order
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/production`)
    await page.getByText('Work in progress').waitFor()
    await page.screenshot({ path: `${SHOTS}/production-1-dashboard.png` })
    await page.getByRole('tab', { name: 'Setup' }).click()
    await page.getByRole('button', { name: 'New bill of materials' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name', { exact: true }).fill(BOM)
    await choose(dialog, 'Stocked chemical 1', 1)
    r.check('choosing a chemical names the line', (await dialog.getByLabel('Material 1', { exact: true }).inputValue()) !== '')
    await dialog.getByLabel('Quantity 1', { exact: true }).fill('2')
    await dialog.getByLabel('Cost per unit 1 (Rs.)', { exact: true }).fill('50')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Bill of materials added.').waitFor()

    await page.getByRole('tab', { name: 'Orders' }).click()
    await page.getByRole('button', { name: 'New order' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Product', { exact: true }).fill(PRODUCT)
    await choose(dialog, 'Fabric lot', 0)
    await choose(dialog, 'Routing', /Standard recycling/)
    await choose(dialog, 'Bill of materials', new RegExp(BOM))
    await dialog.getByLabel('Planned input (kg)').fill('500')
    await dialog.getByLabel('Planned output (kg)').fill('600')
    await dialog.getByLabel('Planned end').fill(new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10))
    await dialog.getByRole('button', { name: 'Save' }).click()
    const tooMuch = await dialog.locator('p.text-destructive').first().innerText()
    r.check('planned output above input is refused', tooMuch.includes("can't be more"), tooMuch)
    await dialog.getByLabel('Planned output (kg)').fill('400')
    await page.screenshot({ path: `${SHOTS}/production-2-order-form.png` })
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Production order added.').waitFor()
    let mo = await order()
    r.check('the order takes its stages from the routing', mo.steps.map((s) => s.stage_name).join() === 'Sorting,Decolorization,Drying', mo.steps.map((s) => s.stage_name).join())
    r.check('and its materials from the recipe (2 per 100 kg of 500 kg)', mo.materials[0]?.planned_quantity === '10.00', mo.materials[0]?.planned_quantity)

    // 2. Release it
    await page.getByPlaceholder('Search order, product, material…').fill(mo.number)
    await page.locator('tbody tr', { hasText: mo.number }).getByRole('button', { name: mo.number }).click()
    await page.getByRole('button', { name: 'Release' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Release' }).click()
    await page.getByText('Order released to the floor.').waitFor()
    r.check('a released order shows its stages waiting', (await settle(async () => (await order()).status, 'Released')) === 'Released')
    await logout(page)

    // 3. A supervisor runs the stages; planning stays with the admin
    await login(page, 'sorting_user')
    const nav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('sorting supervisor sees Production', nav.some((t) => t.includes('Production')))
    await page.goto(`${BASE}/production`)
    r.check('supervisors cannot plan orders', (await page.getByRole('button', { name: 'New order' }).count()) === 0)
    await page.getByRole('tab', { name: 'Orders' }).click()
    await page.getByPlaceholder('Search order, product, material…').fill(mo.number)
    await page.locator('tbody tr', { hasText: mo.number }).getByRole('button', { name: mo.number }).click()
    r.check('only the next stage can be started', (await page.getByRole('button', { name: 'Start' }).count()) === 1)

    dialog = await completeStage('Sorting', '500', '480', '40')
    await dialog.getByRole('button', { name: 'Mark complete' }).click()
    const over = await dialog.locator('p.text-destructive').first().innerText()
    r.check('output plus waste above the input is refused', over.includes("can't be more"), over)
    await dialog.getByLabel('Waste (kg)').fill('20')
    await dialog.getByRole('button', { name: 'Mark complete' }).click()
    await page.getByText('Sorting completed.').waitFor()
    mo = await order()
    r.check('the order is in progress at the next stage', mo.status === 'In Progress' && mo.current_stage === 'Decolorization', `${mo.status} ${mo.current_stage}`)

    dialog = await completeStage('Decolorization', null, '450', '10')
    r.check('the next stage starts from the last output', (await dialog.getByLabel('Input (kg)').inputValue()) === '480.00')
    await dialog.getByRole('button', { name: 'Mark complete' }).click()
    await page.getByText('Decolorization completed.').waitFor()
    dialog = await completeStage('Drying', null, '420', '5')
    await dialog.getByRole('button', { name: 'Mark complete' }).click()
    await page.getByText('Drying completed.').waitFor()

    await page.getByRole('button', { name: 'Record use' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel(/Quantity used/).fill('12')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Material use updated.').waitFor()
    await page.screenshot({ path: `${SHOTS}/production-3-order.png`, fullPage: true })

    await page.getByRole('button', { name: 'Complete order' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Complete order' }).click()
    await page.getByText('Order completed.').waitFor()
    mo = await order()
    r.check('the completed order has output, yield and cost',
      mo.status === 'Completed' && mo.actual_output_kg === '420.00' && mo.yield_pct === 84 && mo.material_cost === '600.00',
      `${mo.status} ${mo.actual_output_kg} ${mo.yield_pct}% Rs.${mo.material_cost}`)
    r.check('waste is the sum of the stages', mo.waste_kg === '35.00', mo.waste_kg)
    await logout(page)

    // 4. Schedule, material needs, and roles without access
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/production`)
    await page.getByRole('tab', { name: 'Schedule' }).click()
    await page.getByText('Planned dates of open orders').waitFor()
    await page.screenshot({ path: `${SHOTS}/production-4-schedule.png` })
    await page.getByRole('tab', { name: 'Materials' }).click()
    await page.getByText('Still needed').waitFor()
    r.check('material needs are listed', (await page.locator('tbody tr').count()) > 0)
    await page.screenshot({ path: `${SHOTS}/production-5-materials.png` })
    await logout(page)

    await login(page, 'warehouse_user')
    const keeperNav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('warehouse supervisor has no Production menu', !keeperNav.some((t) => t.includes('Production')))
    await page.goto(`${BASE}/production`)
    r.check('and is sent home if they open it', new URL(page.url()).pathname === '/')
    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/production-error.png` }).catch(() => {})
  } finally {
    r.finish()
    await context.close()
  }
  return r.lines
}
