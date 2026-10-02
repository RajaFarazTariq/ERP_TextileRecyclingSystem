// Maintenance: machine -> spare part -> overdue schedule -> preventive work order, then a supervisor reports a
// breakdown, repairs it with a part and completes it; and what a supervisor may not do.
import { BASE, SHOTS, choose, createReport, login, logout, settle } from './helpers.mjs'

const TAG = Date.now() % 100000
const CODE = `E2E-${TAG}`
const MACHINE = `E2E shredder ${TAG}`
const PART = `E2E belt ${TAG}`
const TASK = `E2E grease ${TAG}`
const JOB = `E2E jammed ${TAG}`

export async function maintenanceScenario(browser) {
  const r = createReport('maintenance')
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
  const machine = async () => (await api('maintenance/machines')).find((m) => m.code === CODE)
  const part = async () => (await api('maintenance/parts')).find((p) => p.name === PART)
  const order = async (title) => (await api('maintenance/work-orders')).find((o) => o.title === title)
  const row = (text) => page.locator('tbody tr', { hasText: text }).first()
  const openMenu = (rowLocator) => rowLocator.getByRole('button', { name: 'Row actions' }).click()
  const toast = (text) => page.getByText(text, { exact: true }).first().waitFor()

  try {
    // 1. The admin registers a machine and a spare part
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/maintenance`)
    await page.getByRole('tab', { name: 'Machines' }).click()
    await page.getByRole('button', { name: 'Add machine' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Save' }).click()
    r.check('a machine needs a code', (await dialog.locator('p.text-destructive').first().innerText()).includes('code'))
    await dialog.getByLabel('Code', { exact: true }).fill(CODE)
    await dialog.getByLabel('Name', { exact: true }).fill(MACHINE)
    await dialog.getByLabel('Category', { exact: true }).fill('Shredder')
    await page.screenshot({ path: `${SHOTS}/maintenance-1-machine.png` })
    await dialog.getByRole('button', { name: 'Save' }).click()
    await toast('Machine added.')

    await page.getByRole('tab', { name: 'Spare parts' }).click()
    await page.getByRole('button', { name: 'Add spare part' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Code', { exact: true }).fill(`P-${TAG}`)
    await dialog.getByLabel('Name', { exact: true }).fill(PART)
    await dialog.getByLabel('In stock', { exact: true }).fill('5')
    await dialog.getByLabel('Reorder level', { exact: true }).fill('5')
    await dialog.getByLabel('Cost per unit (Rs.)').fill('100')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await toast('Spare part added.')
    await page.getByPlaceholder('Search code, part, location…').fill(PART)
    r.check('a part at its reorder level is flagged', (await settle(async () => (await row(PART).innerText()).includes('Low stock'), true)) === true)
    await openMenu(row(PART))
    await page.getByRole('menuitem', { name: 'Receive' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Quantity received, pcs').fill('10')
    await dialog.getByRole('button', { name: 'Receive' }).click()
    await toast('Stock received.')
    const received = await part()
    r.check('receiving adds to the stock', Number(received.stock_quantity) === 15 && received.low === false, received.stock_quantity)

    // 2. A preventive schedule that is overdue raises one work order
    const longAgo = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)
    await page.getByRole('tab', { name: 'Schedules' }).click()
    await page.getByRole('button', { name: 'New schedule' }).click()
    dialog = page.getByRole('dialog')
    await choose(dialog, 'Machine', new RegExp(CODE))
    await dialog.getByLabel('Task', { exact: true }).fill(TASK)
    await dialog.getByLabel('Last done on').fill(longAgo)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await toast('Schedule added.')
    await page.getByPlaceholder('Search task or machine…').fill(TASK)
    r.check('the schedule shows as overdue', (await settle(async () => (await row(TASK).innerText()).includes('overdue'), true)) === true)
    await page.screenshot({ path: `${SHOTS}/maintenance-2-schedules.png` })
    await openMenu(row(TASK))
    await page.getByRole('menuitem', { name: 'Create work order' }).click()
    await toast('Work order created.')
    const planned = await order(TASK)
    r.check('a preventive work order is created', planned?.kind === 'Preventive' && planned.status === 'Open')
    const schedule = (await api('maintenance/schedules')).find((s) => s.task === TASK)
    const twice = await send('POST', `maintenance/schedules/${schedule.id}/create-work-order`)
    r.check('no second work order while one is open', twice.status === 400 && twice.text.includes(planned.number), `${twice.status} ${twice.text.slice(0, 120)}`)
    await logout(page)

    // 3. A sorting supervisor reports a breakdown, but can't manage the registers
    await login(page, 'sorting_user')
    const nav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('a supervisor sees Maintenance', nav.some((t) => t.includes('Maintenance')))
    await page.goto(`${BASE}/maintenance`)
    await page.getByRole('tab', { name: 'Machines' }).click()
    await page.getByPlaceholder('Search machine, category, location…').fill(CODE)
    await row(CODE).waitFor()
    r.check('only admins add machines and plan work',
      (await page.getByRole('button', { name: 'Add machine' }).count()) === 0 && (await page.getByRole('button', { name: 'New work order' }).count()) === 0)
    await page.getByRole('button', { name: 'Report breakdown' }).click()
    dialog = page.getByRole('dialog')
    await choose(dialog, 'Machine', new RegExp(CODE))
    await dialog.getByLabel('What is wrong').fill(JOB)
    await dialog.getByRole('button', { name: 'Report' }).click()
    await toast('Work order added.')
    const reported = await order(JOB)
    r.check('the breakdown is recorded and the machine is broken down',
      reported?.is_breakdown === true && reported.reported_by_name === 'sorting_user' && (await machine()).status === 'Broken down')

    // 4. Repair: start, use a part, complete
    await page.getByRole('tab', { name: 'Work orders' }).click()
    await page.getByPlaceholder('Search work order, machine, job…').fill(JOB)
    await openMenu(row(JOB))
    const items = (await page.getByRole('menuitem').allInnerTexts()).map((t) => t.trim())
    r.check('a supervisor cannot cancel or delete a work order', !items.includes('Cancel') && !items.includes('Delete'), items.join())
    await page.getByRole('menuitem', { name: 'Start' }).click()
    await toast('Work started.')
    r.check('the work order is in progress', (await settle(async () => (await row(JOB).innerText()).includes('In progress'), true)) === true)

    await openMenu(row(JOB))
    await page.getByRole('menuitem', { name: 'Parts used' }).click()
    dialog = page.getByRole('dialog')
    await choose(dialog, 'Part', new RegExp(PART))
    await dialog.getByLabel('Quantity', { exact: true }).fill('20')
    await dialog.getByRole('button', { name: 'Add part' }).click()
    const tooMany = await dialog.locator('p.text-destructive').first().innerText()
    r.check('more parts than are in stock is refused', tooMany.includes('in stock'), tooMany)
    await dialog.getByLabel('Quantity', { exact: true }).fill('3')
    await dialog.getByRole('button', { name: 'Add part' }).click()
    await toast('Part added.')
    r.check('the part shows on the work order', (await settle(async () => (await dialog.innerText()).includes('Rs. 300'), true)) === true)
    await page.screenshot({ path: `${SHOTS}/maintenance-3-parts.png` })
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })

    await openMenu(row(JOB))
    await page.getByRole('menuitem', { name: 'Complete' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Complete' }).click()
    r.check('completing needs the work done', (await dialog.locator('p.text-destructive').first().innerText()).includes('Describe'))
    await dialog.getByLabel('Work done').fill('Cleared the jam and fitted new belts')
    await dialog.getByLabel('Downtime, minutes').fill('90')
    await dialog.getByLabel('Labour hours').fill('1.5')
    await dialog.getByLabel('Labour cost (Rs.)').fill('500')
    await page.screenshot({ path: `${SHOTS}/maintenance-4-complete.png` })
    await dialog.getByRole('button', { name: 'Complete' }).click()
    await toast('Work order completed.')
    const done = await order(JOB)
    r.check('the cost is labour plus parts', done.status === 'Done' && done.total_cost === '800.00' && done.downtime_minutes === 90, done.total_cost)
    r.check('the machine runs again and the part left the stock',
      (await machine()).status === 'Running' && Number((await part()).stock_quantity) === 12)

    // 5. Doing the preventive job moves its schedule forward
    const finished = await send('POST', `maintenance/work-orders/${planned.id}/complete`, { work_done: 'Greased' })
    const after = (await api('maintenance/schedules')).find((s) => s.task === TASK)
    r.check('a completed preventive job is no longer overdue', finished.status === 200 && after.overdue === false && after.days_until_due === 30,
      `${finished.status} ${after.next_due_on}`)

    // 6. The performance report counts the breakdown
    await page.getByRole('tab', { name: 'Performance' }).click()
    await page.getByPlaceholder('Search machines…').fill(CODE)
    r.check('performance shows the downtime of the machine', (await settle(async () => (await row(CODE).innerText()).includes('1.5 h'), true)) === true)
    await page.screenshot({ path: `${SHOTS}/maintenance-5-performance.png` })
    await page.getByRole('tab', { name: 'Dashboard' }).click()
    await page.getByText('Machines by status').waitFor()
    await page.screenshot({ path: `${SHOTS}/maintenance-6-dashboard.png` })
    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/maintenance-error.png` }).catch(() => {})
  } finally {
    r.finish()
    await context.close()
  }
  return r.lines
}
