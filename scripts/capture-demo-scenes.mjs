import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";

const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9237;
const outDir = "C:/Users/HP/Documents/CorpMind/docs/demo-video";
const profileDir = "C:/tmp/corpmind-chrome-profile";

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
    await waitFor(cdp, "document.body && document.body.innerText.includes('CorpMind')");
    await wait(1500);
    await screenshot("scene01-dashboard");

    await evaluate(`
      (() => {
        const input = document.querySelector('input[placeholder="Filter sources"]');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'acme');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await wait(700);
    await screenshot("scene02-source-library");

    await evaluate(`
      (() => {
        const input = document.querySelector('input[placeholder="Filter sources"]');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const button = Array.from(document.querySelectorAll('button'))
          .find((item) => item.textContent.includes('acme-data-policy.md'));
        button?.click();
      })()
    `);
    await wait(1000);
    await screenshot("scene03-document-intelligence");

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
    await wait(700);
    await screenshot("scene04-analysis-modes");

    await evaluate(`
      (() => {
        const ask = Array.from(document.querySelectorAll('button'))
          .find((item) => item.textContent.trim() === 'Ask');
        ask?.click();
      })()
    `);
    await waitFor(cdp, "document.body.innerText.includes('Grounded Answer') && document.querySelectorAll('.citation-card').length > 0", 15000);
    await wait(500);
    await screenshot("scene05-answer-citations");

    await evaluate(`
      (() => {
        const summary = Array.from(document.querySelectorAll('button'))
          .find((item) => item.textContent.includes('Executive summary'));
        summary?.click();
      })()
    `);
    await waitFor(cdp, "document.body.innerText.includes('Grounded Answer') && document.querySelectorAll('.citation-card').length > 0", 15000);
    await wait(800);
    await screenshot("scene06-executive-summary");

    socket.close();
    console.log("Captured 6 demo scenes.");
  } finally {
    chrome.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
