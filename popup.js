const toggle = document.getElementById('toggle');
const statusText = document.getElementById('statusText');

function render(enabled) {
  toggle.classList.toggle('on', enabled);
  toggle.setAttribute('aria-checked', String(enabled));
  statusText.textContent = enabled ? 'Enabled' : 'Disabled';
}

chrome.storage.local.get({ enabled: true }, ({ enabled }) => render(enabled));

toggle.addEventListener('click', async () => {
  const { enabled = true } = await chrome.storage.local.get({ enabled: true });
  const next = !enabled;
  await chrome.storage.local.set({ enabled: next });
  render(next);
});
