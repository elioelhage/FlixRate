(() => {
  const STAR_ID = 'flixrate-star';
  const VOLUME_SELECTORS = [
    '[data-uia="control-volume"]',
    '[data-uia="control-volume-container"]',
    'button[aria-label*="Volume"]',
    'button[aria-label*="volume"]'
  ];

  let enabled = true;
  let observer = null;
  let lastAnchor = null;

  const STAR_SVG = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.6l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.16l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 2.6z"/>
    </svg>`;

  function findVolumeControl() {
    for (const selector of VOLUME_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) return element.closest('button, [role="button"]') || element;
    }
    return null;
  }

  function removeStar() {
    document.getElementById(STAR_ID)?.remove();
    lastAnchor = null;
  }

  function createStar(anchor) {
    removeStar();

    const star = document.createElement('button');
    star.id = STAR_ID;
    star.className = 'flixrate-star';
    star.type = 'button';
    star.title = 'FlixRate — Not enough ratings';
    star.setAttribute('aria-label', 'FlixRate — Not enough ratings');
    star.dataset.ratingState = 'unrated';
    star.innerHTML = STAR_SVG;

    const parent = anchor.parentElement;
    if (!parent) return;

    // Insert directly beside Netflix's volume control so the button follows
    // the same playback-control row and autohide behavior.
    parent.insertBefore(star, anchor.nextSibling);
    lastAnchor = anchor;
  }

  function syncStar() {
    if (!enabled) {
      removeStar();
      return;
    }

    const anchor = findVolumeControl();
    if (!anchor) return;

    const current = document.getElementById(STAR_ID);
    if (!current || lastAnchor !== anchor || !anchor.parentElement.contains(current)) {
      createStar(anchor);
    }
  }

  function startObserver() {
    if (observer) return;

    observer = new MutationObserver(() => {
      syncStar();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function init() {
    startObserver();
    syncStar();

    // Netflix is a SPA and may rebuild the player without a useful route event.
    window.setInterval(syncStar, 1000);
  }

  chrome.storage.local.get({ enabled: true }, (result) => {
    enabled = result.enabled !== false;
    init();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.enabled) return;
    enabled = changes.enabled.newValue !== false;
    syncStar();
  });
})();
