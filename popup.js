const toggle = document.getElementById('toggle');
const statusText = document.getElementById('statusText');
const currentEpisode = document.getElementById('currentEpisode');
const currentState = document.getElementById('currentState');
const ratingStar = document.getElementById('ratingStar');

function renderEnabled(enabled) {
  toggle.classList.toggle('on', enabled);
  toggle.setAttribute('aria-checked', String(enabled));
  statusText.textContent = enabled ? 'Enabled' : 'Disabled';
}

function paintStar(tier, text) {
  ratingStar.style.background = tier.color;
  ratingStar.className = `rating-star rating-star--${tier.id}`;
  ratingStar.title = text;
  ratingStar.setAttribute('aria-label', text);
}

function parseNumbering(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
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

function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function detectEpisodeInTab() {
  const titleFromNode = (node) => {
    let current = node;
    for (let depth = 0; current && depth < 7; depth += 1, current = current.parentElement) {
      const headings = Array.from(current.querySelectorAll?.('h1,h2,h3,h4,[role="heading"]') || []);
      const heading = headings.find((el) => {
        const text = clean(el.textContent);
        return text && !parseNumbering(text) && text.length < 140;
      });
      if (heading) return clean(heading.textContent);
      const aria = clean(current.getAttribute?.('aria-label'));
      if (aria && !parseNumbering(aria) && aria.length < 140 && !/volume|play|pause|fullscreen|subtitle/i.test(aria)) return aria;
    }
    return '';
  };

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
      const title = titleFromNode(node) || lines.find((line) => !parseNumbering(line)) || clean(String(raw).slice(0, numbering.index));
      if (title) return { title, season: numbering.season, episode: numbering.episode, source: selector };
    }
  }

  const video = document.querySelector('video');
  if (video) {
    let current = video;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      const candidates = current.querySelectorAll('h1,h2,h3,h4,span,div,button,[aria-label]');
      for (const node of candidates) {
        if (node.children.length > 5) continue;
        const raw = node.innerText || node.textContent || node.getAttribute('aria-label') || '';
        const numbering = parseNumbering(raw);
        if (!numbering) continue;
        const text = clean(raw);
        if (text.length < 4 || text.length > 180) continue;
        const title = titleFromNode(node) || clean(text.slice(0, numbering.index));
        if (title) return { title, season: numbering.season, episode: numbering.episode, source: 'player-neighborhood' };
      }
    }
  }

  let best = null;
  for (const node of document.querySelectorAll('h1,h2,h3,h4,span,button,div')) {
    if (!(node instanceof HTMLElement) || node.children.length > 4) continue;
    const raw = node.innerText || node.textContent || '';
    const text = clean(raw);
    if (text.length < 4 || text.length > 180) continue;
    const numbering = parseNumbering(text);
    if (!numbering) continue;
    const title = titleFromNode(node) || clean(text.slice(0, numbering.index));
    if (!title) continue;
    const score = (node.closest('[data-uia*="player"], [class*="Player"], [class*="player"]') ? 0 : 1000) + text.length;
    if (!best || score < best.score) best = { title, season: numbering.season, episode: numbering.episode, source: 'visible-text', score };
  }
  if (best) delete best.score;
  return best;
}

async function getCurrentEpisode() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !/^https:\/\/www\.netflix\.com\//i.test(tab.url || '')) return null;

  try {
    const injected = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: detectEpisodeInTab });
    return injected?.[0]?.result || null;
  } catch (error) {
    console.warn('[FlixRate 1.51] Could not inspect Netflix tab directly:', error);
    return null;
  }
}

async function loadEpisode() {
  currentEpisode.textContent = 'Detecting episode…';
  currentState.textContent = '';
  paintStar(FlixRateRatings.UNRATED, 'Detecting episode…');

  const episode = await getCurrentEpisode();
  if (!episode) {
    currentEpisode.textContent = 'Episode not detected';
    currentState.textContent = 'Start playback on Netflix, then reopen the FlixRate popup.';
    paintStar(FlixRateRatings.UNRATED, 'Episode not detected');
    return;
  }

  currentEpisode.textContent = `${episode.title} · S${episode.season}:E${episode.episode}`;
  currentState.textContent = 'Fetching IMDb rating…';

  try {
    const data = await chrome.runtime.sendMessage({ type: 'FLIXRATE_FETCH_RATING', payload: episode });
    const tier = FlixRateRatings.getTier(data?.rating ?? null, data?.votes ?? 0);
    paintStar(tier, tier.label);
    currentState.textContent = data?.rating != null
      ? `${data.rating.toFixed(1)}/10 · ${Number(data.votes || 0).toLocaleString()} IMDb votes · ${tier.label}`
      : (data?.error || 'No usable IMDb rating found.');
  } catch (error) {
    currentState.textContent = `Lookup error: ${String(error?.message || error)}`;
    paintStar(FlixRateRatings.UNRATED, 'Rating unavailable');
  }
}

chrome.storage.local.get({ enabled: true }, ({ enabled }) => renderEnabled(enabled));

toggle.addEventListener('click', async () => {
  const { enabled = true } = await chrome.storage.local.get({ enabled: true });
  const next = !enabled;
  await chrome.storage.local.set({ enabled: next });
  renderEnabled(next);
});

loadEpisode();
