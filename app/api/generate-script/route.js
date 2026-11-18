import { GoogleGenAI } from "@google/genai";

// Models ordered from primary to lightweight high-availability fallbacks
const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
];

export async function POST(request) {
  try {
    const { targetUrl, framework, userStory, usePom } = await request.json();
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const outputInstructions = usePom === true
      ? `Return exactly two clearly labeled JavaScript sections, each in its own markdown \`\`\`javascript code block, with no other prose:

1. Section 1: Page Object Class — use the appropriate path \`pages/TargetPage.js\`. Encapsulate resilient user-facing locators (Playwright: prefer getByRole/getByLabel; Cypress: use data-cy attributes where available) and provide atomic methods for user actions. Do not put assertions in the Page Object.
2. Section 2: Test Spec File — use \`tests/generated-test.spec.js\` for Playwright or \`cypress/e2e/generated-test.cy.js\` for Cypress. Import and instantiate the Page Object, call its action methods, and include meaningful test assertions in the spec.

Ensure the code is valid JavaScript for the selected framework and that imports and APIs match that framework.`
      : "Return only the test script inside a JavaScript markdown code block.";
    const prompt = `Generate a ${framework} end-to-end test for the application at the target URL below.

${usePom === true ? "Use a modular Page Object Model architecture." : "Use clean inline test blocks."}

Target URL: ${targetUrl}

User story and acceptance criteria:
${userStory}

${outputInstructions}`;

    let lastError = null;

    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        if (response.text) {
          return Response.json({ script: response.text });
        }
      } catch (err) {
        lastError = err;
        // If 503 (high demand) or 429 (rate limit), try the next model
        if (err?.status === 503 || err?.status === 429) {
          console.warn(`Model ${model} busy (${err.status}), trying fallback...`);
          continue;
        }
        // For any other error (e.g. bad request), stop immediately
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
            ? "Google's servers are currently busy across all models. Please wait 10 seconds and click Generate again."
            : "Failed to generate test script. Please try again.",
      },
      { status: error?.status === 503 ? 503 : 500 },
    );
  }
}