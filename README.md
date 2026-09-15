# FlixRate

IMDb episode ratings, directly in the FlixRate popup while watching Netflix.

## Version 1.51

- Temporarily moved rating display entirely into the extension popup for reliable testing.
- The popup directly inspects the active Netflix tab instead of relying only on stored/content-script episode detection.
- Detection uses Netflix title nodes, player-neighborhood DOM, and compact visible-text fallbacks.
- The popup identifies the current show, season, and episode, then requests that exact episode's IMDb data through OMDb.
- Popup star changes color according to the FlixRate rating tiers.
- Numerical rating and vote count are shown only as testing diagnostics.
- Playback-skin injection is intentionally disabled as the next UI phase.

## Setup

Keep `config.js` local with your OMDb key. It is gitignored.
