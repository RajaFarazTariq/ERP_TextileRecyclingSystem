// Access management: an admin gives and takes pages for a role and for one person, and the
// change reaches the other user's menu, typed addresses and API calls. Leaves access as it found it.
import { BASE, SHOTS, createReport, login, logout } from './helpers.mjs'

export async function accessScenario(browser) {
  const r = createReport('access')
  const adminContext = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const userContext = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const admin = await adminContext.newPage()
  const user = await userContext.newPage()
  r.watch(admin)

  const matrix = async () => (await (await admin.request.get(`${BASE}/api/django/access/matrix`)).json())
  const menu = async (page) => (await page.locator('[data-sidebar="menu-button"]').allInnerTexts()).map((t) => t.trim())
  const cell = (label) => admin.getByRole('checkbox', { name: label, exact: true })
  const saveRoles = async () => {
    await admin.getByRole('button', { name: 'Save changes' }).click()
    await admin.getByText('Page access saved.', { exact: false }).first().waitFor()
  }
  /** Where the user ends up after typing an address. */
  const visit = async (page, path) => {
    await page.goto(`${BASE}${path}`)
    await page.waitForLoadState('domcontentloaded')
    return new URL(page.url()).pathname
  }
  let original = null

  try {
    await login(admin, 'admin', 'Admin@1234')
    original = (await matrix()).matrix
    await admin.goto(`${BASE}/users`)
    await admin.getByRole('tab', { name: 'Access' }).click()
    await admin.getByText('Pages by role').waitFor()
    r.check('the grid lists every page for every role', (await admin.getByRole('checkbox').count()) === 18 * 5,
      String(await admin.getByRole('checkbox').count()))
    r.check('admins always have every page', await cell('Admin: Finance').isDisabled() && (await cell('Admin: Finance').getAttribute('data-state')) === 'checked')
    r.check('the Users page cannot be given away', await cell('Sorting Supervisor: Users').isDisabled()
      && (await cell('Sorting Supervisor: Users').getAttribute('data-state')) === 'unchecked')
    await admin.screenshot({ path: `${SHOTS}/access-1-roles.png` })

    // A supervisor starts without Finance
    await login(user, 'sorting_user')
    r.check('a sorting supervisor has no Finance page to start with', !(await menu(user)).includes('Finance'))
    r.check('typing its address sends them home', (await visit(user, '/finance')) === '/')
    r.check('and the finance API refuses them', (await user.request.get(`${BASE}/api/django/finance/accounts`)).status() === 403)

    // Give the role Finance
    await cell('Sorting Supervisor: Finance').click()
    r.check('unsaved changes are pointed out', (await admin.getByText('You have unsaved changes.').count()) === 1)
    await saveRoles()
    r.check('the page appears in their menu', (await visit(user, '/')) === '/' && (await menu(user)).includes('Finance'))
    r.check('they can open it', (await visit(user, '/finance')) === '/finance')
    await user.getByText('Cash and bank').first().waitFor()
    r.check('and it shows data', (await user.request.get(`${BASE}/api/django/finance/accounts`)).status() === 200)

    // Take it away again: the open tab, a typed address and the API all follow
    await cell('Sorting Supervisor: Finance').click()
    await saveRoles()
    r.check('after removal a typed address sends them home', (await visit(user, '/finance')) === '/')
    r.check('the menu no longer shows it', !(await menu(user)).includes('Finance'))
    r.check('and the API refuses them again', (await user.request.get(`${BASE}/api/django/finance/accounts`)).status() === 403)

    // One person: give Sales, take Quality away
    await admin.getByLabel('User', { exact: true }).click()
    await admin.getByRole('option', { name: /Sorting User/ }).click()
    await admin.getByLabel('Access to Sales').click()
    await admin.getByRole('option', { name: 'Give access' }).click()
    await admin.getByLabel('Access to Quality').click()
    await admin.getByRole('option', { name: 'Take away' }).click()
    await admin.getByRole('button', { name: 'Save exceptions' }).click()
    await admin.getByText('Access of Sorting User saved.').waitFor()
    await admin.screenshot({ path: `${SHOTS}/access-2-person.png` })
    const personal = await menu(await (async () => { await visit(user, '/'); return user })())
    r.check('a person can be given a page their role lacks', personal.includes('Sales') && (await visit(user, '/sales')) === '/sales')
    r.check('and lose one their role has', !personal.includes('Quality') && (await visit(user, '/quality')) === '/')
    r.check('the API follows the exception', (await user.request.get(`${BASE}/api/django/quality/inspections`)).status() === 403
      && (await user.request.get(`${BASE}/api/django/sales/orders`)).status() === 200)
    const colleague = (await matrix()).matrix.sorting_supervisor
    r.check('the role itself is unchanged', !colleague.includes('sales') && colleague.includes('quality'))

    // Back to the role
    await admin.getByRole('button', { name: 'Same as role' }).click()
    await admin.getByRole('button', { name: 'Save exceptions' }).click()
    await admin.getByText('Access of Sorting User saved.').waitFor()
    await visit(user, '/')
    const restored = await menu(user)
    r.check('clearing the exceptions returns them to the role', !restored.includes('Sales') && restored.includes('Quality'))

    const after = (await matrix()).matrix
    r.check('access is left as it was found', JSON.stringify(after) === JSON.stringify(original))
    r.check('the changes are in the audit log',
      (await (await admin.request.get(`${BASE}/api/django/audit/logs?page_size=20`)).text()).includes('Page access of Sorting Supervisor'))

    // Only admins manage access
    r.check('a supervisor cannot read or change access', (await user.request.get(`${BASE}/api/django/access/matrix`)).status() === 403
      && (await visit(user, '/users')) === '/')
    await logout(user)
    await logout(admin)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await admin.screenshot({ path: `${SHOTS}/access-error.png` }).catch(() => {})
    // Never leave a supervisor with pages they did not have
    if (original) {
      await admin.evaluate(async (roles) => {
        await fetch('/api/django/access/matrix', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roles }) })
      }, original).catch(() => {})
    }
  } finally {
    r.finish()
    await adminContext.close()
    await userContext.close()
  }
  return r.lines
}
