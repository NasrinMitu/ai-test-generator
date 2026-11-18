# AI Test Generator

Generate framework-ready end-to-end tests from a target URL and a user story. Choose Playwright or Cypress, optionally generate a Page Object Model (POM), and export the results for your project.

## Features

- Generate Playwright or Cypress JavaScript test scripts from acceptance criteria.
- Use optional Page Object Model architecture with a separate page class and test spec.
- Download standard scripts as `.spec.js` or `.cy.js` files.
- Export POM suites as ZIP archives with framework-specific test paths.
- Use sample user stories to try common login, checkout, and search scenarios.
- Follow the interactive Execution Guide for setup, file placement, and run commands.
- Copy generated scripts and terminal commands to the clipboard.

## Tech Stack

- [Next.js](https://nextjs.org/) App Router
- React
- Tailwind CSS
- [`@google/genai`](https://www.npmjs.com/package/@google/genai) for Gemini API access
- [`jszip`](https://www.npmjs.com/package/jszip) for POM suite exports

## Local Setup

### Requirements

- Node.js (LTS recommended)
- A Gemini API key with access to a supported Gemini model

### Install and configure

1. Clone the repository and enter the project directory:

   ```bash
   git clone https://github.com/NasrinMitu/ai-test-generator.git
   cd ai-test-generator
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local` and add your Gemini API key:

   ```bash
   cp .env.example .env.local
   ```

   Set `GEMINI_API_KEY` in `.env.local`. Keep this file private; it is excluded from Git.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

## Generate a Test

1. Enter the target URL and describe the user story and acceptance criteria.
2. Select Playwright or Cypress.
3. Optionally enable **Use Page Object Model (POM)**.
4. Select **Generate test script**.
5. Copy the output or download the test file / POM ZIP suite.

The generated tests may need adjustments to match the target application's selectors, test data, and environment configuration.
