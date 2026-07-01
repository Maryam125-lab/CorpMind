import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";

const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9238;
const outDir = "C:/Users/HP/Documents/CorpMind/docs/demo-video-english";
const profileDir = "C:/tmp/corpmind-chrome-profile-english";

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForEndpoint(url, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Chrome is still booting.
    }
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitFor(cdp, expression, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await cdp("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    if (result.result?.value) return;
    await wait(300);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await rm(profileDir, { recursive: true, force: true });

  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${port}`,
      "--window-size=1600,1000",
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    await waitForEndpoint(`http://127.0.0.1:${port}/json/version`);
    const targets = await (await waitForEndpoint(`http://127.0.0.1:${port}/json/list`)).json();
    const pageTarget = targets.find((target) => target.type === "page");
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error("Could not find a Chrome page target for screenshot capture.");
    }
    const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });

    let id = 0;
    const pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      }
    });

    function cdp(method, params = {}) {
      const commandId = ++id;
      socket.send(JSON.stringify({ id: commandId, method, params }));
      return new Promise((resolve, reject) => pending.set(commandId, { resolve, reject }));
    }

    async function evaluate(expression) {
      return cdp("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
    }

    async function clickButton(label) {
      await evaluate(`
        (() => {
          const button = Array.from(document.querySelectorAll('button'))
            .find((item) => item.textContent.trim() === ${JSON.stringify(label)});
          button?.click();
        })()
      `);
      await wait(700);
    }

    async function screenshot(name) {
      const result = await cdp("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });
      await writeFile(`${outDir}/${name}.png`, Buffer.from(result.data, "base64"));
    }

    await cdp("Page.enable");
    await cdp("Runtime.enable");
    await cdp("Page.navigate", { url: "http://127.0.0.1:5173/" });
    await waitFor(cdp, "document.body && document.body.innerText.includes('Command Overview')");
    await wait(1200);
    await screenshot("scene01-overview");

    await clickButton("Documents");
    await waitFor(cdp, "document.body.innerText.includes('Document Center')");
    await screenshot("scene02-documents");

    await evaluate(`
      (() => {
        const button = Array.from(document.querySelectorAll('button'))
          .find((item) => item.textContent.includes('acme-data-policy.md'))
          || Array.from(document.querySelectorAll('button')).find((item) => item.textContent.includes('Acme-Data-Protection-Policy'));
        button?.click();
      })()
    `);
    await wait(900);
    await screenshot("scene03-document-intelligence");

    await clickButton("Ask");
    await waitFor(cdp, "document.body.innerText.includes('RAG Q&A')");
    await evaluate(`
      (() => {
        const risk = Array.from(document.querySelectorAll('button'))
          .find((item) => item.textContent.trim() === 'Risk');
        risk?.click();
        const textarea = document.querySelector('textarea');
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(textarea, 'What are the most important risks, deadlines, and obligations across these documents?');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await wait(800);
    await screenshot("scene04-rag-question");

    await clickButton("Run query");
    await waitFor(cdp, "document.body.innerText.includes('Grounded Answer') && document.querySelectorAll('.citation-card').length > 0", 15000);
    await wait(600);
    await screenshot("scene05-answer-citations");

    await clickButton("Activity");
    await waitFor(cdp, "document.body.innerText.includes('Evidence & History')");
    await wait(600);
    await screenshot("scene06-activity");

    socket.close();
    console.log("Captured 6 English demo scenes.");
  } finally {
    chrome.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
