// Layout audit: opens every page, tab and form at several screen sizes in both
// themes and reports overlapping controls, content wider than the screen,
// controls that leave their dialog, and text clipped without an ellipsis.
//
//   node e2e/ui-audit.mjs                 everything
//   node e2e/ui-audit.mjs sorting sales   only these pages
//   RUN=phone-dark                        only this size and theme (see RUNS)
//   SHOTS=<folder>                        where screenshots go (default e2e/screenshots/audit)
//
// Needs the same setup as the e2e tests. Exits with code 1 when it finds a problem.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

import { BASE, SHOTS, login } from './helpers.mjs'

const OUT = `${SHOTS}audit/`
mkdirSync(OUT, { recursive: true })

const PAGES = ['dashboard', 'approvals', 'traceability', 'warehouse', 'sorting', 'decolorization', 'drying', 'quality', 'production', 'procurement', 'sales', 'finance', 'maintenance', 'workforce', 'sustainability', 'documents', 'reports', 'users']
// Forms are opened at the widest and narrowest size; the sizes in between check the pages
const RUNS = [
  { name: 'desktop', width: 1440, height: 900, theme: 'dark', forms: true, dropdowns: true },
  { name: 'phone', width: 390, height: 844, theme: 'dark', forms: true },
  { name: 'laptop', width: 1024, height: 768, theme: 'light', forms: true },
  { name: 'tablet', width: 768, height: 1024, theme: 'light' },
  { name: 'phone', width: 390, height: 844, theme: 'light' },
  { name: 'desktop', width: 1440, height: 900, theme: 'light' },
]
const wanted = process.argv.slice(2)
const pages = wanted.length ? PAGES.filter((p) => wanted.includes(p)) : PAGES

