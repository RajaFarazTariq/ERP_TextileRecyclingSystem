// Sales page: order lifecycle with stock reservation/dispatch, payments, customers.
import { BASE, SHOTS, choose, createReport, login, logout, settle } from './helpers.mjs'

const TAG = Date.now() % 100000
const BUYER = `E2E Buyer ${TAG}`

export async function salesScenario(browser) {
  const r = createReport('sales')
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const page = await context.newPage()
  r.watch(page)

  const api = async (path) => (await page.request.get(`${BASE}/api/django/${path}`)).json()
  const stockOf = async (fabricId) => {
    const row = (await api('inventory/movements/stock')).find((x) => x.fabric === fabricId)
    return row ? { onHand: Number(row.on_hand_kg), available: Number(row.available_kg) } : { onHand: 0, available: 0 }
  }
  const orderRow = () => page.locator('tbody tr', { hasText: BUYER }).first()
  const rowAction = async (row, name) => {
    await row.getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name }).click()
  }

  try {
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/sales`)
    await page.getByText('Order value by month').waitFor()
    r.check('dashboard shows revenue and a chart', (await page.locator('.recharts-bar-rectangle').count()) > 0)
    await page.screenshot({ path: `${SHOTS}/sales-1-dashboard.png` })

    // Draft order for a lot with dried stock
    await page.getByRole('tab', { name: 'Orders' }).click()
    await page.getByRole('button', { name: 'New order' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('Buyer', { exact: true }).fill(BUYER)
    await choose(dialog, 'Fabric lot', /— [1-9][\d,.]* kg available/)
    await dialog.getByLabel('Quality').fill('Grade A')
    await dialog.getByLabel('Weight (kg)').fill('50')
    await dialog.getByLabel('Price per kg (Rs.)').fill('100')
    r.check('order form shows the total', (await dialog.innerText()).includes('Rs. 5,000'))
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Order added.').waitFor()
    const order = (await api('sales/orders')).find((o) => o.buyer_name === BUYER)
    r.check('new order is a Draft linked to a customer', order.status === 'Draft' && order.customer_name === BUYER, `${order.status} / ${order.customer_name}`)
    const start = await stockOf(order.fabric)

    // Confirm → reserves stock
    await page.getByPlaceholder('Search buyer, fabric, quality…').fill(BUYER)
    await rowAction(orderRow(), 'Confirm')
    await page.getByText('Order confirmed; stock reserved.').waitFor()
    const reserved = await settle(async () => (await stockOf(order.fabric)).available, start.available - 50)
    r.check('confirming reserves the ordered kg', reserved === start.available - 50, `${start.available} → ${reserved}`)

    // An order bigger than the stock can't be confirmed
    await page.getByRole('button', { name: 'New order' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Buyer', { exact: true }).fill(BUYER)
    await choose(dialog, 'Fabric lot', new RegExp(order.fabric_material))
    await dialog.getByLabel('Quality').fill('Grade A')
    await dialog.getByLabel('Weight (kg)').fill('9999999')
    await dialog.getByLabel('Price per kg (Rs.)').fill('1')
    await choose(dialog, 'Order status', 'Confirmed')
    await dialog.getByRole('button', { name: 'Save' }).click()
    const weightError = dialog.locator('p.text-destructive').first()
    await weightError.waitFor()
    r.check('overselling is refused with the available amount', (await weightError.innerText()).includes('available'), await weightError.innerText())
    await page.screenshot({ path: `${SHOTS}/sales-2-oversell-refused.png` })
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    // Dispatch part of it → stock goes out
    await rowAction(orderRow(), 'Dispatch')
    dialog = page.getByRole('dialog')
    r.check('dispatch dialog shows what is left', (await dialog.innerText()).includes('50 kg of 50 kg left'))
    await dialog.getByLabel('Vehicle number').fill(`LHR-${TAG}`)
    await dialog.getByLabel('Weight (kg)').fill('20')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Dispatch added.').waitFor()
    const afterDispatch = await settle(async () => (await stockOf(order.fabric)).onHand, start.onHand - 20)
    r.check('dispatching takes the weight out of stock', afterDispatch === start.onHand - 20, `${start.onHand} → ${afterDispatch}`)

    // Over-dispatch is refused
    await rowAction(orderRow(), 'Dispatch')
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Vehicle number').fill(`LHR-${TAG}`)
    await dialog.getByLabel('Weight (kg)').fill('40')
    await dialog.getByRole('button', { name: 'Save' }).click()
    const dispatchError = dialog.locator('p.text-destructive').first()
    await dispatchError.waitFor()
    r.check('dispatching more than is left is refused', (await dispatchError.innerText()).includes('30.00 kg'), await dispatchError.innerText())
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    // Payment by Online Transfer → Partial
    await page.getByRole('tab', { name: 'Payments' }).click()
    await page.getByRole('button', { name: 'Record payment' }).click()
    dialog = page.getByRole('dialog')
    await choose(dialog, 'Order', new RegExp(`#${order.id} `))
    await dialog.getByLabel('Amount (Rs.)').fill('1000')
    await choose(dialog, 'Method', 'Online Transfer')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Payment added.').waitFor()
    const payStatus = await settle(async () => (await api('sales/orders')).find((o) => o.id === order.id).payment_status, 'Partial')
    r.check('online transfer payment makes the order Partial', payStatus === 'Partial', payStatus)

    // Deliver → Completed
    await page.getByRole('tab', { name: 'Dispatches' }).click()
    await page.getByPlaceholder('Search order, vehicle, driver…').fill(`LHR-${TAG}`)
    await rowAction(page.locator('tbody tr').first(), 'Mark delivered')
    await page.getByText('Marked as delivered; order completed.').waitFor()
    const status = await settle(async () => (await api('sales/orders')).find((o) => o.id === order.id).status, 'Completed')
    r.check('delivery completes the order', status === 'Completed', status)

    // Customers: add one and merge it into the order's customer
    await page.getByRole('tab', { name: 'Customers' }).click()
    await page.getByRole('button', { name: 'Add customer' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name').fill(`E2E Merge ${TAG}`)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Customer added.').waitFor()
    await page.getByPlaceholder('Search customers…').fill(`E2E Merge ${TAG}`)
    await rowAction(page.locator('tbody tr').first(), 'Merge into…')
    dialog = page.getByRole('dialog')
    await choose(dialog, 'Merge into', new RegExp(BUYER))
    await dialog.getByRole('button', { name: 'Merge' }).click()
    await dialog.waitFor({ state: 'detached' })
    const merged = await settle(async () => (await api('sales/customers')).some((c) => c.name === `E2E Merge ${TAG}`), false)
    r.check('customer merged away', merged === false)
    await page.screenshot({ path: `${SHOTS}/sales-3-customers.png` })

    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/sales-error.png` }).catch(() => {})
  } finally {
    r.finish()
    await context.close()
  }
  return r.lines
}
