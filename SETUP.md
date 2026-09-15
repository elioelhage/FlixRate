# FlixRate 1.52 setup

## OMDb key

1. Get an OMDb API key.
2. Keep the key in local `config.js`.
3. `config.js` is gitignored and must never be committed to the public repository.

## Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked** and select the FlixRate folder.
4. Reload Netflix.
5. Start an episode and open the FlixRate toolbar popup.

## v1.52 detection test

The episode detector is now independent of a single Netflix selector. It tries, in order:

- JSON-LD episode metadata embedded in the page
- Netflix player/video-title elements
- DOM surrounding the active player
- Visible page text, including `S1:E1`, `S1 E1`, and `Season 1 Episode 1`
- Document title and nearby headings as show-title fallbacks

The content script publishes the detected episode to the background service worker, keyed to the individual Netflix tab. The popup asks the service worker for the episode belonging to the active tab, then performs the rating lookup.

If the popup still says **Episode not detected**, check the Netflix DevTools console for `[FlixRate 1.52]` messages. The detector reports which strategy succeeded or failed.

## Rating test

Once the show/season/episode appears in the popup, FlixRate sends that exact combination to the background service worker, which queries OMDb for the individual episode. The popup star then shows the resulting FlixRate color tier.
