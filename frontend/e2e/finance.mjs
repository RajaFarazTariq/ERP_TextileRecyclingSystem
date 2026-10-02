// Finance: balanced journal entries, expenses that post themselves, statements that balance, admin only.
import { BASE, SHOTS, choose, createReport, login, logout, settle } from './helpers.mjs'

const TAG = Date.now() % 100000
const MEMO = `E2E capital ${TAG}`
const BILL = `E2E electricity ${TAG}`

export async function financeScenario(browser) {
  const r = createReport('finance')
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const page = await context.newPage()
  r.watch(page)

  const api = async (path) => (await page.request.get(`${BASE}/api/django/${path}`)).json()
  const balanceOf = async (code) => Number((await api('finance/accounts')).find((a) => a.code === code).balance)
  const row = (text) => page.locator('tbody tr', { hasText: text }).first()
  const rowAction = async (rowLocator, name) => {
    await rowLocator.getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name }).click()
  }

  try {
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/finance`)
    await page.getByText('Cash and bank').first().waitFor()
    r.check('dashboard shows cash, balances and profit', (await page.getByText('Customers owe us').count()) > 0
      && (await page.getByText('Income and expenses').count()) === 1)
    await page.screenshot({ path: `${SHOTS}/finance-1-dashboard.png` })
    const bankBefore = await balanceOf('1010')
    const cashBefore = await balanceOf('1000')

    // An entry that doesn't balance is refused before it is sent
    await page.getByRole('tab', { name: 'Journal' }).click()
    await page.getByRole('button', { name: 'New entry' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('What it is for').fill(MEMO)
    await choose(dialog, 'Account 1', /1010 /)
    await dialog.getByLabel('Debit 1', { exact: true }).fill('50000')
    await choose(dialog, 'Account 2', /3000 /)
    await dialog.getByLabel('Credit 2', { exact: true }).fill('40000')
    r.check('the form shows how far out the entry is', (await dialog.innerText()).includes('Out by Rs. 10,000'))
    await dialog.getByRole('button', { name: 'Post entry' }).click()
    const refused = await dialog.getByText('Debits and credits must be equal.', { exact: true }).waitFor({ timeout: 4000 }).then(() => true, () => false)
    r.check('an entry that does not balance is refused', refused)
    await dialog.getByLabel('Credit 2', { exact: true }).fill('50000')
    await dialog.getByRole('button', { name: 'Post entry' }).click()
    await page.getByText('Journal entry added.').waitFor()
    const bankAfter = await settle(() => balanceOf('1010'), bankBefore + 50000)
    r.check('a balanced entry is posted to its accounts', bankAfter === bankBefore + 50000, `${bankBefore} → ${bankAfter}`)

    // An expense makes its own journal entry
    await page.getByRole('tab', { name: 'Expenses' }).click()
    await page.getByRole('button', { name: 'Record expense' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Amount (Rs.)').fill('1200')
    await dialog.getByLabel('What was paid for').fill(BILL)
    await choose(dialog, 'Expense account', /Electricity/)
    await choose(dialog, 'Paid from', /Cash in hand/)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Expense added.').waitFor()
    const cashAfter = await settle(() => balanceOf('1000'), cashBefore - 1200)
    r.check('an expense comes out of the account it was paid from', cashAfter === cashBefore - 1200, `${cashBefore} → ${cashAfter}`)
    const posted = (await api('finance/journal?source=Expense')).some((e) => e.memo.includes(BILL))
    r.check('the expense has its own journal entry', posted)

    // Statements
    await page.getByRole('tab', { name: 'Statements' }).click()
    await page.getByText('Total income').waitFor()
    r.check('profit and loss shows income and expenses', (await page.getByText('Total expenses').count()) === 1)
    await page.locator('#statement').click()
    await page.getByRole('option', { name: 'Trial balance' }).click()
    await page.getByText('Debits equal credits').waitFor()
    r.check('the trial balance balances', true)
    await page.locator('#statement').click()
    await page.getByRole('option', { name: 'Balance sheet' }).click()
    await page.getByText('Assets equal liabilities plus equity').waitFor()
    r.check('the balance sheet balances', true)
    await page.screenshot({ path: `${SHOTS}/finance-2-balance-sheet.png` })

    // Reversing an entry posts its mirror image
    await page.getByRole('tab', { name: 'Journal' }).click()
    await page.getByPlaceholder('Search number, purpose…').fill(MEMO)
    await rowAction(row(MEMO), 'Reverse')
    await page.getByText('Entry reversed.').waitFor()
    const bankReversed = await settle(() => balanceOf('1010'), bankBefore)
    r.check('reversing an entry undoes its effect', bankReversed === bankBefore, `${bankReversed}`)

    // Clean up the expense; its entry goes with it
    await page.getByRole('tab', { name: 'Expenses' }).click()
    await page.getByPlaceholder('Search expense, payee, account…').fill(BILL)
    await rowAction(row(BILL), 'Delete')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await page.getByText('Expense deleted.').waitFor()
    const cashBack = await settle(() => balanceOf('1000'), cashBefore)
    r.check('deleting an expense removes its entry', cashBack === cashBefore, `${cashBack}`)

    await page.getByRole('tab', { name: 'Costing' }).click()
    await page.getByText('Cost by kind').waitFor()
    r.check('costing lists the kinds of cost', (await page.getByText('Raw material').count()) > 0)
    await page.screenshot({ path: `${SHOTS}/finance-3-costing.png` })
    await logout(page)

    // Finance is for admins only
    await login(page, 'warehouse_user')
    const nav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('a supervisor has no Finance menu', !nav.some((t) => t.includes('Finance')))
    const denied = await page.request.get(`${BASE}/api/django/finance/accounts`)
    r.check('and the finance API refuses them', denied.status() === 403, String(denied.status()))
    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/finance-error.png` }).catch(() => {})
  } finally {
    r.finish()
    await context.close()
  }
  return r.lines
}
