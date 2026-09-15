# FlixRate

IMDb episode ratings, directly in Netflix.

## Version 1.4

- Reads the current show, season, and episode from Netflix's playback title.
- Fetches the individual episode through OMDb, which exposes IMDb rating data and supports season/episode queries. citeturn166487search0
- If a direct title lookup fails, resolves the show's IMDb ID first and retries the episode lookup by IMDb ID.
- Successful ratings are cached for 7 days.
- Failed lookups are cached for only 2 minutes, preventing stale white-star results while troubleshooting.
- The star remains white when there are fewer than 400 IMDb votes or no usable rating data.
- Netflix playback integration continues to use the native volume-control area.

## Setup

See `SETUP.md` and create a local `config.js` from `config.example.js` with your OMDb API key.

`config.js` is gitignored and is never committed to the public repository.
