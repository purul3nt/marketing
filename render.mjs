// Renders trailer.html frame by frame in headless Edge, then mixes the audio.
//   node render.mjs                 full video -> out/llamaplay-trailer.mp4
//   node render.mjs 2.6 9.4 14.8    stills of those seconds -> out/stills/
import http from "node:http";
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import { DURATION, FPS } from "./edit.mjs";

const ROOT = "C:/Users/hanna/Documents/GitHub";
const HERE = join(ROOT, "llamaplay-trailer");
const OUT = join(HERE, "out");
const FF = "C:/Program Files/Live2D Cubism 5.3/tools/ffmpeg/ffmpeg.exe";
const BROWSER = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".otf": "font/otf", ".woff2": "font/woff2", ".ttf": "font/ttf" };
const server = http.createServer((req, res) => {
  const path = normalize(join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!path.startsWith(normalize(ROOT)) || !existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
  createReadStream(path).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ["--force-device-scale-factor=1"], userDataDir: join(OUT, "profile"), dumpio: false });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
page.on("console", (m) => m.type() === "error" && console.error("page:", m.text()));
await page.goto(`http://localhost:${port}/llamaplay-trailer/trailer.html`);
await page.evaluate(() => window.ready);

const stills = process.argv.slice(2).map(Number);
const shot = async (t, file) => {
  await page.evaluate((v) => window.renderFrame(v), t);
  await page.screenshot({ path: file, type: "png", clip: { x: 0, y: 0, width: 1920, height: 1080 } });
};

if (stills.length) {
  mkdirSync(join(OUT, "stills"), { recursive: true });
  for (const t of stills) await shot(t, join(OUT, "stills", `t${t.toFixed(2)}.png`));
} else {
  const frames = join(OUT, "frames");
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  const n = FPS * DURATION;
  const begin = Date.now();
  for (let i = 0; i < n; i++) {
    await shot(i / FPS, join(frames, `${String(i).padStart(4, "0")}.png`));
    if (i % 60 === 0) console.log(`frame ${i}/${n} ${((Date.now() - begin) / 1000).toFixed(0)}s`);
  }
}
await browser.close();
server.close();

if (!stills.length) {
  execFileSync("node", [join(HERE, "mix.mjs")], { stdio: "inherit" });
  execFileSync(FF, ["-v", "error", "-y", "-framerate", String(FPS), "-i", join(OUT, "frames/%04d.png"), "-i", join(OUT, "mix.wav"),
    "-c:v", "h264_mf", "-b:v", "16M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart",
    join(OUT, "llamaplay-trailer.mp4")], { stdio: "inherit" });
  console.log("wrote", join(OUT, "llamaplay-trailer.mp4"));
}
