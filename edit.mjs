// The trailer's edit, shared by trailer.js (the pictures), prep.mjs (cutting
// the footage) and mix.mjs (the games' own sounds, from each take's sfx.json).
// Times in seconds.
//
// A run shows its take from `src` onwards, placed at `at` in the trailer and
// held until `until`. A run that starts before the previous one ends
// dissolves in over the overlap, so no cut ever jumps the gameplay.

export const FPS = 30;
export const DURATION = 30;

export const T = {
  // Vinci's Vices: the first window smash (vrec3 5.16 s), where Leonardo's
  // reaction starts.
  smash: 3.21,
  // Hades' swarm takes Vinci's Vices away and brings House of Hades in.
  swarm: 12.6, swap: 13.3,
  outro: 27, end: DURATION,
};

export const RUNS = [
  // Vinci's Vices, the 2,523x base spin recorded with Leonardo hidden (he is
  // drawn from his clips): the spin, three wheels smashing both windows,
  // Wilds, the first multiplied wins.
  { name: "vv-a", game: "vincisvices", take: "out/vrec3", src: 1.95, at: 0, until: 9.26 },
  // Its Epic Win, from the last refill (so its tier sounds at 20.05 s land
  // inside the dissolve) to the held 2,523.20.
  { name: "vv-c", game: "vincisvices", take: "out/vrec3", src: 19.9, at: 8.9, until: T.swap },
  // House of Hades, a 16,108x bonus buy recorded after a warm-up
  // round (record.mjs warm): the first spin's Devil Squad promoting a x5,
  { name: "hoh-a", game: "houseofhades", take: "out/rec3", src: 9.5, at: T.swap, until: 17.6 },
  // Wraith Squad's bolts building a x10,
  { name: "hoh-b", game: "houseofhades", take: "out/rec3", src: 36.8, at: 17.24, until: 19.9 },
  // the Mega Win counting up to 9,372.80,
  { name: "hoh-c", game: "houseofhades", take: "out/rec3", src: 132.2, at: 19.54, until: 22.9 },
  // and the Total Win of 16,108.20 with Hades' energy orb.
  { name: "hoh-d", game: "houseofhades", take: "out/rec3", src: 206.5, at: 22.54, until: T.outro },
];

/** The run before `run`, if it overlaps it (a dissolve). */
export const dissolveFrom = (run) => {
  const prev = RUNS[RUNS.indexOf(run) - 1];
  return prev && prev.game === run.game && run.at < prev.until ? prev : null;
};

/** The trailer seconds whose sounds belong to `run`: from its start until the
 *  next run starts dissolving in. */
export function soundSpan(run) {
  const next = RUNS[RUNS.indexOf(run) + 1];
  return [run.at, next && dissolveFrom(next) ? next.at : run.until];
}
