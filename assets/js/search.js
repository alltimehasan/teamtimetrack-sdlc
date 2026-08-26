/* ==========================================================================
   search.js — Client-side full-text search over the documentation set.

   The index is built lazily on first use and is section-granular: a hit points
   at the nearest heading rather than at the top of a long document, which
   matters for pages holding 158 requirements.
   ========================================================================== */
(function (global) {
  'use strict';

  var entries = [];
  var built = false;

  /* Split a document into heading-anchored sections. Headings are matched to
     the renderer's heading list by document order, so the anchor ids agree. */
  function sectionise(raw, headings) {
    var lines = String(raw).split('\n');
    var inFence = false;
    var out = [];
    var cur = { heading: null, lines: [] };
    var hi = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; cur.lines.push(line); continue; }
      if (!inFence && /^#{1,6}\s+/.test(line)) {
        out.push(cur);
        cur = { heading: headings[hi++] || null, lines: [] };
        continue;
      }
      cur.lines.push(line);
    }
    out.push(cur);
    return out;
  }

  function build(docs) {
    entries = [];
    docs.forEach(function (doc) {
      var secs = sectionise(doc.raw, doc.headings);
      secs.forEach(function (sec) {
        var text = global.TTTMarkdown.plain(sec.lines.join('\n')).trim();
        var headingText = sec.heading ? sec.heading.text : doc.title;
        if (!text && !sec.heading) return;
        entries.push({
          slug: doc.slug,
          page: doc.title,
          section: headingText,
          anchor: sec.heading ? sec.heading.id : null,
          text: text,
          lcHeading: headingText.toLowerCase(),
          lcText: text.toLowerCase()
        });
      });
    });
    built = true;
  }

  function tokenise(q) {
    return String(q).toLowerCase().split(/[^\w.\-]+/).filter(function (t) { return t.length > 1; });
  }

  function countOccurrences(haystack, needle) {
    var n = 0, idx = 0;
    while ((idx = haystack.indexOf(needle, idx)) !== -1) { n++; idx += needle.length; }
    return n;
  }

  function score(entry, tokens) {
    var total = 0;
    var matched = 0;

    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      var s = 0;

      if (entry.lcHeading === t) s += 60;
      else if (entry.lcHeading.indexOf(t) !== -1) s += 14;

      if (entry.page.toLowerCase().indexOf(t) !== -1) s += 4;

      var inText = countOccurrences(entry.lcText, t);
      if (inText) s += Math.min(inText, 6) * 2;

      if (s > 0) matched++;
      total += s;
    }

    if (matched === 0) return 0;
    // Require every token to appear somewhere, otherwise heavily discount.
    if (matched < tokens.length) total = total * 0.25;
    return total;
  }

  function snippet(entry, tokens) {
    var text = entry.text;
    if (!text) return '';
    var lc = entry.lcText;
    var pos = -1;
    for (var i = 0; i < tokens.length && pos === -1; i++) pos = lc.indexOf(tokens[i]);
    if (pos === -1) pos = 0;

    var start = Math.max(0, pos - 80);
    var end = Math.min(text.length, pos + 160);
    var frag = (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');

    var escaped = global.TTTMarkdown.escapeHtml(frag);
    tokens.forEach(function (t) {
      var safe = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      escaped = escaped.replace(new RegExp('(' + safe + ')', 'gi'), '<mark>$1</mark>');
    });
    return escaped;
  }

  function query(q, limit) {
    if (!built) return [];
    var tokens = tokenise(q);
    if (!tokens.length) return [];

    var hits = [];
    for (var i = 0; i < entries.length; i++) {
      var s = score(entries[i], tokens);
      if (s > 0) hits.push({ entry: entries[i], score: s });
    }

    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, limit || 30).map(function (h) {
      return {
        slug: h.entry.slug,
        page: h.entry.page,
        section: h.entry.section,
        anchor: h.entry.anchor,
        snippet: snippet(h.entry, tokens)
      };
    });
  }

  global.TTTSearch = {
    build: build,
    query: query,
    isBuilt: function () { return built; }
  };
})(window);
