import { expect } from '@playwright/test'

import { test } from '../testWithCoverage'
import { decodeInBrowser } from './decode'

// const matrix = [
//   '01.jpg',
//   '02.jpg',
//   '03.jpg',
//   '04.jpg',
//   '05.jpg',
//   '06.jpg',
//   '07.jpg',
//   '08.jpg',
//   '09.jpg',
//   '10.jpg',
//   'pisa-4k.jpg',
//   'spruit_sunrise_4k.jpg',
//   'abandoned_bakery_16k.jpg'
// ]

// for (const testFile of matrix) {

// }

test('decodes from jpeg', async ({ page }) => {
  await page.goto('/tests/testbed.html', { waitUntil: 'networkidle' })

  const script = page.getByTestId('script')
  await expect(script).toBeAttached()

  const result = await page.evaluate(decodeInBrowser, { file: 'files/spruit_sunrise_4k.jpg' })

  expect(JSON.stringify(result.materialValues)).toMatchSnapshot({ name: 'material-values.json' })

  await expect(page).toHaveScreenshot('render.png')
})
