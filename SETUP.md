# FlixRate 1.51 setup

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

## v1.51 detection test

The popup now directly inspects the active Netflix tab with the extension's `scripting` permission. It does not depend on Netflix's URL containing the episode number.

The detector checks multiple DOM locations for `Sx:Ey` / `Season x Episode y`, then derives the nearby show title. The content script also runs the same style of multi-strategy detection in the background so Netflix SPA changes are continuously observed.

If the popup says **Episode not detected**, the Netflix player markup has changed enough that another DOM strategy is needed.

## Rating test

Once the show/season/episode appears in the popup, FlixRate sends that exact combination to the background service worker, which queries OMDb for the individual episode. The popup star shows the resulting FlixRate color tier.
