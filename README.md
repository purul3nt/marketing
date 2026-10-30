# Marketing

Llamaplay marketing videos.

## Llamaplay trailer (30 s)

The finished cut is [out/llamaplay-trailer.mp4](out/llamaplay-trailer.mp4) (1920x1080, 30 fps, AAC).

- 0 to 13.3 s: Vinci's Vices. A 2,523x base spin: wheels smash both windows (the first with Leonardo's "whoopsie"), Wilds land, and Leonardo dances through the Epic Win.
- 12.6 s: Hades' swarm transition with "I love the hells".
- 13.3 to 27 s: House of Hades free spins. Devil Squad, Wraith Squad's x10, a Mega Win of 9,372.80 and the 16,108.20 Total Win with Hades' energy orb.
- 27 to 30 s: the Llamaplay logo with the congrats swoosh.

All footage is real gameplay recorded from the games' local dev servers, and the game sounds are the ones each game played during its take, at the same moments.

### How it is built

The scripts expect this folder to sit at `Documents/GitHub/llamaplay-trailer`, next to the `houseofhades`, `vincisvices` and `SlotFramework` checkouts.

| Script | What it does |
| --- | --- |
| `record.mjs` | Screencasts a round from a game's dev server into `out/<take>/frames`, and logs the sounds it plays to `sfx.json` |
| `assemble.mjs` | Turns a take's frames into a constant 30 fps `footage.mp4` |
| `edit.mjs` | The edit: which stretch of which take goes where, and the key moments |
| `prep.mjs` | Cuts Leonardo's and Hades' character clips, the symbol atlases and the footage runs into `build/` |
| `trailer.js` / `trailer.html` | Draws each frame of the trailer on a canvas from the footage and clips |
| `mix.mjs` | Mixes each run's logged game sounds, the music and the voice lines into `out/mix.wav` |
| `render.mjs` | Renders every frame in headless Chrome, mixes, and encodes the mp4 |

`node render.mjs` renders the full video. `node render.mjs 3 9.5 12` writes stills at those times to `out/stills`.

The footage frames in `build/` and the raw recordings in `out/` are not committed (several GB).
