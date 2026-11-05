// Runs before first paint (loaded synchronously in <head>) so the chosen theme never flashes.
;(function () {
  try {
    var mode = localStorage.getItem('whale.theme') || 'system'
    var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
})()
