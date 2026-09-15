# FlixRate

IMDb episode ratings, directly in the FlixRate popup while watching Netflix.

## Version 1.52

- Episode detection is now the first priority.
- Detects the current show, season, and episode from multiple Netflix-side sources.
- Tries JSON-LD episode metadata first, then dedicated player/title elements, player-neighborhood DOM, and finally visible page text.
- Detected episode data is stored per Netflix tab by the service worker.
- The popup reads the detected episode from the active Netflix tab, then fetches its exact IMDb/OMDb rating.
- Playback-skin rendering remains disabled during testing.

## Setup

Keep `config.js` local with your OMDb key. It is gitignored.
