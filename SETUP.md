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

## v1.4 troubleshooting

If the star is white on an episode that should have enough IMDb votes, open the Netflix DevTools console. FlixRate logs the title it parsed and the response it received with the `[FlixRate]` prefix.

Also open the FlixRate service-worker console from `chrome://extensions`. A missing/invalid OMDb key, HTTP error, or OMDb title mismatch will be shown there.

v1.4 deliberately does not cache failed lookups for days. A failed lookup expires after about 2 minutes so temporary API or title problems can recover without clearing extension storage.
