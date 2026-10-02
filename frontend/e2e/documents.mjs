// Documents: upload with checks -> new version -> versions and download -> expiring list,
// and what a role that may not see a category gets.
import { BASE, SHOTS, choose, createReport, login, logout, settle } from './helpers.mjs'

const TAG = Date.now() % 100000
const PRIVATE = `E2E contract ${TAG}`
const SHARED = `E2E certificate ${TAG}`
const CATEGORY = `E2E permits ${TAG}`

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n')
const PDF_2 = Buffer.from('%PDF-1.4\n% second edition\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n')
const PROGRAM = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00', 'latin1')
const pdf = (name, buffer = PDF) => ({ name, mimeType: 'application/pdf', buffer })

function inDays(n) {
  const d = new Date(Date.now() + n * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function documentsScenario(browser) {
  const r = createReport('documents')
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 }, reducedMotion: 'reduce', acceptDownloads: true })
  const page = await context.newPage()
  r.watch(page)

  const api = async (path) => (await page.request.get(`${BASE}/api/django/${path}`)).json()
  // Same-origin call from the page, as the app itself would make it
  const send = (method, path) => page.evaluate(async ([method, path]) => {
    const res = await fetch(`/api/django/${path}`, { method })
    return { status: res.status, type: res.headers.get('content-type') ?? '', disposition: res.headers.get('content-disposition') ?? '' }
  }, [method, path])
  const find = async (title) => (await api('documents/documents')).find((d) => d.title === title)
  const row = (text) => page.locator('tbody tr', { hasText: text }).first()
  const openMenu = (rowLocator) => rowLocator.getByRole('button', { name: 'Row actions' }).click()
  const search = (text) => page.getByPlaceholder('Search title, number, file, record…').fill(text)

  try {
    // 1. Upload: a file is needed, and its content must be what its name says
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/documents`)
    await page.getByRole('button', { name: 'Upload document' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('Title', { exact: true }).fill(PRIVATE)
    await choose(dialog, 'Category', 'Employee documents')
    await dialog.getByRole('button', { name: 'Upload', exact: true }).click()
    const noFile = await dialog.locator('p.text-destructive').first().innerText()
    r.check('a file is required', noFile.includes('Choose a file'), noFile)

    await dialog.getByLabel('File', { exact: true }).setInputFiles({ name: 'setup.exe', mimeType: 'application/octet-stream', buffer: PROGRAM })
    await dialog.getByRole('button', { name: 'Upload', exact: true }).click()
    const badType = await dialog.locator('p.text-destructive').first().innerText()
    r.check('file types outside the list are refused', badType.includes('not allowed'), badType)

    await dialog.getByLabel('File', { exact: true }).setInputFiles(pdf('contract.pdf', PROGRAM))
    await dialog.getByRole('button', { name: 'Upload', exact: true }).click()
    const fake = await settle(async () => (await dialog.locator('p.text-destructive').allInnerTexts()).join(' ').includes('not a real'), true)
    r.check('a program renamed to .pdf is refused by the server', fake === true)

    await dialog.getByLabel('File', { exact: true }).setInputFiles(pdf('contract.pdf'))
    await dialog.getByLabel('Expires on', { exact: true }).fill(inDays(10))
    await choose(dialog, 'Linked to', 'Employee')
    await dialog.getByLabel('Record', { exact: true }).fill(`Worker ${TAG}`)
    await page.screenshot({ path: `${SHOTS}/documents-1-upload.png` })
    await dialog.getByRole('button', { name: 'Upload', exact: true }).click()
    await page.getByText('Document added.').waitFor()
    const first = await find(PRIVATE)
    r.check('the upload is version 1 and expiring soon',
      first?.current_version === 1 && first.status === 'Expiring soon' && first.number.startsWith('DOC-'), JSON.stringify(first ?? {}).slice(0, 160))

    // 2. A new version keeps the old one
    await page.getByRole('tab', { name: 'Documents', exact: true }).click()
    await search(PRIVATE)
    await openMenu(row(PRIVATE))
    await page.getByRole('menuitem', { name: 'New version' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('File', { exact: true }).setInputFiles(pdf('contract-signed.pdf', PDF_2))
    await dialog.getByLabel('What changed').fill('Signed copy')
    await dialog.getByRole('button', { name: 'Upload', exact: true }).click()
    await page.getByText('Version 2 added.').waitFor()
    r.check('the list shows version 2', (await settle(async () => (await row(PRIVATE).innerText()).includes('Version 2'), true)) === true)

    await openMenu(row(PRIVATE))
    await page.getByRole('menuitem', { name: 'Versions' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByText('Version 1').waitFor()
    const versions = await dialog.innerText()
    r.check('both versions are listed with the note', versions.includes('Version 2') && versions.includes('contract.pdf') && versions.includes('Signed copy'))
    await page.screenshot({ path: `${SHOTS}/documents-2-versions.png` })
    const [old] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'Download version 1' }).click(),
    ])
    r.check('an earlier version can be downloaded', old.suggestedFilename() === 'contract.pdf', old.suggestedFilename())
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })

    // 3. Download of the current version, sent as an attachment
    await openMenu(row(PRIVATE))
    const [current] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Download' }).click(),
    ])
    r.check('the current version downloads', current.suggestedFilename() === 'contract-signed.pdf', current.suggestedFilename())
    const headers = await send('GET', `documents/documents/${first.id}/download`)
    r.check('downloads are attachments, never shown in the page',
      headers.status === 200 && headers.disposition.startsWith('attachment') && headers.type === 'application/pdf', JSON.stringify(headers))

    // 4. Expiring tab and dashboard
    await page.getByRole('tab', { name: 'Expiring' }).click()
    await search(PRIVATE)
    r.check('the Expiring tab lists it', (await settle(async () => (await row(PRIVATE).innerText()).includes('in 10 days'), true)) === true)
    await page.getByRole('tab', { name: 'Dashboard' }).click()
    await page.getByText('Expires next').waitFor()
    await page.screenshot({ path: `${SHOTS}/documents-3-dashboard.png` })

    // 5. A document every role may see, and a category of the admin's own
    await page.getByRole('button', { name: 'Upload document' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('File', { exact: true }).setInputFiles(pdf('certificate.pdf'))
    await dialog.getByLabel('Title', { exact: true }).fill(SHARED)
    await choose(dialog, 'Category', 'Quality certificates')
    await dialog.getByRole('button', { name: 'Upload', exact: true }).click()
    await page.getByText('Document added.').waitFor()
    const shared = await find(SHARED)

    await page.getByRole('tab', { name: 'Categories' }).click()
    await page.getByRole('button', { name: 'New category' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name', { exact: true }).fill(CATEGORY)
    await choose(dialog, 'Drying Supervisor', 'Yes')
    await page.screenshot({ path: `${SHOTS}/documents-4-category.png` })
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByText('Category added.').waitFor()
    const category = (await api('documents/categories')).find((c) => c.name === CATEGORY)
    r.check('a category is open to the chosen roles only', category?.allowed_roles.join() === 'drying_supervisor', JSON.stringify(category ?? {}))
    await logout(page)

    // 6. A sorting supervisor sees shared documents only
    await login(page, 'sorting_user')
    const nav = await page.locator('[data-sidebar="menu-button"]').allInnerTexts()
    r.check('a sorting supervisor sees Documents', nav.some((t) => t.includes('Documents')))
    await page.goto(`${BASE}/documents`)
    await page.getByRole('tab', { name: 'Documents', exact: true }).click()
    await search(String(TAG))
    await row(SHARED).waitFor()
    const titles = (await api('documents/documents')).map((d) => d.title)
    r.check('hidden documents are not in the list', titles.includes(SHARED) && !titles.includes(PRIVATE)
      && (await page.locator('tbody tr', { hasText: PRIVATE }).count()) === 0)
    const hidden = await send('GET', `documents/documents/${first.id}/download`)
    const hiddenDetail = await send('GET', `documents/documents/${first.id}`)
    r.check('a hidden document answers 404, also for its file', hidden.status === 404 && hiddenDetail.status === 404, `${hidden.status} ${hiddenDetail.status}`)
    await openMenu(row(SHARED))
    const items = (await page.getByRole('menuitem').allInnerTexts()).map((t) => t.trim())
    await page.keyboard.press('Escape')
    r.check('other users download but do not change or delete', items.includes('Download') && items.includes('Versions')
      && !items.includes('Delete') && !items.includes('New version') && !items.includes('Edit details'), items.join())
    await page.getByRole('tab', { name: 'Categories' }).click()
    await page.getByText('Quality certificates').first().waitFor()
    const seen = await page.locator('tbody').innerText()
    r.check('only admins manage categories', (await page.getByRole('button', { name: 'New category' }).count()) === 0
      && !seen.includes('Employee documents') && !seen.includes(CATEGORY))
    await logout(page)

    // 7. The admin deletes; the files go with the documents
    await login(page, 'admin', 'Admin@1234')
    await page.goto(`${BASE}/documents`)
    await page.getByRole('tab', { name: 'Documents', exact: true }).click()
    await search(PRIVATE)
    await openMenu(row(PRIVATE))
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await page.getByText('Document deleted.').waitFor()
    const gone = await send('GET', `documents/documents/${first.id}/versions/1/download`)
    r.check('a deleted document is gone with its versions', gone.status === 404, String(gone.status))
    await send('DELETE', `documents/documents/${shared.id}`)
    await send('DELETE', `documents/categories/${category.id}`)
    await logout(page)
  } catch (e) {
    r.check('scenario completed', false, `${e.message.split('\n')[0]} (after: ${r.lines.at(-1) ?? 'start'})`)
    await page.screenshot({ path: `${SHOTS}/documents-error.png` }).catch(() => {})
  } finally {
    r.finish([400, 404])
    await context.close()
  }
  return r.lines
}
