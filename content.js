(() => {
  const DEBUG = true;
  const DETECTION_INTERVAL_MS = 1000;
  const PUBLISH_MIN_MS = 500;
  let lastSignature = '';
  let lastPublish = 0;

  function log(...args) {
    if (DEBUG) console.debug('[FlixRate 1.52]', ...args);
  }

  function clean(text) {
    return String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function parseEpisodeNumber(text) {
    const value = clean(text);
    const patterns = [
      /\bS(?:eason\s*)?(\d{1,3})\s*[:\-]\s*E(?:pisode\s*)?(\d{1,3})\b/i,
      /\bS(?:eason\s*)?(\d{1,3})\s+E(?:pisode\s*)?(\d{1,3})\b/i,
      /\bSeason\s*(\d{1,3})\s*[,\-:]?\s*Episode\s*(\d{1,3})\b/i,
      /\bEpisode\s*(\d{1,3})\s*(?:of|\/|-)\s*Season\s*(\d{1,3})\b/i,
    ];
    for (const pattern of patterns) {
      const m = value.match(pattern);
      if (!m) continue;
      if (/^Episode/i.test(m[0])) {
        return { episode: Number(m[1]), season: Number(m[2]), index: m.index ?? 0, length: m[0].length };
      }
      return { season: Number(m[1]), episode: Number(m[2]), index: m.index ?? 0, length: m[0].length };
    }
    return null;
  }

  function isUsableTitle(value) {
    const text = clean(value);
    if (!text || text.length < 2 || text.length > 160) return false;
    if (parseEpisodeNumber(text)) return false;
    if (/^(play|pause|volume|mute|unmute|fullscreen|exit fullscreen|next episode|previous episode|skip intro|skip recap|audio|subtitles|settings)$/i.test(text)) return false;
    return true;
  }

  function titleFromDocumentTitle() {
    const candidates = [
      document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
      document.title,
    ].map(clean).filter(Boolean);

    for (let title of candidates) {
      title = title
        .replace(/^Watch\s+/i, '')
        .replace(/\s*[|\-–—]\s*(?:Netflix|Watch on Netflix).*$/i, '')
        .replace(/\s*-\s*Netflix$/i, '')
        .trim();
      if (isUsableTitle(title)) return title;
    }
    return '';
  }

  function fromJsonLd() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      let parsed;
      try { parsed = JSON.parse(script.textContent || ''); } catch { continue; }
      const stack = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (stack.length) {
        const item = stack.pop();
        if (!item || typeof item !== 'object') continue;
        if (Array.isArray(item)) { stack.push(...item); continue; }
        if (item['@graph'] && Array.isArray(item['@graph'])) stack.push(...item['@graph']);

        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        const typeText = types.filter(Boolean).join(' ');
        const seasonValue = item.partOfSeason?.seasonNumber ?? item.seasonNumber;
        const episodeValue = item.episodeNumber;
        const season = Number.parseInt(seasonValue, 10);
        const episode = Number.parseInt(episodeValue, 10);
        const seriesName = clean(item.partOfSeries?.name || item.series?.name || item.parentSeries?.name || item.partOfSeries || '');
        if ((/Episode/i.test(typeText) || episodeValue != null) && Number.isFinite(season) && Number.isFinite(episode) && isUsableTitle(seriesName)) {
          return { title: seriesName, season, episode, source: 'json-ld' };
        }
      }
    }
    return null;
  }

  function titleFromNodeContext(node) {
    let current = node;
    for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
      const headings = Array.from(current.querySelectorAll?.('h1,h2,h3,h4,[role="heading"]') || []);
      for (const heading of headings) {
        const text = clean(heading.textContent);
        if (isUsableTitle(text)) return text;
      }
      const labelled = clean(current.getAttribute?.('aria-label'));
      if (isUsableTitle(labelled)) return labelled;
    }
    return '';
  }

  function fromExplicitTitleNodes() {
    const selectors = [
      '[data-uia="video-title"]',
      '[data-uia*="video-title"]',
      '[data-uia="player-title"]',
      '[data-uia*="player-title"]',
      '[class*="video-title"]',
      '[class*="PlayerControlsNeo__episode"]',
    ];

    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        const raw = node.innerText || node.textContent || node.getAttribute('aria-label') || '';
        const numbering = parseEpisodeNumber(raw);
        if (!numbering) continue;
        const lines = String(raw).split(/\n+/).map(clean).filter(Boolean);
        const title = titleFromNodeContext(node)
          || lines.find((line) => isUsableTitle(line))
          || clean(String(raw).slice(0, numbering.index));
        if (isUsableTitle(title)) {
          return { title, season: numbering.season, episode: numbering.episode, source: selector };
        }
      }
    }
    return null;
  }

  function fromVisibleText() {
    const bodyLines = clean(document.body?.innerText).split(/\n+/).map(clean).filter(Boolean);
    const candidates = [];

    for (let i = 0; i < bodyLines.length; i += 1) {
      const line = bodyLines[i];
      const numbering = parseEpisodeNumber(line);
      if (!numbering) continue;

      let title = clean(line.slice(0, numbering.index));
      if (!isUsableTitle(title)) {
        for (let offset = 1; offset <= 4 && i - offset >= 0; offset += 1) {
          const previous = bodyLines[i - offset];
          if (isUsableTitle(previous) && previous.length <= 100) {
            title = previous;
            break;
          }
        }
      }

      if (!isUsableTitle(title)) title = titleFromDocumentTitle();
      if (!isUsableTitle(title)) continue;

      const contextScore = i < 120 ? 0 : 20;
      const netflixUiPenalty = /^(Home|TV Shows|Movies|My List|New & Popular|Browse)$/i.test(title) ? 50 : 0;
      candidates.push({
        title,
        season: numbering.season,
        episode: numbering.episode,
        source: 'body-text',
        score: contextScore + netflixUiPenalty + Math.min(line.length, 120),
      });
    }

    candidates.sort((a, b) => a.score - b.score);
    if (!candidates.length) return null;
    const best = candidates[0];
    delete best.score;
    return best;
  }

  function fromElementTree() {
    const elements = document.querySelectorAll('h1,h2,h3,h4,span,button,div,p');
    const candidates = [];

    for (const node of elements) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.children.length > 8) continue;
      const text = clean(node.innerText || node.textContent || node.getAttribute('aria-label'));
      if (text.length < 4 || text.length > 180) continue;
      const numbering = parseEpisodeNumber(text);
      if (!numbering) continue;

      let title = titleFromNodeContext(node) || clean(text.slice(0, numbering.index));
      if (!isUsableTitle(title)) title = titleFromDocumentTitle();
      if (!isUsableTitle(title)) continue;

      const rect = node.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      if (!visible) continue;

      const nearPlayer = !!node.closest('[data-uia*="player"], [class*="Player"], [class*="player"], video');
      candidates.push({
        title,
        season: numbering.season,
        episode: numbering.episode,
        source: nearPlayer ? 'player-dom' : 'dom-scan',
        score: (nearPlayer ? 0 : 1000) + text.length,
      });
    }

    candidates.sort((a, b) => a.score - b.score);
    if (!candidates.length) return null;
    const best = candidates[0];
    delete best.score;
    return best;
  }

  function detectCurrentEpisode() {
    return fromJsonLd() || fromExplicitTitleNodes() || fromElementTree() || fromVisibleText();
  }

  async function publish() {
    const episode = detectCurrentEpisode();
    const signature = JSON.stringify(episode && {
      title: episode.title,
      season: episode.season,
      episode: episode.episode,
    });

    if (signature === lastSignature && Date.now() - lastPublish < PUBLISH_MIN_MS) return;
    lastSignature = signature;
    lastPublish = Date.now();

    try {
      await chrome.runtime.sendMessage({
        type: 'FLIXRATE_EPISODE_DETECTED',
        payload: episode ? { ...episode, url: location.href, detectedAt: Date.now() } : null,
      });
      if (episode) log('Current episode detected:', episode);
    } catch (error) {
      log('Could not publish detected episode:', error);
    }
  }

  publish();
  window.setInterval(() => publish(), DETECTION_INTERVAL_MS);
  new MutationObserver(() => publish()).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
