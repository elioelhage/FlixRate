const toggle = document.getElementById('toggle');
const statusText = document.getElementById('statusText');
const episodeTitle = document.getElementById('episodeTitle');
const episodeMeta = document.getElementById('episodeMeta');
const ratingWrap = document.getElementById('ratingWrap');
const ratingStar = document.getElementById('ratingStar');
const ratingLabel = document.getElementById('ratingLabel');
const ratingDetails = document.getElementById('ratingDetails');
const errorText = document.getElementById('errorText');
const refresh = document.getElementById('refresh');

function renderEnabled(enabled) {
  toggle.classList.toggle('on', enabled);
  toggle.setAttribute('aria-checked', String(enabled));
  statusText.textContent = enabled ? 'Enabled' : 'Disabled';
}

function resetRating(message = 'Waiting for Netflix…') {
  ratingWrap.hidden = true;
  errorText.hidden = true;
  episodeTitle.textContent = message;
  episodeMeta.textContent = 'Open an episode on Netflix.';
}

function showRating(data) {
  const tier = FlixRateRatings.getTier(data?.rating ?? null, data?.votes ?? 0);
  ratingWrap.hidden = false;
  ratingStar.dataset.tier = tier.id;
  ratingStar.setAttribute('aria-label', tier.label);
  ratingLabel.textContent = tier.label;

  if (data?.rating != null) {
    ratingDetails.textContent = `${data.rating.toFixed(1)}/10 · ${Number(data.votes || 0).toLocaleString()} IMDb votes`;
  } else {
    ratingDetails.textContent = data?.error || 'No usable IMDb rating found.';
  }
}

async function getActiveNetflixTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function loadEpisode() {
  errorText.hidden = true;
  ratingWrap.hidden = true;
  episodeTitle.textContent = 'Detecting episode…';
  episodeMeta.textContent = '';

  const tab = await getActiveNetflixTab();
  if (!tab?.id || !/^https:\/\/www\.netflix\.com\//i.test(tab.url || '')) {
    resetRating('Netflix is not the active tab');
    return;
  }

  let current;
  try {
    current = await chrome.tabs.sendMessage(tab.id, { type: 'FLIXRATE_GET_CURRENT_EPISODE' });
  } catch (error) {
    resetRating('Reload Netflix and try again');
    errorText.hidden = false;
    errorText.textContent = 'FlixRate could not reach the Netflix player. Reload the Netflix tab once after updating the extension.';
    return;
  }

  const episode = current?.episode;
  if (!episode) {
    resetRating('No episode detected yet');
    errorText.hidden = false;
    errorText.textContent = 'Start playback and open the popup again.';
    return;
  }

  episodeTitle.textContent = episode.title;
  episodeMeta.textContent = `Season ${episode.season} · Episode ${episode.episode}`;

  try {
    const data = await chrome.runtime.sendMessage({
      type: 'FLIXRATE_FETCH_RATING',
      payload: episode,
    });

    if (!data) throw new Error('No response from FlixRate background service.');
    showRating(data);

    if (data.error && data.rating == null) {
      errorText.hidden = false;
      errorText.textContent = data.error;
    }
  } catch (error) {
    ratingWrap.hidden = false;
    ratingStar.dataset.tier = 'unrated';
    ratingLabel.textContent = 'Lookup failed';
    ratingDetails.textContent = '';
    errorText.hidden = false;
    errorText.textContent = String(error?.message || error);
  }
}

chrome.storage.local.get({ enabled: true }, ({ enabled }) => renderEnabled(enabled));

toggle.addEventListener('click', async () => {
  const { enabled = true } = await chrome.storage.local.get({ enabled: true });
  const next = !enabled;
  await chrome.storage.local.set({ enabled: next });
  renderEnabled(next);
});

refresh.addEventListener('click', loadEpisode);
loadEpisode();
