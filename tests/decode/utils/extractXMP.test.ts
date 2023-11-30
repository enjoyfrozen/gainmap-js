import * as decode from '@monogrid/gainmap-js'
import { expect } from '@playwright/test'
import * as THREE from 'three'

import { test } from '../../testWithCoverage'

const matrix = [
  '01.jpg',
  '02.jpg',
  '03.jpg',
  '04.jpg',
  '05.jpg',
  '06.jpg',
  '07.jpg',
  '08.jpg',
  '09.jpg',
  '10.jpg',
  'pisa-4k.jpg',
  'spruit_sunrise_4k.jpg',
  'abandoned_bakery_16k.jpg'
]

for (const testFile of matrix) {
  test(`extracts xmp from ${testFile}`, async ({ page }) => {
    await page.goto('/tests/testbed.html', { waitUntil: 'networkidle' })

    const script = page.getByTestId('script')
    await expect(script).toBeAttached()

    const result = await page.evaluate(async (testFile) => {
      const file = await new THREE.FileLoader()
        .setResponseType('arraybuffer')
        .loadAsync(`files/${testFile}`)

      if (typeof file !== 'string') {
        return decode.extractXMP(new Uint8Array(file))
      }
      return undefined
    }, testFile)

    expect(result).not.toBeUndefined()
    expect(JSON.stringify(result)).toMatchSnapshot()
  })
}
