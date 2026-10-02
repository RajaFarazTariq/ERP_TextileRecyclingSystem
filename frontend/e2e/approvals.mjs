// Approvals inbox and notifications: pending items from every module, a decision made through the
// module's own endpoint, the notification rules, the bell, and who may open the page.
import { BASE, SHOTS, createReport, login, logout, settle } from './helpers.mjs'

const KINDS = ['Purchase requests', 'Purchase orders', 'Quarantine', 'Production orders', 'Sales returns',
  'Decolorization batches', 'Leave requests']
const RULE = 'Leave requests waiting'
// What only an admin may be told about
const ADMIN_ONLY = /^(invoice-overdue|credit-limit|sales-return-pending|leave-pending|stock-adjustment|stock-oversold):/

export async function approvalsScenario(browser) {
  const r = createReport('approvals')
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const page = await context.newPage()
  r.watch(page)

  const get = (path) => page.request.get(`${BASE}/api/django/${path}`)
  const api = async (path) => (await get(path)).json()
  // Same-origin call from the page, as the app itself would make it
  const send = (method, path, body) => page.evaluate(async ([method, path, body]) => {
    const res = await fetch(`/api/django/${path}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    })
    return { status: res.status, text: await res.text() }
  }, [method, path, body])
  const group = async (kind) => (await api('alerts/approvals')).groups.find((g) => g.kind === kind)
  const rule = async () => (await api('alerts/rules')).find((x) => x.title === RULE)
  const row = (text) => page.locator('tbody tr', { hasText: text }).first()
  const openMenu = (rowLocator) => rowLocator.getByRole('button', { name: 'Row actions' }).click()

  try {
    // 1. The admin sees everything that is waiting, grouped by kind
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/approvals`)
    await page.getByRole('tab', { name: 'Rules' }).waitFor()
    const inbox = await api('alerts/approvals')
    r.check('the demo data has items waiting for a decision', inbox.total > 0, `total ${inbox.total}`)
    const tabs = await page.getByRole('tab').allInnerTexts()
    r.check('there is a tab for every kind of approval, and one for the rules',
      [...KINDS, 'Rules'].every((name) => tabs.some((t) => t.includes(name))), tabs.join(' | '))
    const waiting = inbox.groups.filter((g) => g.count > 0)
    r.check('each tab shows how many are waiting',
      waiting.every((g) => tabs.some((t) => t.includes(g.label) && t.replace(/\D/g, '') === String(g.count))),
      waiting.map((g) => `${g.label} ${g.count}`).join(', '))
    r.check('the summary cards show the total', await page.getByText('Waiting for a decision').isVisible()
      && await page.getByText('Oldest item').isVisible())
    await page.screenshot({ path: `${SHOTS}/approvals-1-inbox.png` })

    // 2. Approve a decolorization batch (a sign-off only: it changes nothing else)
    const batches = await group('decolorization_batch')
    const batch = batches.items[0]
    if (batch) {
      await page.getByRole('tab', { name: /Decolorization batches/ }).click()
      await page.getByPlaceholder('Search number, name, person…').fill(batch.number)
      const batchRow = row(new RegExp(`${batch.number}(?!\\d)`))
      await batchRow.getByRole('button', { name: 'Approve' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByText(`Approve ${batch.number}?`).waitFor()
      await page.screenshot({ path: `${SHOTS}/approvals-2-decision.png` })
      await dialog.getByRole('button', { name: 'Approve' }).click()
      await page.getByText('Batch approved.').waitFor()
      const left = await settle(async () => (await group('decolorization_batch')).count, batches.count - 1)
      r.check('the approved batch leaves the inbox', left === batches.count - 1, `${batches.count} -> ${left}`)
      r.check('and its row leaves the list', (await settle(() => page.locator('tbody tr', { hasText: new RegExp(`${batch.number}(?!\\d)`) }).count(), 0)) === 0)
      const session = await api(`decolorization/sessions/${batch.id}`)
      r.check('the batch is approved by the admin in its own module', session.approved_by_name === 'admin', String(session.approved_by_name))
      const again = await send('POST', `decolorization/sessions/${batch.id}/approve`)
      r.check('the module refuses a second approval', again.status === 400 && again.text.includes('already approved'), `${again.status} ${again.text.slice(0, 80)}`)
    } else {
      r.check('a decolorization batch is waiting for approval in the demo data', false, 'none left: reseed the demo data')
    }

    // 3. A decision that needs a reason says so and shows the refusal (nothing is changed)
    const quarantine = await group('quarantine')
    if (quarantine.items.length) {
      const held = quarantine.items[0]
      await page.getByRole('tab', { name: /Quarantine/ }).click()
      await page.getByPlaceholder('Search number, name, person…').fill(held.number)
      await row(held.number).getByRole('button', { name: 'Release' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: 'Release' }).click()
      r.check('releasing from quarantine needs a reason', (await dialog.getByRole('alert').innerText()).includes('why'))
      await dialog.getByRole('button', { name: 'Cancel' }).click()
      await dialog.waitFor({ state: 'detached' })
      r.check('cancelling leaves the material in quarantine', (await group('quarantine')).count === quarantine.count)
    } else {
      r.check('releasing from quarantine needs a reason', true, 'skipped: no material is in quarantine in this data')
    }

    // 4. Notification rules: switch one off and on, and look at its settings
    await page.getByRole('tab', { name: 'Rules' }).click()
    await page.getByPlaceholder('Search rule, role…').fill(RULE)
    const before = await rule()
    r.check('the rules are listed with their settings', before?.is_enabled === true && (await row(RULE).innerText()).includes('On'))
    await openMenu(row(RULE))
    await page.getByRole('menuitem', { name: 'Switch off' }).click()
    r.check('a rule can be switched off', (await settle(async () => (await rule()).is_enabled, false)) === false)
    r.check('the list shows it as off', (await settle(async () => (await row(RULE).innerText()).includes('Off'), true)) === true)
    const quiet = await api('alerts/notifications')
    r.check('a rule that is off lists nothing', !quiet.some((n) => n.rule === before.key))
    await openMenu(row(RULE))
    await page.getByRole('menuitem', { name: 'Switch on' }).click()
    r.check('and switched on again', (await settle(async () => (await rule()).is_enabled, true)) === true)
    await settle(async () => (await row(RULE).innerText()).includes('On'), true)

    await openMenu(row(RULE))
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('Escalate after days').waitFor()
    r.check('a rule about staff can only go to admins', (await dialog.innerText()).includes('Admins only'))
    await dialog.getByLabel('Escalate after days').fill('soon')
    await dialog.getByRole('button', { name: 'Update' }).click()
    r.check('escalation takes whole days', (await dialog.locator('p.text-destructive').first().innerText()).includes('whole days'))
    await page.screenshot({ path: `${SHOTS}/approvals-3-rule.png` })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await dialog.waitFor({ state: 'detached' })

    // 5. The bell lists the open notifications and can be quietened
    const notes = await api('alerts/notifications')
    r.check('the server lists notifications for the admin', notes.length > 0, `${notes.length} items`)
    const bell = page.getByRole('button', { name: /^Notifications/ })
    r.check('the bell counts the unread items', (await settle(() => bell.getAttribute('aria-label'), `Notifications (${notes.length} unread)`))
      === `Notifications (${notes.length} unread)`, await bell.getAttribute('aria-label'))
    await bell.click()
    await page.getByText('Needs attention').waitFor()
    const listed = await page.getByRole('button', { name: /^Mark as read: / }).count()
    r.check('the bell lists every item, grouped by how serious it is',
      listed === notes.length && (await page.getByRole('region', { name: /^(Escalated|Urgent|Warnings|For information)$/ }).count()) > 0,
      `${listed} of ${notes.length}`)
    await page.screenshot({ path: `${SHOTS}/approvals-4-bell.png` })
    await page.getByRole('button', { name: 'Mark all as read' }).click()
    r.check('"Mark all as read" clears the badge', (await settle(() => bell.getAttribute('aria-label'), 'Notifications')) === 'Notifications')
    r.check('read items stay listed until solved', await page.getByText(/^All read\./).isVisible()
      && (await page.getByText('Read', { exact: true }).count()) === notes.length)
    await page.keyboard.press('Escape')
    await logout(page)

    // 6. A supervisor has no Approvals page and is told only what the role may see
    await login(page, 'warehouse_user')
    const nav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('a supervisor has no Approvals menu', !nav.some((t) => t.includes('Approvals')), nav.join(','))
    r.check('nor the approvals inbox or the rules', (await get('alerts/approvals')).status() === 403 && (await get('alerts/rules')).status() === 403)
    const own = await api('alerts/notifications')
    r.check('the supervisor is not told about money or staff matters', Array.isArray(own) && !own.some((n) => ADMIN_ONLY.test(n.id)),
      own.map?.((n) => n.id).join(','))
    await page.getByRole('button', { name: /^Notifications/ }).click()
    r.check('the supervisor has a bell too', await page.getByText('Needs attention').waitFor({ timeout: 3000 }).then(() => true, () => false))
    await page.keyboard.press('Escape')
    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/approvals-error.png` }).catch(() => {})
  } finally {
    r.finish()
    await context.close()
  }
  return r.lines
}
