// Sustainability: waste category -> a supervisor records waste and a water reading -> the figures move ->
// report and export, and who may change or delete what.
import { BASE, SHOTS, choose, createReport, login, logout, settle } from './helpers.mjs'

const TAG = Date.now() % 100000
const CATEGORY = `E2E waste ${TAG}`
const REFERENCE = `E2E-GP-${TAG}`
const METER = `E2E-WM-${TAG}`

export async function sustainabilityScenario(browser) {
  const r = createReport('sustainability')
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 }, reducedMotion: 'reduce' })
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
  const record = async () => (await api('sustainability/waste-records')).find((w) => w.disposal_reference === REFERENCE)
  const reading = async () => (await api('sustainability/utility-readings')).find((u) => u.meter_reference === METER)
  const row = (text) => page.locator('tbody tr', { hasText: text }).first()
  const body = page.locator('body')
  const near = (a, b) => Math.abs(a - b) < 0.011

  try {
    // 1. The admin adds a waste category
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/sustainability`)
    await page.getByText('How these are calculated').waitFor()
    const dashboard = (await page.getByRole('tabpanel').innerText()).toLowerCase()
    r.check('the dashboard shows the figures and how they are worked out',
      ['recovery rate', 'waste handled', 'diverted from landfill', 'water per kg', 'energy per kg'].every((t) => dashboard.includes(t)))
    await page.screenshot({ path: `${SHOTS}/sustainability-1-dashboard.png`, fullPage: true })
    const before = await api('sustainability/summary')

    await page.getByRole('tab', { name: 'Setup' }).click()
    await page.getByRole('button', { name: 'New category' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Save' }).click()
    const noName = await dialog.locator('p.text-destructive').first().innerText()
    r.check('a category needs a name', noName.includes('Enter a name'), noName)
    await dialog.getByLabel('Name', { exact: true }).fill(CATEGORY)
    await choose(dialog, 'Classification', 'Hazardous')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Waste category added.').waitFor()
    await page.screenshot({ path: `${SHOTS}/sustainability-2-setup.png` })
    await logout(page)

    // 2. A sorting supervisor records waste sent to landfill
    await login(page, 'sorting_user')
    const nav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('a supervisor sees Sustainability', nav.some((t) => t.includes('Sustainability')))
    await page.goto(`${BASE}/sustainability`)
    await page.getByRole('button', { name: 'Add waste record' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Save' }).click()
    const errors = (await dialog.locator('p.text-destructive').allInnerTexts()).join(' | ')
    r.check('a waste record needs a weight, a category and a method',
      errors.includes('Enter the weight') && errors.includes('Choose a waste category') && errors.includes('disposed of'), errors)
    await dialog.getByLabel('Weight (kg)').fill('42.5')
    await choose(dialog, 'Waste category', new RegExp(CATEGORY))
    await choose(dialog, 'Disposal method', 'Landfill')
    await dialog.getByLabel('Taken by').fill('E2E hauler')
    await dialog.getByLabel('Manifest or gate pass no.').fill(REFERENCE)
    await page.screenshot({ path: `${SHOTS}/sustainability-3-waste-form.png` })
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Waste record added.').waitFor()
    const saved = await record()
    r.check('the record keeps who entered it and its classification',
      saved?.recorded_by_name === 'sorting_user' && saved.classification === 'Hazardous' && saved.quantity_kg === '42.50',
      JSON.stringify(saved ?? null).slice(0, 160))

    await page.getByRole('tab', { name: 'Waste records' }).click()
    await page.getByPlaceholder('Search waste, disposal, reference…').fill(REFERENCE)
    await row(REFERENCE).waitFor()
    await row(REFERENCE).getByRole('button', { name: 'Row actions' }).click()
    const items = (await page.getByRole('menuitem').allInnerTexts()).map((t) => t.trim())
    await page.keyboard.press('Escape')
    r.check('a supervisor edits their own record but cannot delete it', items.includes('Edit') && !items.includes('Delete'), items.join())
    await choose(body, 'Classification', 'Recyclable')
    r.check('the classification filter hides other waste', (await settle(() => row(REFERENCE).count(), 0)) === 0)
    await choose(body, 'Classification', 'Hazardous')
    r.check('and shows the matching waste', (await settle(() => row(REFERENCE).count(), 1)) === 1)
    await page.screenshot({ path: `${SHOTS}/sustainability-4-waste.png` })

    // 3. ...and a water reading
    await page.getByRole('tab', { name: 'Utilities' }).click()
    await page.getByRole('button', { name: 'Add reading' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Quantity used').fill('12.5')
    await dialog.getByLabel('Cost (Rs.)').fill('1000')
    await dialog.getByLabel('Meter or bill no.').fill(METER)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Reading added.').waitFor()
    await page.getByPlaceholder('Search utility, area, meter…').fill(METER)
    await row(METER).waitFor()
    const readingRow = await row(METER).innerText()
    r.check('the reading is listed in the unit of its utility', readingRow.includes('12.5 m3'), readingRow.replace(/\s+/g, ' ').slice(0, 120))
    await page.screenshot({ path: `${SHOTS}/sustainability-5-utilities.png` })

    // 4. The calculated figures follow
    const after = await api('sustainability/summary')
    const grew = (pick) => Number(pick(after)) - Number(pick(before))
    r.check('waste handled and landfill grow by the recorded weight',
      near(grew((s) => s.waste.total_kg), 42.5) && near(grew((s) => s.waste.landfill_kg), 42.5),
      `${before.waste.total_kg} -> ${after.waste.total_kg}`)
    r.check('water use grows by the reading', near(grew((s) => s.utilities.water_m3), 12.5),
      `${before.utilities.water_m3} -> ${after.utilities.water_m3}`)

    // 5. Environmental report and its export
    await page.getByRole('tab', { name: 'Environmental report' }).click()
    await page.getByText('Material balance').waitFor()
    const report = (await page.getByRole('tabpanel').innerText()).toLowerCase()
    r.check('the report shows the balance, waste, utilities and chemicals',
      ['sorting', 'decolorization', 'drying', 'disposal method', 'landfill', 'water', 'chemicals'].every((t) => report.includes(t)))
    await page.screenshot({ path: `${SHOTS}/sustainability-6-report.png`, fullPage: true })
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export CSV' }).click(),
    ])
    r.check('the report exports as CSV', /^environmental-report-.*\.csv$/.test(download.suggestedFilename()), download.suggestedFilename())
    await logout(page)

    // 6. Another supervisor reads everything but can't change it or manage the setup
    await login(page, 'drying_user')
    await page.goto(`${BASE}/sustainability`)
    await page.getByRole('tab', { name: 'Waste records' }).click()
    await page.getByPlaceholder('Search waste, disposal, reference…').fill(REFERENCE)
    await row(REFERENCE).waitFor()
    r.check("a supervisor has no menu on someone else's record", (await row(REFERENCE).getByRole('button', { name: 'Row actions' }).count()) === 0)
    const patched = await send('PATCH', `sustainability/waste-records/${saved.id}`, { quantity_kg: '1' })
    const removed = await send('DELETE', `sustainability/waste-records/${saved.id}`)
    r.check('and the server refuses the change and the delete', patched.status === 403 && removed.status === 403, `${patched.status} ${removed.status}`)
    await page.getByRole('tab', { name: 'Setup' }).click()
    await page.getByText(CATEGORY).first().waitFor()
    r.check('only admins manage categories and targets',
      (await page.getByRole('button', { name: 'New category' }).count()) === 0 && (await page.getByRole('button', { name: 'New target' }).count()) === 0)
    await logout(page)

    // 7. The admin deletes the record; clean up the rest
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/sustainability`)
    await page.getByRole('tab', { name: 'Waste records' }).click()
    await page.getByPlaceholder('Search waste, disposal, reference…').fill(REFERENCE)
    await row(REFERENCE).getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await page.getByText('Waste record deleted.').waitFor()
    r.check('an admin deletes a waste record', (await record()) === undefined)
    const meter = await reading()
    if (meter) await send('DELETE', `sustainability/utility-readings/${meter.id}`)
    const category = (await api('sustainability/waste-categories')).find((c) => c.name === CATEGORY)
    if (category) await send('DELETE', `sustainability/waste-categories/${category.id}`)
    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/sustainability-error.png` }).catch(() => {})
  } finally {
    // 403: the role check above asks the server on purpose
    r.finish([400, 403, 409])
    await context.close()
  }
  return r.lines
}
