# Vigil design system

## Direction

An orbital observatory for software reliability, following the user's dark, luminous MotionSites reference. A custom moving constellation carries the hero; measured, calm controls carry the workspace. Creative direction was delegated by the user. Code-led implementation uses the explicit reference as the visual bar.

## First viewport

Centered wide headline, two clear actions, substantial negative space, and a blue-white particle sphere emerging from the lower frame. Navigation is quiet and sits on the same near-black surface. An amber satellite introduces the incident state. No fictional customer logos or metrics.

## Tokens

- Surface: #06090f; panels #0d121b; raised #121b27.
- Foreground: #f0f4fa; secondary #a4b2c5; subtle #8190a4.
- Signal: #a9dbff; action #d2edff; healthy #73dfb2; incident #f5bb70; failure #ff8787.
- Font: self-hosted Geist Variable; monospace only for identifiers, time and code.
- Rounded rectangles 12–16px; thin cool borders; one elevation per surface.
- Display width 1100px, headline balanced to 2 lines on desktop / 3 on mobile.

## Motion

Original canvas constellation with orbit trails and cursor parallax. Lenis on landing only. GSAP scroll pin and stacking workflow. Motion layout transitions inside app, rapid spring response on controls. Reduce motion disables scroll smoothing, continuous motion, and animated transitions. Pointer effects do not obstruct clicks or keyboard navigation.

## App

Dense sidebar, broad main workspace, durable state badges with text, functional service checks, incident timelines, and task board. Every primary action has loading, success and failure feedback. Demo records are labeled. No invisible placeholders for real integrations.

## References

- [MotionSites](https://motionsites.ai/): luminous spatial composition, original implementation.
- [Emil Kowalski](https://emilkowal.ski/skill): response timing, reduced motion, deliberate transitions.
- [Taste Skill](https://www.tasteskill.dev/): typography, visual hierarchy, coherent sections.
- [Impeccable](https://impeccable.style/): accessibility, readable data, distinct identity.
- [Inspira UI](https://github.com/unovue/inspira-ui): spatial particle/globe inspiration; Vue components are not imported into React.
- [Animate UI](https://animate-ui.com/): animated React interaction inspiration.
- [Lenis](https://github.com/darkroomengineering/lenis): actual smooth-scroll runtime dependency.
- User's frontend PDF: real content, mobile review, metadata, functional CTAs, HTTPS.
