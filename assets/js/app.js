/* ==========================================================================
   app.js — Routing, loading, rendering and UI behaviour.

   Route shape:  #/<page-slug>            e.g. #/functional-requirements
                 #/<page-slug>/<anchor>   e.g. #/functional-requirements/req-time-001

   Anchors are part of the route rather than a bare fragment so that in-page
   links, the table of contents, heading links and browser reloads all behave
   consistently.
   ========================================================================== */
(function () {
  'use strict';

  var Nav = window.TTTNav;
  var MD = window.TTTMarkdown;
  var Search = window.TTTSearch;

  var el = {
    doc: document.getElementById('doc'),
    content: document.getElementById('content'),
    navList: document.getElementById('navList'),
    toc: document.getElementById('toc'),
    pager: document.getElementById('pager'),
    crumbs: document.getElementById('breadcrumbs'),
    sidebar: document.getElementById('sidebar'),
    backdrop: document.getElementById('backdrop'),
    menuToggle: document.getElementById('menuToggle'),
    themeToggle: document.getElementById('themeToggle'),
    searchOpen: document.getElementById('searchOpen'),
    searchHint: document.getElementById('searchHint'),
    overlay: document.getElementById('searchOverlay'),
    searchInput: document.getElementById('searchInput'),
    searchResults: document.getElementById('searchResults'),
    searchClose: document.getElementById('searchClose')
  };

  var cache = Object.create(null);   // slug -> { raw, html, headings }
  var current = null;                // slug currently rendered
  var tocLinks = [];
  var tocTargets = [];

  /* --- utilities --------------------------------------------------------- */

  function esc(s) { return MD.escapeHtml(s); }

  function parseRoute() {
    var hash = location.hash || '';
    if (hash.indexOf('#/') !== 0) return { slug: Nav.defaultSlug, anchor: null };
    var rest = hash.slice(2);
    var cut = rest.indexOf('/');
    if (cut === -1) return { slug: decodeURIComponent(rest) || Nav.defaultSlug, anchor: null };
    return {
      slug: decodeURIComponent(rest.slice(0, cut)) || Nav.defaultSlug,
      anchor: decodeURIComponent(rest.slice(cut + 1)) || null
    };
  }

  function scrollToAnchor(anchor) {
    if (!anchor) { window.scrollTo({ top: 0, behavior: 'auto' }); return; }
    var target = document.getElementById(anchor);
    if (target) {
      target.scrollIntoView({ block: 'start', behavior: 'auto' });
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  /* --- navigation -------------------------------------------------------- */

  function buildNav() {
    var html = '';
    Nav.sections.forEach(function (section) {
      html += '<div class="nav-section">';
      html += '<div class="nav-section-title">' + esc(section.title) + '</div>';
      section.items.forEach(function (item) {
        html += '<a class="nav-link" data-slug="' + esc(item.slug) + '" href="#/' + esc(item.slug) + '">' +
          '<span>' + esc(item.title) + '</span>' +
          (item.tag ? '<span class="nav-tag">' + esc(item.tag) + '</span>' : '') +
          '</a>';
      });
      html += '</div>';
    });
    el.navList.innerHTML = html;
  }

  function markActiveNav(slug) {
    var links = el.navList.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute('data-slug') === slug) {
        links[i].setAttribute('aria-current', 'page');
      } else {
        links[i].removeAttribute('aria-current');
      }
    }
  }

  function buildBreadcrumbs(page) {
    if (!page) { el.crumbs.innerHTML = ''; return; }
    el.crumbs.innerHTML =
      '<a href="#/' + esc(Nav.defaultSlug) + '">Documentation</a>' +
      '<span class="sep" aria-hidden="true">/</span>' +
      '<span>' + esc(page.section) + '</span>' +
      '<span class="sep" aria-hidden="true">/</span>' +
      '<span class="current">' + esc(page.title) + '</span>';
  }

  function buildPager(slug) {
    var prev = Nav.prev(slug);
    var next = Nav.next(slug);
    var html = '';
    html += prev
      ? '<a class="pg-prev" href="#/' + esc(prev.slug) + '"><span class="pg-label">Previous</span><span class="pg-title">' + esc(prev.title) + '</span></a>'
      : '<span class="pg-spacer"></span>';
    html += next
      ? '<a class="pg-next" href="#/' + esc(next.slug) + '"><span class="pg-label">Next</span><span class="pg-title">' + esc(next.title) + '</span></a>'
      : '<span class="pg-spacer"></span>';
    el.pager.innerHTML = html;
  }

  /* --- table of contents ------------------------------------------------- */

  function buildToc(slug, headings) {
    if (!el.toc) return;

    // Long specifications would otherwise produce a 180-entry contents list.
    var withSubs = headings.filter(function (h) { return h.level === 2 || h.level === 3; });
    var includeLevel3 = withSubs.length <= 60;
    var shown = headings.filter(function (h) {
      return h.level === 2 || (includeLevel3 && h.level === 3);
    });

    if (!shown.length) {
      el.toc.innerHTML = '<div class="toc-title">On this page</div><p class="toc-empty">No sections.</p>';
      tocLinks = []; tocTargets = [];
      return;
    }

    var html = '<div class="toc-title">On this page</div><nav>';
    shown.forEach(function (h) {
      html += '<a class="lvl-' + h.level + '" href="#/' + esc(slug) + '/' + esc(h.id) + '" data-id="' + esc(h.id) + '">' +
        esc(h.text) + '</a>';
    });
    html += '</nav>';
    el.toc.innerHTML = html;

    tocLinks = Array.prototype.slice.call(el.toc.querySelectorAll('a[data-id]'));
    tocTargets = tocLinks.map(function (a) { return document.getElementById(a.getAttribute('data-id')); });
  }

  var spyQueued = false;
  function updateSpy() {
    if (!tocLinks.length) return;
    var offset = 90;
    var activeIndex = 0;
    for (var i = 0; i < tocTargets.length; i++) {
      var t = tocTargets[i];
      if (t && t.getBoundingClientRect().top <= offset) activeIndex = i;
    }
    for (var j = 0; j < tocLinks.length; j++) {
      tocLinks[j].classList.toggle('active', j === activeIndex);
    }
  }

  window.addEventListener('scroll', function () {
    if (spyQueued) return;
    spyQueued = true;
    requestAnimationFrame(function () { spyQueued = false; updateSpy(); });
  }, { passive: true });

  /* --- document loading -------------------------------------------------- */

  function loadDoc(slug) {
    if (cache[slug]) return Promise.resolve(cache[slug]);
    return fetch(Nav.path(slug), { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + Nav.path(slug));
        return res.text();
      })
      .then(function (raw) {
        var rendered = MD.render(raw, { pageSlug: slug });
        cache[slug] = { raw: raw, html: rendered.html, headings: rendered.headings };
        return cache[slug];
      });
  }

  function showLoading() {
    el.doc.innerHTML = '<div class="doc-loading"><span class="spinner" aria-hidden="true"></span><span>Loading…</span></div>';
  }

  function showFileProtocolNotice() {
    el.doc.innerHTML =
      '<h1>Start a local web server</h1>' +
      '<div class="state-panel">' +
      '<h2>This portal loads its content from <code>docs/*.md</code></h2>' +
      '<p>Browsers block those requests when a page is opened directly from the file system ' +
      '(<code>file://</code>). Serve the project folder over HTTP instead — any static server works.</p>' +
      '<p>From the project root, run one of:</p>' +
      '<pre><code>npx serve .\n\npython -m http.server 8000\n\nphp -S localhost:8000</code></pre>' +
      '<p>Then open <code>http://localhost:8000</code>.</p>' +
      '</div>';
    el.pager.innerHTML = '';
    if (el.toc) el.toc.innerHTML = '';
  }

  function showError(slug, err) {
    el.doc.innerHTML =
      '<h1>Could not load this page</h1>' +
      '<div class="state-panel">' +
      '<h2>' + esc(Nav.path(slug)) + '</h2>' +
      '<p>' + esc(String(err && err.message ? err.message : err)) + '</p>' +
      '<p>Check that the file exists and that the server is serving the project root.</p>' +
      '</div>';
    el.pager.innerHTML = '';
    if (el.toc) el.toc.innerHTML = '';
  }

  function showNotFound(slug) {
    var links = Nav.flat.map(function (p) {
      return '<li><a href="#/' + esc(p.slug) + '">' + esc(p.title) + '</a></li>';
    }).join('');
    el.doc.innerHTML =
      '<h1>Page not found</h1>' +
      '<div class="state-panel"><h2>No document named &ldquo;' + esc(slug) + '&rdquo;</h2>' +
      '<p>Available documents:</p><ul>' + links + '</ul></div>';
    el.pager.innerHTML = '';
    if (el.toc) el.toc.innerHTML = '';
  }

  /* --- routing ----------------------------------------------------------- */

  function route() {
    var r = parseRoute();

    if (!Nav.exists(r.slug)) {
      current = null;
      markActiveNav(null);
      buildBreadcrumbs(null);
      showNotFound(r.slug);
      document.title = 'Not found — Team Time Track';
      return;
    }

    // Same page, different anchor: scroll without re-rendering.
    if (current === r.slug) {
      scrollToAnchor(r.anchor);
      updateSpy();
      return;
    }

    var page = Nav.get(r.slug);
    markActiveNav(r.slug);
    buildBreadcrumbs(page);
    document.title = page.title + ' — Team Time Track';
    showLoading();

    if (location.protocol === 'file:') { showFileProtocolNotice(); return; }

    loadDoc(r.slug)
      .then(function (entry) {
        current = r.slug;
        el.doc.innerHTML = entry.html;
        buildPager(r.slug);
        buildToc(r.slug, entry.headings);
        scrollToAnchor(r.anchor);
        updateSpy();
        closeSidebar();
      })
      .catch(function (err) {
        current = null;
        showError(r.slug, err);
      });
  }

  /* --- sidebar (mobile) -------------------------------------------------- */

  function openSidebar() {
    el.sidebar.classList.add('open');
    el.backdrop.hidden = false;
    el.menuToggle.setAttribute('aria-expanded', 'true');
  }
  function closeSidebar() {
    el.sidebar.classList.remove('open');
    el.backdrop.hidden = true;
    el.menuToggle.setAttribute('aria-expanded', 'false');
  }
  el.menuToggle.addEventListener('click', function () {
    if (el.sidebar.classList.contains('open')) closeSidebar(); else openSidebar();
  });
  el.backdrop.addEventListener('click', closeSidebar);

  /* --- theme ------------------------------------------------------------- */

  function currentTheme() {
    var set = document.documentElement.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  el.themeToggle.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ttt-theme', next); } catch (e) {}
  });

  /* --- search ------------------------------------------------------------ */

  var searchTimer = null;
  var selected = -1;
  var results = [];

  function ensureIndex() {
    if (Search.isBuilt()) return Promise.resolve();
    el.searchResults.innerHTML = '<div class="search-msg">Building index…</div>';
    return Promise.all(Nav.flat.map(function (p) {
      return loadDoc(p.slug)
        .then(function (entry) {
          return { slug: p.slug, title: p.title, raw: entry.raw, headings: entry.headings };
        })
        .catch(function () { return null; });
    })).then(function (docs) {
      Search.build(docs.filter(Boolean));
    });
  }

  function renderResults() {
    if (!results.length) {
      el.searchResults.innerHTML = '<div class="search-msg">No matches.</div>';
      return;
    }
    el.searchResults.innerHTML = results.map(function (r, i) {
      var href = '#/' + r.slug + (r.anchor ? '/' + r.anchor : '');
      return '<a class="search-hit' + (i === selected ? ' sel' : '') + '" role="option" href="' + esc(href) + '" data-i="' + i + '">' +
        '<span class="hit-top"><span class="hit-title">' + esc(r.section) + '</span>' +
        '<span class="hit-page">' + esc(r.page) + '</span></span>' +
        (r.snippet ? '<span class="hit-snippet">' + r.snippet + '</span>' : '') +
        '</a>';
    }).join('');
  }

  function runSearch() {
    var q = el.searchInput.value.trim();
    if (!q) {
      results = []; selected = -1;
      el.searchResults.innerHTML = '<div class="search-msg">Search requirements, business rules, risks, assumptions and decisions.</div>';
      return;
    }
    results = Search.query(q, 30);
    selected = results.length ? 0 : -1;
    renderResults();
  }

  function openSearch() {
    el.overlay.hidden = false;
    el.searchInput.value = '';
    el.searchResults.innerHTML = '<div class="search-msg">Search requirements, business rules, risks, assumptions and decisions.</div>';
    el.searchInput.focus();

    if (location.protocol === 'file:') {
      el.searchResults.innerHTML = '<div class="search-msg">Search needs the documents to be served over HTTP. See the notice on the page behind this dialog.</div>';
      return;
    }
    ensureIndex().then(function () { runSearch(); });
  }

  function closeSearch() {
    el.overlay.hidden = true;
    el.searchOpen.focus();
  }

  el.searchOpen.addEventListener('click', openSearch);
  el.searchClose.addEventListener('click', closeSearch);
  el.overlay.addEventListener('mousedown', function (e) {
    if (e.target === el.overlay) closeSearch();
  });

  el.searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 110);
  });

  el.searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length) { selected = (selected + 1) % results.length; renderResults(); scrollSelectedIntoView(); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length) { selected = (selected - 1 + results.length) % results.length; renderResults(); scrollSelectedIntoView(); }
    } else if (e.key === 'Enter') {
      if (selected >= 0 && results[selected]) {
        e.preventDefault();
        var r = results[selected];
        location.hash = '#/' + r.slug + (r.anchor ? '/' + r.anchor : '');
        closeSearch();
      }
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  });

  function scrollSelectedIntoView() {
    var node = el.searchResults.querySelector('.search-hit.sel');
    if (node && node.scrollIntoView) node.scrollIntoView({ block: 'nearest' });
  }

  el.searchResults.addEventListener('click', function (e) {
    var hit = e.target.closest ? e.target.closest('.search-hit') : null;
    if (hit) closeSearch();
  });

  document.addEventListener('keydown', function (e) {
    var isFind = (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey);
    if (isFind) { e.preventDefault(); if (el.overlay.hidden) openSearch(); else closeSearch(); return; }
    if (e.key === '/' && el.overlay.hidden) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); openSearch(); }
      return;
    }
    if (e.key === 'Escape' && !el.overlay.hidden) closeSearch();
  });

  /* --- boot -------------------------------------------------------------- */

  if (el.searchHint && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) {
    el.searchHint.textContent = '⌘K';
  }

  buildNav();
  window.addEventListener('hashchange', route);

  if (!location.hash || location.hash.indexOf('#/') !== 0) {
    location.replace('#/' + Nav.defaultSlug);
  }
  route();
})();
