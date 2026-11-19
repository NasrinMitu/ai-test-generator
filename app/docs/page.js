import Link from "next/link";

const checkoutHtml = `<main data-testid="checkout-page">
  <h1>Checkout</h1>
  <form aria-label="Shipping details">
    <label for="full-name">Full name</label>
    <input id="full-name" name="fullName" autocomplete="name" />
    <label for="address">Street address</label>
    <input id="address" name="address" autocomplete="street-address" />
    <button type="submit">Continue to payment</button>
  </form>
  <section aria-label="Order summary">
    <p>Total: <span data-testid="order-total">$49.99</span></p>
  </section>
</main>`;

const pageObjectExample = `export class TargetPage {
  constructor(page) {
    this.page = page;
    this.fullName = page.getByLabel("Full name");
    this.address = page.getByLabel("Street address");
    this.continueButton = page.getByRole("button", {
      name: "Continue to payment",
    });
  }

  async visit() {
    await this.page.goto("https://example.com/checkout");
  }

  async fillShippingDetails(details) {
    await this.fullName.fill(details.fullName);
    await this.address.fill(details.address);
  }

  async continueToPayment() {
    await this.continueButton.click();
  }
}`;

const specExample = `import { test, expect } from "@playwright/test";
import { TargetPage } from "../pages/TargetPage";
import testData from "../fixtures/testData.json";

test("shopper can continue checkout", async ({ page }) => {
  const checkout = new TargetPage(page);
  await checkout.visit();
  await checkout.fillShippingDetails(testData.validInputs);
  await checkout.continueToPayment();

  await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
});`;

const fixtureExample = `{
  "validInputs": {
    "fullName": "Jordan Lee",
    "address": "123 Market Street"
  },
  "invalidInputs": {
    "emptyRequired": ""
  },
  "boundaryCases": {
    "maxNotes": "Please leave the package with the front desk. Please leave the package with the front desk.",
    "specialChars": "<script>alert(1)</script>"
  }
}`;

const playwrightFixtureExample = `import testData from "../fixtures/testData.json";

await checkout.fillShippingDetails(testData.validInputs);`;

const cypressFixtureExample = `describe("checkout", () => {
  beforeEach(() => {
    cy.fixture("testData").as("testData");
  });

  it("uses valid shipping details", function () {
    cy.get("@testData").then((testData) => {
      cy.get('[name="fullName"]').type(testData.validInputs.fullName);
      cy.get('[name="address"]').type(testData.validInputs.address);
    });
  });
});`;

const ciExample = `name: Playwright E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/`;

const toc = [
  { id: "copy-html", label: "Copy page HTML" },
  { id: "pom", label: "Page Object Model" },
  { id: "fixtures", label: "Data-driven fixtures" },
  { id: "frameworks", label: "Playwright vs. Cypress" },
  { id: "ci", label: "GitHub Actions CI" },
];

