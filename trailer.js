// Llamaplay 30 s trailer: a Vinci's Vices base spin, Hades' swarm transition,
// House of Hades free spins (both real footage, cut as edit.mjs lists),
// Llamaplay logo. Every frame is a pure function of t (seconds), so
// render.mjs can step it frame by frame.
import { FPS, RUNS, T, dissolveFrom } from "./edit.mjs";

const W = 1920;
const H = 1080;
const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
const VV = "/vincisvices/assets/";
const B = "/llamaplay-trailer/build/";
const DL = "/llamaplay-trailer/media/";

// --- helpers -------------------------------------------------------------------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const outBack = (k) => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const smooth = (k) => { const c = clamp(k); return c * c * (3 - 2 * c); };
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- images: loaded on demand, the frame redraws once they are in ---------------
const cache = new Map();
const missing = new Set();
let renderId = 0;
function img(path) {
  const e = cache.get(path);
  if (e) { e.used = renderId; return e.img; }
  missing.add(path);
  return null;
}
function load(path) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => { cache.set(path, { img: im, used: renderId }); resolve(); };
    im.onerror = () => { console.error("missing " + path); cache.set(path, { img: null, used: renderId }); resolve(); };
    im.src = path;
  });
}
const frame = (dir, i) => `${B}${dir}/${String(i).padStart(4, "0")}.png`;
/** A clip's frame at clip time `ct` (24 fps), held on its last frame or looped. */
const clipAt = (dir, count, ct, loop = false) => {
  const i = Math.floor(Math.max(0, ct) * 24);
  return frame(dir, loop ? i % count : Math.min(count - 1, i));
};

