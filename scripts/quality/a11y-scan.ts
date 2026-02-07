import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

type Violation = {
  description: string;
  help: string;
  id: string;
  impact: string | null;
  nodes: Array<{ failureSummary?: string | null; html: string; target: string[] }>;
};

const baseUrl = process.env.A11Y_BASE_URL ?? "http://localhost:3000";
const routes = ["/grid-energy", "/weather-water", "/transport", "/outages-alerts"];

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let hasViolation = false;

  for (const route of routes) {
    const url = `${baseUrl}${route}`;
    await page.goto(url, { waitUntil: "networkidle" });

    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations as Violation[];

    if (violations.length === 0) {
      console.log(`PASS ${route}: no accessibility violations`);
      continue;
    }

    hasViolation = true;
    console.log(`FAIL ${route}: ${violations.length} accessibility violations`);

    for (const violation of violations) {
      console.log(
        ` - [${violation.impact ?? "unknown"}] ${violation.id}: ${violation.help} (${violation.description})`,
      );

      for (const node of violation.nodes.slice(0, 3)) {
        const target = node.target.join(" | ");
        const summary = node.failureSummary?.replace(/\s+/g, " ").trim() ?? "no summary";
        console.log(`   target: ${target}`);
        console.log(`   summary: ${summary}`);
        console.log(`   html: ${node.html.slice(0, 180)}`);
      }
    }
  }

  await context.close();
  await browser.close();

  if (hasViolation) {
    process.exit(1);
  }
};

run().catch((error: unknown) => {
  console.error("A11Y scan failed", error);
  process.exit(1);
});
