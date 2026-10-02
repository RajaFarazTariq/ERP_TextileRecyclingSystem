// Access management: an admin sets pages to no access, view only or full for a role and for one person, hands out a
// duty and adds a role, and each change reaches the other user's menu, typed addresses and API calls. Leaves access
// as it found it.
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
  /** Set one cell of the grid, e.g. level('Sorting Supervisor: Finance', 'View only'). */
  const level = async (label, choice) => {
    await admin.getByRole('combobox', { name: label, exact: true }).click()
    await admin.getByRole('option', { name: choice, exact: true }).click()
  }
  const post = (page, path, body) => page.evaluate(async ([path, body]) => {
    const res = await fetch(`/api/django/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return res.status
  }, [path, body])
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
    const cells = await admin.getByRole('combobox', { name: /Supervisor: / }).count()
    r.check('the grid has a level for every page and role', cells === 17 * 4, String(cells))
    r.check('admins always have every page in full', (await admin.locator('td[data-level="full"]').count()) === 18)
    r.check('the Users page cannot be given away', (await admin.locator('td[data-level="none"]').count()) === 4
      && (await admin.getByRole('combobox', { name: 'Sorting Supervisor: Users' }).count()) === 0)
    await admin.screenshot({ path: `${SHOTS}/access-1-roles.png` })

    // A supervisor starts without Finance
    await login(user, 'sorting_user')
    r.check('a sorting supervisor has no Finance page to start with', !(await menu(user)).includes('Finance'))
    r.check('typing its address sends them home', (await visit(user, '/finance')) === '/')
    r.check('and the finance API refuses them', (await user.request.get(`${BASE}/api/django/finance/accounts`)).status() === 403)

    // Give the role Finance
    await level('Sorting Supervisor: Finance', 'Full')
    r.check('unsaved changes are pointed out', (await admin.getByText('You have unsaved changes.').count()) === 1)
    await saveRoles()
    r.check('the page appears in their menu', (await visit(user, '/')) === '/' && (await menu(user)).includes('Finance'))
    r.check('they can open it', (await visit(user, '/finance')) === '/finance')
    await user.getByText('Cash and bank').first().waitFor()
    r.check('and use it', (await user.getByRole('button', { name: 'Record expense' }).count()) === 1
      && (await user.request.get(`${BASE}/api/django/finance/accounts`)).status() === 200)

    // Cut it to view only: they still see everything, but the page offers no changes and the API takes none
    await level('Sorting Supervisor: Finance', 'View only')
    await saveRoles()
    r.check('view only still opens the page', (await visit(user, '/finance')) === '/finance')
    await user.getByText('Cash and bank').first().waitFor()
    r.check('the page says it is view only and hides its add button',
      (await user.getByText('View only', { exact: true }).count()) === 1 && (await user.getByRole('button', { name: 'Record expense' }).count()) === 0)
    await user.getByRole('tab', { name: 'Expenses' }).click()
    await user.getByPlaceholder('Search expense, payee, account…').waitFor()
    r.check('rows offer nothing to edit or delete', (await user.getByRole('button', { name: 'Row actions' }).count()) === 0)
    r.check('reading still works', (await user.request.get(`${BASE}/api/django/finance/expenses`)).status() === 200)
    r.check('and the API refuses a change', (await post(user, 'finance/tax-rates', { name: 'E2E', rate: '1' })) === 403)
    await admin.screenshot({ path: `${SHOTS}/access-3-view-only.png` })
    await user.screenshot({ path: `${SHOTS}/access-4-view-only-page.png` })

    // Take it away again: the open tab, a typed address and the API all follow
    await level('Sorting Supervisor: Finance', 'No access')
    await saveRoles()
    r.check('after removal a typed address sends them home', (await visit(user, '/finance')) === '/')
    r.check('the menu no longer shows it', !(await menu(user)).includes('Finance'))
    r.check('and the API refuses them again', (await user.request.get(`${BASE}/api/django/finance/accounts`)).status() === 403)

    // One person: give Sales, take Quality away
    await admin.getByLabel('User', { exact: true }).click()
    await admin.getByRole('option', { name: /Sorting User/ }).click()
    await admin.getByLabel('Access to Sales').click()
    await admin.getByRole('option', { name: 'Full', exact: true }).click()
    await admin.getByLabel('Access to Quality').click()
    await admin.getByRole('option', { name: 'No access', exact: true }).click()
    await admin.getByRole('button', { name: 'Save exceptions' }).click()
    await admin.getByText('Access of Sorting User saved.').waitFor()
    await admin.screenshot({ path: `${SHOTS}/access-2-person.png` })
    const personal = await menu(await (async () => { await visit(user, '/'); return user })())
    r.check('a person can be given a page their role lacks', personal.includes('Sales') && (await visit(user, '/sales')) === '/sales')
    r.check('and lose one their role has', !personal.includes('Quality') && (await visit(user, '/quality')) === '/')
    r.check('the API follows the exception', (await user.request.get(`${BASE}/api/django/quality/inspections`)).status() === 403
      && (await user.request.get(`${BASE}/api/django/sales/orders`)).status() === 200)
    const colleague = (await matrix()).matrix.sorting_supervisor
    r.check('the role itself is unchanged', !('sales' in colleague) && colleague.quality === 'full')

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

    // Duties: planning production is the admin's to start with; give it to the sorting supervisors
    const planning = admin.getByRole('checkbox', { name: 'Sorting Supervisor: Plan production', exact: true })
    r.check('admins carry every duty, locked', await admin.getByRole('checkbox', { name: 'Admin: Plan production', exact: true }).isDisabled())
    r.check('a supervisor does not plan production to start with', !(await planning.isChecked()))
    r.check('so the Production page offers them no new order', (await visit(user, '/production')) === '/production'
      && (await user.getByText('Production').first().waitFor().then(() => user.getByRole('button', { name: 'New order' }).count())) === 0
      && (await post(user, 'production/stages', {})) === 403)
    await planning.click()
    await admin.getByRole('button', { name: 'Save duties' }).click()
    await admin.getByText('Duties saved.', { exact: false }).first().waitFor()
    await admin.screenshot({ path: `${SHOTS}/access-5-duties.png` })
    await visit(user, '/production')
    await user.getByRole('button', { name: 'New order' }).waitFor()
    r.check('with the duty they can plan', (await post(user, 'production/stages', {})) === 400)
    await planning.click()
    await admin.getByRole('button', { name: 'Save duties' }).click()
    await admin.getByText('Duties saved.', { exact: false }).first().waitFor()
    r.check('and without it they are refused again', (await post(user, 'production/stages', {})) === 403)

    // A role of the organisation's own, copied from an existing one
    await admin.getByRole('button', { name: 'Add role' }).click()
    await admin.getByLabel('Name', { exact: true }).fill('E2E Clerk')
    await admin.getByLabel('Start with the pages and duties of').click()
    await admin.getByRole('option', { name: 'Warehouse Supervisor', exact: true }).click()
    await admin.getByRole('listbox').waitFor({ state: 'detached' })
    await admin.getByRole('dialog').getByRole('button', { name: 'Add role' }).click()
    await admin.getByText('Role added', { exact: false }).first().waitFor()
    const clerk = admin.locator('li[data-role="e2e_clerk"]')
    await clerk.waitFor()
    await admin.getByRole('combobox', { name: 'E2E Clerk: Warehouse', exact: true }).waitFor()
    r.check('a new role gets its own column, with the copied pages',
      (await admin.getByRole('combobox', { name: 'E2E Clerk: Warehouse', exact: true }).getAttribute('data-level')) === 'full'
      && (await admin.getByRole('combobox', { name: 'E2E Clerk: Sales', exact: true }).getAttribute('data-level')) === 'none')
    r.check('and the copied duties', await admin.getByRole('checkbox', { name: 'E2E Clerk: Inspect incoming material', exact: true }).isChecked())
    await admin.screenshot({ path: `${SHOTS}/access-6-roles.png`, fullPage: true })
    await admin.getByRole('tab', { name: 'Users', exact: true }).click()
    await admin.getByRole('button', { name: 'Add user' }).click()
    await admin.getByLabel('Role', { exact: true }).click()
    r.check('the new role can be given to a user', (await admin.getByRole('option', { name: 'E2E Clerk', exact: true }).count()) === 1)
    await admin.keyboard.press('Escape')
    await admin.getByRole('listbox').waitFor({ state: 'detached' })
    await admin.keyboard.press('Escape')
    await admin.getByRole('tab', { name: 'Access' }).click()
    await clerk.getByRole('button', { name: 'Row actions' }).click()
    await admin.getByRole('menuitem', { name: 'Delete' }).click()
    await admin.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await admin.getByText('Role deleted.').waitFor()
    await clerk.waitFor({ state: 'detached' })
    r.check('a role nobody has can be deleted', !('e2e_clerk' in (await matrix()).matrix))
    r.check('built-in roles offer no rename or delete', (await admin.locator('li[data-role="sorting_supervisor"]').getByRole('button', { name: 'Row actions' }).count()) === 0)

    // Only admins manage access
    r.check('a supervisor cannot read or change access', (await user.request.get(`${BASE}/api/django/access/matrix`)).status() === 403
      && (await user.request.get(`${BASE}/api/django/access/roles`)).status() === 403
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
