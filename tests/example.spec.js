// @ts-check
import { test, expect } from '@playwright/test'

test('execute tests', async ({ page }) => {
  await page.goto('http://127.0.0.1:8001/test/index.html');

  await page.waitForTimeout(15000);

  const passingTests = await page.locator('#mocha-report > li > ul > li.test.pass').all();
  const failingTests = await page.locator('#mocha-report > li > ul > li.test.fail').all();
  const passingTestsCount = (await passingTests).length;
  const failingTestsCount = (await failingTests).length;

  await expect(passingTestsCount).toBe(20);
  await expect(failingTestsCount).toBe(0);
});
