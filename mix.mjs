// Mixes the trailer's audio from the two games' own music and SFX into
// out/mix.wav (20 s). Times match trailer.js.
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";

const FF = "C:/Program Files/Live2D Cubism 5.3/tools/ffmpeg/ffmpeg.exe";
const GH = "C:/Users/hanna/Documents/GitHub";
const HERE = join(GH, "llamaplay-trailer");
const VV = join(GH, "vincisvices/assets/audio");
const HOH = join(GH, "houseofhades/assets/audio");
/** Where the Llamaplay logo comes up: every game sound stops here. */
const LOGO = 17.3;

/** Where Vinci's Vices starts, after House of Hades and the swarm (trailer.js T.swap). */
const VV_AT = 9.1;
const vv = (cues) => cues.map(([file, at, ...rest]) => [file, VV_AT + at, ...rest]);

// [file, start s, volume, extra filter]
const cues = [
  // House of Hades' bonus music, held under Hades' line until it ends.
  [`${HOH}/music/bonus.mp3`, 0, 1, "atrim=30:39.6,asetpts=PTS-STARTPTS,afade=t=in:d=0.3,volume='if(lt(t,2.2),0.5,0.95)':eval=frame,afade=t=out:st=8.5:d=0.7"],
  // "I love the hells": HoH plays it on the way from base into the bonus
  // (gameAudio.ts bonusEnterVoice2). Nothing else lands on it before 1.9 s.
  [`${HOH}/sfx/base-to-bonus-2.mp3`, 0.25, 1.4],
  // The footage's beats (trailer.js drawHades): devil squad 0, skeleton
  // fights 1.5, ghoul clones 3.2, Big / Super / Mega Win 5.1, 5.6, 7.1.
  [`${HOH}/sfx/demon-win.mp3`, 0.5, 0.4],
  [`${HOH}/sfx/sword-clash-1.mp3`, 1.9, 0.9],
  [`${HOH}/sfx/sword-clash-2.mp3`, 2.4, 0.9],
  [`${HOH}/sfx/ghoul-win.mp3`, 3.25, 0.8],
  [`${HOH}/sfx/multiplier-upgrade.mp3`, 4.65, 0.9],
  [`${HOH}/sfx/huge-win.mp3`, 5.1, 1],
  [`${HOH}/sfx/tier-gong.mp3`, 5.6, 0.8],
  [`${HOH}/sfx/tier-gong.mp3`, 7.1, 0.9],
  [`${HOH}/sfx/transition-whoosh.mp3`, 8.4, 1.1, "atrim=0:1.2,afade=t=out:st=0.8:d=0.4"],
  ...vv([
    // Vinci's bonus music, starting 3.2 s before its energetic drop (49.38 s)
    // so the drop lands on the cut into the wins.
    [`${VV}/music/bonus.mp3`, 0, 0.8, "atrim=46.18:55.08,asetpts=PTS-STARTPTS,afade=t=in:d=0.3,afade=t=out:st=7.6:d=0.7"],
    // The footage's beats (trailer.js drawVinci): a wheel rolls the top row from
    // 0.55 s and smashes the left window at 1.7 s, a second rolls from 2.6 s,
    // the multiplied wins from 3.2 s, Epic Win pops at 5.07 s and lands at 7.4 s.
    [`${VV}/sfx/wheel-roll.mp3`, 0.55, 1],
    ...[0.65, 0.8, 0.95, 1.1, 1.25, 1.4].map((t) => [`${VV}/sfx/multiplier-drop.mp3`, t, 0.55]),
    // The window smash with Leonardo's whoopsie.
    [`${VV}/sfx/window-smash-stone.mp3`, 1.7, 1.1],
    [`${VV}/sfx/wheel-roll.mp3`, 2.6, 0.9],
    ...[2.75, 2.9, 3.05].map((t) => [`${VV}/sfx/multiplier-drop.mp3`, t, 0.5]),
    [`${VV}/sfx/wild-win.mp3`, 3.22, 0.9],
    [`${VV}/sfx/pulse-multiplier.mp3`, 3.3, 0.7],
    [`${VV}/sfx/tier-riser.mp3`, 4.55, 0.8],
    [`${VV}/sfx/big-super-mega-win.mp3`, 5.05, 1],
    [`${VV}/sfx/tier-gong.mp3`, 5.07, 0.8],
    [`${VV}/sfx/count-end.mp3`, 7.4, 0.9],
  ]),
];
const swoosh = `${HOH}/sfx/congrats-swoosh.mp3`;

const inputs = [...cues.flatMap(([file]) => ["-i", file]), "-i", swoosh];
const chains = cues.map(([, at, vol, extra], i) =>
  `[${i}:a]${extra ? extra + "," : ""}aformat=sample_rates=48000:channel_layouts=stereo,volume=${vol},adelay=${Math.round(at * 1000)}:all=1[a${i}]`);
const mixGraph = `${chains.join(";")};${cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cues.length}:normalize=0:dropout_transition=0,`
  + `afade=t=out:st=${LOGO - 0.08}:d=0.08[game];`
  + `[${cues.length}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${Math.round(LOGO * 1000)}:all=1[sw];`
  + "[game][sw]amix=inputs=2:normalize=0:dropout_transition=0,apad,atrim=0:20";

// Two-pass loudness: measure, then one linear gain, so nothing pumps.
const raw = join(HERE, "out/mix-raw.wav");
execFileSync(FF, ["-v", "error", "-y", ...inputs, "-filter_complex", `${mixGraph}[out]`, "-map", "[out]", "-ar", "48000", raw], { stdio: "inherit" });
const probe = spawnSync(FF, ["-hide_banner", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
const m = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf("{")));
const norm = `loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`;
execFileSync(FF, ["-v", "error", "-y", "-i", raw, "-af", `${norm},alimiter=limit=0.89`, "-ar", "48000", join(HERE, "out/mix.wav")], { stdio: "inherit" });
console.log("wrote out/mix.wav");
