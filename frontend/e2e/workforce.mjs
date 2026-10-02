// Workforce: setup -> employee -> approved leave -> attendance sheet -> task -> productivity,
// and that only admins see any of it.
import { BASE, SHOTS, choose, createReport, login, logout, settle } from './helpers.mjs'

const TAG = Date.now() % 100000
const DEPARTMENT = `E2E Dept ${TAG}`
const ROLE = `E2E Operator ${TAG}`
const SHIFT = `E2E Night ${TAG}`
const ON_LEAVE = `E2E Leave ${TAG}`
const WORKER = `E2E Worker ${TAG}`
const TASK = `E2E task ${TAG}`

export async function workforceScenario(browser) {
  const r = createReport('workforce')
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
  const row = (text) => page.locator('tbody tr', { hasText: text }).first()
  const openMenu = (rowLocator) => rowLocator.getByRole('button', { name: 'Row actions' }).click()
  const body = page.locator('body')

  try {
    // 1. Setup: a department, a job role and a night shift
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/workforce`)
    await page.getByRole('tab', { name: 'Setup' }).click()
    await page.getByRole('button', { name: 'New department' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name', { exact: true }).fill(DEPARTMENT)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Department added.').waitFor()

    await page.getByRole('button', { name: 'New job role' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Title', { exact: true }).fill(ROLE)
    await choose(dialog, 'Department', DEPARTMENT)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Job role added.').waitFor()

    await page.getByRole('button', { name: 'New shift' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name', { exact: true }).fill(SHIFT)
    await dialog.getByLabel('Starts', { exact: true }).fill('22:00')
    await dialog.getByLabel('Ends', { exact: true }).fill('06:00')
    r.check('a shift may end on the next day', (await settle(async () => (await dialog.innerText()).includes('8 hours, ends the next day'), true)) === true)
    await page.screenshot({ path: `${SHOTS}/workforce-1-shift.png` })
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Shift added.').waitFor()
    const shift = (await api('workforce/shifts')).find((s) => s.name === SHIFT)
    r.check('the shift is 8 hours long', shift?.hours === '8.00', shift?.hours)

    // 2. An employee, added through the form; the code comes from the server
    await page.getByRole('tab', { name: 'Employees' }).click()
    await page.getByRole('button', { name: 'Add employee' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Save' }).click()
    const noName = await dialog.locator('p.text-destructive').first().innerText()
    r.check('an employee needs a name, department and job role', noName.includes('full name'), noName)
    await dialog.getByLabel('Full name', { exact: true }).fill(ON_LEAVE)
    await choose(dialog, 'Department', DEPARTMENT)
    await choose(dialog, 'Job role', ROLE)
    await choose(dialog, 'Usual shift', new RegExp(SHIFT))
    await dialog.getByLabel('Phone', { exact: true }).fill('0300-0000000')
    await page.screenshot({ path: `${SHOTS}/workforce-2-employee.png` })
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Employee added.').waitFor()
    const onLeave = (await api('workforce/employees')).find((e) => e.full_name === ON_LEAVE)
    r.check('the employee code is given by the server', /^EMP-\d{5}$/.test(onLeave?.number ?? ''), onLeave?.number)

    // A second employee on the same shift
    const made = await send('POST', 'workforce/employees', {
      full_name: WORKER, department: onLeave.department, job_role: onLeave.job_role, shift: shift.id, joined_on: onLeave.joined_on,
    })
    const worker = JSON.parse(made.text)

    // 3. Leave for today: requested, approved, and no second request on the same days
    await page.getByRole('tab', { name: 'Leave' }).click()
    await page.getByRole('button', { name: 'New leave request' }).click()
    dialog = page.getByRole('dialog')
    await choose(dialog, 'Employee', new RegExp(ON_LEAVE))
    await dialog.getByLabel('Reason', { exact: true }).fill('Family event')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Leave request added.').waitFor()
    await page.getByPlaceholder('Search employee, type, reason…').fill(ON_LEAVE)
    await openMenu(row(ON_LEAVE))
    await page.getByRole('menuitem', { name: 'Approve' }).click()
    await page.getByText('Leave approved.').waitFor()
    const leave = (await api('workforce/leave')).find((l) => l.employee === onLeave.id)
    r.check('the leave is approved by the admin', leave?.status === 'Approved' && leave.decided_by_name === 'admin' && leave.days === 1,
      `${leave?.status} ${leave?.days}`)
    await page.screenshot({ path: `${SHOTS}/workforce-3-leave.png` })

    await page.getByRole('button', { name: 'New leave request' }).click()
    dialog = page.getByRole('dialog')
    await choose(dialog, 'Employee', new RegExp(ON_LEAVE))
    await dialog.getByRole('button', { name: 'Save' }).click()
    const overlap = await dialog.locator('p.text-destructive').first().innerText()
    r.check('leave cannot overlap approved leave', overlap.includes('already has approved leave'), overlap)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await dialog.waitFor({ state: 'detached' })

    // 4. The attendance sheet for this shift: leave is suggested, times start from the shift
    await page.getByRole('tab', { name: 'Attendance' }).click()
    await choose(body, 'Shift', new RegExp(SHIFT))
    await page.getByLabel('Search employee', { exact: true }).fill(String(TAG))
    const leaveStatus = page.getByLabel(`Status of ${ON_LEAVE}`, { exact: true })
    await leaveStatus.waitFor()
    r.check('approved leave is suggested on the sheet', (await leaveStatus.innerText()).includes('Leave'), await leaveStatus.innerText())
    const checkIn = page.getByLabel(`Check-in of ${WORKER}`, { exact: true })
    r.check('times start from the shift hours', (await checkIn.inputValue()) === '22:00', await checkIn.inputValue())
    await choose(body, `Status of ${WORKER}`, 'Late')
    await checkIn.fill('22:30')
    await page.screenshot({ path: `${SHOTS}/workforce-4-sheet.png` })
    await page.getByRole('button', { name: 'Save attendance' }).click()
    await page.getByText(/Attendance saved for/).waitFor()
    const today = (await api('workforce/attendance?date_filter=today'))
    const late = today.find((a) => a.employee === worker.id)
    const away = today.find((a) => a.employee === onLeave.id)
    r.check('hours cross midnight', late?.status === 'Late' && late.hours_worked === '7.50' && late.shift === shift.id,
      `${late?.status} ${late?.hours_worked}`)
    r.check('the employee on leave is saved as Leave with no hours', away?.status === 'Leave' && away.hours_worked === '0.00', away?.status)

    // Saving the sheet again updates the same records
    await page.getByLabel(`Check-out of ${WORKER}`, { exact: true }).fill('07:00')
    await page.getByRole('button', { name: 'Save attendance' }).click()
    await page.getByText(/Attendance saved for/).last().waitFor()
    const again = (await api('workforce/attendance?date_filter=today')).filter((a) => a.employee === worker.id)
    r.check('one record per employee per day', (await settle(async () =>
      (await api('workforce/attendance?date_filter=today')).find((a) => a.employee === worker.id)?.hours_worked, '8.50')) === '8.50' && again.length === 1,
    `${again.length} record(s)`)

    // 5. A task with output, finished
    await page.getByRole('tab', { name: 'Tasks' }).click()
    await page.getByRole('button', { name: 'Assign task' }).click()
    dialog = page.getByRole('dialog')
    await choose(dialog, 'Employee', new RegExp(WORKER))
    await dialog.getByLabel('Task', { exact: true }).fill(TASK)
    await choose(dialog, 'Area', 'Sorting')
    await dialog.getByLabel('Reference', { exact: true }).fill('Sorting session #12')
    await dialog.getByLabel('Hours spent', { exact: true }).fill('4')
    await dialog.getByLabel('Output (kg)').fill('200')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Task added.').waitFor()
    await page.getByPlaceholder('Search task, employee, area…').fill(TASK)
    await openMenu(row(TASK))
    await page.getByRole('menuitem', { name: 'Mark as done' }).click()
    await page.getByText('Task updated.').waitFor()
    r.check('the task is done', (await settle(async () => (await row(TASK).innerText()).includes('Done'), true)) === true)

    // 6. Productivity for today
    await page.getByRole('tab', { name: 'Productivity' }).click()
    await choose(body, 'Period', 'Today')
    await page.getByPlaceholder('Search employee, department…').fill(WORKER)
    await row(WORKER).waitFor()
    const report = await api('workforce/productivity?date_filter=today')
    const figures = report.employees.find((e) => e.employee === worker.id)
    r.check('productivity counts the late day, the task and kg per hour',
      figures?.late_days === 1 && figures.tasks_done === 1 && figures.output_kg === '200.00' && figures.kg_per_hour === '50.00',
      JSON.stringify(figures))
    await page.screenshot({ path: `${SHOTS}/workforce-5-productivity.png` })

    await page.getByRole('tab', { name: 'Dashboard' }).click()
    await page.getByText('Active employees').waitFor()
    await page.screenshot({ path: `${SHOTS}/workforce-6-dashboard.png` })
    await logout(page)

    // 7. Employee data is for admins only
    await login(page, 'warehouse_user')
    const nav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('a supervisor does not see Workforce', !nav.some((t) => t.includes('Workforce')), nav.join())
    const denied = await send('GET', 'workforce/employees')
    r.check('and cannot read employees through the API', denied.status === 403, String(denied.status))
    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/workforce-error.png` }).catch(() => {})
  } finally {
    r.finish([400, 403, 409])
    await context.close()
  }
  return r.lines
}