function CodeBlock({ children, language = "javascript", title }) {
  return (
    <div className="docs-code-wrap">
      {title ? (
        <div className="docs-code-title">
          <span>{title}</span>
          <span>{language}</span>
        </div>
      ) : null}
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}

export default function DocsPage() {
  return (
    <main className="docs-page">
      <header className="docs-topbar">
        <Link className="brand" href="/" aria-label="Testcraft home">
          <span className="brand-mark" aria-hidden="true">
            &lt;/&gt;
          </span>
          <span>testcraft</span>
        </Link>
        <Link className="docs-back-link" href="/">
          Back to workspace
        </Link>
      </header>

      <div className="docs-layout">
        <aside className="docs-sidebar" aria-label="Documentation contents">
          <p className="docs-sidebar-label">ON THIS PAGE</p>
          <nav>
            {toc.map((item, index) => (
              <a key={item.id} href={`#${item.id}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="docs-content">
          <div className="docs-heading">
            <p className="docs-eyebrow">TESTCRAFT LEARNING CENTER</p>
            <h1>From page HTML to reliable tests</h1>
            <p>
              New to end-to-end testing? Follow these short guides to give
              Testcraft useful page context, understand the generated files, and
              run your suite locally or in GitHub Actions.
            </p>
          </div>

          <section className="docs-card" id="copy-html">
            <p className="docs-section-number">MODULE 01</p>
            <h2>How to copy page HTML (outerHTML)</h2>
            <p>
              A DOM snippet is a small piece of the page&apos;s real HTML. It
              tells Testcraft which labels, names, roles, and test IDs actually
              exist, so generated selectors are less likely to break.
            </p>
            <ol className="docs-steps">
              <li>Open the page you want to test in Chrome, Edge, or Firefox.</li>
              <li>Right-click the form or main page section and choose <strong>Inspect</strong>.</li>
              <li>
                In DevTools, select the form or container element. Right-click
                it, then choose <strong>Copy → Copy outerHTML</strong>.
              </li>
              <li>Paste the copied HTML into Testcraft&apos;s Page HTML / DOM Snippet field.</li>
            </ol>
            <p className="docs-callout">
              Copy the smallest container that includes the fields and buttons
              in your story. Avoid pasting the whole page when a form is enough.
            </p>
            <CodeBlock title="Checkout snippet from the sample preset">
              {checkoutHtml}
            </CodeBlock>
          </section>

          <section className="docs-card" id="pom">
            <p className="docs-section-number">MODULE 02</p>
            <h2>Page Object Model (POM), explained</h2>
            <p>
              POM separates <code>TargetPage.js</code> (how to find and use
              controls) from the test spec (what outcome to verify). When a
              locator changes, update it in one place instead of every test.
            </p>
            <div className="docs-example-grid">
              <div>
                <h3>TargetPage.js · locators and actions</h3>
                <CodeBlock>{pageObjectExample}</CodeBlock>
              </div>
              <div>
                <h3>generated-test.spec.js · test and assertion</h3>
                <CodeBlock>{specExample}</CodeBlock>
              </div>
            </div>
            <p className="docs-callout">
              The example uses the sample checkout labels. The final assertion
              should match the real state shown by your application after
              continuing.
            </p>
          </section>

          <section className="docs-card" id="fixtures">
            <p className="docs-section-number">MODULE 03</p>
            <h2>Data-driven fixtures (testData.json)</h2>
            <p>
              Fixtures keep sample inputs separate from test steps. Testcraft
              can bundle <code>testData.json</code> into the ZIP so the suite
              can reuse valid, invalid, and boundary values.
            </p>
            <CodeBlock language="json" title="fixtures/testData.json">
              {fixtureExample}
            </CodeBlock>
            <div className="docs-example-grid">
              <div>
                <h3>Playwright · import the JSON</h3>
                <CodeBlock>{playwrightFixtureExample}</CodeBlock>
              </div>
              <div>
                <h3>Cypress · load a fixture alias</h3>
                <CodeBlock>{cypressFixtureExample}</CodeBlock>
              </div>
            </div>
            <p className="docs-callout">
              Playwright can import JSON directly. In Cypress, load it in
              <code> beforeEach </code> and read the alias with
              <code> cy.get(&quot;@testData&quot;)</code> inside a test.
            </p>
          </section>

          <section className="docs-card" id="frameworks">
            <p className="docs-section-number">MODULE 04</p>
            <h2>Playwright vs. Cypress cheat sheet</h2>
            <p>
              Both tools automate browsers and make assertions. Their APIs look
              different, but the same DOM-grounded approach applies.
            </p>
            <div className="docs-table-scroll">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th scope="col">Task</th>
                    <th scope="col">Playwright</th>
                    <th scope="col">Cypress</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Find a labeled field</th>
                    <td><code>page.getByLabel(&quot;Full name&quot;)</code></td>
                    <td><code>cy.get(&apos;[name=&quot;fullName&quot;]&apos;)</code></td>
                  </tr>
                  <tr>
                    <th scope="row">Find a button</th>
                    <td><code>page.getByRole(&quot;button&quot;, &#123; name: &quot;Continue to payment&quot; &#125;)</code></td>
                    <td><code>cy.contains(&quot;button&quot;, &quot;Continue to payment&quot;)</code></td>
                  </tr>
                  <tr>
                    <th scope="row">Click</th>
                    <td><code>await button.click()</code></td>
                    <td><code>button.click()</code></td>
                  </tr>
                  <tr>
                    <th scope="row">Type into a field</th>
                    <td><code>await field.fill(&quot;Jordan Lee&quot;)</code></td>
                    <td><code>field.type(&quot;Jordan Lee&quot;)</code></td>
                  </tr>
                  <tr>
                    <th scope="row">Assert visible</th>
                    <td><code>await expect(locator).toBeVisible()</code></td>
                    <td><code>locator.should(&quot;be.visible&quot;)</code></td>
                  </tr>
                  <tr>
                    <th scope="row">Visit a URL</th>
                    <td><code>await page.goto(url)</code></td>
                    <td><code>cy.visit(url)</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="docs-card" id="ci">
            <p className="docs-section-number">MODULE 05</p>
            <h2>Run tests in GitHub Actions (e2e.yml)</h2>
            <p>
              The CI option adds a framework-specific workflow to your ZIP. A
              workflow runs tests on GitHub&apos;s hosted machine whenever code
              is pushed or a pull request targets <code>main</code>.
            </p>
            <ol className="docs-steps">
              <li>Download the Testcraft ZIP and extract it into your project.</li>
              <li>Keep the generated test, fixtures, and <code>.github/workflows/e2e.yml</code> in their provided paths.</li>
              <li>Make sure your project has a <code>package-lock.json</code> and the selected testing framework in its dependencies.</li>
              <li>Commit and push the files to GitHub, or open a pull request targeting <code>main</code>.</li>
              <li>Open your repository&apos;s <strong>Actions</strong> tab to view the workflow and test results.</li>
            </ol>
            <p>
              The generated workflow installs dependencies, runs the browser
              tests headlessly, and uploads reports or failure artifacts when
              available.
            </p>
            <CodeBlock language="yaml" title=".github/workflows/e2e.yml">
              {ciExample}
            </CodeBlock>
          </section>

          <footer className="docs-footer">
            <span>Ready to generate a suite?</span>
            <Link href="/">Return to Testcraft</Link>
          </footer>
        </article>
      </div>
    </main>
  );
}