function draw(im, x, y, w, h, alpha = 1) {
  if (!im || alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(im, x, y, w, h);
  ctx.globalAlpha = 1;
}
function shade(alpha, color = "0,0,0") {
  if (alpha <= 0) return;
  ctx.fillStyle = `rgba(${color},${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

// --- footage: the runs in edit.mjs, each dissolving into the next ---------------------
const runFrame = (run, t) => `${B}${run.name}/${String(Math.max(0, Math.floor((t - run.at) * FPS))).padStart(4, "0")}.jpg`;
function drawFootage(t, game) {
  for (const run of RUNS) {
    if (run.game !== game || t < run.at || t >= run.until) continue;
    const from = dissolveFrom(run);
    const k = from ? smooth(seg(t, run.at, from.until)) : 1;
    draw(img(runFrame(run, t)), 0, 0, W, H, k);
    // A soft bloom through the dissolve's middle hides the change of shot.
    if (k < 1) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      shade(0.22 * Math.sin(Math.PI * k), "255,240,220");
      ctx.restore();
    }
  }
}

// --- Vinci's Vices -------------------------------------------------------------------------
// The take has Leonardo hidden: the game's video jumps him to his standing
// pose whenever a reaction cuts into his idle. Here his real clips play where
// the game stands him, and as each clip begins and ends on that pose he only
// changes clip at a clip's end: the idle is phased to finish on the smash,
// the broken-window reaction (leonardo_win_8c) plays whole, then his dance
// (leonardo_win_9) loops through the Epic Win. A three-frame blend covers
// what the generated clips differ by at the joins.
const PLATE_K = W / 1536;
const LEO_K = (748 * 0.838 * PLATE_K) / 960;
const LEO = { w: 588 * LEO_K, h: 960 * LEO_K, feetX: (224 / 458) * 588 * LEO_K, feetY: (730 / 748) * 960 * LEO_K, x: 183 * PLATE_K, y: 770 * PLATE_K };
const LEO_CLIPS = { idle: 112, window: 124, dance: 124 };
const LEO_PLAN = [["idle", T.smash - 112 / 24], ["window", T.smash], ["dance", T.smash + 124 / 24]];
const LEO_BLEND = 3 / 24;
function leoFrame(k, t) {
  const [dir, at] = LEO_PLAN[k];
  const n = LEO_CLIPS[dir];
  const i = Math.floor((t - at) * 24);
  return frame(`leo/${dir}`, ((i % n) + n) % n);
}
function drawLeo(t) {
  let k = LEO_PLAN.length - 1;
  while (k > 0 && t < LEO_PLAN[k][1]) k--;
  const box = [LEO.x - LEO.feetX, LEO.y - LEO.feetY, LEO.w, LEO.h];
  const since = t - LEO_PLAN[k][1];
  if (k > 0 && since < LEO_BLEND) {
    const [dir] = LEO_PLAN[k - 1];
    draw(img(frame(`leo/${dir}`, LEO_CLIPS[dir] - 1)), ...box);
    draw(img(leoFrame(k, t)), ...box, since / LEO_BLEND);
  } else draw(img(leoFrame(k, t)), ...box);
}

function drawVinci(t) {
  drawFootage(t, "vincisvices");
  drawLeo(t);
}

// --- Hades' swarm transition (houseofhades/src/game/swarmTransition.ts) -------------
// Ported as is, with its Math.random seeded and its clock driven by t.
const SW = (() => {
  const BEATS = { enter: 0.05, release: 0.7, clear: 0.78, end: 1.5 };
  const DIR = { x: -0.866, y: -0.5 };
  const HEADING = Math.atan2(DIR.y, DIR.x) - Math.PI;
  const skull = (ty, my) =>
    `M-36 4C-40-22-22-38-2-36C14-35 24-26 28-16C42-14 54 ${-18 + my} 74 ${-10 + ty}C58 ${-2 + my} 42 6 26 8`
    + "C20 12 10 14 0 14L-4 22C-12 26-24 26-30 21L-28 13L-36 12Z"
    + "M-16-14A8 9 0 1 0-32-14A8 9 0 1 0-16-14Z";
  const ghoul = (dy) =>
    `M-38-16L-44-24L-36-30C-32-40-22-42-16-38L-12-54L-6-36C4-32 14-28 24-22C40-18 56-22 78 ${-26 + dy}`
    + `L58-14L82 ${-6 + dy * 0.6}L56-2L72 ${12 - dy * 0.8}C50 10 30 12 16 8C4 6-10 2-18-4C-26-8-32-10-38-16Z`;
  const ARMS = [
    "M-10-16L-32-18L-46-26L-42-18L-56-18L-44-12L-54-6L-40-8L-28-8L-8-6Z",
    "M-10-14L-30-6L-46-8L-40-2L-52 4L-40 4L-46 12L-34 6L-24 0L-6-4Z",
    "M-10-12L-24 2L-32 16L-26 14L-32 26L-24 18L-22 28L-18 16L-14 4L-2-4Z",
  ];
  const shift = (d, dx, dy) => { let i = 0; return d.replace(/-?\d+(\.\d+)?/g, (n) => String(Number(n) + (i++ % 2 ? dy : dx))); };
  const kind = [
    { poses: [[-10, 4], [0, 0], [10, -4]].map(([ty, my]) => [new Path2D(skull(ty, my))]), rule: "evenodd" },
    { poses: [-6, 0, 6].map((dy, k) => [new Path2D(shift(ARMS[(k + 1) % 3], 10, -2)), new Path2D(ghoul(dy)), new Path2D(ARMS[k])]), rule: "nonzero" },
  ];
  const CYCLE = [0, 1, 2, 1];
  const random = rng(1337);
  const rand = (a, b) => a + random() * (b - a);
  const w = W, h = H, min = Math.min(w, h);
  const cx = w / 2, cy = h / 2, nx = -DIR.y, ny = DIR.x;
  const sExt = (w / 2) * Math.abs(DIR.x) + (h / 2) * Math.abs(DIR.y);
  const uExt = (w / 2) * Math.abs(nx) + (h / 2) * Math.abs(ny);
  const rag = 0.07 * min, big = 0.3 * min, far = sExt + rag + big * 1.8;
  const seed = Array.from({ length: 4 }, () => random() * Math.PI * 2);
  const crowd = (count, small, large, offMin, offMax) =>
    Array.from({ length: count }, (_, i) => ({
      kind: random() < 0.5 ? 0 : 1, size: rand(small, large) * min, off: rand(offMin, offMax),
      u: (((i + random()) / count) * 2 - 1) * (uExt + big * 0.5), phase: Math.floor(random() * CYCLE.length),
      bob: random() * Math.PI * 2, tilt: rand(-0.25, 0.25),
    }));
  const leaders = [...crowd(20, 0.14, 0.3, -0.5, 0.3), ...crowd(6, 0.08, 0.16, 0.4, 1.4)];
  const stragglers = [...crowd(20, 0.14, 0.3, -0.5, 0.3), ...crowd(6, 0.08, 0.16, 0.4, 1.4)];
  const inside = crowd(28, 0.1, 0.26, -1, 1);
  const huge = 0.65 * Math.max(w, h);
  const giants = [
    { kind: 1, size: huge, u: -0.3 * uExt, at: BEATS.release - 0.05, dur: 0.5 },
    { kind: 0, size: huge * 0.85, u: 0.35 * uExt, at: BEATS.release + 0.12, dur: 0.5 },
  ];
  const lead = (t) => -far + 2 * far * smooth((t - BEATS.enter) / (BEATS.release - BEATS.enter));
  const trail = (t) => -far + 2 * far * smooth((t - BEATS.clear) / (BEATS.end - BEATS.clear));
  const steps = 24, across = uExt + rag * 2;
  const ragAt = (u, boil, k) => 0.5 + 0.3 * Math.sin((u / min) * 9 + seed[k] + boil * 5) + 0.2 * Math.sin((u / min) * 23 + seed[k + 2] - boil * 7);
  const band = (front, back, boil) => {
    const path = new Path2D();
    for (let i = 0; i <= steps; i++) {
      const u = -across + (2 * across * i) / steps;
      const s = front + rag * ragAt(u, boil, 0);
      const x = cx + DIR.x * s + nx * u, y = cy + DIR.y * s + ny * u;
      if (i) path.lineTo(x, y); else path.moveTo(x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const u = -across + (2 * across * i) / steps;
      const s = back - rag * ragAt(u, boil, 1);
      path.lineTo(cx + DIR.x * s + nx * u, cy + DIR.y * s + ny * u);
    }
    path.closePath();
    return path;
  };
  const fig = (k, size, s, u, tilt, pose) => {
    const shape = kind[k];
    const scale = size / 120, a = HEADING + tilt;
    const cos = Math.cos(a) * scale, sin = Math.sin(a) * scale;
    ctx.setTransform(cos, sin, -sin, cos, cx + DIR.x * s + nx * u, cy + DIR.y * s + ny * u);
    for (const path of shape.poses[CYCLE[pose % CYCLE.length]]) ctx.fill(path, shape.rule);
  };
  const flock = (list, t, tick, at) => {
    for (const f of list) fig(f.kind, f.size, at(f), f.u + Math.sin(t * 5 + f.bob) * 0.02 * min, f.tilt + 0.08 * Math.sin(t * 7 + f.bob), tick + f.phase);
  };
  return (t) => {
    if (t < 0 || t > BEATS.end) return;
    const tick = Math.floor(t * 12), boil = tick / 12;
    const released = t >= BEATS.release;
    ctx.save();
    const dim = released ? 0.35 * (1 - clamp((t - BEATS.release) / 0.3)) : 0.35 * smooth(t / BEATS.release);
    if (dim > 0) { ctx.fillStyle = `rgba(0,0,0,${dim.toFixed(3)})`; ctx.fillRect(0, 0, w, h); }
    const front = lead(t), back = trail(t), mass = band(front, back, boil);
    ctx.fillStyle = "#07110d";
    ctx.fill(mass);
    ctx.fillStyle = "#000000";
    ctx.save();
    ctx.clip(mass);
    const through = (2 * far) / (BEATS.end - BEATS.enter);
    flock(inside, t, tick, (f) => -far + (t - BEATS.enter) * through * 1.2 + f.off * sExt);
    ctx.restore();
    flock(leaders, t, tick, (f) => front + f.off * big);
    flock(stragglers, t, tick, (f) => back - f.off * big);
    for (const g of giants) {
      const u = clamp((t - g.at + g.dur / 2) / g.dur);
      if (u <= 0 || u >= 1) continue;
      const reach = sExt + g.size * 0.75;
      fig(g.kind, g.size, -reach + 2 * reach * u, g.u, 0, tick);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();
  };
})();

// --- House of Hades ------------------------------------------------------------------------
function drawHades(t) {
  drawFootage(t, "houseofhades");
  shade(seg(t, T.outro - 0.2, T.outro));
}

// --- the Llamaplay outro -----------------------------------------------------------------
function drawOutro(t) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const logo = img(DL + "llamaplaylogo2.jpg");
  if (!logo) return;
  const k = seg(t, T.outro + 0.1, T.outro + 0.7);
  const s = 760 * lerp(0.82, 1, outBack(k)) * (1 + 0.012 * (t - T.outro));
  const x = W / 2 - s / 2;
  const y = H / 2 - s / 2;
  draw(logo, x, y, s, s, smooth(k * 1.4));
  // A flash on arrival, then a light sweep across the bright parts only.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  draw(logo, x, y, s, s, 0.6 * (1 - seg(t, T.outro + 0.55, T.outro + 1.0)) * (k > 0.6 ? 1 : 0));
  const sw = seg(t, T.outro + 1.1, T.outro + 1.9);
  if (sw > 0 && sw < 1) {
    const bx = lerp(x - 300, x + s + 300, sw);
    ctx.beginPath();
    ctx.moveTo(bx - 120, y);
    ctx.lineTo(bx + 40, y);
    ctx.lineTo(bx - 160, y + s);
    ctx.lineTo(bx - 320, y + s);
    ctx.closePath();
    ctx.clip();
    draw(logo, x, y, s, s, 0.9);
  }
  ctx.restore();
}

// --- frame -------------------------------------------------------------------------------
function drawFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  if (t < T.swap) drawVinci(t);
  else if (t < T.outro) drawHades(t);
  else drawOutro(t);
  SW(t - T.swarm);
}

window.renderFrame = async (t) => {
  renderId++;
  for (let pass = 0; pass < 5; pass++) {
    missing.clear();
    drawFrame(t);
    if (!missing.size) break;
    await Promise.all([...missing].map(load));
  }
  for (const [path, e] of cache) if (path.startsWith(B) && e.used < renderId - 30) cache.delete(path);
};

window.ready = Promise.resolve();

// Preview: trailer.html?t=3.2 shows one frame, ?play plays it in real time.
(async () => {
  await window.ready;
  const q = new URLSearchParams(location.search);
  const ui = document.getElementById("ui");
  if (q.has("play")) {
    const begin = performance.now();
    const tick = async () => {
      const t = ((performance.now() - begin) / 1000) % T.end;
      await window.renderFrame(t);
      ui.textContent = t.toFixed(2);
      requestAnimationFrame(tick);
    };
    tick();
  } else if (q.has("t")) {
    await window.renderFrame(Number(q.get("t")));
    ui.textContent = q.get("t");
  }
})();
