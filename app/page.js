"use client";

import Link from "next/link";
import JSZip from "jszip";
import { FiAlertTriangle } from "react-icons/fi";
import { LuLogIn, LuSearch, LuShoppingCart } from "react-icons/lu";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

const initialForm = {
  targetUrl: "",
  framework: "playwright",
  usePom: false,
  userStory: "",
};

const EXECUTION_GUIDES = {
  playwright: {
    label: "Playwright",
    steps: [
      { title: "Install Playwright", command: "npm init playwright@latest" },
      { title: "Save your test file", path: "tests/generated-test.spec.js" },
      { title: "Run headless", command: "npx playwright test" },
      { title: "Run Visual UI", command: "npx playwright test --ui" },
    ],
  },
  cypress: {
    label: "Cypress",
    steps: [
      { title: "Install Cypress", command: "npm install cypress --save-dev" },
      { title: "Save your test file", path: "cypress/e2e/generated-test.cy.js" },
      { title: "Run headless", command: "npx cypress run" },
      { title: "Open Runner", command: "npx cypress open" },
    ],
  },
};

const SAMPLE_PRESETS = [
  {
    id: "login",
    label: "Login Flow",
    description: "Sign-in & validation",
    icon: LuLogIn,
    targetUrl: "https://example.com/login",
    userStory:
      "As a registered user, I want to sign in securely so I can access my account.\n\nAcceptance criteria:\n• Enter a valid email and password\n• Submit the login form\n• Show a success state or welcome message\n• Show a clear error for invalid credentials",
  },
  {
    id: "checkout",
    label: "Checkout Validation",
    description: "Cart & purchase",
    icon: LuShoppingCart,
    targetUrl: "https://example.com/checkout",
    userStory:
      "As a shopper, I want to complete checkout so I can purchase the items in my cart.\n\nAcceptance criteria:\n• Review the cart contents and total\n• Enter required shipping and payment details\n• Submit the order\n• Show an order confirmation with an order number",
  },
  {
    id: "search",
    label: "Search Filter",
    description: "Query & results",
    icon: LuSearch,
    targetUrl: "https://example.com/products",
    userStory:
      "As a customer, I want to search and filter products so I can find relevant items quickly.\n\nAcceptance criteria:\n• Enter a search term and submit it\n• Only matching products appear in the results\n• Apply at least one filter and update the results\n• Show an empty state when no products match",
  },
];

function SparkleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="brand-icon"
    >
      <path
        d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z"
        fill="currentColor"
      />
      <path
        d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="empty-icon"
    >
      <path
        d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-11-2 14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function extractJavaScriptCodeBlocks(response) {
  const codeBlocks = [
    ...response.matchAll(/```(?:javascript|js)\s*\r?\n([\s\S]*?)```/gi),
  ]
    .map((match) => match[1].trim())
    .filter(Boolean);

  if (codeBlocks.length > 0) {
    return codeBlocks;
  }

  const plainCode = response
    .trim()
    .replace(/^```(?:javascript|js)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  return plainCode ? [plainCode] : [];
}

export default function Home() {
  const [form, setForm] = useState(initialForm);
  const [notice, setNotice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedScript, setGeneratedScript] = useState("");
  const [generatedOptions, setGeneratedOptions] = useState(null);
  const [pendingPreset, setPendingPreset] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [activePreset, setActivePreset] = useState("");
  const [isExecutionGuideOpen, setIsExecutionGuideOpen] = useState(false);
  const [executionGuideTab, setExecutionGuideTab] = useState("playwright");
  const [commandCopyStatus, setCommandCopyStatus] = useState("");
  const copyTimeoutRef = useRef(null);
  const commandCopyTimeoutRef = useRef(null);
  const presetModalRef = useRef(null);
  const presetCancelRef = useRef(null);

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      if (commandCopyTimeoutRef.current) {
        clearTimeout(commandCopyTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!generatedScript) {
      return;
    }

    function warnBeforeLeaving(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [generatedScript]);

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.hash}`,
      );
    }
  }, []);

  useEffect(() => {
    if (!pendingAction) {
      return;
    }

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    presetCancelRef.current?.focus();

    function handleModalKeyDown(event) {
      if (event.key === "Escape") {
        setPendingAction(null);
        setPendingPreset(null);
        return;
      }

      if (event.key === "Tab") {
        const buttons =
          presetModalRef.current?.querySelectorAll("button:not(:disabled)");
        if (!buttons?.length) {
          return;
        }

        const firstButton = buttons[0];
        const lastButton = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === firstButton) {
          event.preventDefault();
          lastButton.focus();
        } else if (!event.shiftKey && document.activeElement === lastButton) {
          event.preventDefault();
          firstButton.focus();
        }
      }
    }

    document.addEventListener("keydown", handleModalKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleModalKeyDown);
      previousFocus?.focus?.();
    };
  }, [pendingAction]);

  function handleChange(event) {
    const { name, type, value, checked } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: type === "checkbox" ? checked : value,
    }));
    setActivePreset("");
    setNotice("");
  }

  function applyPreset(preset) {
    setForm((currentForm) => ({
      ...currentForm,
      targetUrl: preset.targetUrl,
      userStory: preset.userStory,
    }));
    setActivePreset(preset.id);
    setGeneratedScript("");
    setGeneratedOptions(null);
    setCopyMessage("");
    setIsCopied(false);
    setNotice("");
  }

  function handlePreset(preset) {
    if (generatedScript) {
      setPendingPreset(preset);
      setPendingAction("preset");
      return;
    }

    applyPreset(preset);
  }

  function clearTestSetup() {
    setForm({ ...initialForm });
    setActivePreset("");
    setGeneratedScript("");
    setGeneratedOptions(null);
    setCopyMessage("");
    setIsCopied(false);
    setNotice("");
  }

  function handleReset() {
    if (generatedScript) {
      setPendingPreset(null);
      setPendingAction("reset");
      return;
    }

    clearTestSetup();
  }

  function handleConfirmAction() {
    if (pendingAction === "reset") {
      clearTestSetup();
    } else if (pendingPreset) {
      applyPreset(pendingPreset);
    }

    setPendingAction(null);
    setPendingPreset(null);
  }

  function handleCancelAction() {
    setPendingAction(null);
    setPendingPreset(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsGenerating(true);
    setGeneratedScript("");
    setGeneratedOptions(null);
    setCopyMessage("");
    setIsCopied(false);
    setNotice("");

    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error("The server returned an invalid response. Please try again.");
      }

      if (!response.ok) {
        throw new Error(result.error || "Unable to generate a test script.");
      }

      if (typeof result.script !== "string" || !result.script.trim()) {
        throw new Error("The server returned an empty test script.");
      }

      const codeBlock = result.script.match(
        /^```(?:javascript|js)\s*\n([\s\S]*?)\n```$/i,
      );
      setGeneratedScript(
        form.usePom || !codeBlock ? result.script : codeBlock[1],
      );
      setGeneratedOptions({
        framework: form.framework,
        usePom: form.usePom,
      });
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Something went wrong while generating the test script.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDownload() {
    const outputOptions = generatedOptions ?? form;
    const codeBlocks = extractJavaScriptCodeBlocks(generatedScript);

    try {
      let blob;
      let fileName;

      if (outputOptions.usePom) {
        if (codeBlocks.length < 2) {
          throw new Error(
            "The POM response must contain separate Page Object and test spec code blocks.",
          );
        }

        const zip = new JSZip();
        const pageObjectPath =
          outputOptions.framework === "cypress"
            ? "cypress/support/pages/TargetPage.js"
            : "pages/TargetPage.js";
        zip.file(pageObjectPath, codeBlocks[0]);
        const specPath =
          outputOptions.framework === "playwright"
            ? "tests/generated-test.spec.js"
            : "cypress/e2e/generated-test.cy.js";
        zip.file(specPath, codeBlocks[1]);
        blob = await zip.generateAsync({ type: "blob" });
        fileName =
          outputOptions.framework === "playwright"
            ? "playwright-pom-suite.zip"
            : "cypress-pom-suite.zip";
      } else {
        if (!codeBlocks[0]) {
          throw new Error("The generated response did not contain JavaScript code.");
        }

        blob = new Blob([codeBlocks[0]], {
          type: "text/javascript;charset=utf-8",
        });
        fileName =
          outputOptions.framework === "playwright"
            ? "generated-test.spec.js"
            : "generated-test.cy.js";
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not prepare the generated test download.",
      );
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generatedScript);
      setIsCopied(true);
      setCopyMessage("Copied to clipboard!");
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setIsCopied(false);
        setCopyMessage("");
      }, 2500);
    } catch {
      setIsCopied(false);
      setCopyMessage("Could not copy. Check your browser permissions.");
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopyMessage(""), 3500);
    }
  }

  async function handleCopyCommand(commandId, command) {
    try {
      await navigator.clipboard.writeText(command);
      setCommandCopyStatus(`${commandId}:copied`);
      if (commandCopyTimeoutRef.current) {
        clearTimeout(commandCopyTimeoutRef.current);
      }
      commandCopyTimeoutRef.current = setTimeout(
        () => setCommandCopyStatus(""),
        2500,
      );
    } catch {
      setCommandCopyStatus(`${commandId}:error`);
      if (commandCopyTimeoutRef.current) {
        clearTimeout(commandCopyTimeoutRef.current);
      }
      commandCopyTimeoutRef.current = setTimeout(
        () => setCommandCopyStatus(""),
        3500,
      );
    }
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Testcraft home">
          <span className="brand-mark">
            <SparkleIcon />
          </span>
          <span>testcraft</span>
        </Link>
        <div className="topbar-note">
          <span className="status-dot" />
          AI test workspace
        </div>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">AUTOMATED TESTING, MADE SIMPLE</p>
        <h1 id="page-title">Turn your ideas into tests.</h1>
        <p className="intro-copy">
          Describe what you want to test. We&apos;ll help you shape it into a
          reliable end-to-end test.
        </p>
      </section>

      <section className="preset-section" aria-label="Sample test presets">
        <div className="preset-heading">
          <span>QUICK START</span>
          <p>Choose a preset to fill the form</p>
        </div>
        <div className="preset-list">
          {SAMPLE_PRESETS.map((preset) => {
            const isActive = activePreset === preset.id;
            const PresetIcon = preset.icon;
            return (
              <button
                className={`preset-button${isActive ? " preset-button-active" : ""}`}
                type="button"
                key={preset.id}
                onClick={() => handlePreset(preset)}
                aria-pressed={isActive}
              >
                <span className="preset-icon" aria-hidden="true">
                  <PresetIcon />
                </span>
                <span>
                  <strong>{preset.label}</strong>
                  <small>{preset.description}</small>
                </span>
                {isActive && (
                  <span className="preset-active-indicator" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="workspace" aria-label="Test generator workspace">
        <form className="panel input-panel" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <div>
              <span className="step-label">STEP 01</span>
              <div className="form-heading-title-row">
                <h2>Tell us what to test</h2>
                <button
                  className="reset-button"
                  type="button"
                  onClick={handleReset}
                  aria-label="Reset form and start a new test"
                >
                  Reset
                </button>
              </div>
            </div>
            <span className="required-note">All fields required</span>
          </div>

          <div className="form-fields">
            <div className="field">
              <label htmlFor="targetUrl">Target URL</label>
              <div className="input-wrap">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="field-icon"
                >
                  <circle
                    cx="10"
                    cy="10"
                    r="7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M3.5 10h13M10 3c1.7 1.9 2.5 4.2 2.5 7s-.8 5.1-2.5 7c-1.7-1.9-2.5-4.2-2.5-7S8.3 4.9 10 3Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                </svg>
                <input
                  id="targetUrl"
                  name="targetUrl"
                  type="url"
                  placeholder="https://yourwebsite.com"
                  value={form.targetUrl}
                  onChange={handleChange}
                  required
                />
              </div>
              <span className="field-hint">
                The website you want to run tests against
              </span>
            </div>

            <div className="field">
              <label htmlFor="framework">Testing framework</label>
              <div className="framework-segmented" role="group" aria-label="Testing framework">
                {["playwright", "cypress"].map((framework) => (
                  <button
                    className={`framework-option${form.framework === framework ? " framework-option-active" : ""}`}
                    type="button"
                    key={framework}
                    aria-pressed={form.framework === framework}
                    onClick={() => {
                      setForm((currentForm) => ({ ...currentForm, framework }));
                      setActivePreset("");
                      setNotice("");
                    }}
                  >
                    {framework === "playwright" ? "Playwright" : "Cypress"}
                  </button>
                ))}
              </div>
              <span className="field-hint">
                Choose the framework for your generated script
              </span>
            </div>

            <label className="pom-toggle" htmlFor="usePom">
              <input
                id="usePom"
                name="usePom"
                type="checkbox"
                checked={form.usePom}
                onChange={handleChange}
              />
              <span className="pom-toggle-track" aria-hidden="true">
                <span className="pom-toggle-thumb" />
              </span>
              <span className="pom-toggle-copy">
                <strong>Use Page Object Model (POM)</strong>
                <small>
                  Separates locators &amp; page actions from test assertions
                </small>
              </span>
            </label>

            <div className="field story-field">
              <label htmlFor="userStory">User story &amp; acceptance criteria</label>
              <textarea
                id="userStory"
                name="userStory"
                placeholder={
                  "As a shopper, I want to add items to my cart so I can purchase them later.\n\nAcceptance criteria:\n• I can add an item from its product page\n• The cart count updates"
                }
                value={form.userStory}
                onChange={handleChange}
                required
                rows={7}
              />
              <span className="field-hint">
                Include the steps, expected behavior, and edge cases
              </span>
            </div>
          </div>

          <div className="form-footer">
            <p className="privacy-note">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                className="lock-icon"
              >
                <rect
                  x="3.5"
                  y="7"
                  width="9"
                  height="7"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <path
                  d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
              Your test details stay private
            </p>
            <button
              className="generate-button"
              type="submit"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <span className="button-spinner" aria-hidden="true" />
                  Generating...
                </>
              ) : (
                <>
                  <SparkleIcon />
                  Generate test script
                  <span aria-hidden="true">→</span>
                </>
              )}
            </button>
          </div>
          <p
            className={`form-notice${notice ? " form-notice-error" : ""}`}
            role={notice ? "alert" : "status"}
            aria-live={notice ? "assertive" : "polite"}
          >
            {notice}
          </p>
        </form>

        <section className="panel preview-panel" aria-labelledby="preview-title">
          <div className="panel-heading preview-heading">
            <div>
              <span className="step-label">STEP 02</span>
              <h2 id="preview-title">Your test script</h2>
            </div>
            <span className="language-badge">JS</span>
          </div>

          <div
            className="preview-canvas"
            aria-busy={isGenerating}
            aria-live="polite"
          >
            <div className="code-window">
              <div className="window-bar" aria-hidden="true">
                <span />
                <span />
                <span />
                <div className="window-filename">
                  {(generatedOptions?.framework ?? form.framework) === "cypress"
                    ? "generated-test.cy.js"
                    : "generated-test.spec.js"}
                </div>
              </div>
              {isGenerating ? (
                <div
                  className="loading-state"
                  role="status"
                  aria-label="Generating your test script"
                >
                  <span className="loading-spinner" aria-hidden="true" />
                  <h3>Writing your test script...</h3>
                  <p>Turning your acceptance criteria into test steps.</p>
                  <div className="skeleton-lines" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : generatedScript ? (
                <>
                  <div className="code-toolbar">
                    <span className="code-toolbar-label">JavaScript</span>
                    <div className="code-actions">
                    <button
                      className={`copy-button${isCopied ? " copy-button-copied" : ""}`}
                      type="button"
                      onClick={handleCopy}
                      aria-label={isCopied ? "Test script copied" : "Copy generated test script to clipboard"}
                    >
                      {isCopied ? (
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                          <path
                            d="m4 10 3.5 3.5L16 5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                          <rect
                            x="7"
                            y="6"
                            width="9"
                            height="11"
                            rx="1.5"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                          <path
                            d="M13 6V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v9A1.5 1.5 0 0 0 4.5 15H7"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                      {isCopied ? "Copied!" : "Copy to Clipboard"}
                    </button>
                    <button
                      className="download-button"
                      type="button"
                      onClick={handleDownload}
                      aria-label={
                        (generatedOptions?.usePom ?? form.usePom)
                          ? "Download POM test suite as a ZIP file"
                          : `Download generated ${generatedOptions?.framework ?? form.framework} test file`
                      }
                    >
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                        <path
                          d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 15.5h12"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {(generatedOptions?.usePom ?? form.usePom)
                        ? "Download .zip Suite"
                        : (generatedOptions?.framework ?? form.framework) ===
                            "playwright"
                          ? "Download .spec.js"
                          : "Download .cy.js"}
                    </button>
                    </div>
                  </div>
                  <pre className="generated-code" aria-label="Generated JavaScript">
                    <code>
                      {generatedScript.split("\n").map((line, index) => (
                        <span className="code-line" key={index}>
                          <span className="code-line-number" aria-hidden="true">
                            {index + 1}
                          </span>
                          <span className="code-line-content">{line || " "}</span>
                        </span>
                      ))}
                    </code>
                  </pre>
                </>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon-wrap">
                    <CodeIcon />
                  </span>
                  <h3>Your script will appear here</h3>
                  <p>
                    Add your target URL and user story to get started. Your
                    framework-ready test code will show up in this space.
                  </p>
                  <div className="preview-tags">
                    <span>{form.framework === "playwright" ? "Playwright" : "Cypress"}</span>
                    <span>JavaScript</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="preview-footer">
            <span className="preview-status">
              <span
                className={`preview-pulse${isGenerating ? " preview-pulse-active" : ""}`}
              />
              {isGenerating
                ? "Generating your script..."
                : generatedScript
                  ? "Test script generated"
                  : "Waiting for your test brief"}
            </span>
            {copyMessage && (
              <span
                className={`copy-toast${copyMessage.startsWith("Copied") ? "" : " copy-toast-error"}`}
                role="status"
                aria-live="polite"
              >
                {copyMessage}
              </span>
            )}
          </div>

        </section>
      </section>

      <section className="execution-guide" aria-labelledby="execution-guide-title">
        <button
          className="execution-guide-toggle"
          type="button"
          aria-expanded={isExecutionGuideOpen}
          aria-controls="execution-guide-content"
          onClick={() => setIsExecutionGuideOpen((isOpen) => !isOpen)}
        >
          <span className="execution-guide-toggle-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none">
              <path
                d="M4 5h12M4 10h8M4 15h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="execution-guide-title-wrap">
            <strong id="execution-guide-title">
              Execution Guide: How to Run Your Test
            </strong>
            <small>Setup and run commands for Playwright and Cypress</small>
          </span>
          <svg
            className={`execution-guide-chevron${isExecutionGuideOpen ? " execution-guide-chevron-open" : ""}`}
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              d="m5 7.5 5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div
          className={`execution-guide-collapse${isExecutionGuideOpen ? " execution-guide-collapse-open" : ""}`}
          id="execution-guide-content"
          aria-hidden={!isExecutionGuideOpen}
          inert={!isExecutionGuideOpen}
        >
          <div className="execution-guide-collapse-inner">
            <div className="execution-guide-body">
              <div
                className="execution-guide-tabs"
                role="tablist"
                aria-label="Testing framework instructions"
              >
                {Object.entries(EXECUTION_GUIDES).map(([framework, guide]) => (
                  <button
                    className={`execution-guide-tab${executionGuideTab === framework ? " execution-guide-tab-active" : ""}`}
                    type="button"
                    role="tab"
                    id={`execution-guide-tab-${framework}`}
                    aria-selected={executionGuideTab === framework}
                    aria-controls={`execution-guide-panel-${framework}`}
                    key={framework}
                    onClick={() => setExecutionGuideTab(framework)}
                  >
                    {guide.label}
                  </button>
                ))}
              </div>

              {(generatedOptions?.usePom ?? form.usePom) && (
                <p className="execution-pom-tip">
                  {executionGuideTab === "cypress" ? (
                    <>
                      <strong>POM tip:</strong> Save the Page Object class as{" "}
                      <code>cypress/support/pages/TargetPage.js</code> and the
                      test spec as{" "}
                      <code>cypress/e2e/generated-test.cy.js</code>.
                    </>
                  ) : (
                    <>
                      <strong>POM tip:</strong> Save the Page Object class as{" "}
                      <code>pages/TargetPage.js</code> and the test spec as{" "}
                      <code>tests/generated-test.spec.js</code>.
                    </>
                  )}
                </p>
              )}

              {Object.entries(EXECUTION_GUIDES).map(([framework, guide]) => (
                <div
                  className="execution-guide-panel"
                  role="tabpanel"
                  id={`execution-guide-panel-${framework}`}
                  aria-labelledby={`execution-guide-tab-${framework}`}
                  hidden={executionGuideTab !== framework}
                  key={framework}
                >
                  <ol className="execution-steps">
                    {guide.steps.map((step, index) => {
                      const commandId = `${framework}-${index}`;
                      const statusPrefix = `${commandId}:`;
                      const isCommandCopied =
                        commandCopyStatus === `${statusPrefix}copied`;
                      const hasCommandError =
                        commandCopyStatus === `${statusPrefix}error`;

                      return (
                        <li className="execution-step" key={step.title}>
                          <span className="execution-step-number">
                            {index + 1}
                          </span>
                          <div className="execution-step-content">
                            <span className="execution-step-title">
                              {step.title}
                            </span>
                            {step.command ? (
                              <div className="execution-command">
                                <code>{step.command}</code>
                                <button
                                  className={`execution-command-copy${isCommandCopied ? " execution-command-copy-success" : ""}`}
                                  type="button"
                                  onClick={() =>
                                    handleCopyCommand(commandId, step.command)
                                  }
                                  aria-label={`Copy command: ${step.command}`}
                                >
                                  {isCommandCopied ? "Copied!" : "Copy"}
                                </button>
                                {hasCommandError && (
                                  <span
                                    className="execution-command-error"
                                    role="status"
                                    aria-live="polite"
                                  >
                                    Could not copy
                                  </span>
                                )}
                              </div>
                            ) : (
                              <code className="execution-file-path">
                                {step.path}
                              </code>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="page-footer">
        <span>Built for better testing.</span>
        <span>Describe it. Test it.</span>
      </footer>

      {pendingAction &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="preset-modal-overlay"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              backgroundColor: "rgba(9, 9, 11, 0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                handleCancelAction();
              }
            }}
          >
            <div
              className="preset-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="preset-modal-title"
              aria-describedby="preset-modal-description"
              ref={presetModalRef}
              style={{
                backgroundColor: "#ffffff",
                color: "#18181b",
                width: "100%",
                maxWidth: "440px",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid #e4e4e7",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              }}
            >
              <div
                className="preset-modal-heading"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span
                  className="preset-modal-icon"
                  aria-hidden="true"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "40px",
                    height: "40px",
                    backgroundColor: "#fef3c7",
                    color: "#d97706",
                    borderRadius: "10px",
                    flexShrink: 0,
                  }}
                >
                  <FiAlertTriangle size={20} />
                </span>
                <h2
                  id="preset-modal-title"
                  style={{
                    margin: 0,
                    color: "#18181b",
                    fontSize: "19px",
                    fontWeight: 700,
                    letterSpacing: "-0.45px",
                    lineHeight: 1.3,
                  }}
                >
                  {pendingAction === "reset"
                    ? "Reset current test setup?"
                    : "Replace current test setup?"}
                </h2>
              </div>
              <p
                id="preset-modal-description"
                style={{
                  margin: "18px 0 0",
                  color: "#52525b",
                  fontSize: "14px",
                  lineHeight: 1.65,
                }}
              >
                {pendingAction === "reset"
                  ? "Resetting will clear your current form inputs and generated test script from the editor. Make sure you have copied or downloaded your code first."
                  : "Loading this preset will overwrite your current form inputs and clear the generated test script in the editor. Make sure you have copied or downloaded your code first."}
              </p>
              <div
                className="preset-modal-actions"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "24px",
                }}
              >
                <button
                  className="preset-modal-cancel"
                  type="button"
                  ref={presetCancelRef}
                  onClick={handleCancelAction}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "10px",
                    border: "1px solid #d4d4d8",
                    backgroundColor: "#ffffff",
                    color: "#3f3f46",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  className="preset-modal-confirm"
                  type="button"
                  onClick={handleConfirmAction}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: "#09090b",
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  {pendingAction === "reset"
                    ? "Reset & Clear"
                    : "Continue & Replace"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </main>
  );
}
