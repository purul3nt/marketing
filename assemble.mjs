// Turns a record.mjs capture into a constant 30 fps 1920x1080 video.
//   node assemble.mjs <rec dir>   ->  <rec dir>/footage.mp4
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FF = "C:/Program Files/Live2D Cubism 5.3/tools/ffmpeg/ffmpeg.exe";
const dir = process.argv[2];
const stamps = JSON.parse(readFileSync(join(dir, "frames.json"), "utf8"));
const lines = ["ffconcat version 1.0"];
stamps.forEach((s, i) => {
  lines.push(`file 'frames/${s.file}'`);
  lines.push(`duration ${((stamps[i + 1]?.t ?? s.t + 1 / 30) - s.t).toFixed(6)}`);
});
lines.push(`file 'frames/${stamps.at(-1).file}'`);
writeFileSync(join(dir, "frames.ffconcat"), lines.join("\n"));
execFileSync(FF, ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "frames.ffconcat"),
  "-vf", "scale=1920:1080:flags=lanczos,fps=30", "-c:v", "h264_mf", "-b:v", "20M", "-pix_fmt", "yuv420p", join(dir, "footage.mp4")], { stdio: "inherit" });
console.log("wrote", join(dir, "footage.mp4"));
