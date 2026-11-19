import { GoogleGenAI } from "@google/genai";

// Ordered from fastest, highest-availability models to standard Flash models
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
];

export async function POST(request) {
  try {
    const { targetUrl, framework, userStory, usePom } = await request.json();

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { timeout: 25000 },
    });

    const pomInstructions = usePom
      ? framework === "cypress"
        ? `Use Page Object Model (POM). Output TWO separate JavaScript markdown code blocks:
1. First block: Page Object class for cypress/support/pages/TargetPage.js encapsulating locators and actions.
2. Second block: Test spec for cypress/e2e/generated-test.cy.js importing TargetPage from '../support/pages/TargetPage' and running assertions.`
        : `Use Page Object Model (POM). Output TWO separate JavaScript markdown code blocks:
1. First block: Page Object class for pages/TargetPage.js encapsulating locators and actions.
2. Second block: Test spec for tests/generated-test.spec.js importing TargetPage from '../pages/TargetPage' and running assertions.`
      : `Return only a single, complete test script inside a JavaScript markdown code block.`;

    const prompt = `Generate a clean, production-ready ${framework} end-to-end test script.

Target URL: ${targetUrl}

User story and acceptance criteria:
${userStory}

QA Best Practices:
- Prioritize resilient user-facing locators (getByRole, getByLabel, getByPlaceholder, or data-cy).
- Use auto-waiting web-first assertions; avoid hard-coded sleeps or waitForTimeout.
- Keep code concise without verbose comments.

Return a JSON object with exactly these keys:
- "scenarios": an array of 4 to 6 test cases covering the user story, positive and negative paths, and relevant edge cases. Each item must have "id" (TC-01, TC-02, etc.), "type" (exactly "Positive", "Negative", or "Edge Case"), "title", and "expectedResult".
- "script": the complete generated ${framework} test script as a string, including the requested JavaScript markdown code block(s)${usePom ? " in the Page Object Model structure" : ""}.

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

          return Response.json({
            script: parsed.script,
            scenarios: parsed.scenarios,
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