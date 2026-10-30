// Records real gameplay footage from a game's local dev server.
//   node record.mjs <out dir> <action> <query> [port] [warm]
// action: "spin" for one base spin, or a buy menu index (1-5) to buy that bonus.
// Plays the splash, starts the round, and screencasts the page until it
// settles. Frames land in <out>/frames with their timestamps in frames.json.
import puppeteer from "puppeteer-core";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [out, action = "4", query = "source=local&case=trailerCombo&min=100000", port = "5181", warm = ""] = process.argv.slice(2);
const URL = `http://localhost:${port}/?${query}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "frames"), { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: false,
  defaultViewport: null,
  userDataDir: "C:/Users/hanna/Documents/GitHub/llamaplay-trailer/out/profile-rec",
  args: ["--window-size=1440,845", "--window-position=0,0", "--autoplay-policy=no-user-gesture-required", "--app=about:blank"],
});
const [page] = await browser.pages();
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.log("page:", m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 300)));
const cdp = await page.createCDPSession();
// A 1440x810 viewport at 4/3 density renders exactly 1920x1080, so the
// screencast needs no scaling and the game draws under half the pixels it
// would at density 2, which keeps its frame rate up while recording.
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 810, deviceScaleFactor: 4 / 3, mobile: false });
// Log every sound the game starts, by the catalog path the game stamps on
// each decoded buffer (gameAudio.ts decorateBuffer), on the same clock as
// the screencast's timestamps, so the trailer can play them in sync.
await page.evaluateOnNewDocument(() => {
  const log = (window.__sfxLog = []);
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (this instanceof AudioBufferSourceNode && dest instanceof GainNode) this.__gain = dest.gain.value;
    return connect.call(this, dest, ...rest);
  };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    const entry = { path: this.buffer?.path, t: Date.now() / 1000, rate: this.playbackRate.value, gain: this.__gain ?? 1, loop: this.loop };
    log.push(entry);
    this.addEventListener("ended", () => { entry.end = Date.now() / 1000; });
    return start.apply(this, args);
  };
});
await page.goto(URL);
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
let begin = Date.now();
const mark = (label) => { console.log(`${((Date.now() - begin) / 1000).toFixed(2)}s ${label}`); };

/** Start the round and run it until it settles, clicking through anything
 *  that asks to continue. */
async function playRound() {
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
}

// "warm" plays one round unrecorded first, so the win screens and character
// clips the game loads on first use do not freeze the recorded round.
if (warm === "warm") {
  console.log("warm-up round");
  await sleep(1500);
  await playRound();
}
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
begin = Date.now();
mark("recording");
await sleep(1500);
await playRound();
mark(`settled, win ${JSON.stringify(await page.evaluate(() => window.__GAME_TEST__?.state?.()))}`);
await cdp.send("Page.stopScreencast");
await sleep(300);
writeFileSync(join(out, "frames.json"), JSON.stringify(stamps));
writeFileSync(join(out, "sfx.json"), JSON.stringify(await page.evaluate(() => window.__sfxLog), null, 1));
console.log(`${stamps.length} frames over ${(stamps.at(-1).t - stamps[0].t).toFixed(1)}s`);
await browser.close();
