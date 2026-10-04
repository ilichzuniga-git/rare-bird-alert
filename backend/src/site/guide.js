// Tabs by URL hash, so the app can link straight to #whats-new or #privacy.
// Sections are id'd p-<tab> so the hash doesn't also jump-scroll to them.
// Without this script every section simply shows, one after another.
document.documentElement.classList.add('js');

const tabs = ['tour', 'whats-new', 'privacy'];
function show() {
  const id = tabs.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'tour';
  for (const t of tabs) {
    document.getElementById('p-' + t).classList.toggle('on', t === id);
    document.querySelector(`nav a[href="#${t}"]`).classList.toggle('on', t === id);
  }
  window.scrollTo(0, 0);
}
addEventListener('hashchange', show);
addEventListener('DOMContentLoaded', show);
