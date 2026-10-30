// Mixes the trailer's audio into out/mix.wav. Each footage run in edit.mjs
// plays the sounds the game itself played over that stretch of its take
// (record.mjs logs them to sfx.json), at the same moments; the music, Hades'
// line and the logo's swoosh are laid on top.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DURATION, RUNS, T, soundSpan } from "./edit.mjs";

const FF = "C:/Program Files/Live2D Cubism 5.3/tools/ffmpeg/ffmpeg.exe";
const GH = "C:/Users/hanna/Documents/GitHub";
const HERE = join(GH, "llamaplay-trailer");
const VV = join(GH, "vincisvices/assets/audio");
const HOH = join(GH, "houseofhades/assets/audio");

// [file, trailer second, volume, extra filter]
const cues = [];

// The games' own sounds, run by run.
for (const run of RUNS) {
  const take = join(HERE, run.take);
  const t0 = JSON.parse(readFileSync(join(take, "frames.json"), "utf8"))[0].t;
  const [from, to] = soundSpan(run);
  for (const e of JSON.parse(readFileSync(join(take, "sfx.json"), "utf8"))) {
    const at = run.at + (e.t - t0 - run.src);
    if (!e.path || at < from || at >= to) continue;
    cues.push([join(GH, run.game, "assets", e.path), at, 1, e.rate === 1 ? "" : `aresample=48000,asetrate=${48000 * e.rate},aresample=48000`]);
  }
}
// Leonardo's "whoopsie" is window-smash-stone, so the first smash plays it
// in place of the glass the game picked.
const smash = cues.find(([file]) => file.endsWith("window-smash-glass.mp3"));
smash[0] = `${VV}/sfx/window-smash-stone.mp3`;
smash[2] = 1.3;

cues.push(
  // Vinci's bonus music, from 3.2 s before its energetic drop (49.38 s), so
  // the drop lands on the smash; out under the swarm.
  [`${VV}/music/bonus.mp3`, 0, 0.9, `atrim=${49.38 - T.smash}:${49.38 - T.smash + T.swap + 0.2},asetpts=PTS-STARTPTS,afade=t=in:d=0.3,afade=t=out:st=${T.swarm}:d=${T.swap - T.swarm + 0.2}`],
  // The Epic Win's call-out, which the game's tier sounds sit under.
  [`${VV}/sfx/big-super-mega-win.mp3`, RUNS.find((r) => r.name === "vv-c").at + 0.3, 0.9],
  // House of Hades' own way from base into the bonus: the swarm's whoosh and
  // "I love the hells" (gameAudio.ts bonusEnterVoice2), together.
  [`${HOH}/sfx/transition-whoosh.mp3`, T.swarm, 1.1],
  [`${HOH}/sfx/base-to-bonus-2.mp3`, T.swarm, 1.5],
  // House of Hades' bonus music from the swap, held under Hades' line.
  [`${HOH}/music/bonus.mp3`, T.swap, 0.9, `atrim=30:${30 + T.outro - T.swap},asetpts=PTS-STARTPTS,afade=t=in:d=0.4,volume='if(lt(t,${(T.swarm + 2 - T.swap).toFixed(2)}),0.45,1)':eval=frame`],
);
const swoosh = `${HOH}/sfx/congrats-swoosh.mp3`;

// Every game sound stops where the Llamaplay logo comes up, then the swoosh.
const inputs = [...cues.flatMap(([file]) => ["-i", file]), "-i", swoosh];
const chains = cues.map(([, at, vol, extra], i) =>
  `[${i}:a]${extra ? extra + "," : ""}aformat=sample_rates=48000:channel_layouts=stereo,volume=${vol},adelay=${Math.round(at * 1000)}:all=1[a${i}]`);
const mixGraph = `${chains.join(";")};${cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cues.length}:normalize=0:dropout_transition=0,`
  + `afade=t=out:st=${T.outro - 0.15}:d=0.15[game];`
  + `[${cues.length}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${Math.round(T.outro * 1000)}:all=1[sw];`
  + `[game][sw]amix=inputs=2:normalize=0:dropout_transition=0,apad,atrim=0:${DURATION}`;

// Two-pass loudness: measure, then one linear gain, so nothing pumps.
const raw = join(HERE, "out/mix-raw.wav");
execFileSync(FF, ["-v", "error", "-y", ...inputs, "-filter_complex", `${mixGraph}[out]`, "-map", "[out]", "-ar", "48000", raw], { stdio: "inherit" });
const probe = spawnSync(FF, ["-hide_banner", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
const m = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf("{")));
const norm = `loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`;
execFileSync(FF, ["-v", "error", "-y", "-i", raw, "-af", `${norm},alimiter=limit=0.89`, "-ar", "48000", join(HERE, "out/mix.wav")], { stdio: "inherit" });
console.log(`wrote out/mix.wav (${cues.length} cues)`);
