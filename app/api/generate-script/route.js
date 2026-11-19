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

function getJavaScriptCodeBlocks(script) {
  return [...script.matchAll(/```(?:javascript|js)\s*([\s\S]*?)```/gi)].map(
    (match) => match[1].trim(),
  );
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
        ? `POM OUTPUT IS REQUIRED. The script field MUST contain exactly TWO separate fenced JavaScript code blocks in this order:
1. Code Block 1 for cypress/support/pages/TargetPage.js: define "export default class TargetPage" and encapsulate all DOM locators and page actions, including visit() and story-specific actions such as fillShippingDetails() or submitOrder().
2. Code Block 2 for cypress/e2e/generated-test.cy.js: import TargetPage from '../support/pages/TargetPage', instantiate it, and call its methods from the Cypress tests.
Keep all DOM selectors and interactions inside TargetPage methods. The it() blocks must contain zero raw cy.get(), cy.contains(), or other DOM selectors; they must only call Page Object methods and make assertions. Do not combine the files or omit either fenced block.`
        : `POM OUTPUT IS REQUIRED. The script field MUST contain exactly TWO separate fenced JavaScript code blocks in this order:
1. Code Block 1 for pages/TargetPage.js: define "export class TargetPage" and encapsulate all DOM locators and page actions, including visit() and story-specific actions such as fillShippingDetails() or submitOrder().
2. Code Block 2 for tests/generated-test.spec.js: import { TargetPage } from '../pages/TargetPage', instantiate it, and call its methods from the Playwright tests.
Keep all DOM selectors and interactions inside TargetPage methods. The test() blocks must contain zero raw page.locator() selectors; they must only call Page Object methods and make assertions. Do not combine the files or omit either fenced block.`
      : `Return only a single, complete test script inside a JavaScript markdown code block.`;

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
- Always navigate to the complete Target URL:
${navigationInstruction}
- Use auto-waiting web-first assertions; avoid hard-coded sleeps or waitForTimeout.
- Keep code concise without verbose comments.
${fixtureInstructions}

Return a JSON object with exactly these keys:
- "scenarios": an array of 4 to 6 test cases covering the user story, positive and negative paths, and relevant edge cases. Each item must have "id" (TC-01, TC-02, etc.), "type" (exactly "Positive", "Negative", or "Edge Case"), "title", and "expectedResult".
- "script": the complete generated ${framework} test script as a string, including the requested JavaScript markdown code block(s)${usePom ? ". When usePom is true, include TWO fenced code blocks: first the TargetPage class, second the test spec importing TargetPage." : ""}.
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
            typeof parsed.script !== "string" ||
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

          if (usePom) {
            const codeBlocks = getJavaScriptCodeBlocks(parsed.script);
            const [pageObject, spec] = codeBlocks;
            const hasExpectedPageObject =
              framework === "cypress"
                ? /\bexport\s+default\s+class\s+TargetPage\b/.test(pageObject ?? "")
                : /\bexport\s+class\s+TargetPage\b/.test(pageObject ?? "");
            const hasExpectedImport =
              framework === "cypress"
                ? /import\s+TargetPage\s+from\s+['"]\.\.\/support\/pages\/TargetPage['"]/.test(
                    spec ?? "",
                  )
                : /import\s+\{\s*TargetPage\s*\}\s+from\s+['"]\.\.\/pages\/TargetPage['"]/.test(
                    spec ?? "",
                  );

            if (
              codeBlocks.length !== 2 ||
              !pageObject ||
              !spec ||
              !hasExpectedPageObject ||
              !hasExpectedImport
            ) {
              throw new Error(
                "Gemini returned an incomplete POM suite. The response must contain a TargetPage class block followed by a spec block that imports it.",
              );
            }
          }

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
            script: parsed.script,
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