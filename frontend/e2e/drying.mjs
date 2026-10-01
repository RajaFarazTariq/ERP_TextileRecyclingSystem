// Drying page: full session cycle, dried output reaching sellable stock, dryer actions, admin menu.
import { BASE, SHOTS, choose, createReport, login, logout, settle } from './helpers.mjs'

export async function dryingScenario(browser) {
  const r = createReport('drying')
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const page = await context.newPage()
  r.watch(page)

  // API calls through the app's proxy, with this browser session's cookies
  const api = async (method, path, data) => {
    const res = await page.request.fetch(`${BASE}/api/django/${path}`, {
      method, data, headers: { Origin: BASE, 'Content-Type': 'application/json' },
    })
    return res.status() === 204 ? null : res.json()
  }
  const onHand = async (fabricId) => {
    const row = (await api('GET', 'inventory/movements/stock')).find((x) => x.fabric === fabricId)
    return row ? Number(row.on_hand_kg) : 0
  }

  try {
    await login(page, 'admin', 'Admin@1234')

    // Setup: finish one decolorization session so its fabric is ready for drying
    const decolor = (await api('GET', 'decolorization/sessions')).find((s) => s.status === 'In Progress')
    await api('POST', `decolorization/sessions/${decolor.id}/complete`, {
      output_quantity: String(Math.floor(Number(decolor.input_quantity) * 0.9)), waste_quantity: '0',
    })
    const fabricId = decolor.fabric
    const before = await onHand(fabricId)

    await page.goto(`${BASE}/drying`)
    await page.getByText('Dryers available').waitFor()
    r.check('dashboard shows drying figures', true)

    // New session → Pending
    await page.getByRole('tab', { name: 'Sessions' }).click()
    await page.getByRole('button', { name: 'Add session' }).click()
    const dialog = page.getByRole('dialog')
    await choose(dialog, 'Dryer', 0)
    await choose(dialog, 'Fabric (from decolorization)', new RegExp(decolor.fabric_material))
    await choose(dialog, 'Supervisor', /drying_user/)
    await dialog.getByLabel('Input quantity (kg)').fill('100')
    await dialog.getByLabel('Temperature (°C)').fill('80')
    await dialog.getByLabel('Duration (min)').fill('90')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Drying session added.').waitFor()
    const row = page.locator('tbody tr').first()
    r.check('new session is Pending', (await row.innerText()).includes('Pending'))

    // Start → In Progress
    await row.getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Start' }).click()
    await page.getByText('Drying started.').waitFor()
    r.check('start moves it to In Progress', (await settle(async () => (await row.innerText()).includes('In Progress'), true)) === true)

    // Output above input is refused; a valid completion adds to sellable stock
    await row.getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Complete' }).click()
    const complete = page.getByRole('dialog')
    r.check('complete dialog explains the stock effect', (await complete.innerText()).includes('becomes sellable stock'))
    await complete.getByLabel('Dried output (kg)').fill('150')
    await complete.getByRole('button', { name: 'Mark complete' }).click()
    await complete.locator('p.text-destructive').first().waitFor()
    r.check('output above input is refused', (await complete.locator('p.text-destructive').first().innerText()).includes('more than'))
    await complete.getByLabel('Dried output (kg)').fill('90')
    await complete.getByLabel('Waste (kg)').fill('5')
    await complete.getByRole('button', { name: 'Mark complete' }).click()
    await page.getByText(/Output added to sellable stock/).waitFor()
    const after = await onHand(fabricId)
    r.check('completing adds the dried output to sellable stock', Math.abs(after - before - 90) < 0.005, `${before} → ${after}`)
    await page.screenshot({ path: `${SHOTS}/drying-1-sessions.png` })

    // Deleting the completed session takes the output back out
    await row.getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    r.check('delete dialog warns about stock', (await page.getByRole('alertdialog').innerText()).includes('taken back out of sellable stock'))
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await page.getByText('Drying session deleted.').waitFor()
    r.check('deleting it takes the output back out', (await onHand(fabricId)) === before, `${await onHand(fabricId)} vs ${before}`)

    // Dryer actions
    await page.getByRole('tab', { name: 'Dryers' }).click()
    const dryerRow = page.locator('tbody tr').first()
    await dryerRow.getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Send to maintenance' }).click()
    await page.getByText('Dryer sent to maintenance.').waitFor()
    r.check('dryer can be sent to maintenance', (await settle(async () => (await dryerRow.innerText()).includes('Maintenance'), true)) === true)
    await dryerRow.getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Mark available' }).click()
    await page.getByText('Dryer marked available.').waitFor()
    r.check('and marked available again', (await settle(async () => (await dryerRow.innerText()).includes('Available'), true)) === true)

    // Admin sees every group; modules not moved yet are marked as the classic app
    const nav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('admin sees all modules', ['Warehouse', 'Sorting', 'Decolorization', 'Drying', 'Sales', 'Users', 'Reports'].every((m) => nav.some((t) => t.includes(m))))

    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/drying-error.png` }).catch(() => {})
  } finally {
    r.finish()
    await context.close()
  }
  return r.lines
}
