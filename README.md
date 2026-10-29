# Marketing

Llamaplay marketing videos.

## Llamaplay trailer (20 s)

The finished cut is [out/llamaplay-trailer.mp4](out/llamaplay-trailer.mp4) (1920x1080, 30 fps, AAC).

- 0 to 9.1 s: House of Hades bonus round with "I love the hells", ending on a Mega Win.
- 9.1 s: the House of Hades swarm transition.
- 9.1 to 17.3 s: Vinci's Vices. A wheel smashes the window (whoopsie), Leonardo reacts and dances through an Epic Win.
- 17.3 to 20 s: the Llamaplay logo with the congrats swoosh.

All footage is real gameplay recorded from the games' local dev servers, and all audio comes from the games' own music and SFX.

### How it is built

The scripts expect this folder to sit at `Documents/GitHub/llamaplay-trailer`, next to the `houseofhades`, `vincisvices` and `SlotFramework` checkouts.

| Script | What it does |
| --- | --- |
| `record.mjs` | Screencasts a round from a game's dev server into `out/<take>/frames` |
| `assemble.mjs` | Turns a take's frames into a constant 30 fps `footage.mp4` |
| `prep.mjs` | Cuts Leonardo's and Hades' character clips and the symbol atlases into `build/` |
| `trailer.js` / `trailer.html` | Draws each frame of the trailer on a canvas from the footage and clips |
| `mix.mjs` | Mixes the audio into `out/mix.wav` |
| `render.mjs` | Renders all 600 frames in headless Chrome, mixes, and encodes the mp4 |

`node render.mjs` renders the full video. `node render.mjs 3 9.5 12` writes stills at those times to `out/stills`.

The footage frames in `build/` and the raw recordings in `out/` are not committed (several GB).
