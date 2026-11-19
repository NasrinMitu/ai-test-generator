import { GoogleGenAI } from "@google/genai";

// Ordered from fastest, highest-availability models to standard Flash models
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
];

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export async function POST(request) {
  try {
    const {
      targetUrl,
      framework,
      userStory,
      usePom,
      useFixtures,
      domSnippet,
    } = await request.json();

    if (
      typeof userStory !== "string" ||
      !userStory.trim() ||
      typeof domSnippet !== "string" ||
      !domSnippet.trim()
    ) {
      return Response.json(
        { error: "Both user story and Page HTML / DOM snippet are required." },
        { status: 400 },
      );
    }

    const effectiveTargetUrl =
      typeof targetUrl === "string" && targetUrl.trim()
        ? targetUrl.trim()
        : "/";

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { timeout: 25000 },
    });

    const pomInstructions = usePom
      ? framework === "cypress"
        ? `When usePom is true, return "pageObjectCode" and "specCode" as separate JSON string fields. "pageObjectCode" must contain only raw JavaScript (no Markdown fences) defining "export default class TargetPage" for cypress/support/pages/TargetPage.js and encapsulating all DOM locators and page actions. "specCode" must contain only raw JavaScript for cypress/e2e/generated-test.cy.js and import TargetPage from '../support/pages/TargetPage'. Call Page Object methods from the Cypress tests. Keep all DOM selectors and interactions inside TargetPage methods; it() blocks must contain zero raw cy.get(), cy.contains(), or other DOM selectors.`
        : `When usePom is true, return "pageObjectCode" and "specCode" as separate JSON string fields. "pageObjectCode" must contain only raw JavaScript (no Markdown fences) defining "export class TargetPage" for pages/TargetPage.js and encapsulating all DOM locators and page actions. "specCode" must contain only raw JavaScript for tests/generated-test.spec.js and import { TargetPage } from '../pages/TargetPage'. Call Page Object methods from the Playwright tests. Keep all DOM selectors and interactions inside TargetPage methods; test() blocks must contain zero raw page.locator() selectors.`
      : `When usePom is false, return "pageObjectCode" as an empty string and put the complete raw JavaScript test spec in "specCode", without Markdown fences.`;

    const fixtureInstructions = useFixtures
      ? framework === "cypress"
        ? `Generate test fixtures and use them in the test spec instead of hard-coding test payloads. In beforeEach, use cy.fixture("testData").as("testData"). Never assign this.data = data inside arrow functions (() => {}). Access fixtures inside it() blocks with cy.get("@testData").then((testData) => { ... }).`
        : `Generate test fixtures and use them in the test spec instead of hard-coding test payloads. Import the data in the test spec with import testData from '../fixtures/testData.json' and reference its values in test assertions and request bodies.`
      : "";

    const frameworkInstructions =
      framework === "cypress"
        ? `- Use only native Cypress commands and syntax. Do not use cy.getByRole, cy.getByLabel, or cy.getByPlaceholder; those commands are not part of native Cypress.
- For accessible button text, use cy.contains('button', /.../i).
- To locate a labeled field, use cy.contains('label', /.../i).invoke('attr', 'for').then((id) => cy.get('#' + id)).
- For fields without a usable label, use selectors such as cy.get('input[name="..."], input[placeholder*="..."]').
- Prefer [data-cy="..."] or [data-testid="..."] selectors when available.`
        : `- Use Playwright locators such as page.getByRole(), page.getByLabel(), page.getByPlaceholder(), page.getByTestId(), and page.locator() with selectors confirmed by the provided HTML.`;

    const navigationInstruction =
      framework === "cypress"
        ? `- Visit the full target URL directly with cy.visit('${effectiveTargetUrl}'); do not use a relative path or assume baseUrl is configured.`
        : `- Navigate to the full target URL directly with await page.goto('${effectiveTargetUrl}'); do not assume baseURL is configured.`;

    const prompt = `Generate a clean, production-ready ${framework} end-to-end test script.

Target URL: ${effectiveTargetUrl}

User story and acceptance criteria:
${userStory}

Page HTML / DOM Snippet:
${domSnippet}

QA Best Practices:
- Use these framework-specific locator rules:
${frameworkInstructions}
- Extract locators strictly from the provided Page HTML / DOM Snippet. Do NOT invent or guess data-cy, data-testid, IDs, or labels that do not exist in the HTML.
- Prioritize actual attributes present in the snippet in this order: 1) data-testid / data-cy, 2) accessible label / placeholder / aria-label / role text, 3) unique name or id attributes.
- Scan the DOM snippet for required fields whose visible label or associated trigger text includes an asterisk (*), especially custom dropdowns rendered as buttons (for example, "City / District*") and required select elements. Never skip these fields. Add a Page Object helper that opens each custom dropdown using its actual accessible trigger (for example, Playwright page.getByRole('button', { name: /City \\/ District/i }) or Cypress cy.contains('button', /City \\/ District/i)), then selects a valid option using only options/text confirmed by the DOM snippet. Handle native select fields with the framework's native select interaction.
- Every test() or it() block must finish with at least one meaningful assertion: use expect(...) in Playwright or a Cypress .should(...) assertion. This applies to positive submissions and negative validation cases; do not leave any test without an assertion.
- Check the DOM snippet for duplicate data-testid values before using them. When multiple elements share a value (such as payment method cards), disambiguate by visible text using Playwright locator.filter({ hasText: '...' }) or Cypress cy.contains('[data-testid=\"...\"]', '...'), with text that identifies the intended element.
- Always navigate to the complete Target URL:
${navigationInstruction}
- Use auto-waiting web-first assertions; avoid hard-coded sleeps or waitForTimeout.
- Keep code concise without verbose comments.
${fixtureInstructions}
${pomInstructions}

Return a JSON object with exactly these keys:
- "scenarios": an array of 4 to 6 test cases covering the user story, positive and negative paths, and relevant edge cases. Each item must have "id" (TC-01, TC-02, etc.), "type" (exactly "Positive", "Negative", or "Edge Case"), "title", and "expectedResult".
- "pageObjectCode": ${
      usePom
        ? "raw JavaScript code for TargetPage, without Markdown fences."
        : 'an empty string ("").'
    }
- "specCode": raw JavaScript code for the test spec, without Markdown fences.
- "script": ${
      usePom
        ? 'an empty string (""); the server creates the combined preview from pageObjectCode and specCode.'
        : "the complete generated test script as a string."
    }.
- "testData": ${
      useFixtures
        ? 'a nested JSON object (not a stringified JSON string) containing realistic "validInputs" and "invalidInputs" objects, a "boundaryCases" array, and a "mockApiResponses" object tailored to the user story and target URL.'
        : "null"
    }.

Do not include Markdown fences around the JSON response itself.`;

    let lastError = null;

    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.2,
            responseMimeType: "application/json",
            // Gemini 3.x models use thinkingLevel instead of thinkingBudget: 0
            thinkingConfig: {
              thinkingLevel: usePom ? "LOW" : "MINIMAL",
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          if (
            !Array.isArray(parsed.scenarios) ||
            parsed.scenarios.length < 4 ||
            parsed.scenarios.length > 6 ||
            parsed.scenarios.some(
              (scenario) =>
                !scenario ||
                typeof scenario.id !== "string" ||
                !["Positive", "Negative", "Edge Case"].includes(scenario.type) ||
                typeof scenario.title !== "string" ||
                typeof scenario.expectedResult !== "string",
            )
          ) {
            throw new Error("Gemini returned an invalid test script or scenario list.");
          }

          const pageObjectCode =
            usePom && typeof parsed.pageObjectCode === "string"
              ? parsed.pageObjectCode.trim()
              : "";
          const specCode =
            typeof parsed.specCode === "string"
              ? parsed.specCode.trim()
              : !usePom && typeof parsed.script === "string"
                ? parsed.script.trim()
                : "";
          if (!usePom && !specCode && typeof parsed.script !== "string") {
            throw new Error("Gemini returned an invalid test script.");
          }
          const script =
            usePom && pageObjectCode
              ? `\`\`\`javascript\n// TargetPage.js\n${pageObjectCode}\n\`\`\`\n\n\`\`\`javascript\n// ${framework === "cypress" ? "generated-test.cy.js" : "generated-test.spec.js"}\n${specCode}\n\`\`\``
              : typeof parsed.script === "string"
                ? parsed.script
                : specCode;

          let testData = parsed.testData;
          if (useFixtures) {
            if (typeof testData === "string") {
              try {
                testData = JSON.parse(testData);
              } catch {
                testData = null;
              }
            }

            if (!isPlainObject(testData)) {
              testData = {
                validInputs: {},
                invalidInputs: {},
                boundaryCases: [],
                mockApiResponses: {},
              };
            } else {
              testData = {
                validInputs: isPlainObject(testData.validInputs)
                  ? testData.validInputs
                  : {},
                invalidInputs: isPlainObject(testData.invalidInputs)
                  ? testData.invalidInputs
                  : {},
                boundaryCases: Array.isArray(testData.boundaryCases)
                  ? testData.boundaryCases
                  : [],
                mockApiResponses: isPlainObject(testData.mockApiResponses)
                  ? testData.mockApiResponses
                  : {},
              };
            }
          }

          return Response.json({
            script,
            pageObjectCode,
            specCode,
            scenarios: parsed.scenarios,
            testData: useFixtures ? testData : null,
          });
        }
      } catch (err) {
        lastError = err;
        // Skip busy (503), rate-limited (429), or timed-out models immediately
        if (
          err?.status === 503 ||
          err?.status === 429 ||
          err?.status === 504 ||
          err?.status === 500 ||
          err?.name === "AbortError" ||
          err?.message?.includes("timeout")
        ) {
          console.warn(`Model ${model} unavailable (${err.status || "timeout"}), trying next...`);
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error("All Gemini models are currently busy.");
  } catch (error) {
    console.error("Failed to generate test script:", error);
    return Response.json(
      {
        error:
          error?.status === 503
            ? "Google's servers are currently busy. Please wait a few seconds and try again."
            : error?.message || "Failed to generate test script. Please try again.",
      },
      { status: error?.status === 503 ? 503 : 500 }
    );
  }
}