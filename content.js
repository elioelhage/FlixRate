(() => {
  const STATE_CLASS = 'flixrate-star';

  function createStar() {
    if (document.querySelector(`.${STATE_CLASS}`)) return;
    const star = document.createElement('button');
    star.className = STATE_CLASS;
    star.type = 'button';
    star.title = 'FlixRate: IMDb episode rating';
    star.setAttribute('aria-label', 'FlixRate IMDb episode rating');
    star.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.16l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 2.6z"/></svg>';
    const controls = document.querySelector('.watch-video--bottom-controls, [class*="controls"]');
    if (controls) controls.appendChild(star);
  }

  chrome.storage.local.get({ enabled: true }, ({ enabled }) => {
    if (!enabled) return;
    // Placement/integration will be wired to Netflix's exact player DOM in the next step.
    // This scaffold intentionally does not fetch or display ratings yet.
    window.setTimeout(createStar, 1000);
  });
})();
