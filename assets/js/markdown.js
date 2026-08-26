/* ==========================================================================
   markdown.js — Self-contained Markdown renderer for the documentation portal.

   No external dependencies. Supports the subset the documentation uses:
     headings, paragraphs, fenced code, inline code, bold, italic, links,
     nested lists, tables (with alignment and trailing-cell spanning),
     blockquotes, horizontal rules, ::: containers (callouts + <details>),
     and {Badge} tokens.

   Two deliberate behaviours worth knowing about:
     1. In-page anchors are rewritten to hash routes (#/page/anchor) so the
        router keeps working and deep links survive a reload.
     2. If a document contains more than one level-1 heading, every heading
        after the first is demoted one level. Long specification documents use
        H1 for module bands and H2 for requirements; demoting keeps exactly one
        document title and gives the table of contents a usable hierarchy.
   ========================================================================== */
(function (global) {
  'use strict';

  // Sentinels park inline-code contents while the rest of the inline pass runs.
  // U+0000 cannot occur in the source documents.
  var CODE_OPEN = '\u0001TTTC';
  var CODE_CLOSE = 'CTTT\u0001';

  /* --- helpers ----------------------------------------------------------- */

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function dedent(line, n) {
    var i = 0;
    while (i < n && line.charAt(i) === ' ') i++;
    return line.slice(i);
  }

  function isBlank(line) { return /^\s*$/.test(line); }

  /* --- badges ------------------------------------------------------------ */

  var BADGE_CLASS = {
    'p0': 'p0', 'p1': 'p1', 'p2': 'p2', 'p3': 'p3',
    'high': 'high', 'medium': 'medium', 'low': 'low',
    'confirmed': 'confirmed', 'derived': 'derived',
    'proposed': 'proposed', 'open': 'open',
    'mvp': 'mvp', 'future': 'future', 'v1.1': 'future', 'v2': 'future',
    'basic': 'basic', 'standard': 'standard', 'premium': 'premium',
    'invariant': 'invariant',
    'resolved': 'resolved', 'decision': 'open', 'unresolved': 'open'
  };

  function badgeClass(label) {
    var key = label.toLowerCase().trim();
    if (BADGE_CLASS[key]) return BADGE_CLASS[key];
    var first = key.split(/[\s\-/]+/)[0];
    return BADGE_CLASS[first] || '';
  }

  var BADGE_TOKEN = /^\{([A-Za-z0-9][A-Za-z0-9 ./&+\-]{0,44})\}$/;

  function renderBadge(label) {
    var cls = badgeClass(label);
    return '<span class="badge' + (cls ? ' badge-' + cls : '') + '">' + escapeHtml(label) + '</span>';
  }

  /* --- inline ------------------------------------------------------------ */

  function resolveHref(href, pageSlug) {
    if (/^#\//.test(href)) return href;                       // already a route
    if (/^#/.test(href)) {                                    // in-page anchor
      return pageSlug ? '#/' + pageSlug + '/' + href.slice(1) : href;
    }
    if (/^\s*javascript:/i.test(href)) return '#';            // refuse script URLs
    return href;
  }

  function inline(text, ctx) {
    var codes = [];

    // 1. Protect inline code so nothing else touches its contents.
    text = String(text).replace(/`([^`]+)`/g, function (_, c) {
      codes.push(c);
      return CODE_OPEN + (codes.length - 1) + CODE_CLOSE;
    });

    // 2. Escape everything that remains.
    text = escapeHtml(text);

    // 3. Links.
    text = text.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, label, href) {
      var resolved = resolveHref(href, ctx.pageSlug);
      var external = /^https?:/i.test(resolved);
      return '<a href="' + escapeHtml(resolved) + '"' +
        (external ? ' target="_blank" rel="noopener noreferrer"' : '') +
        '>' + label + '</a>';
    });

    // 4. Emphasis. Underscore emphasis is deliberately unsupported: the
    //    documentation contains identifiers such as organization_id.
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[\s(\[])\*([^*\n]+)\*(?=[\s).,;:!?\]]|$)/g, '$1<em>$2</em>');

    // 5. Badges.
    text = text.replace(/\{([A-Za-z0-9][A-Za-z0-9 ./&+\-]{0,44})\}/g, function (m, label) {
      return renderBadge(label);
    });

    // 6. Restore inline code. A code span whose entire content is a badge token
    //    becomes a badge: the documents write both `{Confirmed}` and {Confirmed}
    //    and both should render identically.
    text = text.replace(new RegExp(CODE_OPEN + '(\\d+)' + CODE_CLOSE, 'g'), function (_, i) {
      var content = codes[+i];
      var token = content.match(BADGE_TOKEN);
      if (token) return renderBadge(token[1]);
      return '<code>' + escapeHtml(content) + '</code>';
    });

    return text;
  }

  /* --- headings ---------------------------------------------------------- */

  // Headings that open with a stable identifier take that identifier as their
  // anchor, so cross-references such as (#req-time-001) resolve regardless of
  // the descriptive text that follows.
  var ID_PREFIX = /^`?((?:REQ|NFR|BR|RISK|ASM|OQ|CONF|GAP|JRN)(?:-[A-Z0-9]+){1,2})`?(?=\s|$)/i;

  function headingId(raw, ctx) {
    var clean = raw.replace(/\{[^}]*\}/g, '').trim();
    var m = clean.match(ID_PREFIX);
    var base;
    if (m) {
      base = m[1].toLowerCase();
    } else {
      base = clean
        .toLowerCase()
        .replace(/`/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }
    if (!base) base = 'section';
    if (ctx.ids[base] === undefined) {
      ctx.ids[base] = 0;
      return base;
    }
    ctx.ids[base] += 1;
    return base + '-' + ctx.ids[base];
  }

  function headingText(raw) {
    return raw
      .replace(/\{[^}]*\}/g, '')
      .replace(/`/g, '')
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* --- tables ------------------------------------------------------------ */

  function splitRow(line) {
    var s = line.trim();
    if (s.charAt(0) === '|') s = s.slice(1);
    if (s.charAt(s.length - 1) === '|') s = s.slice(0, -1);

    var cells = [];
    var buf = '';
    var inCode = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '`') inCode = !inCode;
      if (ch === '|' && !inCode) { cells.push(buf.trim()); buf = ''; }
      else buf += ch;
    }
    cells.push(buf.trim());
    return cells;
  }

  var ALIGN_ROW = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

  function alignments(line) {
    return splitRow(line).map(function (c) {
      var left = c.charAt(0) === ':';
      var right = c.charAt(c.length - 1) === ':';
      if (left && right) return 'center';
      if (right) return 'right';
      if (left) return 'left';
      return '';
    });
  }

  function renderTable(headerLine, alignLine, bodyLines, ctx) {
    var head = splitRow(headerLine);
    var align = alignments(alignLine);
    var out = '<div class="table-wrap"><table><thead><tr>';

    head.forEach(function (cell, i) {
      var a = align[i] ? ' style="text-align:' + align[i] + '"' : '';
      out += '<th' + a + '>' + inline(cell, ctx) + '</th>';
    });
    out += '</tr></thead><tbody>';

    bodyLines.forEach(function (line) {
      var cells = splitRow(line);

      // Collapse a run of trailing empty cells into a colspan on the last
      // populated cell. Source rows such as "| Feature | note |||" then render
      // as a single spanning cell instead of three blank ones.
      var span = 0;
      while (cells.length > 1 && cells[cells.length - 1] === '') { cells.pop(); span++; }

      out += '<tr>';
      cells.forEach(function (cell, i) {
        var isLast = i === cells.length - 1;
        var a = align[i] ? ' style="text-align:' + align[i] + '"' : '';
        var cs = (isLast && span > 0) ? ' colspan="' + (span + 1) + '"' : '';
        out += '<td' + cs + a + '>' + inline(cell, ctx) + '</td>';
      });
      out += '</tr>';
    });

    return out + '</tbody></table></div>';
  }

  /* --- containers -------------------------------------------------------- */

  var CALLOUT_ICONS = {
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.6"/></svg>',
    warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5l8.5 15h-17z"/><path d="M12 10v4M12 16.8v.4"/></svg>',
    danger: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    tip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 17h5M10 20h4"/><path d="M12 3.5a5.5 5.5 0 013.2 9.9c-.5.4-.8 1-.8 1.6H9.6c0-.6-.3-1.2-.8-1.6A5.5 5.5 0 0112 3.5z"/></svg>',
    decision: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l8 4.6v7.8l-8 4.6-8-4.6V8.1z"/><path d="M12 11v5"/></svg>'
  };

  var CALLOUT_LABELS = {
    note: 'Note', warning: 'Important', danger: 'Critical',
    tip: 'Recommendation', decision: 'Decision required'
  };

  function renderContainer(type, title, innerLines, ctx) {
    var body = parseBlocks(innerLines, ctx);

    if (type === 'details') {
      return '<details><summary>' + inline(title || 'Details', ctx) + '</summary>' + body + '</details>';
    }

    var kind = CALLOUT_ICONS[type] ? type : 'note';
    var label = title ? inline(title, ctx) : escapeHtml(CALLOUT_LABELS[kind]);
    return '<div class="callout callout-' + kind + '">' +
      '<div class="callout-title">' + CALLOUT_ICONS[kind] + '<span>' + label + '</span></div>' +
      body + '</div>';
  }

  /* --- lists ------------------------------------------------------------- */

  var LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+([\s\S]*)$/;

  function renderList(block, ctx) {
    var first = block[0].match(LIST_ITEM);
    var baseIndent = first[1].length;
    var ordered = /\d/.test(first[2]);
    var items = [];
    var cur = null;

    for (var i = 0; i < block.length; i++) {
      var line = block[i];
      var m = line.match(LIST_ITEM);
      if (m && m[1].length <= baseIndent + 1) {
        if (cur) items.push(cur);
        cur = { lines: [m[3]], cont: m[1].length + m[2].length + 1 };
      } else if (cur) {
        cur.lines.push(isBlank(line) ? '' : dedent(line, cur.cont));
      }
    }
    if (cur) items.push(cur);

    var tag = ordered ? 'ol' : 'ul';
    var out = '<' + tag + '>';

    items.forEach(function (item) {
      var content;
      var meaningful = item.lines.filter(function (l) { return !isBlank(l); });
      if (meaningful.length <= 1) {
        content = inline(meaningful[0] || '', ctx);
      } else {
        content = parseBlocks(item.lines, ctx)
          .replace(/^<p>([\s\S]*?)<\/p>/, '$1'); // tighten the first paragraph
      }
      out += '<li>' + content + '</li>';
    });

    return out + '</' + tag + '>';
  }

  /* --- block parser ------------------------------------------------------ */

  var RE_FENCE = /^(```|~~~)\s*([\w+-]*)\s*$/;
  var RE_HEADING = /^(#{1,6})\s+(.*)$/;
  var RE_HR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
  var RE_CONTAINER_OPEN = /^:::\s*([a-zA-Z][\w-]*)\s*(.*)$/;
  var RE_CONTAINER_CLOSE = /^:::\s*$/;
  var RE_QUOTE = /^>\s?/;

  function startsBlock(line) {
    return RE_HEADING.test(line) || RE_FENCE.test(line) || RE_HR.test(line) ||
      RE_CONTAINER_OPEN.test(line) || RE_CONTAINER_CLOSE.test(line) ||
      RE_QUOTE.test(line) || LIST_ITEM.test(line);
  }

  function parseBlocks(lines, ctx) {
    var out = '';
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (isBlank(line)) { i++; continue; }

      // Fenced code
      var fence = line.match(RE_FENCE);
      if (fence) {
        var marker = fence[1];
        var lang = fence[2] || '';
        var buf = [];
        i++;
        while (i < lines.length && lines[i].trim().slice(0, marker.length) !== marker) {
          buf.push(lines[i]); i++;
        }
        i++; // consume the closing fence
        out += '<pre><code' + (lang ? ' class="lang-' + escapeHtml(lang) + '"' : '') + '>' +
          escapeHtml(buf.join('\n')) + '</code></pre>';
        continue;
      }

      // ::: container
      var open = line.match(RE_CONTAINER_OPEN);
      if (open && !RE_CONTAINER_CLOSE.test(line)) {
        var type = open[1].toLowerCase();
        var title = open[2] || '';
        var inner = [];
        var depth = 1;
        i++;
        while (i < lines.length) {
          if (RE_CONTAINER_CLOSE.test(lines[i])) { depth--; if (depth === 0) break; }
          else if (RE_CONTAINER_OPEN.test(lines[i])) depth++;
          inner.push(lines[i]); i++;
        }
        i++; // consume the closing :::
        out += renderContainer(type, title, inner, ctx);
        continue;
      }

      // Heading
      var head = line.match(RE_HEADING);
      if (head) {
        var level = head[1].length;
        if (ctx.demote && !ctx.firstHeadingSeen) ctx.firstHeadingSeen = true;
        else if (ctx.demote) level = Math.min(level + 1, 6);
        else ctx.firstHeadingSeen = true;

        var raw = head[2].trim().replace(/\s+#+\s*$/, '');
        var id = headingId(raw, ctx);
        var text = headingText(raw);

        ctx.headings.push({ level: level, id: id, text: text });

        var anchor = level > 1
          ? '<a class="heading-anchor" href="#/' + ctx.pageSlug + '/' + id + '" aria-label="Link to this section">#</a>'
          : '';
        out += '<h' + level + ' id="' + id + '">' + anchor + inline(raw, ctx) + '</h' + level + '>';
        i++;
        continue;
      }

      // Horizontal rule
      if (RE_HR.test(line)) { out += '<hr>'; i++; continue; }

      // Table
      if (line.indexOf('|') !== -1 && i + 1 < lines.length && ALIGN_ROW.test(lines[i + 1])) {
        var headerLine = line;
        var alignLine = lines[i + 1];
        var body = [];
        i += 2;
        while (i < lines.length && !isBlank(lines[i]) && lines[i].indexOf('|') !== -1) {
          body.push(lines[i]); i++;
        }
        out += renderTable(headerLine, alignLine, body, ctx);
        continue;
      }

      // Blockquote
      if (RE_QUOTE.test(line)) {
        var q = [];
        while (i < lines.length && (RE_QUOTE.test(lines[i]) || (!isBlank(lines[i]) && q.length && !startsBlock(lines[i])))) {
          q.push(lines[i].replace(RE_QUOTE, '')); i++;
        }
        out += '<blockquote>' + parseBlocks(q, ctx) + '</blockquote>';
        continue;
      }

      // List
      var firstItem = line.match(LIST_ITEM);
      if (firstItem) {
        var baseIndent = firstItem[1].length;
        var baseOrdered = /\d/.test(firstItem[2]);

        // A sibling item whose marker type differs starts a *new* list rather
        // than continuing this one, so an ordered list following a bulleted one
        // is not absorbed into it.
        var breaksList = function (m) {
          return m && m[1].length <= baseIndent + 1 && (/\d/.test(m[2]) !== baseOrdered);
        };

        var block = [];
        while (i < lines.length) {
          var l = lines[i];
          var lm = l.match(LIST_ITEM);
          if (lm) {
            if (breaksList(lm)) break;
            block.push(l); i++; continue;
          }
          if (isBlank(l)) {
            var nxt = lines[i + 1];
            if (nxt === undefined) break;
            var nm = nxt.match(LIST_ITEM);
            if (nm && !breaksList(nm)) { block.push(l); i++; continue; }
            if (!nm && /^\s{2,}\S/.test(nxt)) { block.push(l); i++; continue; }
            break;
          }
          if (/^\s{2,}\S/.test(l)) { block.push(l); i++; continue; }
          break;
        }
        out += renderList(block, ctx);
        continue;
      }

      // Paragraph
      var para = [];
      while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines[i])) {
        // A table header may follow directly; stop before it.
        if (lines[i].indexOf('|') !== -1 && i + 1 < lines.length && ALIGN_ROW.test(lines[i + 1])) break;
        para.push(lines[i]); i++;
      }
      if (para.length) {
        var html = inline(para.join('\n').replace(/\n/g, ' '), ctx);
        var cls = '';
        if (/^<span class="badge/.test(html)) {
          cls = /^(?:<span class="badge[^>]*>[^<]*<\/span>\s*)+$/.test(html) ? ' class="badge-row"' : ' class="meta-row"';
        }
        out += '<p' + cls + '>' + html + '</p>';
      } else {
        i++; // safety valve: never loop forever on an unrecognised line
      }
    }

    return out;
  }

  /* --- public API -------------------------------------------------------- */

  function render(source, options) {
    options = options || {};
    var text = String(source).replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
    var lines = text.split('\n');

    // Count level-1 headings outside fenced code to decide on demotion.
    var h1 = 0, inFence = false;
    for (var k = 0; k < lines.length; k++) {
      if (RE_FENCE.test(lines[k])) { inFence = !inFence; continue; }
      if (!inFence && /^#\s+/.test(lines[k])) h1++;
    }

    var ctx = {
      pageSlug: options.pageSlug || '',
      headings: [],
      ids: {},
      demote: h1 > 1,
      firstHeadingSeen: false
    };

    return { html: parseBlocks(lines, ctx), headings: ctx.headings };
  }

  function plain(source) {
    return String(source)
      .replace(/\r\n?/g, '\n')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/^:::.*$/gm, ' ')
      .replace(/^\s*\|?\s*:?-{2,}:?[\s|:-]*$/gm, ' ')
      .replace(/[|>#*`]/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\{([^}]{0,44})\}/g, '$1')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n');
  }

  global.TTTMarkdown = { render: render, plain: plain, escapeHtml: escapeHtml };
})(window);
