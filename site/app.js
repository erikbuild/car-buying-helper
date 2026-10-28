// ABOUTME: Connects the page to the deal checks: reads the fields and renders the strip, tabs and cards.
// ABOUTME: Saves the deal on the phone and registers the offline cache.

// Registers the offline cache, so the page opens with no signal after one online visit.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('offline.js', { updateViaCache: 'none' });
}
