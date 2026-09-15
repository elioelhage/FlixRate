(() => {
  const STAR_ID = 'flixrate-star';
  const TITLE_SELECTOR = '[data-uia="video-title"]';
  const VOLUME_SELECTORS = [
    '[data-uia^="control-volume"]',
    'button[aria-label*="Volume"]',
    'button[aria-label*="volume"]',
    '[data-uia^="player-volume"]',
  ];
  const CONTROLS_ROW_SELECTORS = [
    '[data-uia="controls-standard"]',
    '.PlayerControlsNeo__button-control-row',
  ];
  const DEBUG = true;

  let enabled = true;
  let observer = null;
  let intervalId = null;
  let lastAnchor = null;
  let lastKey = null;
  let requestToken = 0;

  const STAR_SVG = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.6l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.16l-5.7 3 1.09-6.35-2.85 5.78-6.38-.93 4.62-4.5-1.09-6.35 5.7 3z"/>
    </svg>`;

  function log(...args) {
    if (DEBUG) console.debug('[FlixRate]', ...args);
  }

  function findVolumeControl() {
    for (const selector of VOLUME_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) return element.closest('button, [role="button"]') || element;
    }
    return null;
  }

  function findFallbackAnchor() {
    for (const selector of CONTROLS_ROW_SELECTORS) {
      const row = document.querySelector(selector);
      if (row?.lastElementChild) return row.lastElementChild;
    }
    return null;
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function readCurrentTitle() {
    const node = document.querySelector(TITLE_SELECTOR);
    if (!node) {
      log('no video-title element found');
      return null;
    }

    const rawLines = (node.innerText || node.textContent || '')
      .split(/\n+/)
      .map(cleanText)
      .filter(Boolean);

    if (!rawLines.length) return null;

    const combined = cleanText(rawLines.join(' '));
    const match = combined.match(/\bS(?:eason\s*)?(\d{1,3})\s*[:\-]?\s*E(?:pisode\s*)?(\d{1,3})\b/i)
      || combined.match(/\bSeason\s*(\d{1,3})\s*[, -]+\s*Episode\s*(\d{1,3})\b/i);

    if (!match) {
      log('could not parse season/episode from Netflix title:', combined);
      return null;
    }

    const season = Number.parseInt(match[1], 10);
    const episode = Number.parseInt(match[2], 10);

    // Prefer the first visible line as the show title, stripping any accidental
    // episode metadata if Netflix puts it on the same line.
    let title = rawLines[0];
    title = title.replace(/\bS(?:eason\s*)?\d{1,3}\s*[:\-]?\s*E(?:pisode\s*)?\d{1,3}\b/i, '').trim();
    title = title.replace(/\bSeason\s*\d{1,3}\s*[, -]+\s*Episode\s*\d{1,3}\b/i, '').trim();

    if (!title) {
      title = combined.slice(0, match.index).trim();
    }
    if (!title) return null;

    return {
      title,
      season,
      episode,
      key: `${title}|${season}|${episode}`,
    };
  }

  function removeStar() {
    document.getElementById(STAR_ID)?.remove();
    lastAnchor = null;
  }

  function paintStar(star, tier, stateLabel = tier.label) {
    star.style.setProperty('--flixrate-color', tier.color);
    star.dataset.ratingState = tier.id;
    star.title = `FlixRate — ${stateLabel}`;
    star.setAttribute('aria-label', `FlixRate — ${stateLabel}`);
  }

  function createStar(anchor) {
    removeStar();

    const star = document.createElement('button');
    star.id = STAR_ID;
    star.className = 'flixrate-star';
    star.type = 'button';
    star.dataset.ratingState = 'unrated';
    star.innerHTML = STAR_SVG;
    paintStar(star, FlixRateRatings.UNRATED);

    star.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'FLIXRATE_OPEN_POPUP' }).catch(() => {});
    });

    const parent = anchor.parentElement;
    if (!parent) return null;

    parent.insertBefore(star, anchor.nextSibling);
    lastAnchor = anchor;
    return star;
  }

  async function refreshRatingIfNeeded() {
    const info = readCurrentTitle();
    const star = document.getElementById(STAR_ID);
    if (!info || !star) return;
    if (info.key === lastKey) return;

    lastKey = info.key;
    const token = ++requestToken;
    paintStar(star, FlixRateRatings.UNRATED, 'Loading rating…');
    log('fetching', info);

    try {
      const data = await chrome.runtime.sendMessage({
        type: 'FLIXRATE_FETCH_RATING',
        payload: { title: info.title, season: info.season, episode: info.episode },
      });

      if (token !== requestToken) return;
      const currentStar = document.getElementById(STAR_ID);
      if (!currentStar) return;

      const tier = FlixRateRatings.getTier(data?.rating ?? null, data?.votes ?? 0);
      paintStar(currentStar, tier);
      log('rating response', data, '→', tier.id);
    } catch (error) {
      if (token !== requestToken) return;
      const currentStar = document.getElementById(STAR_ID);
      if (currentStar) paintStar(currentStar, FlixRateRatings.UNRATED, 'Rating unavailable');
      log('rating fetch failed:', error);
    }
  }

  function syncStar() {
    if (!enabled) {
      removeStar();
      return;
    }

    const anchor = findVolumeControl() || findFallbackAnchor();
    if (!anchor) return;

    const current = document.getElementById(STAR_ID);
    if (!current || lastAnchor !== anchor || !anchor.parentElement?.contains(current)) {
      const created = createStar(anchor);
      if (created) {
        lastKey = null;
        log('star injected');
      }
    }

    refreshRatingIfNeeded();
  }

  function init() {
    if (!observer) {
      observer = new MutationObserver(syncStar);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    syncStar();

    if (!intervalId) intervalId = window.setInterval(syncStar, 1000);
  }

  chrome.storage.local.get({ enabled: true }, (result) => {
    enabled = result.enabled !== false;
    init();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.enabled) return;
    enabled = changes.enabled.newValue !== false;
    lastKey = null;
    syncStar();
  });
})();