/** Runs in the browser: returns a list of layout problems in `scope` (a CSS selector). */
function findProblems(scope) {
  const root = document.querySelector(scope)
  if (!root) return []
  const problems = []
  const visible = (el) => {
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0 && r.width > 0 && r.height > 0
  }
  const describe = (el) => {
    const text = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 50)
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}> "${text}"`
  }
  const scrollsX = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX
      if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) return true
    }
    return false
  }
  /** The part of the element that can be seen: its box cut down by every ancestor that clips or scrolls. */
  const shown = (el) => {
    const r = el.getBoundingClientRect()
    const box = { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    for (let p = el.parentElement; p; p = p.parentElement) {
      const st = getComputedStyle(p)
      if (st.overflowX === 'visible' && st.overflowY === 'visible') continue
      const pr = p.getBoundingClientRect()
      if (st.overflowX !== 'visible') { box.left = Math.max(box.left, pr.left); box.right = Math.min(box.right, pr.right) }
      if (st.overflowY !== 'visible') { box.top = Math.max(box.top, pr.top); box.bottom = Math.min(box.bottom, pr.bottom) }
    }
    return box.right - box.left > 1 && box.bottom - box.top > 1 ? box : null
  }
  // Screen-reader-only text is 1px on purpose
  const srOnly = (el) => el.closest('.sr-only') !== null || el.getBoundingClientRect().width <= 1

  // 1. The page itself scrolls sideways
  if (scope === 'main' && document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
    problems.push(`page is wider than the screen (${document.documentElement.scrollWidth}px > ${document.documentElement.clientWidth}px)`)
  }

  // 2. Controls that overlap each other
  const controls = [...root.querySelectorAll('input, textarea, button, [role=combobox], a[href], [role=tab]')]
    .filter((el) => visible(el) && shown(el) && !srOnly(el) && !el.closest('nextjs-portal'))
  for (let i = 0; i < controls.length; i++) {
    const a = shown(controls[i])
    for (let j = i + 1; j < controls.length; j++) {
      if (controls[i].contains(controls[j]) || controls[j].contains(controls[i])) continue
      const b = shown(controls[j])
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      // A small button inside a field (show password, clear search) is meant to sit on it
      const inside = (x, y) => x.left >= y.left - 1 && x.right <= y.right + 1 && x.top >= y.top - 1 && x.bottom <= y.bottom + 1
      if (inside(a, b) || inside(b, a)) continue
      if (w > 2 && h > 2) problems.push(`overlap: ${describe(controls[i])} and ${describe(controls[j])} (${Math.round(w)}x${Math.round(h)}px)`)
    }
  }

  // 3. Anything sticking out of the screen or of its dialog, unless its container scrolls sideways
  const bounds = scope === 'main' ? { left: 0, right: window.innerWidth } : root.getBoundingClientRect()
  for (const el of root.querySelectorAll('*')) {
    if (!visible(el) || el.closest('nextjs-portal') || el.closest('svg')) continue
    const r = shown(el)
    if (r && !srOnly(el) && (r.right > bounds.right + 1 || r.left < bounds.left - 1) && !scrollsX(el)) {
      if (![...el.children].some((c) => visible(c) && c.getBoundingClientRect().right > bounds.right + 1)) {
        problems.push(`sticks out ${Math.round(Math.max(r.right - bounds.right, bounds.left - r.left))}px: ${describe(el)}`)
      }
    }
  }

  // 4. Text cut off without an ellipsis
  for (const el of root.querySelectorAll('p, span, h1, h2, h3, label, button, a, td, th, dt, dd, legend')) {
    if (!visible(el) || srOnly(el) || el.closest('nextjs-portal')) continue
    const s = getComputedStyle(el)
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (!ownText || s.overflowX === 'visible') continue
    if (s.webkitLineClamp && s.webkitLineClamp !== 'none') continue   // clamped to N lines, ends in an ellipsis
    if (el.scrollWidth > el.clientWidth + 1 && s.textOverflow !== 'ellipsis' && s.overflowX !== 'auto' && s.overflowX !== 'scroll') {
      problems.push(`text cut off without "…": ${describe(el)}`)
    }
  }
  return [...new Set(problems)]
}

const browser = await chromium.launch()
const report = []
const note = (where, tag, problems) => {
  for (const problem of problems) {
    report.push({ where, tag, problem })
    console.log(`[${tag}] ${where}: ${problem}`)
  }
}

try {
  {
    for (const vp of RUNS.filter((r) => !process.env.RUN || process.env.RUN === `${r.name}-${r.theme}`)) {
      const theme = vp.theme
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce', colorScheme: theme })
      await context.addInitScript((t) => localStorage.setItem('theme', t), theme)
      const page = await context.newPage()
      const tag = `${vp.name}-${theme}`
      const settle = async () => {
        await page.waitForLoadState('networkidle').catch(() => {})
        await page.waitForTimeout(350)
      }
      const shot = (name) => page.screenshot({ path: `${OUT}${name}-${tag}.png` })

      await page.goto(`${BASE}/login`)
      await settle()
      note('login', tag, await page.evaluate(findProblems, 'body'))
      await shot('login')
      await login(page, 'admin', 'Admin@1234')
      await settle()
      note('home', tag, await page.evaluate(findProblems, 'main'))
      await shot('home')

      for (const name of pages) {
        await page.goto(`${BASE}/${name}`)
        await settle()
        await page.getByRole('tab').first().waitFor({ timeout: 2500 }).catch(() => {})   // pages without tabs
        const tabs = await page.getByRole('tab').allInnerTexts()
        for (const tab of tabs.length ? tabs : [null]) {
          const where = `${name}${tab ? ` > ${tab}` : ''}`
          const slug = `${name}${tab ? `-${tab.toLowerCase().replace(/\W+/g, '-')}` : ''}`
          if (tab) {
            await page.getByRole('tab', { name: tab, exact: true }).click()
            await settle()
          }
          // Measure the page with its data, not its loading placeholders
          await page.waitForFunction(() => !document.querySelector('main [data-slot="skeleton"]'), null, { timeout: 15000 })
            .catch(() => note(where, tag, ['still showing loading placeholders after 15 s']))
          await settle()
          note(where, tag, await page.evaluate(findProblems, 'main'))
          await page.screenshot({ path: `${OUT}${slug}-${tag}.png`, fullPage: true })

          // Forms: the page's "add" button, then the first row's Edit
          const openers = [
            { label: 'new', open: () => page.locator('main').getByRole('button', { name: /^(Add|New|Record|Start|Issue|Create|Fill|Register)\b/ }).first() },
            { label: 'edit', open: () => page.locator('main tbody tr').first().getByRole('button', { name: 'Row actions' }) },
          ]
          for (const opener of vp.forms ? openers : []) {
            const button = opener.open()
            if (!(await button.count()) || !(await button.isVisible().catch(() => false))) continue
            await button.click()
            if (opener.label === 'edit') {
              const edit = page.getByRole('menuitem', { name: 'Edit', exact: true })
              if (!(await edit.count())) { await page.keyboard.press('Escape'); continue }
              await edit.click()
            }
            const dialog = page.getByRole('dialog')
            if (!(await dialog.waitFor({ timeout: 4000 }).then(() => true, () => false))) continue
            await settle()
            note(`${where} ${opener.label} form`, tag, await page.evaluate(findProblems, '[role=dialog]'))
            await shot(`${slug}-${opener.label}-form`)

            // Every dropdown in the form: the list must fit on screen
            const combos = dialog.getByRole('combobox')
            for (let i = 0; i < (vp.dropdowns ? Math.min(await combos.count(), 8) : 0); i++) {
              const combo = combos.nth(i)
              if (!(await combo.isEnabled())) continue
              await combo.click()
              const list = page.getByRole('listbox')
              if (await list.waitFor({ timeout: 2000 }).then(() => true, () => false)) {
                // The list is created off-screen and placed a moment later: wait until it has landed
                let box = await list.boundingBox()
                for (let tries = 0; tries < 15 && box && (box.y < 0 || box.x < 0); tries++) {
                  await page.waitForTimeout(100)
                  box = await list.boundingBox()
                }
                if (box && (box.x < -1 || box.x + box.width > vp.width + 1 || box.y < -1 || box.y + box.height > vp.height + 1)) {
                  note(`${where} ${opener.label} form`, tag, [`dropdown ${i + 1} list leaves the screen (${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)})`])
                }
                await page.keyboard.press('Escape')
                await list.waitFor({ state: 'detached', timeout: 2000 }).catch(() => {})
              }
            }
            await page.keyboard.press('Escape')
            if (!(await dialog.waitFor({ state: 'detached', timeout: 3000 }).then(() => true, () => false))) {
              await dialog.getByRole('button', { name: 'Cancel' }).click().catch(() => {})
              await dialog.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
            }
          }
        }
      }
      await context.close()
    }
  }
} finally {
  await browser.close()
}

// The same problem usually shows at several sizes: group them
const grouped = new Map()
for (const { where, tag, problem } of report) {
  const key = `${where}: ${problem}`
  grouped.set(key, [...(grouped.get(key) ?? []), tag])
}
for (const [key, tags] of grouped) console.log(`${key}\n    at: ${tags.join(', ')}`)
console.log(`\n${grouped.size} distinct problems (${report.length} occurrences). Screenshots: ${OUT}`)
if (report.length) process.exitCode = 1
