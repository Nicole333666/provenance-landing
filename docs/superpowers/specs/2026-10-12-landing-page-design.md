# provtools.com landing page: design spec

Date: 2026-10-12
Status: draft for review
Repo: `provenance-landing` (standalone; no code shared with the `provenance` monorepo)

## 1. Intent

A single long-scroll landing page for Provenance at **provtools.com**, the public front door of the
ProvenanceTools GitHub org. It must look like the work of a top design studio, not a template, and
it must explain Provenance accurately: what it is, why it exists, how it works, why it is fair, and
how to adopt it.

### Audience (in priority order)

1. **Instructors and departments** at other schools deciding whether to adopt. They get the
   mechanism, the fairness argument, proof of scale, and a contact path.
2. **Students** who arrive from install links. They get an honest, specific account of what is and
   is not recorded, and the argument that the record protects them.
3. **The curious** (press, researchers, people on X). The page itself is the pitch.

### Success criteria

- A faculty visitor can say, after one scroll, what Provenance records, why it is tamper-evident,
  why it is not an AI detector, and how to get in touch.
- A student visitor can find the exact recorded / never-recorded lists in one click from the nav.
- Every factual claim traces to the PRD, `docs/recorder.md`, `docs/student-faq-short.md`, or a
  statement from the project owner in this conversation. No invented numbers.
- Visual quality: the 3D object reads as the same object as the Cycles wallpaper renders (satin
  glaze, single motivated light, real over/under weave).
- Performance: LCP < 2.5 s on a mid-range laptop over fast 4G, CLS < 0.1, scroll at 60 fps on an
  M-series MacBook, usable at 30 fps on a mid-range phone.

### Facts the page may state (confirmed by the owner, 2026-10-12)

- Live at UC Berkeley this semester in **CS 61A, CS 61B, CS 61C, CS 10 and DATA C88C**, for
  **2,800+ students**.
- Three recorders, **all shipped**: VS Code, JetBrains IDEs, Neovim.
- Open source, under the ProvenanceTools GitHub org.
- Pilot survey numbers are **not** to be used.

### Links

| Intent            | Label             | Target                                                                          |
| ----------------- | ----------------- | ------------------------------------------------------------------------------- |
| Contact           | `Talk to us`      | `mailto:aaryanm@berkeley.edu` (temporary; swap when a project address exists)   |
| Source            | `Read the source` | `https://github.com/ProvenanceTools`                                            |
| Student install   | `Install guide`   | `https://github.com/ProvenanceTools/provenance/blob/main/docs/student-guide.md` |
| Staff setup (ftr) | `Admin guide`     | `https://github.com/ProvenanceTools/provenance/blob/main/docs/admin-guide.md`   |

One label per intent, everywhere on the page.

## 2. Creative direction

**Brand source of truth:** `~/Downloads/provenance-wallpapers/PHILOSOPHY.md` ("Evidentiary Calm")
and the `provenance/brand/` mark. Key rules carried over:

- One object, held still. The subject is small relative to the field; the field is the luxury.
- Material before graphics. Light is singular and motivated. Shadows agree with their source.
- Two inks and their ground. Nothing outside the brand palette.
- The record as texture. Where the page turns graphic it uses the language of measurement:
  offset contours, engineering-outline chains, two hairlines per strand with a gap at each crossing.
- Text as a signature. The wordmark is small and low, where a maker would sign.

**Design read:** brand / manifesto landing for faculty, students and the curious, in an
evidentiary-calm language, leaning on gallery-grade real-time 3D object work, native CSS and GSAP.
Dials: `DESIGN_VARIANCE 7`, `MOTION_INTENSITY 6`, `VISUAL_DENSITY 2`.

### The colour arc

The page is one journey with exactly two ground transitions, each graded on scroll (never a cut):

