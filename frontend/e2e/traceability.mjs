// Traceability and global search: find a lot, read its history from delivery to customer,
// find records from the Ctrl+K palette, and what a role without Sales may see.
import { BASE, SHOTS, createReport, login, logout } from './helpers.mjs'

const STAGES = ['delivery', 'sorting', 'decolorization', 'drying', 'production', 'quality', 'stock', 'sales']
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export async function traceabilityScenario(browser) {
  const r = createReport('traceability')
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const page = await context.newPage()
  r.watch(page)

  const api = async (path) => (await page.request.get(`${BASE}/api/django/${path}`)).json()
  const stage = (name) => page.locator(`[data-stage="${name}"]`)
  // Requests the palette and the lot search send to the search endpoint (not the trace)
  const searches = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (/\/api\/django\/search\/?$/.test(url.pathname)) searches.push(url.searchParams.get('q'))
  })
  const searched = (q) => page.waitForResponse((res) => {
    const url = new URL(res.url())
    return /\/api\/django\/search\/?$/.test(url.pathname) && url.searchParams.get('q') === q
  })
  const openPalette = async () => {
    await page.keyboard.press('Control+k')
    const dialog = page.getByRole('dialog')
    await dialog.getByPlaceholder('Type a page, section or action…').waitFor()
    return dialog
  }

  try {
    // 1. The admin opens the page: nothing is traced until a lot is picked
    await login(page, 'admin', 'Admin@1234')
    const orders = await api('sales/orders')
    const order = orders.find((o) => ['Dispatched', 'Completed', 'Confirmed'].includes(o.status)) ?? orders[0]
    const lotId = order ? order.fabric : (await api('sorting/fabric-stock'))[0].id
    const expected = await api(`search/trace?lot=${lotId}`)
    const material = expected.lot.material_type
    const supplier = expected.source.delivery.supplier
    const customer = expected.sales.orders[0]?.customer ?? ''

    await page.goto(`${BASE}/traceability`)
    await page.getByText('Pick a lot to trace').waitFor()
    r.check('nothing is traced until a lot is picked', (await stage('delivery').count()) === 0
      && await page.getByRole('button', { name: 'Print' }).isDisabled())

    // 2. Find the lot: by material, then by its number
    const box = page.getByLabel('Find a fabric lot')
    const results = page.locator('[aria-label="Matching lots"]')
    await box.fill(material.slice(0, 4).trim())
    await results.getByRole('button').first().waitFor()
    r.check('typing a material lists matching lots', (await results.innerText()).toLowerCase().includes(material.slice(0, 4).trim().toLowerCase()))
    await page.screenshot({ path: `${SHOTS}/traceability-1-search.png` })
    await box.fill(`#${lotId}`)
    await results.getByRole('button', { name: new RegExp(`^Lot #${lotId} `) }).first().click()
    await page.waitForURL(`**/traceability?lot=${lotId}`)
    await stage('sales').waitFor()
    r.check('picking a lot opens its trace', (await page.getByRole('heading', { name: new RegExp(`^Lot #${lotId} `) }).count()) === 1)

    // 3. The stages and the yield strip
    const shown = await page.locator('[data-stage]').evaluateAll((items) => items.map((i) => i.dataset.stage))
    r.check('the timeline runs from delivery to sales', shown.join() === STAGES.join(), shown.join())
    const steps = await page.locator('[data-yield]').evaluateAll((items) => items.map((i) => i.dataset.yield))
    r.check('the yield strip shows weight in to sold', steps.join() === 'in,sorted,decolorized,dried,sold', steps.join())
    const weightIn = await page.locator('[data-yield="in"]').innerText()
    r.check('weight in is the lot weight', weightIn.includes(Number(expected.summary.weight_in).toLocaleString('en-PK')) && weightIn.includes('kg'), weightIn.replace(/\n/g, ' '))
    r.check('the delivery names the supplier', (await stage('delivery').innerText()).includes(supplier))
    if (customer) {
      const sales = await stage('sales').innerText()
      r.check('an admin sees the customer', sales.includes(customer) && sales.includes(`Order #${expected.sales.orders[0].id}`))
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    r.check('the page does not scroll sideways', overflow <= 0, `${overflow}px`)
    await page.screenshot({ path: `${SHOTS}/traceability-2-trace.png`, fullPage: true })

    // 4. A sales order leads to its lot
    if (order) {
      await page.goto(`${BASE}/traceability?order=${order.id}`)
      r.check('a link with a sales order opens its lot',
        await page.getByRole('heading', { name: new RegExp(`^Lot #${lotId} `) }).waitFor({ timeout: 8000 }).then(() => true, () => false))
    }

    // 5. The palette finds records, and still jumps to pages
    let dialog = await openPalette()
    searches.length = 0
    await dialog.getByPlaceholder('Type a page, section or action…').fill(supplier.slice(0, 1))
    await page.waitForTimeout(700)
    r.check('one letter sends no search', searches.length === 0, searches.join())
    const word = supplier.slice(0, 5).trim()
    const answered = searched(word)
    await dialog.getByPlaceholder('Type a page, section or action…').fill(word)
    await answered
    const supplierResult = dialog.locator('[data-search-group="suppliers"] [cmdk-item]', { hasText: supplier }).first()
    r.check('typing part of a supplier name shows it as a live result',
      await supplierResult.waitFor({ timeout: 5000 }).then(() => true, () => false))
    await page.screenshot({ path: `${SHOTS}/traceability-3-palette.png` })
    await supplierResult.click()
    await page.waitForURL('**/procurement')
    r.check('choosing a result opens its page', new URL(page.url()).pathname === '/procurement')

    dialog = await openPalette()
    await dialog.getByPlaceholder('Type a page, section or action…').fill('quality')
    await dialog.getByRole('option', { name: 'Quality', exact: true }).click()
    await page.waitForURL('**/quality')
    r.check('the palette still jumps to pages', new URL(page.url()).pathname === '/quality')
    await logout(page)

    // 6. A sorting supervisor traces the same lot without the sales or customer data
    await login(page, 'sorting_user')
    const nav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('a sorting supervisor sees Traceability', nav.some((t) => t.includes('Traceability')))
    await page.goto(`${BASE}/traceability?lot=${lotId}`)
    await stage('sales').waitFor()
    const salesText = await stage('sales').innerText()
    const pageText = await page.locator('main').innerText().catch(() => page.locator('body').innerText())
    r.check('sales are not available for the role', salesText.includes('Not available for your role')
      && (!customer || !pageText.includes(customer)), salesText.replace(/\n/g, ' '))
    r.check('sorting is shown to the role', !(await stage('sorting').innerText()).includes('Not available for your role'))
    r.check('the sold figure is hidden too', (await page.locator('[data-yield="sold"]').innerText()).includes('Not available for your role'))

    if (customer) {
      dialog = await openPalette()
      const name = customer.slice(0, 5).trim()
      const reply = searched(name)
      await dialog.getByPlaceholder('Type a page, section or action…').fill(name)
      await reply
      await dialog.locator('[role="status"]').waitFor({ state: 'detached' })
      const found = await dialog.locator('[cmdk-item]', { hasText: new RegExp(escape(customer)) }).count()
      r.check('the palette shows no customer to the role',
        found === 0 && (await dialog.locator('[data-search-group="customers"], [data-search-group="sales_orders"]').count()) === 0)
      await page.keyboard.press('Escape')
    }
    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/traceability-error.png` }).catch(() => {})
  } finally {
    r.finish()
    await context.close()
  }
  return r.lines
}
