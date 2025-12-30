document.addEventListener('DOMContentLoaded', function() {
  chrome.runtime.sendMessage({
    action: 'pageLoaded',
    url: window.location.href
  });
});

window.addEventListener('load', function() {
  chrome.runtime.sendMessage({
    action: 'pageLoaded',
    url: window.location.href
  });
});
