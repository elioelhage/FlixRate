(() => {
  const DEBUG = true;
  const STORAGE_KEY = 'flixrateCurrentEpisode';
  let lastSignature = '';

  function log(...args) {
    if (DEBUG) console.debug('[FlixRate 1.51]', ...args);
  }

  function clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function parseNumbering(text) {
    const value = clean(text);
    const patterns = [
      /\bS(?:eason\s*)?(\d{1,3})\s*[:\-]\s*E(?:pisode\s*)?(\d{1,3})\b/i,
      /\bS(?:eason\s*)?(\d{1,3})\s+E(?:pisode\s*)?(\d{1,3})\b/i,
      /\bSeason\s*(\d{1,3})\s*[,\-:]?\s*Episode\s*(\d{1,3})\b/i,
    ];
    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match) return { season: Number(match[1]), episode: Number(match[2]), index: match.index ?? 0 };
    }
    return null;
  }

  function nearbyTitle(node) {
    let current = node;
    for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
      const headings = Array.from(current.querySelectorAll?.('h1,h2,h3,h4,[role="heading"]') || []);
      const heading = headings.find((el) => {
        const text = clean(el.textContent);
        return text && !parseNumbering(text) && text.length < 140;
      });
      if (heading) return clean(heading.textContent);

      const aria = clean(current.getAttribute?.('aria-label'));
      if (aria && !parseNumbering(aria) && aria.length < 140 && !/volume|play|pause|fullscreen|subtitle/i.test(aria)) {
        return aria;
      }
    }
    return '';
  }

  function fromTitleNodes() {
    const selectors = [
      '[data-uia="video-title"]',
      '[data-uia*="video-title"]',
      '[data-uia="player-title"]',
      '[class*="video-title"]',
      '[class*="PlayerControlsNeo__episode"]',
    ];

    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        const raw = node.innerText || node.textContent || node.getAttribute('aria-label') || '';
        const numbering = parseNumbering(raw);
        if (!numbering) continue;

        const lines = String(raw).split(/\n+/).map(clean).filter(Boolean);
        const title = nearbyTitle(node) || lines.find((line) => !parseNumbering(line)) || clean(String(raw).slice(0, numbering.index));
        if (title) return { title, season: numbering.season, episode: numbering.episode, source: selector };
      }
    }
    return null;
  }

  function fromPlayerNeighborhood() {
    const video = document.querySelector('video');
    if (!video) return null;

    let current = video;
    for (let depth = 0; current && depth < 7; depth += 1, current = current.parentElement) {
      const candidates = current.querySelectorAll('h1,h2,h3,h4,span,div,button,[aria-label]');
      for (const node of candidates) {
        if (node.children.length > 5) continue;
        const text = clean(node.innerText || node.textContent || node.getAttribute('aria-label'));
        if (text.length < 3 || text.length > 180) continue;
        const numbering = parseNumbering(text);
        if (!numbering) continue;
        const title = nearbyTitle(node) || clean(text.slice(0, numbering.index));
        if (title) return { title, season: numbering.season, episode: numbering.episode, source: 'player-neighborhood' };
      }
    }
    return null;
  }

  function fromCompactVisibleText() {
    const nodes = document.querySelectorAll('h1,h2,h3,h4,span,button,div');
    let best = null;
    for (const node of nodes) {
      if (!(node instanceof HTMLElement) || node.children.length > 4) continue;
      const text = clean(node.innerText || node.textContent);
      if (text.length < 4 || text.length > 180) continue;
      const numbering = parseNumbering(text);
      if (!numbering) continue;
      const title = nearbyTitle(node) || clean(text.slice(0, numbering.index));
      if (!title) continue;
      const playerDistance = node.closest('[data-uia*="player"], [class*="Player"], [class*="player"]') ? 0 : 1;
      const score = playerDistance * 1000 + text.length;
      if (!best || score < best.score) best = { title, season: numbering.season, episode: numbering.episode, source: 'compact-visible-text', score };
    }
    if (best) delete best.score;
    return best;
  }

  function detectCurrentEpisode() {
    return fromTitleNodes() || fromPlayerNeighborhood() || fromCompactVisibleText();
  }

  async function publish() {
    const episode = detectCurrentEpisode();
    const payload = episode ? { ...episode, detectedAt: Date.now() } : null;
    const signature = JSON.stringify(payload && {
      title: payload.title, season: payload.season, episode: payload.episode, source: payload.source,
    });
    if (signature === lastSignature) return;
    lastSignature = signature;
    await chrome.storage.local.set({ [STORAGE_KEY]: payload });
    if (payload) log('Detected', payload);
  }

  publish().catch((e) => log('initial detection error', e));
  window.setInterval(() => publish().catch((e) => log('detection error', e)), 750);
  new MutationObserver(() => publish().catch((e) => log('mutation detection error', e))).observe(document.documentElement, {
    childList: true, subtree: true, characterData: true,
  });
})();
