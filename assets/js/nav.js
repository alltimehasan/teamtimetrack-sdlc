/* ==========================================================================
   nav.js — Navigation model
   Single source of truth for page order, grouping, titles and breadcrumbs.
   Adding a document means adding one entry here and one file in docs/.
   ========================================================================== */
(function (global) {
  'use strict';

  var SECTIONS = [
    {
      title: 'Start here',
      items: [
        { slug: 'index',    title: 'Overview' },
        { slug: 'glossary', title: 'Glossary' }
      ]
    },
    {
      title: 'Product',
      items: [
        { slug: 'product-vision',   title: 'Product Vision' },
        { slug: 'scope',            title: 'Scope' },
        { slug: 'product-analysis', title: 'Product Analysis' },
        { slug: 'product-modules',  title: 'Product Modules', tag: '22' }
      ]
    },
    {
      title: 'Planning',
      items: [
        { slug: 'project-planning', title: 'Project Planning' },
        { slug: 'stakeholders',     title: 'Stakeholders' },
        { slug: 'personas',         title: 'Personas', tag: '6' },
        { slug: 'user-journeys',    title: 'User Journeys', tag: '18' },
        { slug: 'risks',            title: 'Risks', tag: '24' }
      ]
    },
    {
      title: 'Requirements',
      items: [
        { slug: 'functional-requirements',     title: 'Functional Requirements', tag: '161' },
        { slug: 'non-functional-requirements', title: 'Non-Functional Requirements', tag: '65' },
        { slug: 'business-rules',              title: 'Business Rules' },
        { slug: 'security-privacy',            title: 'Security & Privacy' },
        { slug: 'traceability',                title: 'Traceability' }
      ]
    },
    {
      title: 'Decisions & evidence',
      items: [
        { slug: 'source-audit',    title: 'Source & Research Audit' },
        { slug: 'assumptions',     title: 'Assumptions', tag: '24' },
        { slug: 'open-questions',  title: 'Open Questions', tag: '28' },
        { slug: 'answers-decisions',  title: 'Answers & Decisions' },
        { slug: 'answers-decisions-verify',  title: 'Answers & Decisions Verify' }
      ]
    }
  ];

  // Flat ordered list, used for previous/next and lookup.
  var FLAT = [];
  SECTIONS.forEach(function (section) {
    section.items.forEach(function (item) {
      FLAT.push({
        slug: item.slug,
        title: item.title,
        tag: item.tag || null,
        section: section.title
      });
    });
  });

  var BY_SLUG = {};
  FLAT.forEach(function (page, i) {
    page.index = i;
    BY_SLUG[page.slug] = page;
  });

  global.TTTNav = {
    sections: SECTIONS,
    flat: FLAT,
    defaultSlug: 'index',
    get: function (slug) { return BY_SLUG[slug] || null; },
    exists: function (slug) { return Object.prototype.hasOwnProperty.call(BY_SLUG, slug); },
    prev: function (slug) {
      var p = BY_SLUG[slug];
      return p && p.index > 0 ? FLAT[p.index - 1] : null;
    },
    next: function (slug) {
      var p = BY_SLUG[slug];
      return p && p.index < FLAT.length - 1 ? FLAT[p.index + 1] : null;
    },
    path: function (slug) { return 'docs/' + slug + '.md'; }
  };
})(window);
