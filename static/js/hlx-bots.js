/* ─────────────────────────────────────────────────────────────────────────
   HYPRLVX Free-Bots & Bot Store Bridge
   Provides seamless category separation between "Free Bots" and "Bot Store"
   inside the website's Free Bots section, backed by persistent backend
   catalog records from /api/appwrite/bots.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var origFetch = window.fetch.bind(window);
  var FILE_VIEW_RE = /\/storage\/buckets\/[^/]+\/files\/([^/?]+)\/view/;
  var API_TIMEOUT_MS = 8000;
  var currentCategory = (function () {
    if (window.location.hash === '#bot_store' || window.location.search.indexOf('tab=bot_store') !== -1) {
      return 'store';
    }
    return sessionStorage.getItem('bh_bot_subtab') || 'free';
  })();
  var cachedBotsCatalog = [];

  function withTimeout(input, init) {
    init = init || {};
    if (init.signal || !window.AbortController) return origFetch(input, init);

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, API_TIMEOUT_MS);
    var nextInit = Object.assign({}, init, { signal: controller.signal });
    return origFetch(input, nextInit).finally(function () { clearTimeout(timer); });
  }

  function looksLikeBotDocument(doc) {
    if (!doc || typeof doc !== 'object') return false;
    var keys = Object.keys(doc).map(function (key) { return key.toLowerCase(); });
    if (keys.some(function (key) {
      return key === 'storagefileid' || key === 'botid' || key === 'botname' ||
        key === 'botdescription' || key === 'botfile' || key === 'botfileid' ||
        key === 'premium' || key === 'xmlfile';
    })) return true;
    return (keys.indexOf('name') !== -1 || keys.indexOf('displayname') !== -1) &&
      (keys.indexOf('file') !== -1 || keys.indexOf('xmlfile') !== -1 ||
       keys.indexOf('category') !== -1 || keys.indexOf('version') !== -1);
  }

  function isAppwriteDocumentsRequest(url) {
    return /appwrite/i.test(url) &&
      /\/databases\/[^/]+\/collections\/[^/]+\/documents/i.test(url);
  }

  function toAppwriteDocument(bot) {
    var botId = String(bot.id || '');
    var storageFileId = String(bot.storageFileId || bot.fileId || botId);
    var name = String(bot.name || bot.botName || bot.displayName || '');
    var description = String(bot.description || bot.botDescription || '');
    return {
      $id: botId,
      $createdAt: bot.createdAt || new Date().toISOString(),
      $updatedAt: bot.updatedAt || new Date().toISOString(),
      id: botId,
      botId: botId,
      name: name,
      botName: name,
      displayName: name,
      description: description,
      botDescription: description,
      category: bot.category || 'General',
      destination: bot.destination || 'free',
      version: bot.version || '1.0.0',
      premium: bot.premium === true,
      storageFileId: storageFileId,
      fileId: storageFileId,
      file: bot.file || '',
      data: bot
    };
  }

  function primeBotsCache(callback) {
    origFetch('/api/appwrite/bots', { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !Array.isArray(data.bots) || !data.bots.length) return;
        cachedBotsCatalog = data.bots;
        window.__HLX_BOTS_CATALOG__ = data.bots;
        var docs = data.bots.map(toAppwriteDocument);
        try {
          var h = window.location.hostname;
          var clean = h.replace(/^www\./i, '');
          localStorage.setItem('bots.cache.' + h, JSON.stringify(docs));
          localStorage.setItem('bots.cache.' + clean, JSON.stringify(docs));
          localStorage.setItem('bots.cache.www.' + clean, JSON.stringify(docs));
        } catch (_) {}
        if (typeof callback === 'function') callback(data.bots);
        setTimeout(applyCategoryFilterAndSubnav, 50);
      }).catch(function () {});
  }

  // Eagerly prime bot cache on script load
  primeBotsCache();

  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';

      /* Free Bot file: Appwrite storage -> our public site bot endpoint. */
      if (/appwrite/i.test(url)) {
        var m = url.match(FILE_VIEW_RE);
        if (m && m[1]) {
          return withTimeout('/api/appwrite/bot-xml?id=' + encodeURIComponent(m[1]), init);
        }
      }

      /* Free Bot catalog intercept: always provide our local catalog as Appwrite documents */
      if (isAppwriteDocumentsRequest(url)) {
        return withTimeout('/api/appwrite/bots', {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        }).then(function (res) {
          if (!res.ok) throw new Error('Local bots API responded with ' + res.status);
          return res.json().then(function (payload) {
            var bots = Array.isArray(payload && payload.bots) ? payload.bots : [];
            cachedBotsCatalog = bots;
            window.__HLX_BOTS_CATALOG__ = bots;
            var docs = bots.map(toAppwriteDocument);
            try {
              var h = window.location.hostname;
              var clean = h.replace(/^www\./i, '');
              localStorage.setItem('bots.cache.' + h, JSON.stringify(docs));
              localStorage.setItem('bots.cache.' + clean, JSON.stringify(docs));
              localStorage.setItem('bots.cache.www.' + clean, JSON.stringify(docs));
            } catch (_) {}
            setTimeout(applyCategoryFilterAndSubnav, 50);
            return new Response(JSON.stringify({
              total: docs.length,
              documents: docs
            }), {
              status: 200,
              statusText: 'OK',
              headers: new Headers({ 'Content-Type': 'application/json' })
            });
          });
        }).catch(function () {
          return withTimeout(input, init);
        });
      }

      /* Bound only our same-origin startup/data bridge */
      if (/^\/?api\/appwrite\//i.test(url) || /^https?:\/\/[^/]+\/api\/appwrite\//i.test(url)) {
        return withTimeout(input, init);
      }
    } catch (e) { /* fall through */ }
    return origFetch(input, init);
  };

  // ─── STYLES FOR SUB-NAVIGATION & CATEGORY SWITCHER ─────────────────────────
  function ensureSubnavStyles() {
    if (document.getElementById('bh-bot-subnav-styles')) return;
    var style = document.createElement('style');
    style.id = 'bh-bot-subnav-styles';
    style.textContent = `
      .bh-bot-subnav-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px 20px 10px;
        width: 100%;
        box-sizing: border-box;
      }
      .bh-bot-subnav-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        border-bottom: 1px solid rgba(0, 163, 224, 0.22);
        padding-bottom: 12px;
      }
      .bh-subnav-tabs {
        display: inline-flex;
        background: #0b1a2e;
        border: 1px solid rgba(0, 163, 224, 0.3);
        border-radius: 8px;
        padding: 4px;
        gap: 6px;
      }
      .bh-subtab-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: transparent;
        color: #94A3B8;
        border: none;
        padding: 8px 18px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        outline: none;
        font-family: inherit;
      }
      .bh-subtab-btn:hover {
        color: #FFFFFF;
        background: rgba(255, 255, 255, 0.06);
      }
      .bh-subtab-btn.active {
        background: #00A3E0;
        color: #041827;
        box-shadow: 0 4px 14px rgba(0, 163, 224, 0.35);
      }
      .bh-subtab-badge {
        font-size: 11px;
        padding: 2px 7px;
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.3);
        color: inherit;
        font-weight: 800;
      }
      .bh-subtab-btn.active .bh-subtab-badge {
        background: rgba(4, 24, 39, 0.25);
        color: #041827;
      }
      .bh-subnav-info {
        font-size: 12px;
        color: #00D2FF;
        font-weight: 500;
      }
      .bh-store-pill {
        display: inline-block;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(168, 85, 247, 0.2);
        color: #C084FC;
        border: 1px solid rgba(168, 85, 247, 0.4);
        margin-bottom: 8px;
        align-self: flex-start;
      }
      .bh-free-pill {
        display: inline-block;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(0, 163, 224, 0.16);
        color: #00D2FF;
        border: 1px solid rgba(0, 163, 224, 0.35);
        margin-bottom: 8px;
        align-self: flex-start;
      }
      .bh-empty-bots-view {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
        background: rgba(11, 26, 46, 0.6);
        border: 1.5px dashed rgba(0, 163, 224, 0.3);
        border-radius: 12px;
        margin: 16px 8px;
      }
      .bh-empty-bots-icon {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: rgba(0, 163, 224, 0.12);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #00A3E0;
        margin-bottom: 14px;
      }
      .bh-empty-bots-view h3 {
        font-size: 16px;
        font-weight: 700;
        color: #FFFFFF;
        margin: 0 0 6px;
      }
      .bh-empty-bots-view p {
        font-size: 13px;
        color: #94A3B8;
        margin: 0;
        max-width: 440px;
        line-height: 1.5;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── RENDER CATEGORY SUBNAV IN DOM ─────────────────────────────────────────
  function ensureSubnavUI(wrapper) {
    if (document.getElementById('bh-bot-subnav-container')) return;

    ensureSubnavStyles();

    var subnav = document.createElement('div');
    subnav.id = 'bh-bot-subnav-container';
    subnav.className = 'bh-bot-subnav-container';
    subnav.innerHTML = `
      <div class="bh-bot-subnav-bar">
        <div class="bh-subnav-tabs">
          <button type="button" class="bh-subtab-btn ${currentCategory === 'free' ? 'active' : ''}" id="bh-tab-free" data-target="free">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <span>Free Bots</span>
            <span class="bh-subtab-badge" id="bh-badge-free">0</span>
          </button>
          <button type="button" class="bh-subtab-btn ${currentCategory === 'store' ? 'active' : ''}" id="bh-tab-store" data-target="store">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <span>Bot Store</span>
            <span class="bh-subtab-badge" id="bh-badge-store">0</span>
          </button>
        </div>
        <div class="bh-subnav-info" id="bh-subnav-info">
          ${currentCategory === 'store' ? 'Curated premium Bot Store strategies' : 'Verified free community strategies'}
        </div>
      </div>
    `;

    // Click handlers
    subnav.querySelector('#bh-tab-free').onclick = function () {
      switchSubCategory('free');
    };
    subnav.querySelector('#bh-tab-store').onclick = function () {
      switchSubCategory('store');
    };

    // Insert as first child of wrapper
    if (wrapper.firstChild) {
      wrapper.insertBefore(subnav, wrapper.firstChild);
    } else {
      wrapper.appendChild(subnav);
    }
  }

  function switchSubCategory(cat) {
    currentCategory = cat;
    try { sessionStorage.setItem('bh_bot_subtab', cat); } catch (_) {}

    var freeBtn = document.getElementById('bh-tab-free');
    var storeBtn = document.getElementById('bh-tab-store');
    var info = document.getElementById('bh-subnav-info');

    if (freeBtn && storeBtn) {
      if (cat === 'free') {
        freeBtn.classList.add('active');
        storeBtn.classList.remove('active');
        if (info) info.textContent = 'Verified free community strategies';
      } else {
        storeBtn.classList.add('active');
        freeBtn.classList.remove('active');
        if (info) info.textContent = 'Curated premium Bot Store strategies';
      }
    }

    applyCategoryFilterAndSubnav();
  }

  // ─── FILTER BOT CARDS ACCORDING TO DESTINATION ─────────────────────────────
  function applyCategoryFilterAndSubnav() {
    var wrapper = document.querySelector('.bot-list__apollo_wrapper');
    var list = document.querySelector('.apollo-list__wrapper');
    if (!wrapper && !list) return;

    if (wrapper && !document.getElementById('bh-bot-subnav-container')) {
      ensureSubnavUI(wrapper);
    }

    if (!list) return;

    var cards = list.querySelectorAll('.apollo-list__item');
    if (!cards || !cards.length) return;

    // Fetch catalog if missing
    if (!cachedBotsCatalog || !cachedBotsCatalog.length) {
      if (window.__HLX_BOTS_CATALOG__ && window.__HLX_BOTS_CATALOG__.length) {
        cachedBotsCatalog = window.__HLX_BOTS_CATALOG__;
      } else {
        fetch('/api/appwrite/bots').then(function (r) { return r.json(); }).then(function (d) {
          if (d && d.bots) {
            cachedBotsCatalog = d.bots;
            window.__HLX_BOTS_CATALOG__ = d.bots;
            applyCategoryFilterAndSubnav();
          }
        }).catch(function () {});
      }
    }

    var freeCount = 0;
    var storeCount = 0;
    var visibleInCurrentTab = 0;

    cards.forEach(function (card) {
      var nameEl = card.querySelector('.name_text');
      var name = (nameEl ? nameEl.textContent : (card.getAttribute('title') || '')).trim().toLowerCase();

      var match = cachedBotsCatalog.find(function (b) {
        var bName = String(b.displayName || b.name || b.id || '').trim().toLowerCase();
        return bName === name || name.indexOf(bName) !== -1 || bName.indexOf(name) !== -1;
      });

      var dest = (match && match.destination) ? match.destination : 'free';
      card.setAttribute('data-bot-dest', dest);

      // Add badge tag to label if not present
      var labelEl = card.querySelector('.apollo-list__item__label');
      if (labelEl) {
        var existingPill = labelEl.querySelector('.bh-store-pill, .bh-free-pill');
        if (!existingPill) {
          var pill = document.createElement('div');
          if (dest === 'store') {
            pill.className = 'bh-store-pill';
            pill.textContent = 'BOT STORE';
            labelEl.insertBefore(pill, labelEl.firstChild);
          } else if (dest === 'both') {
            pill.className = 'bh-free-pill';
            pill.textContent = 'FREE & STORE';
            labelEl.insertBefore(pill, labelEl.firstChild);
          }
        }
      }

      var isFreeMatch = (dest === 'free' || dest === 'both');
      var isStoreMatch = (dest === 'store' || dest === 'both');

      if (isFreeMatch) freeCount++;
      if (isStoreMatch) storeCount++;

      var shouldShow = false;
      if (currentCategory === 'free' && isFreeMatch) shouldShow = true;
      if (currentCategory === 'store' && isStoreMatch) shouldShow = true;

      if (shouldShow) {
        card.style.display = '';
        visibleInCurrentTab++;
      } else {
        card.style.display = 'none';
      }
    });

    // Update Badges
    var freeBadge = document.getElementById('bh-badge-free');
    var storeBadge = document.getElementById('bh-badge-store');
    if (freeBadge) freeBadge.textContent = freeCount;
    if (storeBadge) storeBadge.textContent = storeCount;

    // Handle Empty State
    var emptyView = document.getElementById('bh-empty-bots-view');
    if (visibleInCurrentTab === 0) {
      if (!emptyView) {
        emptyView = document.createElement('div');
        emptyView.id = 'bh-empty-bots-view';
        emptyView.className = 'bh-empty-bots-view';
        list.appendChild(emptyView);
      }
      emptyView.style.display = 'flex';
      var isStore = currentCategory === 'store';
      emptyView.innerHTML = `
        <div class="bh-empty-bots-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h3>No Bots in ${isStore ? 'Bot Store' : 'Free Bots'}</h3>
        <p>There are currently no trading bots published to the ${isStore ? 'Bot Store' : 'Free Bots'} category on this site.</p>
      `;
    } else if (emptyView) {
      emptyView.style.display = 'none';
    }
  }

  // ─── MUTATION OBSERVER TO WATCH FOR REACT MOUNTING/UNMOUNTING ──────────────
  var observerTimeout = null;
  var observer = new MutationObserver(function () {
    if (observerTimeout) return;
    observerTimeout = setTimeout(function () {
      observerTimeout = null;
      applyCategoryFilterAndSubnav();
    }, 100);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      observer.observe(document.body, { childList: true, subtree: true });
      applyCategoryFilterAndSubnav();
    });
  } else {
    observer.observe(document.body, { childList: true, subtree: true });
    applyCategoryFilterAndSubnav();
  }
})();