| Act      | Ground             | Chapters                           | Light reference        |
| -------- | ------------------ | ---------------------------------- | ---------------------- |
| Night    | warm near-black    | Hero, Proof, Thesis, Chain, Tamper | _Monolith_, _Crossing_ |
| Daylight | the renders' paper | Evidence, System, Students, Limits | _Late Sun_, _Custody_  |
| Signal   | brand orange       | Close, footer                      | _Signal_               |

Night is the mechanism. Daylight is the people. Signal is the call to act. The page is
art-directed and does not follow `prefers-color-scheme`; there is no theme toggle.

### Tokens

Sampled from the 16x10 renders on 2026-10-12, then rounded.

```
--night-0:   #050201   /* floor of the night ground, vignette edge  */
--night-1:   #0c0806   /* night ground                              */
--night-2:   #1c150f   /* lifted pool under the key light           */
--porcelain: #f4f1ec   /* ink on night (off-white, never #fff)      */
--accent-n:  #f97316   /* accent on night (brand)                   */
--day-0:     #f1ece6   /* day ground                                */
--day-1:     #e4dfd9   /* day shade, emboss shadow side             */
--ink:       #18181b   /* ink on day (brand)                        */
--accent-d:  #ea580c   /* accent on day (brand)                     */
--signal:    #dc520b   /* signal ground (lit EA580C)                */
--signal-rule: #b83f06 /* rules and pattern on signal (brand)       */
--muted-n:   rgb(244 241 236 / .58)  /* secondary text on night     */
--muted-d:   rgb(24 24 27 / .62)     /* secondary text on day       */
```

Contrast rule: body text must reach WCAG AA on its ground; muted values are tuned to pass at
their used sizes and checked in verification. Accent is never used for body text.

### Typography

- **Instrument Sans** (OFL, variable `wght` 400-700, `wdth` 75-100), self-hosted. Display and text.
  Headlines run at `wdth` ~85 and weight 500 with tight tracking; body at `wdth` 100, weight 400.
