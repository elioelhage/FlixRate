# FlixRate

IMDb episode ratings, directly in Netflix.

## Version 1.5

- Detects the current Netflix show, season, and episode.
- Looks up the exact episode through OMDb using season/episode data.
- Uses an IMDb-ID fallback when direct title matching fails.
- Shows the rating as the FlixRate color star directly in the extension popup for testing.
- Successful ratings are cached for 7 days; failed lookups expire after 2 minutes.
- The in-player star is temporarily disabled while the rating pipeline is being tested.

## Setup

Create `config.js` from `config.example.js` and put your OMDb API key in it. `config.js` is gitignored.
