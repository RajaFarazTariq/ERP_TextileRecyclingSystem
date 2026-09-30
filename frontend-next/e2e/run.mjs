// Browser tests for the new frontend.
//
// Needs Django on :8000 with demo data (python manage.py seed_demo_data) and
// this app running (npm run build && npm start -- -p 3001). One-time setup:
// npx playwright install chromium.
//
//   npm run e2e                  all scenarios
//   npm run e2e -- sorting       only the named ones
//   BASE=http://host:port        another address; SHOTS=<folder> for screenshots
import { chromium } from 'playwright'

import { sortingScenario } from './sorting.mjs'
import { warehouseScenario } from './warehouse.mjs'

const scenarios = { warehouse: warehouseScenario, sorting: sortingScenario }
const wanted = process.argv.slice(2).filter((a) => a in scenarios)

const browser = await chromium.launch()
try {
  for (const [name, run] of Object.entries(scenarios)) {
    if (wanted.length && !wanted.includes(name)) continue
    console.log((await run(browser)).join('\n'))
  }
} finally {
  await browser.close()
}
