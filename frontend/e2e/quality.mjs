// Quality: standard -> failed inspection -> quarantine blocks sorting -> admin release -> corrective action,
// and who may inspect which stage.
import { BASE, SHOTS, choose, createReport, login, logout, settle } from './helpers.mjs'

const TAG = Date.now() % 100000
const MATERIAL = `E2E QC ${TAG}`
const STANDARD = `E2E standard ${TAG}`

export async function qualityScenario(browser) {
  const r = createReport('quality')
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const page = await context.newPage()
  r.watch(page)

  const api = async (path) => (await page.request.get(`${BASE}/api/django/${path}`)).json()
  // Same-origin call from the page, as the app itself would make it
  const send = (method, path, body) => page.evaluate(async ([method, path, body]) => {
    const res = await fetch(`/api/django/${path}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    })
    return { status: res.status, text: await res.text() }
  }, [method, path, body])
  const inspection = async () => (await api('quality/inspections')).find((i) => i.material === MATERIAL)
  const row = (text) => page.locator('tbody tr', { hasText: text }).first()
  const openMenu = (rowLocator) => rowLocator.getByRole('button', { name: 'Row actions' }).click()

  try {
    // 1. The admin sets up a checklist with limits
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/quality`)
    await page.getByRole('tab', { name: 'Standards' }).click()
    await page.getByRole('button', { name: 'New standard' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name', { exact: true }).fill(STANDARD)
    await dialog.getByLabel('Check 1', { exact: true }).fill('Moisture')
    await dialog.getByLabel('Unit 1', { exact: true }).fill('%')
    await dialog.getByRole('button', { name: 'Save' }).click()
    const noLimit = await dialog.locator('p.text-destructive').first().innerText()
    r.check('a measurement needs a limit', noLimit.includes('minimum'), noLimit)
    await dialog.getByLabel('Maximum 1', { exact: true }).fill('12')
    await dialog.getByRole('button', { name: 'Add check' }).click()
    await dialog.getByLabel('Check 2', { exact: true }).fill('Free of oil')
    await choose(dialog, 'Type 2', 'Yes / no')
    await page.screenshot({ path: `${SHOTS}/quality-1-standard.png` })
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Standard added.').waitFor()

    // A delivery to inspect
    await page.goto(`${BASE}/warehouse`)
    await page.getByRole('button', { name: 'Add stock' }).click()
    dialog = page.getByRole('dialog')
    await choose(dialog, 'Vendor', 0)
    await dialog.getByLabel('Fabric type').fill(MATERIAL)
    await dialog.getByLabel('Vendor weight slip').fill(`QC-${TAG}`)
    await dialog.getByLabel('Vehicle no.').fill(`QCV-${TAG}`)
    await dialog.getByLabel('Our weight (kg)').fill('400')
    await dialog.getByLabel('Unloading weight (kg)').fill('398')
    await choose(dialog, 'Factory unit', 0)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Stock entry added.').waitFor()
    const delivery = (await api('warehouse/stock')).find((s) => s.fabric_type === MATERIAL)
    await logout(page)

    // 2. The warehouse supervisor inspects it and it fails
    await login(page, 'warehouse_user')
    const nav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('warehouse supervisor sees Quality', nav.some((t) => t.includes('Quality')))
    await page.goto(`${BASE}/quality`)
    await page.getByRole('button', { name: 'Record inspection' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Stage', { exact: true }).click()
    const stageOptions = await page.getByRole('option').allInnerTexts()
    await page.keyboard.press('Escape')
    r.check('a warehouse supervisor inspects incoming material only', stageOptions.join() === 'Incoming material', stageOptions.join())
    await choose(dialog, 'Delivery', new RegExp(MATERIAL))
    await choose(dialog, 'Standard', new RegExp(STANDARD))
    r.check('the standard fills in the checklist', (await dialog.innerText()).includes('max 12 %'))
    await dialog.getByLabel('Moisture value').fill('20')
    await choose(dialog, 'Free of oil result', 'Passed')
    await dialog.getByRole('button', { name: 'Save' }).click()
    const notPass = await dialog.locator('p.text-destructive').first().innerText()
    r.check('a failed check cannot be saved as Pass', notPass.includes("can't be Pass"), notPass)
    await choose(dialog, 'Result', /Fail/)
    await dialog.getByRole('button', { name: 'Save' }).click()
    r.check('failing needs a reason', (await dialog.locator('p.text-destructive').first().innerText()).includes('why'))
    await dialog.getByLabel('Why it failed').fill('Arrived wet')
    await page.screenshot({ path: `${SHOTS}/quality-2-inspection.png` })
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Inspection added.').waitFor()
    const failed = await inspection()
    r.check('the failed delivery is in quarantine', failed?.quarantined === true && failed.inspector_name === 'warehouse_user')

    await page.getByRole('tab', { name: 'Inspections' }).click()
    await page.getByPlaceholder('Search inspection, material, supplier…').fill(failed.number)
    await openMenu(row(failed.number))
    const items = (await page.getByRole('menuitem').allInnerTexts()).map((t) => t.trim())
    await page.keyboard.press('Escape')
    r.check('a supervisor cannot release or edit a failed inspection', !items.includes('Release from quarantine') && !items.includes('Edit'), items.join())

    await page.goto(`${BASE}/warehouse`)
    await page.getByPlaceholder(/Search/).first().fill(MATERIAL)
    r.check('the warehouse list shows the quarantine', (await settle(async () => (await row(MATERIAL).innerText()).includes('Quarantined'), true)) === true)
    await logout(page)

    // 3. Quarantined material can't go to sorting until the admin releases it
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/quality`)
    const lot = { stock: delivery.id, material_type: MATERIAL, initial_quantity: '100' }
    const blocked = await send('POST', 'sorting/fabric-stock', lot)
    r.check('sorting refuses the quarantined delivery', blocked.status === 400 && blocked.text.includes('quarantine'), `${blocked.status} ${blocked.text.slice(0, 120)}`)

    const held = page.locator('div.rounded-lg.border', { hasText: failed.number }).first()
    await held.waitFor()
    await page.screenshot({ path: `${SHOTS}/quality-3-dashboard.png` })
    await held.getByRole('button', { name: 'Release' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Release' }).click()
    r.check('releasing needs a reason', (await dialog.getByRole('alert').innerText()).includes('why'))
    await dialog.getByLabel('Reason for release').fill('Dried and re-tested')
    await dialog.getByRole('button', { name: 'Release' }).click()
    await page.getByText('Released from quarantine.').waitFor()
    const released = await inspection()
    r.check('the release is recorded with who did it', released.quarantined === false && released.released_by_name === 'admin')
    const allowed = await send('POST', 'sorting/fabric-stock', lot)
    r.check('after release the delivery can go to sorting', allowed.status === 201, `${allowed.status} ${allowed.text.slice(0, 120)}`)

    // 4. Follow-up action
    await page.getByRole('tab', { name: 'Inspections' }).click()
    await page.getByPlaceholder('Search inspection, material, supplier…').fill(failed.number)
    await openMenu(row(failed.number))
    await page.getByRole('menuitem', { name: 'View details' }).click()
    dialog = page.getByRole('dialog')
    const details = await dialog.innerText()
    r.check('details show the checklist and the release', details.includes('Moisture') && details.includes('Dried and re-tested'))
    await page.screenshot({ path: `${SHOTS}/quality-4-details.png` })
    await page.keyboard.press('Escape')
    await openMenu(row(failed.number))
    await page.getByRole('menuitem', { name: 'Add action' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('What has to be done').fill(`Cover loads in transit ${TAG}`)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Action added.').waitFor()
    await page.getByRole('tab', { name: 'Actions' }).click()
    await page.getByPlaceholder('Search action, inspection, person…').fill(String(TAG))
    await openMenu(row(String(TAG)))
    await page.getByRole('menuitem', { name: 'Mark as done' }).click()
    await page.getByText('Action marked as done.').waitFor()
    r.check('the action is done', (await settle(async () => (await row(String(TAG)).innerText()).includes('Done'), true)) === true)
    await page.screenshot({ path: `${SHOTS}/quality-5-actions.png` })
    await logout(page)

    // 5. A sorting supervisor inspects in-process material, and can't change standards
    await login(page, 'sorting_user')
    await page.goto(`${BASE}/quality`)
    await page.getByRole('button', { name: 'Record inspection' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Stage', { exact: true }).click()
    const sorterStages = await page.getByRole('option').allInnerTexts()
    await page.keyboard.press('Escape')
    r.check('a sorting supervisor inspects in-process material only', sorterStages.join() === 'In-process', sorterStages.join())
    r.check('and chooses a fabric lot, not a delivery', await dialog.getByLabel('Fabric lot').isVisible())
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Standards' }).click()
    await page.getByText(STANDARD).first().waitFor()
    r.check('only admins add standards', (await page.getByRole('button', { name: 'New standard' }).count()) === 0)
    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/quality-error.png` }).catch(() => {})
  } finally {
    r.finish()
    await context.close()
  }
  return r.lines
}
