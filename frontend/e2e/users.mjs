// Users page: create with validation, deactivate/activate (checked by signing in), own-account protection.
import { BASE, SHOTS, choose, createReport, login, logout, settle } from './helpers.mjs'

const NAME = `e2e_user_${Date.now() % 100000}`
const PASSWORD = 'Strong-Pass-2026'

export async function usersScenario(browser) {
  const r = createReport('users')
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const page = await context.newPage()
  r.watch(page)

  const row = (text) => page.locator('tbody tr', { hasText: text }).first()
  const menuItems = async (text) => {
    await row(text).getByRole('button', { name: 'Row actions' }).click()
    const items = await page.getByRole('menuitem').allInnerTexts()
    await page.keyboard.press('Escape')
    return items.map((t) => t.trim())
  }
  /** Sign in as the test user in a separate browser; returns the error shown, or '' on success. */
  const trySignIn = async () => {
    const other = await browser.newContext()
    const p = await other.newPage()
    await p.goto(`${BASE}/login`)
    await p.getByLabel('Username or email').fill(NAME)
    await p.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await p.getByRole('button', { name: 'Sign in' }).click()
    const outcome = await Promise.race([
      p.waitForURL((u) => !u.pathname.startsWith('/login')).then(() => ''),
      p.locator('form p[role="alert"]').waitFor().then(() => p.locator('form p[role="alert"]').innerText()),
    ])
    const nav = outcome ? [] : await p.locator('[data-sidebar="menu-button"]').allInnerTexts()
    await other.close()
    return { error: outcome, nav }
  }

  try {
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/users`)
    await page.getByText('Drying Supervisor').first().waitFor()
    r.check('role counts are shown', (await page.getByText('Warehouse Supervisor').count()) > 0)

    // Own account: only Edit
    const own = await menuItems('(you)')
    r.check('own account can only be edited', own.length === 1 && own[0] === 'Edit', own.join(','))

    // Create: missing password, then a weak one, then a good one
    await page.getByRole('button', { name: 'Add user' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('Username').fill(NAME)
    await dialog.getByLabel('Email').fill(`${NAME}@example.com`)
    await choose(dialog, 'Role', 'Sorting Supervisor')
    await dialog.getByRole('button', { name: 'Create user' }).click()
    r.check('a new user needs a password', (await dialog.innerText()).includes('Set a password'))
    await dialog.getByLabel('Password').fill('password')
    await dialog.getByRole('button', { name: 'Create user' }).click()
    const weak = dialog.locator('p.text-destructive').first()
    await weak.waitFor()
    r.check('a weak password is refused by the server', /too common|too short/i.test(await weak.innerText()), await weak.innerText())
    await dialog.getByLabel('Password').fill(PASSWORD)
    await dialog.getByRole('button', { name: 'Create user' }).click()
    await page.getByText('User created.').waitFor()
    await page.getByPlaceholder('Search username, email, role…').fill(NAME)
    r.check('new user is listed as active', (await row(NAME).innerText()).includes('Active'))

    // Deactivate → can't sign in
    await row(NAME).getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Deactivate' }).click()
    await page.getByText(`${NAME} deactivated.`).waitFor()
    r.check('deactivated user shows Inactive', (await settle(async () => (await row(NAME).innerText()).includes('Inactive'), true)) === true)
    const blocked = await trySignIn()
    r.check('a deactivated user cannot sign in', blocked.error.includes('inactive'), blocked.error)

    // Activate → signs in and sees their module only
    await row(NAME).getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Activate' }).click()
    await page.getByText(`${NAME} activated.`).waitFor()
    const allowed = await trySignIn()
    r.check('an active user signs in and sees their module', allowed.error === '' && allowed.nav.some((t) => t.includes('Sorting')) && !allowed.nav.some((t) => t.includes('Users')),
      allowed.error || allowed.nav.join(','))
    await page.screenshot({ path: `${SHOTS}/users-1-list.png` })

    // Clean up
    await row(NAME).getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await page.getByText('User deleted.').waitFor()
    r.check('test user deleted', true)

    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/users-error.png` }).catch(() => {})
  } finally {
    r.finish()
    await context.close()
  }
  return r.lines
}
