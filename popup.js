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

function paintStar(tier, label = tier.label) {
  ratingStar.className = `rating-star rating-star--${tier.id}`;
  ratingStar.style.background = tier.color;
  ratingStar.title = `FlixRate — ${label}`;
  ratingStar.setAttribute('aria-label', `FlixRate — ${label}`);
}

async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function getDetectedEpisode(tabId) {
  const result = await chrome.runtime.sendMessage({
    type: 'FLIXRATE_GET_EPISODE_FOR_TAB',
    tabId,
  });
  return result?.episode || null;
}

async function loadEpisode() {
  currentEpisode.textContent = 'Detecting episode…';
  currentState.textContent = 'Reading Netflix episode metadata…';
  paintStar(FlixRateRatings.UNRATED, 'Waiting for episode data');

  const tab = await getCurrentTab();
  if (!tab?.id || !/^https:\/\/www\.netflix\.com\//i.test(tab.url || '')) {
    currentEpisode.textContent = 'Netflix is not the active tab';
    currentState.textContent = 'Open a Netflix episode and reopen FlixRate.';
    return;
  }

  const episode = await getDetectedEpisode(tab.id);
  if (!episode) {
    currentEpisode.textContent = 'Episode not detected yet';
    currentState.textContent = 'Start playback, wait a second, then reopen the popup. FlixRate now checks Netflix metadata, player text, and the visible page text.';
    return;
  }

  currentEpisode.textContent = episode.title;
  currentState.textContent = `Season ${episode.season} · Episode ${episode.episode} · detected via ${episode.source}`;
  paintStar(FlixRateRatings.UNRATED, 'Fetching IMDb rating…');

  try {
    const data = await chrome.runtime.sendMessage({
      type: 'FLIXRATE_FETCH_RATING',
      payload: episode,
    });
    const tier = FlixRateRatings.getTier(data?.rating ?? null, data?.votes ?? 0);
    paintStar(tier, tier.label);

    if (data?.rating != null) {
      currentState.textContent = `${data.rating.toFixed(1)}/10 · ${Number(data.votes || 0).toLocaleString()} IMDb votes · ${tier.label}`;
    } else {
      currentState.textContent = data?.error || 'No usable IMDb rating found.';
    }
  } catch (error) {
    paintStar(FlixRateRatings.UNRATED, 'Rating unavailable');
    currentState.textContent = `Lookup error: ${String(error?.message || error)}`;
  }
}

chrome.storage.local.get({ enabled: true }, ({ enabled }) => renderEnabled(enabled));

toggle.addEventListener('click', async () => {
  const { enabled = true } = await chrome.storage.local.get({ enabled: true });
  const next = !enabled;
  await chrome.storage.local.set({ enabled: next });
  renderEnabled(next);
});

loadEpisode().catch((error) => {
  currentEpisode.textContent = 'Detection error';
  currentState.textContent = String(error?.message || error);
  paintStar(FlixRateRatings.UNRATED, 'Detection error');
});
