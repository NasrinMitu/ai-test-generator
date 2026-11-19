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

    // Fail fast (12s timeout) instead of waiting 5 minutes on a busy 503 model
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { timeout: 12000 },
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

${pomInstructions}`;

    let lastError = null;

    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.2,
            // Gemini 3.x models use thinkingLevel instead of thinkingBudget: 0
            thinkingConfig: {
              thinkingLevel: usePom ? "LOW" : "MINIMAL",
            },
          },
        });

        if (response.text) {
          return Response.json({ script: response.text });
        }
      } catch (err) {
        lastError = err;
        // Skip busy (503), rate-limited (429), or timed-out models immediately
        if (
          err?.status === 503 ||
          err?.status === 429 ||
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