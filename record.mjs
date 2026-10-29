// Records real gameplay footage from a game's local dev server.
//   node record.mjs <out dir> <action> <query> [port]
// action: "spin" for one base spin, or a buy menu index (1-5) to buy that bonus.
// Plays the splash, starts the round, and screencasts the page until it
// settles. Frames land in <out>/frames with their timestamps in frames.json.
import puppeteer from "puppeteer-core";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [out, action = "4", query = "source=local&case=trailerCombo&min=100000", port = "5181"] = process.argv.slice(2);
const URL = `http://localhost:${port}/?${query}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "frames"), { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: false,
  defaultViewport: null,
  userDataDir: "C:/Users/hanna/Documents/GitHub/llamaplay-trailer/out/profile-rec",
  args: ["--window-size=1440,845", "--window-position=0,0", "--autoplay-policy=no-user-gesture-required", "--app=" + URL],
});
const [page] = await browser.pages();
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.log("page:", m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 300)));
const cdp = await page.createCDPSession();
// Make the viewport exactly 16:9.
const { windowId } = await cdp.send("Browser.getWindowForTarget");
for (let i = 0; i < 3; i++) {
  const inner = await page.evaluate(() => [innerWidth, innerHeight]);
  if (inner[0] === 1440 && inner[1] === 810) break;
  const { bounds } = await cdp.send("Browser.getWindowBounds", { windowId });
  await cdp.send("Browser.setWindowBounds", { windowId, bounds: { width: bounds.width + 1440 - inner[0], height: bounds.height + 810 - inner[1] } });
  await sleep(500);
}
console.log("viewport", await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]));

await sleep(9000);
await page.mouse.click(720, 720); // the splash's "click to continue"
await sleep(3500);

const stamps = [];
let n = 0;
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const file = `${String(n++).padStart(6, "0")}.jpg`;
  writeFileSync(join(out, "frames", file), Buffer.from(data, "base64"));
  stamps.push({ file, t: metadata.timestamp });
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
const begin = Date.now();
const mark = (label) => { console.log(`${((Date.now() - begin) / 1000).toFixed(2)}s ${label}`); };
mark("recording");
await sleep(1500);

if (action === "spin") {
  await page.click(".wb-spin");
  mark("spun");
} else {
  await page.click(".wb-buy");
  await sleep(1500);
  const buys = await page.$$(".wb-modal-buy");
  await buys[Number(action)].click();
  await sleep(1200);
  await page.click(".wb-confirm-yes");
  mark("bought");
}

// Run until the round settles, clicking through anything that asks to continue.
let wasBusy = false;
let idleSince = 0;
while (Date.now() - begin < 480000) {
  await sleep(500);
  const s = await page.evaluate(() => window.__GAME_TEST__?.state?.()).catch(() => null);
  if (s?.busy) { wasBusy = true; idleSince = 0; }
  else if (wasBusy) {
    idleSince ||= Date.now();
    if (Date.now() - idleSince > 4000) break;
  }
}
mark(`settled, win ${JSON.stringify(await page.evaluate(() => window.__GAME_TEST__?.state?.()))}`);
await cdp.send("Page.stopScreencast");
await sleep(300);
writeFileSync(join(out, "frames.json"), JSON.stringify(stamps));
console.log(`${stamps.length} frames over ${(stamps.at(-1).t - stamps[0].t).toFixed(1)}s`);
await browser.close();
