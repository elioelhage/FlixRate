const toggle = document.getElementById('toggle');
const statusText = document.getElementById('statusText');
const legendList = document.getElementById('legendList');

function render(enabled) {
  toggle.classList.toggle('on', enabled);
  toggle.setAttribute('aria-checked', String(enabled));
  statusText.textContent = enabled ? 'Enabled' : 'Disabled';
}

function renderLegend() {
  legendList.innerHTML = FlixRateRatings.TIERS.map(
    (tier) => `
      <li class="legend-item">
        <span class="swatch" style="background:${tier.color}"></span>
        <div class="legend-copy">
          <span class="legend-label">${tier.label}</span>
          <span class="legend-range">${tier.range}</span>
        </div>
      </li>`
  ).join('');
}

chrome.storage.local.get({ enabled: true }, ({ enabled }) => render(enabled));
renderLegend();

toggle.addEventListener('click', async () => {
  const { enabled = true } = await chrome.storage.local.get({ enabled: true });
  const next = !enabled;
  await chrome.storage.local.set({ enabled: next });
  render(next);
});
