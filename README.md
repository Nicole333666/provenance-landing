# provtools.com

The landing page for [Provenance](https://github.com/ProvenanceTools): a single long scroll
built around the logo as a real-time 3D object. The extruded mark faces you as the logo, rounds
out into a working chain, tears itself to show tamper-evidence, and is relit by daylight before
the page closes on signal orange. Between those: two replays of the same file with different
histories, the fairness and privacy design, and a live recorder visitors can type into.

Static site: Vite + TypeScript, no UI framework. `three` for the scene, `gsap` (ScrollTrigger,
SplitText) and `lenis` for scroll. Design spec: `docs/superpowers/specs/2026-10-12-landing-page-design.md`.

## Commands

```sh
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build to dist/
npm run preview      # serve dist/ on :4173
npm test             # vitest: hash chain, verifier, session, link geometry, poses
npm run typecheck
npm run format
```

Dev aids (need the dev server on `:5199`: `npx vite --port 5199`):

```sh
npm run stills                 # re-render the no-WebGL still frames from the live scene
node scripts/og.mjs            # re-render public/img/og.jpg from the real hero
npm run shots -- http://localhost:5199/ 1440 900 d [--reduced] [--nowebgl]
node scripts/tamper-test.mjs   # drives the drag / keyboard / reset tamper flow
node scripts/fallback-test.mjs # the same demo with WebGL disabled
```

`lab.html` renders one keyframe in isolation (`/lab.html?s=0..4&g=0..1`), for tuning the look.
It is not part of the build.

Re-run `npm run stills` and `node scripts/og.mjs` after changing anything in `src/scene/`, so
the fallback frames and the social card match the live scene.

## How it fits together

- **`index.html`** holds all content as static markup. The page is complete without JavaScript.
- **`src/scene/`**: one fixed, transparent WebGL canvas behind the page. A single
  `InstancedMesh` of 44 links; per-link poses for the `pair`, `chain` and `single` forms are
  blended between keyframes (`keyframes.ts`). Each keyframe is **placed by a DOM anchor**
  (`[data-anchor]`, whose height is one link's height), so the 3D follows the CSS layout at every
  viewport size. Lighting is a procedural studio baked into a PMREM environment, plus one
  shadow-casting key light that moves from overhead softbox (night) to low sun (day).
- **`src/timeline/`**: `Acts` turns scroll position into scene state (`state.s` between
  keyframes, chain growth), the ground mix (`--day-pos`, `--signal-top`) and the nav theme.
  Lenis drives smooth scrolling; there are no `window` scroll listeners.
- **`src/record/`**: two deterministic sessions for a fictional assignment (`trails.py`; never a
  real course's solution): an evening of work and a tab-away plus one paste, both rebuilding the
  same file byte for byte (`Replay`). Hash-chained with WebCrypto SHA-256, a verifier that reports
  the first broken event, the self-playing tamper demo, and the in-page `Playground` recorder.
- **`src/sections/`**: entrances, the two-histories replays, the annotated evening, the privacy
  field, and the signal pattern.
- **Logo system**: flat 2D mark in the nav, footer and favicon; the extruded mark (same
  proportions, with depth) wherever it is the hero; round links only where it works as a chain.
  One swept geometry (`link-geometry.ts`) carries both cross-sections as a morph target.

### Fallbacks

- `prefers-reduced-motion`: native scroll, no reveals, the 3D jumps between still acts.
- No WebGL2, a software renderer, Save-Data, or a slow first 2.4 s: still frames rendered from
  the same scene (`public/img/still-*`), placed by the same anchors; the tamper demo becomes a
  button that still edits and re-verifies the chain.

## Facts on the page

Every claim traces to the Provenance PRD, `docs/recorder.md`, `docs/student-faq-short.md`, or the
project owner (2026-10-12): live this semester in CS 61A, CS 61B, CS 61C, CS 10 and DATA C88C for
2,800+ students; three shipped recorders (VS Code, JetBrains, Neovim); open source. The contact
address (`aaryanm@berkeley.edu`) is temporary.

## Deploying

`npm run build` produces a plain static `dist/`. Any static host works. `public/robots.txt` and
`public/sitemap.xml` assume the site is served at `https://provtools.com/`.
