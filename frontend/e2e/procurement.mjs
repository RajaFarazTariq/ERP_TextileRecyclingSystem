// Purchasing: request -> approval -> order -> approval -> delivery against the order -> invoice -> payment,
// amendments, and who may approve.
import { BASE, SHOTS, choose, createReport, login, logout, settle } from './helpers.mjs'

const TAG = Date.now() % 100000
const MATERIAL = `E2E Cotton ${TAG}`
const SUPPLIER = 'Ali Traders'

export async function procurementScenario(browser) {
  const r = createReport('procurement')
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const page = await context.newPage()
  r.watch(page)

  const api = async (path) => (await page.request.get(`${BASE}/api/django/${path}`)).json()
  const request = async () => (await api('procurement/requisitions')).find((x) => x.lines.some((l) => l.material === MATERIAL))
  const order = async () => (await api('procurement/orders')).find((x) => x.lines.some((l) => l.material === MATERIAL))
  const row = (text) => page.locator('tbody tr', { hasText: text }).first()
  const menuItems = async (rowLocator) => {
    await rowLocator.getByRole('button', { name: 'Row actions' }).click()
    const items = (await page.getByRole('menuitem').allInnerTexts()).map((t) => t.trim())
    await page.keyboard.press('Escape')
    return items
  }
  const rowAction = async (rowLocator, name) => {
    await rowLocator.getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name }).click()
  }

  try {
    // 1. A warehouse supervisor asks for material
    await login(page, 'warehouse_user')
    const nav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('warehouse supervisor sees Purchasing', nav.some((t) => t.includes('Purchasing')))
    await page.goto(`${BASE}/procurement`)
    await page.getByRole('tab', { name: 'Requests' }).click()
    await page.getByRole('button', { name: 'New request' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('Material 1', { exact: true }).fill(MATERIAL)
    await dialog.getByLabel('Quantity 1 (kg)', { exact: true }).fill('500')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Purchase request added.').waitFor()
    let req = await request()
    r.check('request is saved as a draft by the requester', req?.status === 'Draft' && req.requested_by_name === 'warehouse_user', `${req?.status} ${req?.requested_by_name}`)

    await page.getByPlaceholder('Search request, material, person…').fill(req.number)
    await rowAction(row(req.number), 'Submit for approval')
    await page.getByText('Request sent for approval.').waitFor()
    r.check('a supervisor cannot approve', !(await menuItems(row(req.number))).includes('Approve'))
    await logout(page)

    // 2. The admin approves it and orders from a supplier
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/procurement`)
    await page.getByText('Waiting for approval').first().waitFor()
    await page.screenshot({ path: `${SHOTS}/procurement-1-dashboard.png` })
    await page.getByRole('tab', { name: 'Requests' }).click()
    await page.getByPlaceholder('Search request, material, person…').fill(req.number)
    await rowAction(row(req.number), 'Approve')
    await page.getByText('Request approved.').waitFor()
    await rowAction(row(req.number), 'Create order')
    dialog = page.getByRole('dialog')
    await choose(dialog, 'Supplier', SUPPLIER)
    r.check('order starts from the request lines', (await dialog.getByLabel('Material 1', { exact: true }).inputValue()) === MATERIAL)
    await dialog.getByLabel('Price per kg 1 (Rs.)', { exact: true }).fill('45')
    r.check('order form shows the total', (await dialog.innerText()).includes('Rs. 22,500'))
    await page.screenshot({ path: `${SHOTS}/procurement-2-order-form.png` })
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Purchase order added.').waitFor()
    let po = await order()
    r.check('order is a draft linked to the request', po?.status === 'Draft' && po.requisition_number === req.number)

    // 3. Submit, then approve from the dashboard
    await page.getByRole('tab', { name: 'Orders' }).click()
    await page.getByPlaceholder('Search order, supplier…').fill(po.number)
    await rowAction(row(po.number), 'Submit for approval')
    await page.getByText('Order sent for approval.').waitFor()
    await page.getByRole('tab', { name: 'Dashboard' }).click()
    const card = page.locator('div.rounded-lg.border', { hasText: po.number }).first()
    await card.getByRole('button', { name: 'Approve' }).click()
    await page.getByText('Order approved.').waitFor()
    po = await order()
    req = await request()
    r.check('approved order marks the request as ordered', po.status === 'Approved' && req.status === 'Ordered', `${po.status} / ${req.status}`)

    // 4. The delivery is booked against the order in the warehouse
    await page.goto(`${BASE}/warehouse`)
    await page.getByRole('button', { name: 'Add stock' }).click()
    dialog = page.getByRole('dialog')
    await choose(dialog, 'Vendor', SUPPLIER)
    await choose(dialog, 'Purchase order', new RegExp(po.number))
    r.check('choosing the order fills in the material', (await dialog.getByLabel('Fabric type').inputValue()) === MATERIAL)
    await dialog.getByLabel('Vendor weight slip').fill(`SLIP-${TAG}`)
    await dialog.getByLabel('Vehicle no.').fill(`LHR-${TAG}`)
    await dialog.getByLabel('Our weight (kg)').fill('200')
    await dialog.getByLabel('Unloading weight (kg)').fill('198')
    await choose(dialog, 'Factory unit', 0)
    await page.screenshot({ path: `${SHOTS}/procurement-3-delivery.png` })
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Stock entry added.').waitFor()
    const partly = await settle(async () => (await order()).status, 'Partially Received')
    r.check('a delivery moves the order to partly received', partly === 'Partially Received', partly)

    // 5. Amending an approved order needs approval again
    await page.goto(`${BASE}/procurement`)
    await page.getByRole('tab', { name: 'Orders' }).click()
    await page.getByPlaceholder('Search order, supplier…').fill(po.number)
    await rowAction(row(po.number), 'Edit')
    dialog = page.getByRole('dialog')
    r.check('edit form warns about the amendment', (await dialog.innerText()).includes('amendment'))
    await dialog.getByLabel('Quantity 1 (kg)', { exact: true }).fill('600')
    await dialog.getByRole('button', { name: 'Update' }).click()
    await page.getByText('Purchase order updated.').waitFor()
    po = await order()
    r.check('the change is revision 1, back to Submitted', po.revision === 1 && po.status === 'Submitted', `rev ${po.revision} ${po.status}`)
    await rowAction(row(po.number), 'Approve')
    await page.getByText('Order approved.').waitFor()
    r.check('re-approval returns it to partly received', (await settle(async () => (await order()).status, 'Partially Received')) === 'Partially Received')

    // 6. Invoice from the order, then pay it
    await rowAction(row(po.number), 'Record invoice')
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Invoice no.').fill(`E2E-${TAG}`)
    await dialog.getByLabel('Amount before tax (Rs.)').fill('9000')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Invoice added.').waitFor()
    await page.getByRole('tab', { name: 'Invoices' }).click()
    await page.getByPlaceholder('Search supplier, invoice, order…').fill(`E2E-${TAG}`)
    await rowAction(row(`E2E-${TAG}`), 'Record payment')
    dialog = page.getByRole('dialog')
    r.check('payment is pre-filled with what is owed', (await dialog.getByLabel('Amount (Rs.)').inputValue()) === '9000.00')
    await dialog.getByLabel('Amount (Rs.)').fill('9500')
    await dialog.getByRole('button', { name: 'Save' }).click()
    const overpaid = await dialog.locator('p.text-destructive').first().innerText()
    r.check('overpaying is refused', overpaid.includes('outstanding'), overpaid)
    await dialog.getByLabel('Amount (Rs.)').fill('9000')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Payment added.').waitFor()
    const paid = await settle(async () => (await row(`E2E-${TAG}`).innerText()).includes('Paid'), true)
    r.check('the invoice shows as paid', paid === true)
    await page.screenshot({ path: `${SHOTS}/procurement-4-invoices.png` })

    // 7. Suppliers: performance and price comparison
    await page.getByRole('tab', { name: 'Suppliers' }).click()
    await page.getByText('Supplier performance').waitFor()
    await page.getByLabel('Filter prices by material').fill(MATERIAL)
    await page.getByText(MATERIAL, { exact: true }).waitFor()
    r.check('price comparison lists the ordered material', true)
    await page.screenshot({ path: `${SHOTS}/procurement-5-suppliers.png`, fullPage: true })
    await logout(page)

    // 8. Other roles can't open Purchasing
    await login(page, 'sorting_user')
    const sortingNav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('sorting supervisor has no Purchasing menu', !sortingNav.some((t) => t.includes('Purchasing')))
    await page.goto(`${BASE}/procurement`)
    r.check('and is sent home if they open it', new URL(page.url()).pathname === '/')
    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/procurement-error.png` }).catch(() => {})
  } finally {
    r.finish()
    await context.close()
  }
  return r.lines
}
