(function (root) {
  const MIN_VOTES = 400;

  const TIERS = [
    { id: 'purple', color: '#8e44ec', label: 'Masterpiece', range: '9.5 – 10', test: (r) => r >= 9.5 },
    { id: 'dark-green', color: '#1e6b30', label: 'Excellent', range: '8.8 – 9.4', test: (r) => r >= 8.8 && r < 9.5 },
    { id: 'lime-green', color: '#6fbf3c', label: 'Great', range: '8.0 – 8.7', test: (r) => r >= 8.0 && r < 8.8 },
    { id: 'yellow', color: '#f5c518', label: 'Good', range: '7.0 – 7.9', test: (r) => r >= 7.0 && r < 8.0 },
    { id: 'orange', color: '#e67e22', label: 'Mediocre', range: '6.0 – 6.9', test: (r) => r >= 6.0 && r < 7.0 },
    { id: 'red', color: '#d7263d', label: 'Poor', range: '3.1 – 5.9', test: (r) => r >= 3.1 && r < 6.0 },
    { id: 'maroon', color: '#5c2a1a', label: 'Horrific', range: '0 – 3.0', test: (r) => r >= 0 && r <= 3.0 },
  ];

  const UNRATED = {
    id: 'unrated',
    color: '#ffffff',
    label: 'Not enough ratings',
    range: null,
  };

  function getTier(rating, votes) {
    if (rating == null || typeof rating !== 'number' || Number.isNaN(rating)) return UNRATED;
    if (!votes || votes < MIN_VOTES) return UNRATED;
    return TIERS.find((tier) => tier.test(rating)) || UNRATED;
  }

  root.FlixRateRatings = { TIERS, UNRATED, MIN_VOTES, getTier };
})(typeof window !== 'undefined' ? window : globalThis);
