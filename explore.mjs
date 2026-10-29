// Opens the running game at 1920x1080, waits, screenshots and lists its buttons.
//   node explore.mjs <url> <out.png> [waitMs] [click selector or x,y ...]
import puppeteer from "puppeteer-core";

const [url, out, wait = "8000", ...clicks] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: false,
  defaultViewport: null,
  userDataDir: "C:/Users/hanna/Documents/GitHub/llamaplay-trailer/out/profile-rec",
  args: ["--window-size=1920,1080", "--window-position=0,0", "--autoplay-policy=no-user-gesture-required", "--app=" + url],
});
const [page] = await browser.pages();
await page.setViewport({ width: 1920, height: 1080 });
page.on("console", (m) => ["error", "warn"].includes(m.type()) && console.log("page:", m.text().slice(0, 200)));
await new Promise((r) => setTimeout(r, Number(wait)));
for (const c of clicks) {
  if (/^\d+,\d+$/.test(c)) { const [x, y] = c.split(",").map(Number); await page.mouse.click(x, y); }
  else if (/^wait:\d+$/.test(c)) await new Promise((r) => setTimeout(r, Number(c.slice(5))));
  else await page.click(c).catch((e) => console.log("click failed", c, e.message));
  await new Promise((r) => setTimeout(r, 1500));
}
await page.screenshot({ path: out });
const buttons = await page.evaluate(() => [...document.querySelectorAll("button, [role=button], .wb-btn, [data-action]")]
  .filter((b) => b.offsetParent !== null)
  .map((b) => { const r = b.getBoundingClientRect(); return `${b.tagName}.${[...b.classList].join(".")} id=${b.id} aria=${b.getAttribute("aria-label")} "${b.textContent.trim().slice(0, 30)}" @${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)}`; }));
console.log(buttons.join("\n"));
await browser.close();
