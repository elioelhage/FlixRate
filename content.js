(() => {
  const DEBUG = true;
  const TITLE_SELECTORS = [
    '[data-uia="video-title"]',
    '[data-uia="video-title"] span',
    '[data-uia="video-title"] h4',
  ];

  let lastEpisodeKey = null;

  function log(...args) {
    if (DEBUG) console.debug('[FlixRate]', ...args);
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findTitleNode() {
    for (const selector of TITLE_SELECTORS) {
      const node = document.querySelector(selector);
      if (node) return node.closest('[data-uia="video-title"]') || node;
    }
    return null;
  }

  function parseEpisodeNumber(text) {
    const patterns = [
      /\bS(?:eason)?\s*(\d+)\s*[:\-]\s*E(?:pisode)?\s*(\d+)\b/i,
      /\bS(?:eason)?\s*(\d+)\s+E(?:pisode)?\s*(\d+)\b/i,
      /\bSeason\s*(\d+)\s*[,\-:]?\s*Episode\s*(\d+)\b/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          season: Number.parseInt(match[1], 10),
          episode: Number.parseInt(match[2], 10),
        };
      }
    }
    return null;
  }

  function readCurrentEpisode() {
    const node = findTitleNode();
    const nodeText = cleanText(node?.textContent);
    const documentText = cleanText(document.body?.innerText);
    const titleText = cleanText(document.title.replace(/\s*[|\-]\s*Netflix.*$/i, ''));

    const candidates = [nodeText, documentText, titleText].filter(Boolean);
    let numbering = null;
    for (const candidate of candidates) {
      numbering = parseEpisodeNumber(candidate);
      if (numbering) break;
    }

    if (!numbering) {
      log('Could not detect a season/episode yet.', { nodeText, titleText });
      return null;
    }

    let showTitle = '';

    if (node) {
      const heading = node.querySelector('h4');
      showTitle = cleanText(heading?.textContent);

      if (!showTitle) {
        const parts = Array.from(node.querySelectorAll('h4, span, div'))
          .map((el) => cleanText(el.textContent))
          .filter(Boolean);
        const index = parts.findIndex((part) => parseEpisodeNumber(part));
        if (index > 0) showTitle = parts[index - 1];
      }

      if (!showTitle) {
        const match = nodeText.match(/^(.+?)\s+S(?:eason\s*)?\d+/i);
        if (match) showTitle = cleanText(match[1]);
      }
    }

    if (!showTitle) {
      const match = titleText.match(/^Watch\s+(.+?)(?:\s+[-|])?\s*$/i);
      showTitle = cleanText(match?.[1] || titleText);
    }

    if (!showTitle) return null;

    const result = {
      title: showTitle,
      season: numbering.season,
      episode: numbering.episode,
      key: `${showTitle}|${numbering.season}|${numbering.episode}`,
    };

    if (result.key !== lastEpisodeKey) {
      log('Current episode detected:', result);
      lastEpisodeKey = result.key;
    }

    return result;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'FLIXRATE_GET_CURRENT_EPISODE') return;
    sendResponse({
      episode: readCurrentEpisode(),
      url: location.href,
    });
  });

  window.setInterval(readCurrentEpisode, 1000);
})();
