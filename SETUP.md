# FlixRate setup

## OMDb key

1. Get a free OMDb API key from https://www.omdbapi.com/apikey.aspx.
2. Copy `config.example.js` to `config.js`.
3. Put your key in `config.js`.
4. Keep `config.js` local; it is gitignored.

## Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked** and select the FlixRate folder.
4. Reload Netflix and start an episode.
5. Open the FlixRate popup. It should detect the current show, season, and episode, then fetch the specific episode rating.

## v1.5 troubleshooting

If the popup says it cannot reach Netflix, reload the Netflix tab once after updating the extension.

If the popup detects the episode but shows `Missing OMDb API key`, make sure your local `config.js` exists beside `background.js`.

If the popup detects the wrong show or episode, open the Netflix DevTools console and look for `[FlixRate] Current episode detected:`. The parsed title/season/episode is shown there.

A successful result shows the numeric IMDb rating and vote count for testing, while the large FlixRate star uses only the configured color tier.
