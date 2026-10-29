// Cuts the packed colour+mask videos from both games into RGBA PNG frames
// the trailer page can draw directly. Run once: node prep.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FF = "C:/Program Files/Live2D Cubism 5.3/tools/ffmpeg/ffmpeg.exe";
const GH = "C:/Users/hanna/Documents/GitHub";
const OUT = join(GH, "llamaplay-trailer/build");

function cut(src, out, { cx, cy, w, h, mx, my, first = 0, count, scale }) {
  if (existsSync(join(out, "0000.png"))) return;
  mkdirSync(out, { recursive: true });
  const range = count ? `select='between(n\\,${first}\\,${first + count - 1})',setpts=N/TB,` : "";
  const sc = scale ? `,scale=${Math.round(w * scale)}:${Math.round(h * scale)}:flags=lanczos` : "";
  const graph = `[0:v]${range}split[a][b];[a]crop=${w}:${h}:${cx}:${cy}[c];`
    + `[b]crop=${w}:${h}:${mx}:${my},format=gray[m];[c][m]alphamerge${sc}[o]`;
  execFileSync(FF, ["-v", "error", "-y", "-i", src, "-filter_complex", graph, "-map", "[o]",
    "-fps_mode", "passthrough", "-start_number", "0", join(out, "%04d.png")]);
  console.log("cut", out);
}

// Symbol atlases: every symbol's idle loop and win clip.
for (const [game, dir] of [["vv", "vincisvices/assets/symbols/video"], ["hoh", "houseofhades/assets/symbols"]]) {
  for (const clip of ["idle", "win"]) {
    const meta = JSON.parse(readFileSync(join(GH, dir, `${clip}.json`), "utf8"));
    for (const s of meta.symbols) {
      const [cx, cy, w, h] = s.colour;
      const [mx, my] = s.mask;
      cut(join(GH, dir, `${clip}.mp4`), join(OUT, game, clip, s.name), { cx, cy, w, h, mx, my });
    }
  }
}

// Leonardo: colour left half, mask right. Idle 0-111, window reaction
// (leonardo_win_8c) 372-495, dance (leonardo_win_9) 496-619.
const leo = join(GH, "vincisvices/assets/character/leonardo/leonardo.mp4");
const LEO = { cx: 0, cy: 0, w: 784, h: 1280, mx: 784, my: 0, scale: 0.75 };
cut(leo, join(OUT, "leo/idle"), { ...LEO, first: 0, count: 112 });
cut(leo, join(OUT, "leo/window"), { ...LEO, first: 372, count: 124 });
cut(leo, join(OUT, "leo/dance"), { ...LEO, first: 496, count: 124 });

// Hades: idle 0-117, fist clip 118-235, energy ball (orb) 236-353.
const hades = join(GH, "houseofhades/assets/character/hades/hades.mp4");
const HADES = { cx: 0, cy: 0, w: 1824, h: 1152, mx: 1824, my: 0, scale: 0.6 };
cut(hades, join(OUT, "hades/idle"), { ...HADES, first: 0, count: 118 });
cut(hades, join(OUT, "hades/fist"), { ...HADES, first: 118, count: 118 });
cut(hades, join(OUT, "hades/orb"), { ...HADES, first: 236, count: 118 });