- **IBM Plex Mono** 400/500 (OFL; already the brand's mono, copied from the analyzer). Used only
  for the record layer: event kinds, hashes, the ticker, small technical annotations.
- The wordmark is the brand lockup SVG, not re-typeset.
- Rules: no serif; no em-dash or en-dash anywhere visible; italic only for emphasis within the same
  family; at most 3 small uppercase labels on the whole page; no section numbering; no scroll cue.
- Fluid scale with `clamp()`. Display max ~ 7.5rem for 4-5 word headlines; hero headline fits on
  two lines at 1280 px and above.

### Shape and material language

- Radius system: interactive elements are full pills; everything else is square. No cards.
- Grouping by space and single hairlines (`1px`, ink or porcelain at low alpha), never boxed.
- Grain: one fixed, `pointer-events: none` SVG-noise overlay at ~4% opacity, blend `overlay`,
  above the canvas and below text. No bloom, glow or gradient text.

## 3. Page structure and copy deck

All copy is final draft for review. Bracketed values are computed at runtime, not typed in.

### Nav (fixed, 64 px, single line)

Left: mark + "Provenance" lockup. Right: `How it works` (#how), `For students` (#students),
`GitHub` (source URL), and a pill button `Talk to us`. Over night it is porcelain; over day it is
ink; it crossfades with the ground. Below 768 px: mark left, `Talk to us` right, other links
collapse into a two-line menu sheet.

### 0. Hero (night)

Layout: asymmetric. The woven pair sits upper right of centre with a large field around it. Text
block is set low-left. Fits the initial viewport at every size (`min-height: 100dvh`).

> **Every line has a history.**
>
> Provenance records how student code gets written, edit by edit, in a tamper-evident log that
> travels with the submission.
>
> [Talk to us] [Read the source]

Motion: on load, the key light rises slowly on the object (1.6 s), then the headline reveals line
by line from a mask, then sub and buttons fade up. The object follows the pointer by a few degrees
with heavy damping. A slow light "breath" (8 s period, very low amplitude) is the only idle motion.

### 1. Proof (night)

Layout: full-width typographic band directly under the hero.

> In use this semester at UC Berkeley _(one of the 3 allowed small labels)_
>
> CS 61A CS 61B CS 61C CS 10 DATA C88C _(set very large, porcelain, wrapping naturally)_
>
> **2,800+** students recording their work _(number in Plex Mono)_

No logos (no Berkeley marks). Course names reveal left to right as the band enters.

### 2. Thesis (night)

Layout: full-bleed statement, single column, left-aligned on an 8/12 measure.

> **The finished file is the easiest part to fake.**
>
> Similarity checkers compare final submissions, and AI tools now produce final submissions on
> demand. What's much harder to produce is the afternoon behind one: the false starts, the deleted
> lines, the test that finally passed at 11:40 p.m.

The 3D pair drifts out of frame to the right as this chapter scrolls, then returns in the next.

### 3. Every edit is a link (night) `#how`

Layout: pinned for ~2.5 viewport heights. Left column text, right two-thirds the 3D scene, with the
live ticker anchored bottom-right.

> **Every edit is a link.**
>
> The recorder runs inside the student's editor. Each change, paste, save and shift of focus
> becomes an event, and each event is hashed together with the one before it. What you get is the
> work itself, in the order it happened, sealed into a chain.

Annotations in Plex Mono, each revealed at a scroll beat:

- `sha-256, each event bound to the one before`
- `checkpoints signed as the student works`
- `sealed when the work is handed in`

Ticker caption (small, muted):

> An illustrative session. Every hash shown is computed in your browser.

Scene: the camera pulls back from the pair; links are added one per ticker line until a chain of
~160 links crosses the frame on a diagonal (the _Custody_ composition, in night lighting). The
accent link stays the one nearest the camera.

### 4. Change one link (night)

Layout: the chain from chapter 3 stays, centred; text top-left; status line and reset bottom-left.

> **Change one link, and the chain says so.**
>
> Rewrite an event after the fact and its hash stops matching. Every event after it fails too,
> all the way to the end. Go ahead: pull a link out of the chain.

Touch devices replace the last sentence with: "Go ahead: tap a link to tamper with it."

Status line (Plex Mono):

- idle: `Chain verified. [N] events, no breaks.`
- broken: `Broken at event [k]. The [N - k] events after it no longer verify.`

Button (appears only when broken): `Reset the chain`.

Behaviour: see section 5.4.

### Transition to daylight

Over ~1 viewport height the scene relights: the night ground grades to `--day-0`, the softbox
fades, a low warm sun comes in from the upper left and casts the long _Late Sun_ shadow; the chain
collapses back to the woven pair in ink + accent (the light-ground colourway). The nav and grain
blend switch at the midpoint.

### 5. Evidence, not a guess (day)

Layout: editorial two-up. Left: text. Right: a comparison figure.

> **Evidence, not a guess.**
>
> AI detectors read finished code and return a probability. The scores are unreliable, and no
> student can argue with one. Provenance doesn't score code at all. It shows how the code came to
> exist: what was typed, what was pasted, and what changed while the editor wasn't looking.
>
> **A flag is a question, not a verdict.** Every case goes to a person, with the whole session to
> replay.

Figure: the line `87% likely AI-generated` set in large type and struck through with a single
accent rule (the thing Provenance refuses to do), above a real rendered replay strip: an SVG
timeline of the illustrative session from section 5.5 showing typing density as fine vertical
hairlines, one paste as an accent block labelled `paste, 212 lines`, and one gap labelled
`edited outside the editor`. The strip is drawn from the same session data as the ticker, not a
mock screenshot.

### 6. Two halves, one record (day)

Layout: horizontal engineering-outline diagram across the full width (stacks vertically below
768 px). Three stations connected by an outline chain drawn in the two-hairline style.

> **Two halves, one record.**

| Station      | Copy                                                                                                                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The recorder | Runs in VS Code, JetBrains IDEs and Neovim. Works offline. Watches the assignment folder and nothing else.                                                                                                                                           |
| The bundle   | One signed file, handed in with the code.                                                                                                                                                                                                            |
| The analyzer | Where course staff review. See a whole cohort at once, then replay any submission edit by edit. Every signal can be weighted or switched off by your staff, and cross-submission checks catch the same paste turning up in different students' work. |

The outline chain draws itself left to right on scroll (stroke-dashoffset), with the gap at each
crossing preserved.

### 7. It works for you, too (day) `#students`

Layout: a ledger. Headline and intro on top, then two columns with a single vertical hairline
between them, then a closing line and button. Columns stack below 768 px.

> **It works for you, too.**
>
> If you did the work, the record is the best evidence you have that you did it. Here is exactly
> what it sees.

| Recorded                                  | Never recorded                                 |
| ----------------------------------------- | ---------------------------------------------- |
| Edits and pastes in the assignment folder | Anything outside the assignment folder         |
| Saves, opened files and editor focus      | Your browser, screen, camera or other projects |
| Commands run in the editor's terminal     | Keystrokes at the system level                 |
| Which editor extensions are installed     | Your clipboard, unless you paste into the work |

> No network requests while you work. The log stays on your computer until you hand it in, and
> it's plain text you can read.
>
> [Install guide]

The section background carries the _Blind Emboss_ treatment: the mark as a very faint relief in
the paper, bottom right, CSS-rendered from the mark SVG with two offset drop-shadow filters.

### 8. What it can't do (day)

Layout: pull quote. Narrow column, quote set large.

> **What it can't do.**
>
> No log is impossible to forge. Someone with enough time and skill can fake one, and our own
> design documents say so. Provenance is built so the easy shortcuts leave marks, and the hard
> ones cost more effort than the assignment. The source is public, and the design assumes it.
>
> "We will know if you do something obvious, and we will know enough to ask questions if you do
> something subtle."
>
> Provenance design document, section 6 _(attribution, smaller)_

### Transition to signal

The day ground floods to `--signal` over ~0.6 viewport heights, wiping up from the bottom edge.

### 9. Close (signal)

Layout: poster. The _Signal_ woven pattern (rows of chain in `--signal-rule` outlines) fills the
ground as texture; one link, solid ink, sits whole above it, rendered in 3D.

> **Bring Provenance to your course.**
>
> It's open source, and it already runs at the scale of a large intro course. Tell us about yours.
>
> [Talk to us] _(ink pill, signal text)_ [Read the source] _(outline pill)_

### Footer (signal, continued)

Small and low. Left: lockup in ink. Right: `GitHub`, `Install guide`, `Admin guide`. Bottom line:
`Built at UC Berkeley.` No version strings, no locale strip.

### Head metadata

- `<title>`: `Provenance: every line has a history`
- description: "Provenance records how student code gets written, edit by edit, in a tamper-evident
  log. Process evidence for academic integrity, not AI detection. Open source."
- OG / Twitter image: 1200x630 crop of the _Monolith_ render with the lockup.
- Favicon: brand `favicon.svg`.

## 4. Visual assets

- Source renders live in `~/Downloads/provenance-wallpapers/`. A `scripts/images.mjs` (sharp)
  produces AVIF + WebP at 640/1280/1920/2560 widths into `public/img/`, from the 16x10 desktop
  and phone masters. The script runs locally; generated files are committed so the build has no
  image step.
- Uses: hero poster (_Monolith_) shown until the WebGL scene is ready, and permanently when 3D is
  off; no-WebGL stills for the chain (_Custody_), daylight (_Late Sun_) and close (_Signal_); OG
  image.
- Brand SVGs (mark, lockup) copied from `provenance/brand/`.

## 5. Technical design

### 5.1 Stack

- Vite + TypeScript (strict), no UI framework. `index.html` holds all content as static semantic
  HTML so the page is complete and indexable without JavaScript. Scripts only enhance.
- Runtime dependencies: `three`, `gsap` (ScrollTrigger, SplitText), `lenis`,
  `@fontsource-variable/instrument-sans`.
- Dev dependencies: `vite`, `typescript`, `vitest`, `sharp`, `prettier`, `@playwright/test`.
- Output: static `dist/` deployable to any static host. Deployment is out of scope here.

### 5.2 Module layout

```
src/
  main.ts                 boot: capability check, poster, lazy-load scene, start timeline
  capabilities.ts         webgl2 / reduced-motion / touch / low-power detection (pure)
  scene/
    link-geometry.ts      rounded-square path + tube geometry (pure, unit tested)
    materials.ts          glaze materials per colourway
    lighting.ts           night softbox rig, day sun rig, crossfade
    woven-pair.ts         the two-link mark, real over/under via opposite tilt
    chain.ts              instanced chain, layout along a diagonal, per-link state
    tamper.ts             pointer picking, drag spring, break propagation visuals
    stage.ts              renderer, camera, resize, render loop with dispose()
  timeline/
    scroll.ts             lenis + ScrollTrigger wiring, single source of scroll truth
    acts.ts               scroll progress -> scene state (camera, chain length, light, ground)
  record/
    session.ts            deterministic illustrative session (seeded), pure
    chain-hash.ts         sha-256 hash chain over canonical JSON via WebCrypto, pure
    verify.ts             verify chain, return first broken index (pure, unit tested)
    ticker.ts             DOM ticker rendering the chain as the scroll advances
  sections/
    reveal.ts             SplitText line reveals, shared
    proof.ts, replay-strip.ts, system-diagram.ts, emboss.ts, nav.ts
  styles/
    tokens.css, base.css, sections.css
```

Every loop, observer and listener is owned by something with a `dispose()`, called on
`pagehide` and in tests.

### 5.3 The 3D scene

- **Link geometry.** A closed rounded-rectangle path (straight sides joined by quarter-circle
  corners, proportions taken from `provenance-mark.svg`), swept with `TubeGeometry` (~256 tubular
  segments, 32 radial). One geometry shared by every link.
- **The weave.** Two links in the mark's horizontal offset. The ink link is rotated about its
  horizontal axis by about +14 degrees, the accent link by about -14 degrees, so the ink link's top
  edge is nearer the camera (passes over) and its bottom edge farther (passes under). Verified by
  rendering the front view and checking the crossings against the mark.
- **Material.** `MeshPhysicalMaterial`: roughness ~0.38, clearcoat 0.6, clearcoat roughness
  ~0.25, subtle sheen. Porcelain link on night, ink link on day, accent link in brand orange.
- **Light.** Night: one large overhead softbox (a `RectAreaLight`), plus a PMREM environment
  built at boot from a tiny procedural studio scene (one emissive panel above, dark everywhere
  else) so reflections match the key. Day: a warm `DirectionalLight` sun, low from the upper left,
  with a soft shadow map onto a shadow-only ground plane, plus a cool fill from the environment.
  Tone mapping: AgX. Output colour space: sRGB.
- **Ground.** No 3D floor in night (the page background is the ground, with a CSS radial pool for
  the lifted area). In day, a `ShadowMaterial` plane catches the sun shadow over the CSS paper.
- **Chain.** `InstancedMesh` of up to 200 links, alternating 90 degree roll, laid on a diagonal
  with a gentle catenary. Per-instance colour attribute for porcelain / accent / broken.
- **Renderer.** One full-viewport canvas, `position: fixed`, behind content, transparent clear so
  the CSS ground shows through. DPR capped at 2 (1.5 on low-power). The render loop pauses when
  the tab is hidden and when the scene is fully off-screen (during the Signal act the close link
  is the only thing drawn).

### 5.4 Tamper interaction

- Picking: raycast against the instanced chain on `pointerdown`.
- Drag: the picked link follows the pointer on a damped spring, constrained to a short radius.
  Neighbours stretch toward it slightly.
- Break: past a threshold distance (or on tap for touch / keyboard), the link is committed as
  tampered. Visually: the link stays displaced, the gap at both its joints opens, and a wave
  travels down the chain to the end, turning each downstream link from porcelain to a dulled
  accent at about 6 ms per link. The ticker re-verifies and prints the broken status line.
- The status numbers come from `verify.ts` run on the actual mutated session: the event bound to
  the picked link has its payload altered, the chain is re-verified, and the first failing index
  and downstream count are displayed.
- Reset: `Reset the chain` restores state with the wave reversed.
- Keyboard: the chain is a focusable control with a visible focus ring; Enter tampers with the
  link under the centre marker, Escape resets. The status line is an `aria-live="polite"` region.
- No WebGL: an SVG engineering-outline chain with the same behaviour (click a link to tamper).

### 5.5 The record

- `session.ts` builds a deterministic illustrative session (seeded PRNG, no `Math.random`) of
  roughly 1,400 events: a student opening `cats.py`, typing function bodies in bursts, deleting and
  retyping, a few focus changes, one paste of 212 lines, one external change, saves and terminal
  commands such as `python3 ok -q 07`. Event kinds and envelope fields match recorder PRD 4.2
  (`seq`, `t`, `wall`, `kind`, `data`, `prev_hash`, `hash`). Payloads show only short code
  fragments, never a full solution.
- `chain-hash.ts`: `hash = sha256(prev_hash || canonical(entry without hash))`, with canonical JSON
  as sorted-key, no-whitespace serialisation. This mirrors the shape of the real chain; it is
  labelled illustrative and makes no claim to be the production format.
- Hashes are computed with `crypto.subtle.digest` in batches during idle time after load.
- `ticker.ts` shows the latest ~10 lines (`seq`, `kind`, short `hash` prefix), advancing with
  scroll in chapter 3 and freezing in chapter 4.

### 5.6 Motion and scroll

- Lenis provides smooth scroll; GSAP ScrollTrigger reads Lenis's scroll position. No
  `window` scroll listeners anywhere.
- `acts.ts` defines one master mapping from document scroll progress to a scene state object
  (camera position and target, chain length, light rig mix, ground colour, object visibility).
  The scene reads that object each frame; sections never touch the scene directly.
- Pinned chapters (3 and 4) use `start: "top top"` and `pin: true`.
- Text reveals: SplitText into lines, each line slides up 100% from a clip mask, staggered 70 ms,
  ease `expo.out`, 0.9 s. Applied to headlines only; body copy fades.
- Every animation has a stated purpose (hierarchy, story beat, or feedback). The hero light breath
  and the ticker are the only things that move without input.

### 5.7 Accessibility

- Semantic landmarks, one `h1`, ordered `h2`s per chapter. The canvas is `aria-hidden`; every idea
  the 3D conveys is also stated in text.
- `prefers-reduced-motion: reduce`: no Lenis, no pinning, no scrubbing, no SplitText motion. The
  3D renders static frames per act (one still frame per chapter) and the tamper demo still works,
  without the wave animation.
- Focus rings visible on every interactive element on all three grounds.
- Text contrast verified per ground (section 6).

### 5.8 Performance and fallbacks

- First paint is the static HTML plus the hero poster image (`fetchpriority="high"`, AVIF with
  WebP fallback, sized `srcset`). Fonts preloaded, `font-display: swap`, metric-matched fallback.
- three.js and the scene are dynamically imported after first paint; when ready, the canvas
  crossfades over the poster with no layout shift.
- No WebGL2, or `navigator.connection.saveData`, or failure to reach 24 fps over the first 2 s of
  rendering: stay on stills, use the SVG tamper chain.
- Budget: initial JS (before the scene import) < 60 KB gzipped; scene chunk < 200 KB gzipped.

## 6. Verification

- `vitest`: `link-geometry` (closed path, corner continuity, proportions), `chain-hash`
  (deterministic hashes for a fixed session; changing one payload changes every downstream hash),
  `verify` (returns the first broken index and correct downstream count; intact chain verifies),
  `session` (deterministic for a seed, envelope fields present, `seq` monotonic), `capabilities`.
- Playwright: load the built site at 390x844, 820x1180, 1440x900 and 2560x1440, with and without
  reduced motion; screenshot every chapter; assert no horizontal overflow, nav on one line at
  > = 1024 px, hero CTAs within the first viewport, no console errors.
- Visual review: screenshots reviewed by eye against the wallpaper renders while iterating.
- Copy check (scripted): zero `—` and `–` characters in `index.html`; count of small uppercase
  labels <= 3.
- Contrast check on every text/ground pair used.
- Lighthouse (mobile + desktop): LCP < 2.5 s, CLS < 0.1, accessibility >= 95.
- `tsc --noEmit`, prettier check.

## 7. Out of scope

- Deployment, DNS and hosting for provtools.com.
- Analytics, cookie banners, a contact form, a blog, additional pages.
- Changes to the `provenance` monorepo or its brand assets.

## 8. Open items

- Contact address is the owner's personal Berkeley address for now.
- "Built at UC Berkeley." in the footer is a factual claim to confirm.
- "It already runs at the scale of a large intro course" rests on the 2,800+ figure across five
  courses; confirm the phrasing.

## 9. As built (2026-10-12)

Where the build departs from the sections above, deliberately:

- **No wallpaper renders.** The owner allowed replacing them. Fallback stills and the social card
  are rendered from the live scene (`scripts/stills.mjs`, `scripts/og.mjs`), so every image
  matches the 3D.
- **Relight** is a diagonal light wipe from the upper left (where the sun is), not a crossfade;
  a crossfade passed through a muddy grey.
- **The chain streams off** along its own axis when it collapses back to the pair, instead of
  shrinking in place.
- **System diagram**: a single hairline record (event ticks, the woven mark sealing them at the
  bundle, a clean line to the analyzer) instead of an outline chain, which read as a coil at that
  size. The outline-chain language is used for the signal ground pattern.
- **Session**: about 4,300 events spanning 20:55 to 23:41, so the replay strip and ledger read
  like a real evening; the status line is computed.
- **Hero** animates in CSS, not SplitText, so it paints without waiting on script (LCP).
- **Narrow screens** cut from hero to thesis while both positions are off-screen, so the object
  never travels across full-width copy.
- **Copy**: "sealed when the work is handed in" became "handed in with the work", and "one
  signed file" became "the signed log", because git-based submissions have no seal step.

## 10. Round 2 (approved 2026-10-12)

Approved scope: items 1 to 7 of the round-2 proposal.

**Order.** Night: hero, proof, thesis, _two histories_, the chain (logo, morph, chain, tamper
that plays itself, then "now you try"). Relight. Day: _built not to accuse_, _see the process_,
_one folder_, _try it_, limits. Signal: close. Cut: "two halves, one record", the "87%" figure,
the old replay strip, "Every hash shown is computed in your browser".

**Logo system.** Flat 2D mark: nav, footer, favicon, emboss, social avatar. Extruded mark (the
2D mark with depth: flat face, softened edges, satin glaze), seen face-on first: hero, thesis,
day, close. Round tubes only where links must work as a chain. The flat mark rounds out into
chain links on screen (a cross-section morph on one shared geometry).

**Illustrative assignment.** Fictional `trails.py` (no real course solutions on a public page;
the round-1 session used live CS 61A Cats code). One final file, two histories that both
reconstruct to it byte for byte: an evening of typing (about 4,000 events) and a tab-away plus a
single paste. The page shows both SHA-256 digests, equal.

**Fairness claims** (from `docs/heuristics.md`): pasting code you already typed is relabelled
"code moved" at info severity and leaves the queue, never hidden; checks that cannot run report
skipped, never failed; signals can be weighted or switched off, and some capture can be turned
off by the course before recording; every flag opens its moment in the replay; a person decides.

**Privacy claims:** assignment folder only; no network while recording; plain-text log; open
source; course can turn capture signals off; stored logs deleted on a retention schedule the
school sets. Not claimed: that code is not kept (edits are in the log by design).

**Try it:** a small editor on the page records the visitor's typing, pastes and focus changes
as hash-chained events, shows them live, and replays them. Nothing leaves the page.
