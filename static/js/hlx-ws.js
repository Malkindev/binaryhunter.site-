/* Deriv Site Builder runtime bridge. */
(function () {
  'use strict';

  // Definitive WebSocket.prototype.close protection:
  // If ws.close() is called while readyState === 0 (CONNECTING),
  // defer closure until 'open' to prevent Chromium from aborting with:
  // "WebSocket is closed before the connection is established"
  try {
    if (typeof window !== 'undefined' && window.WebSocket && window.WebSocket.prototype && !window.__WS_CLOSE_PROTECTION_INSTALLED__) {
      window.__WS_CLOSE_PROTECTION_INSTALLED__ = true;
      var _origProtoClose = window.WebSocket.prototype.close;
      window.WebSocket.prototype.close = function (code, reason) {
        var ws = this;
        if (ws.readyState === 0) {
          var onOpenClose = function () {
            try { _origProtoClose.call(ws, code !== undefined ? code : 1000, reason); } catch (_) {}
          };
          ws.addEventListener('open', onOpenClose, { once: true });
          ws.addEventListener('error', function () {
            try { ws.removeEventListener('open', onOpenClose); } catch (_) {}
          }, { once: true });
          return;
        }
        return _origProtoClose.apply(ws, arguments);
      };
    }
  } catch (_) {}


  var PUBLIC_APP_ID = '';
// Legacy v3 app_id is intentionally omitted. Modern Deriv market-data
// connections do not require an app_id; authenticated trading sockets use
// the OAuth/OTP WebSocket URL returned by Deriv.
  var SETTINGS_TIMEOUT_MS = 5000;
  var HOST_KEY = String(window.location.hostname || 'unknown').replace(/[^a-zA-Z0-9.-]/g, '_');
  var APP_ID_STORAGE_KEY = 'sitebuilder.app_id.' + HOST_KEY;
  var LOGO_STORAGE_KEY = 'sitebuilder.logo_url.' + HOST_KEY;
  var RELOAD_STORAGE_KEY = 'sitebuilder.app_id.reload.' + HOST_KEY;
  var HLX_APP_ID = '';
  var HLX_LOGO_URL = '';

  // Preserve the App ID supplied by the customer configuration. The authoritative
  // template uses an alphanumeric OAuth client/App ID, so numeric-only sanitization
  // here would silently destroy the configured login identity.
  try {} catch (e) {}

  function cleanAppId(value) {
    var raw = String(value || '').trim();
    return raw && /^[A-Za-z0-9._-]+$/.test(raw) ? raw : '';
  }

  function absoluteUrl(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    try { return new URL(raw, window.location.origin).href; } catch (e) { return raw; }
  }

  function persistAppId(appId) {
    appId = cleanAppId(appId);
    try {
      var previous = cleanAppId(localStorage.getItem(APP_ID_STORAGE_KEY));
      if (!appId) {
        localStorage.removeItem(APP_ID_STORAGE_KEY);
        localStorage.removeItem('config.new_app_id');
        localStorage.removeItem('config.oauth_client_id');
        if (localStorage.getItem('config.app_id_source') === 'sitebuilder') {
          localStorage.removeItem('config.app_id');
          localStorage.removeItem('config.legacy_app_id');
          localStorage.removeItem('config.sitebuilder_app_id');
        }
        HLX_APP_ID = '';
        return !!previous;
      }

      var isNumeric = /^\d{1,8}$/.test(appId) && Number(appId) > 0;
      localStorage.setItem(APP_ID_STORAGE_KEY, appId);
      localStorage.setItem('config.app_id_source', 'sitebuilder');
      localStorage.setItem('config.sitebuilder_app_id', appId);

      if (isNumeric) {
        localStorage.removeItem('config.new_app_id');
        localStorage.removeItem('config.oauth_client_id');
        localStorage.setItem('config.app_id', appId);
        localStorage.setItem('config.legacy_app_id', appId);
      } else {
        localStorage.setItem('config.app_id', '1089');
        localStorage.setItem('config.legacy_app_id', '1089');
        localStorage.setItem('config.new_app_id', appId);
        localStorage.setItem('config.oauth_client_id', appId);
      }
      HLX_APP_ID = appId;
      window.__DERIV_APP_ID__ = appId;
      return previous !== appId;
    } catch (e) { return false; }
  }

  function bootstrapCachedAppId() {
    try {
      var prebaked = cleanAppId(window.__DERIV_APP_ID__);
      var cached = cleanAppId(localStorage.getItem(APP_ID_STORAGE_KEY)) || prebaked;
      if (cached) persistAppId(cached);
      else {
        HLX_APP_ID = '';
        window.__DERIV_APP_ID__ = '';
      }
    } catch (e) {}
  }

  function setSiteLogo(value) {
    var logo = absoluteUrl(value);
    if (!logo) return;
    HLX_LOGO_URL = logo;
    window.__DERIV_LOGO_URL__ = logo;

    var selectors = [
      '.logo-holder img.d-apollo-logo__image--uploaded',
      '.logo-holder img:first-child',
      'img[data-site-logo]',
      'img[alt*="logo" i]:not(.d-apollo-logo__image--branded)',
      '[class*="logo"]:not(.logo-holder) img',
      '[id*="logo"] img'
    ];
    var seen = [];
    selectors.forEach(function (selector) {
      try {
        document.querySelectorAll(selector).forEach(function (img) {
          if (seen.indexOf(img) !== -1) return;
          if (img.classList && img.classList.contains('d-apollo-logo__image--branded')) return;
          seen.push(img);
          if (img.src !== logo) img.src = logo;
          img.style.objectFit = 'contain';
        });
      } catch (e) {}
    });
  }

  function applyCachedLogo() {
    if (HLX_LOGO_URL) setSiteLogo(HLX_LOGO_URL);
  }

  function parseSettings(payload) {
    var site = payload && payload.site;
    if (!site) return null;
    var settings = site.settingsJson;
    if (typeof settings === 'string') {
      try { settings = JSON.parse(settings); } catch (e) { settings = {}; }
    }
    if (!settings || typeof settings !== 'object') settings = {};
    return { site: site, settings: settings };
  }

  function getAppId(data) {
    var site = data && data.site || {};
    var settings = data && data.settings || {};
    return cleanAppId(
      settings.newAppId ||
      settings.new_app_id ||
      settings.oauthClientId ||
      settings.oauth_client_id ||
      settings.derivAppId ||
      settings.legacyAppId ||
      settings.legacy_app_id ||
      settings.appId ||
      site.newAppId ||
      site.oauthClientId ||
      site.derivAppId ||
      site.legacyAppId ||
      site.appId ||
      window.__DERIV_APP_ID__ ||
      ''
    );
  }

  function getLogo(data) {
    var site = data && data.site || {};
    var settings = data && data.settings || {};
    return String(
      site.logoUrl ||
      site.logo ||
      settings.logoUrl ||
      settings.logo ||
      ''
    ).trim();
  }

  function persistLogo(logo) {
    try {
      if (logo) localStorage.setItem(LOGO_STORAGE_KEY, absoluteUrl(logo));
      else localStorage.removeItem(LOGO_STORAGE_KEY);
    } catch (e) {}
  }

  function loadCachedLogo() {
    try {
      var cached = String(localStorage.getItem(LOGO_STORAGE_KEY) || '').trim();
      if (cached && !/youngest/i.test(cached)) {
        HLX_LOGO_URL = cached;
        window.__DERIV_LOGO_URL__ = cached;
      } else {
        localStorage.removeItem(LOGO_STORAGE_KEY);
        HLX_LOGO_URL = '/assets/media/logo.png';
        window.__DERIV_LOGO_URL__ = '/assets/media/logo.png';
      }
    } catch (e) {
      HLX_LOGO_URL = '/assets/media/logo.png';
      window.__DERIV_LOGO_URL__ = '/assets/media/logo.png';
    }
  }

  function loadCustomerSettings() {
    if (!window.fetch) return Promise.resolve(null);
    var controller = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, SETTINGS_TIMEOUT_MS);
    var hostname = encodeURIComponent(window.location.hostname || '');

    return fetch('/api/appwrite/site-settings?hostname=' + hostname, {
      method: 'GET', cache: 'no-store', credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        'x-customer-host': window.location.hostname || ''
      },
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('site-settings ' + res.status);
      return res.json();
    }).then(function (payload) {
      var data = parseSettings(payload);
      if (!data) return null;
      try {
        window.__DERIV_SITE_SETTINGS__ = data.settings || {};
      } catch (_) {}

      var appId = getAppId(data);
      var changed = persistAppId(appId);
      if (appId) {
        HLX_APP_ID = appId;
        window.__DERIV_APP_ID__ = appId;
        if (changed) {
          try {
            var marker = sessionStorage.getItem(RELOAD_STORAGE_KEY);
            if (marker !== appId) {
              sessionStorage.setItem(RELOAD_STORAGE_KEY, appId);
              window.location.reload();
              return data;
            }
          } catch (e) {}
        }
      } else {
        try { sessionStorage.removeItem(RELOAD_STORAGE_KEY); } catch (e) {}
      }

      var logo = getLogo(data);
      if (logo) {
        setSiteLogo(logo);
        persistLogo(logo);
      } else {
        persistLogo('');
        HLX_LOGO_URL = '';
        window.__DERIV_LOGO_URL__ = '';
      }

      return data;
    }).catch(function (error) {
      console.warn('[SiteBuilder settings] unavailable; using cached/site defaults', error && error.message ? error.message : error);
      return null;
    }).finally(function () { clearTimeout(timer); });
  }

  function legacyNumericAppId() {
    try {
      var candidates = [
        localStorage.getItem('config.legacy_app_id'),
        localStorage.getItem('config.app_id'),
        window.__DERIV_LEGACY_APP_ID__,
        '1089'
      ];
      for (var i = 0; i < candidates.length; i++) {
        var value = String(candidates[i] || '').trim();
        if (value === '1047') continue;
        if (/^\d{1,8}$/.test(value) && Number(value) > 0) return value;
      }
    } catch (e) {}
    return '1089';
  }

  function hasAuthenticatedSession() {
    try {
      if (sessionStorage.getItem('auth_info')) return true;
      if (localStorage.getItem('active_loginid')) return true;
      if (localStorage.getItem('is_api_token_login') === 'true') return true;
    } catch (e) {}
    return false;
  }

  function fixUrl(u) {
    if (typeof u !== 'string') return u;
    if (/^https:\/\//i.test(u)) u = u.replace(/^https:\/\//i, 'wss://');
    else if (/^http:\/\//i.test(u)) u = u.replace(/^http:\/\//i, 'ws://');

    // Normalize legacy v3 market-data socket.
    // Deriv server REQUIRES a valid numeric app_id for all websockets/v3 connections.
    if (/websockets\/v3/i.test(u)) {
      try {
        var parsed = new URL(u);
        parsed.protocol = 'wss:';
        parsed.hostname = 'ws.derivws.com';
        parsed.pathname = '/websockets/v3';

        var appIdToUse = legacyNumericAppId();
        parsed.searchParams.set('app_id', appIdToUse);
        if (!parsed.searchParams.get('l')) parsed.searchParams.set('l', 'EN');
        if (!parsed.searchParams.get('brand')) parsed.searchParams.set('brand', 'deriv');

        u = parsed.toString();
      } catch (e) {
        var appIdToUse = legacyNumericAppId();
        u = 'wss://ws.derivws.com/websockets/v3?app_id=' + encodeURIComponent(appIdToUse) + '&l=EN&brand=deriv';
      }
    }
    return u;
  }
    bootstrapCachedAppId();
  loadCachedLogo();

  // ─────────────────────────────────────────────────────────────────────────────
  // ── DIAGNOSTIC LOGGING (Safe, non-sensitive, mode & account tracing) ─────────
  // ─────────────────────────────────────────────────────────────────────────────
  function maskAccountId(id) {
    if (!id) return 'NONE';
    var s = String(id).trim();
    if (s.length <= 4) return s;
    return s.substring(0, 3) + '***' + s.substring(s.length - 2);
  }

  function diagLog(action, details) {
    try {
      var curMode = (typeof currentAuthoritativeMode === 'string' && currentAuthoritativeMode)
        ? currentAuthoritativeMode
        : (isDemoAccountActive() ? 'demo' : 'real');
      var curId = currentAuthoritativeLoginid || (typeof localStorage !== 'undefined' ? localStorage.getItem('active_loginid') : '');
      console.log('[MarketingModeDiag]', action, {
        mode: curMode,
        account: maskAccountId(curId),
        details: details || {},
        epoch: typeof activeModeEpoch === 'number' ? activeModeEpoch : 0,
        ts: new Date().toISOString()
      });
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Virtual / Paper Trading Architecture — STRICTLY ISOLATED BY MODE
  // ─────────────────────────────────────────────────────────────────────────────
  var modeState = {
    real: {
      startingBalance: 79.84,
      pnl: 0.00,
      openContracts: {},
      processedContracts: new Set(),
      actualBalance: 0.00,
      loginid: ''
    },
    demo: {
      startingBalance: null,
      pnl: 0.00,
      openContracts: {},
      processedContracts: new Set(),
      actualBalance: null,
      loginid: ''
    }
  };

  var VIRTUAL_STARTING_BALANCE = 79.84;
  var DEMO_STARTING_BALANCE = null;
  var cumulativeVirtualPnL = 0.00;
  var cumulativeRealTradingPnL = 0.00;
  var processedVirtualContractIds = modeState.real.processedContracts;
  var processedRealContractIds = processedVirtualContractIds;
  var currentRealLoginId = '';

  var actualRealBalance = 79.84;
  var actualDemoBalance = (function () {
    try {
      var ca = JSON.parse(localStorage.getItem('client.accounts') || '{}');
      for (var k in ca) {
        var ku = k.toUpperCase();
        if ((ku.startsWith('DOT') || ku.startsWith('VRTC') || ku.startsWith('DEM') || ku.startsWith('VRT')) && ku !== 'VRTC9999999') {
          var num = parseFloat(ca[k].balance);
          if (Number.isFinite(num) && num > 0) return num;
        }
      }
    } catch (_) {}
    return null;
  })();
  var actualDemoLoginId = (function () {
    try {
      var ca = JSON.parse(localStorage.getItem('client.accounts') || '{}');
      for (var k in ca) {
        var ku = k.toUpperCase();
        if ((ku.startsWith('DOT') || ku.startsWith('VRTC') || ku.startsWith('DEM') || ku.startsWith('VRT')) && ku !== 'VRTC9999999') {
          return ku;
        }
      }
    } catch (_) {}
    return '';
  })();
  var actualDemoCurrency = 'USD';

  var selectedAccountType = isDemoAccountActive() ? 'demo' : 'real';
  var selectedAccountId = '';

  var openContractsMap = modeState.real.openContracts;
  var syntheticContractsMap = window.__syntheticContractsMap = window.__syntheticContractsMap || {};

  function getTotalOpenStakes(targetMode) {
    var m = targetMode === 'demo' ? 'demo' : (targetMode === 'real' ? 'real' : (isDemoAccountActive() ? 'demo' : 'real'));
    var map = modeState[m].openContracts;
    var sum = 0;
    for (var id in map) {
      if (Object.prototype.hasOwnProperty.call(map, id)) {
        var entry = map[id];
        var s = (entry && typeof entry === 'object' && Number.isFinite(entry.stake)) ? entry.stake : Number(entry || 0);
        if (Number.isFinite(s)) sum += s;
      }
    }
    return Number(sum.toFixed(2));
  }

  function getVirtualTradingBalance(targetMode) {
    var m = targetMode === 'demo' ? 'demo' : (targetMode === 'real' ? 'real' : (isDemoAccountActive() ? 'demo' : 'real'));
    // The native Demo balance is authoritative; never overlay the Real ledger.
    if (m === 'demo' && actualDemoBalance !== null && Number.isFinite(actualDemoBalance)) {
      return Number(actualDemoBalance.toFixed(2));
    }
    var st = modeState[m];
    var start = Number.isFinite(st.startingBalance) ? st.startingBalance : (m === 'demo' ? (actualDemoBalance !== null ? actualDemoBalance : null) : 79.84);
    if (start === null) return null;
    var pnl = Number.isFinite(st.pnl) ? st.pnl : 0.00;
    var stakes = Number.isFinite(getTotalOpenStakes(m)) ? getTotalOpenStakes(m) : 0.00;
    var bal = start + pnl - stakes;
    if (!Number.isFinite(bal) || isNaN(bal)) {
      bal = start;
      st.pnl = 0.00;
    }
    return Number(bal.toFixed(2));
  }

  function getDemoDisplayBalance() {
    return actualDemoBalance !== null ? actualDemoBalance : getVirtualTradingBalance('demo');
  }

  function formatVirtualTradingBalance(targetMode) {
    var bal = targetMode === 'demo' ? (actualDemoBalance !== null ? actualDemoBalance : getVirtualTradingBalance('demo')) : getVirtualTradingBalance(targetMode);
    if (!Number.isFinite(bal) || isNaN(bal) || bal === null) {
      return targetMode === 'demo' ? '' : '79.84';
    }
    return bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDemoDisplayBalance() {
    return formatVirtualTradingBalance('demo');
  }

  function getStoredRealLoginId() {
    try {
      var actId = String(localStorage.getItem('active_loginid') || '').trim().toUpperCase();
      if (actId.indexOf('CR') === 0 || actId.indexOf('ROT') === 0 || actId.indexOf('MF') === 0 || actId.indexOf('MLT') === 0) return actId;
      var clientAccounts = localStorage.getItem('client.accounts');
      if (clientAccounts) {
        var parsed = JSON.parse(clientAccounts);
        for (var k in parsed) {
          var kUpper = k.toUpperCase();
          if (kUpper.indexOf('CR') === 0 || kUpper.indexOf('ROT') === 0 || kUpper.indexOf('MF') === 0 || kUpper.indexOf('MLT') === 0) return kUpper;
        }
      }
      var acctsList = localStorage.getItem('accountsList');
      if (acctsList) {
        var parsedList = JSON.parse(acctsList);
        for (var k2 in parsedList) {
          var k2Upper = k2.toUpperCase();
          if (k2Upper.indexOf('CR') === 0 || k2Upper.indexOf('ROT') === 0 || k2Upper.indexOf('MF') === 0 || k2Upper.indexOf('MLT') === 0) return k2Upper;
        }
      }
    } catch (_) {}
    return '';
  }

  function getVirtualTradingStorageKey(loginid, targetMode) {
    var m = targetMode === 'demo' ? 'demo' : (targetMode === 'real' ? 'real' : (isDemoAccountActive() ? 'demo' : 'real'));
    var lid = String(loginid || (m === 'demo' ? (actualDemoLoginId || 'DEMO') : (currentRealLoginId || getStoredRealLoginId() || 'DEFAULT'))).toUpperCase();
    return 'sitebuilder_virtual_pnl_' + HOST_KEY + '_' + m + '_' + lid;
  }

  function getDemoSyncStorageKey(loginid) {
    return getVirtualTradingStorageKey(loginid, 'demo');
  }

  function saveVirtualTradingState(targetMode) {
    try {
      var m = targetMode === 'demo' ? 'demo' : (targetMode === 'real' ? 'real' : (isDemoAccountActive() ? 'demo' : 'real'));
      var st = modeState[m];
      var lid = st.loginid || (m === 'demo' ? (actualDemoLoginId || 'DEMO') : (currentRealLoginId || getStoredRealLoginId() || 'DEFAULT'));
      var key = getVirtualTradingStorageKey(lid, m);
      var payload = {
        mode: m,
        loginid: lid,
        startingBalance: st.startingBalance,
        pnl: st.pnl,
        balance: getVirtualTradingBalance(m),
        processedContractIds: Array.from(st.processedContracts),
        lastSyncAt: new Date().toISOString()
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (_) {}
  }

  function saveRealAccountDemoSync() {
    saveVirtualTradingState('real');
  }

  function loadVirtualTradingState(targetMode, loginid) {
    var m = targetMode === 'demo' ? 'demo' : (targetMode === 'real' ? 'real' : (isDemoAccountActive() ? 'demo' : 'real'));
    var lid = String(loginid || (m === 'demo' ? (actualDemoLoginId || 'DEMO') : (getStoredRealLoginId() || 'DEFAULT'))).trim().toUpperCase();
    var st = modeState[m];
    st.loginid = lid;

    // 1. Instant local restore from primary virtual key
    try {
      var key = getVirtualTradingStorageKey(lid, m);
      var cached = localStorage.getItem(key);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (Number.isFinite(parsed.pnl)) {
          st.pnl = Number(parsed.pnl);
          if (m === 'real') {
            cumulativeVirtualPnL = st.pnl;
            cumulativeRealTradingPnL = st.pnl;
          }
        }
        if (Array.isArray(parsed.processedContractIds)) {
          parsed.processedContractIds.forEach(function (id) {
            st.processedContracts.add(String(id));
          });
        }
      }
    } catch (_) {}

    // 2. Authoritative backend synchronization with epoch protection
    try {
      if (window.fetch) {
        var host = encodeURIComponent(window.location.hostname || '');
        var curEpoch = typeof activeModeEpoch === 'number' ? activeModeEpoch : 0;
        fetch('/api/marketing/demo-sync?loginid=' + encodeURIComponent(lid) + '&hostname=' + host + '&mode=' + m)
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (curEpoch !== activeModeEpoch) {
              diagLog('sync_stale_response_dropped', { mode: m, reqEpoch: curEpoch, currentEpoch: activeModeEpoch });
              return;
            }
            if (data && data.success) {
              if (Number.isFinite(data.startingBalance)) st.startingBalance = Number(data.startingBalance);
              var pnl2 = Number.isFinite(data.cumulativeVirtualPnL) ? data.cumulativeVirtualPnL : data.cumulativeRealTradingPnL;
              if (Number.isFinite(pnl2)) {
                st.pnl = Number(pnl2);
                if (m === 'real') {
                  cumulativeVirtualPnL = st.pnl;
                  cumulativeRealTradingPnL = st.pnl;
                }
              }
              if (Array.isArray(data.processedContractIds)) {
                data.processedContractIds.forEach(function (id) {
                  st.processedContracts.add(String(id));
                });
              }
              saveVirtualTradingState(m);
              patchDomBalances();
            }
          })
          .catch(function () {});
      }
    } catch (_) {}
  }

  function loadRealAccountDemoSync(loginid) {
    loadVirtualTradingState('real', loginid);
  }

  function handleSettledVirtualContract(poc, targetMode) {
    // This ledger belongs only to the isolated Real-mode Marketing simulation.
    // Genuine Demo balances come from Deriv and must never be modified here.
    var mode = targetMode === 'real' ? 'real' : (targetMode === 'demo' ? 'demo' : (isDemoAccountActive() ? 'demo' : 'real'));
    if (mode !== 'real') return;
    if (!poc || !poc.contract_id) return;

    var cId = String(poc.contract_id);
    var state = modeState.real;
    var processedIds = state.processedContracts;
    if (processedIds.has(cId)) return;
    processedIds.add(cId);

    var profit = 0;
    if (poc.profit !== undefined && poc.profit !== null && Number.isFinite(Number(poc.profit))) {
      profit = Number(poc.profit);
    } else if (poc.status === 'won') {
      var pay = Number(poc.payout || 0);
      var buy = Number(poc.buy_price || 0);
      profit = pay > buy ? Number((pay - buy).toFixed(2)) : 0;
    } else if (poc.status === 'lost') {
      var buyPrice = Number(poc.buy_price || 0);
      profit = buyPrice > 0 ? -buyPrice : 0;
    }

    state.pnl = Number((state.pnl + profit).toFixed(2));
    if (!Number.isFinite(state.pnl)) state.pnl = 0;
    cumulativeVirtualPnL = state.pnl;
    cumulativeRealTradingPnL = state.pnl;

    var newTotal = getVirtualTradingBalance('real');
    var rotId = String(state.loginid || currentRealLoginId || getStoredRealLoginId() || '').trim().toUpperCase();
    if (activeMarketingProfile && activeMarketingProfile.marketingEligible &&
        !activeMarketingProfile.isDemoMarketing &&
        (!rotId || isSameAccount(rotId, activeMarketingProfile.rot))) {
      activeMarketingProfile.currentBalance = newTotal;
    }
    if (rotId && marketingProfilesByRot[rotId] && marketingProfilesByRot[rotId].marketingEligible &&
        !marketingProfilesByRot[rotId].isDemoMarketing) {
      marketingProfilesByRot[rotId].currentBalance = newTotal;
    }

    saveVirtualTradingState('real');
    if (!isDemoAccountActive()) patchDomBalances(activeMarketingProfile);

    // Ignore any late sync response after the user switches away from Real mode.
    var lid = currentRealLoginId || getStoredRealLoginId();
    if (lid && window.fetch) {
      try {
        var settleEpoch = activeModeEpoch;
        fetch('/api/marketing/demo-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'settle',
            mode: 'real',
            loginid: lid,
            contractId: cId,
            profit: profit,
            symbol: poc.underlying_symbol || poc.symbol || '',
            contractType: poc.contract_type || '',
            hostname: window.location.hostname || ''
          })
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (settleEpoch !== activeModeEpoch || isDemoAccountActive()) return;
          var pnl = Number.isFinite(data && data.cumulativeVirtualPnL)
            ? data.cumulativeVirtualPnL
            : (Number.isFinite(data && data.cumulativeRealTradingPnL) ? data.cumulativeRealTradingPnL : null);
          if (pnl !== null) {
            state.pnl = Number(pnl);
            cumulativeVirtualPnL = state.pnl;
            cumulativeRealTradingPnL = state.pnl;
            saveVirtualTradingState('real');
            patchDomBalances(activeMarketingProfile);
          }
        })
        .catch(function () {});
      } catch (_) {}
    }
  }

  function resetVirtualTradingSession(targetMode) {
    var mode = targetMode === 'real' ? 'real' : (targetMode === 'demo' ? 'demo' : (isDemoAccountActive() ? 'demo' : 'real'));
    var state = modeState[mode];
    state.pnl = 0;
    state.processedContracts.clear();
    Object.keys(state.openContracts).forEach(function (id) { delete state.openContracts[id]; });

    if (mode === 'real') {
      cumulativeVirtualPnL = 0;
      cumulativeRealTradingPnL = 0;
    }
    saveVirtualTradingState(mode);
    if (mode === 'real' && !isDemoAccountActive()) patchDomBalances(activeMarketingProfile);

    // A Demo top-up/reset clears only Demo state, not Real-mode P/L.
    if (mode === 'real') {
      var lid = currentRealLoginId || getStoredRealLoginId();
      if (lid && window.fetch) {
        try {
          fetch('/api/marketing/demo-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'reset',
              mode: 'real',
              loginid: lid,
              hostname: window.location.hostname || ''
            })
          }).catch(function () {});
        } catch (_) {}
      }
    }
  }

  function resetDemoSyncSession() {
    resetVirtualTradingSession('demo');
  }

  window.__DERIV_DEMO_SYNC__ = {
    getDemoStartingBalance: function () { return VIRTUAL_STARTING_BALANCE; },
    getCumulativeRealTradingPnL: function () { return modeState.real.pnl; },
    getDemoDisplayBalance: function () { return getVirtualTradingBalance('demo'); },
    formatDemoDisplayBalance: function () { return formatVirtualTradingBalance('demo'); },
    getProcessedContractIds: function () { return Array.from(modeState.real.processedContracts); },
    getCurrentRealLoginId: function () { return currentRealLoginId || getStoredRealLoginId(); },
    handleSettledRealContract: function (poc) { return handleSettledVirtualContract(poc, 'real'); },
    resetSession: function () { return resetVirtualTradingSession(); },
    loadSyncState: loadVirtualTradingState
  };

  // Self-healing: Purge VRTC9999999, mock tokens, and NaN/null balance corruptions from localStorage
  try {
    var caStrInit = localStorage.getItem('client.accounts');
    if (caStrInit) {
      var caObjInit = JSON.parse(caStrInit);
      var dirty = false;
      for (var aKey in caObjInit) {
        var aKeyUpper = String(aKey).toUpperCase();
        if (aKeyUpper === 'VRTC9999999' || aKeyUpper.indexOf('MOCKDEMO') !== -1) {
          delete caObjInit[aKey];
          dirty = true;
          continue;
        }
        if (caObjInit[aKey]) {
          var bVal = caObjInit[aKey].balance;
          if (bVal === null || bVal === undefined || isNaN(bVal) || bVal === 'NaN') {
            caObjInit[aKey].balance = 100.00;
            caObjInit[aKey].converted_amount = 100.00;
            dirty = true;
          }
        }
      }
      if (dirty) {
        localStorage.setItem('client.accounts', JSON.stringify(caObjInit));
        localStorage.setItem('clientAccounts', JSON.stringify(caObjInit));
      }
    }
    var alStrInit = localStorage.getItem('accountsList');
    if (alStrInit) {
      var alObjInit = JSON.parse(alStrInit);
      if (alObjInit['VRTC9999999'] || alObjInit['vrtc9999999']) {
        delete alObjInit['VRTC9999999'];
        delete alObjInit['vrtc9999999'];
        localStorage.setItem('accountsList', JSON.stringify(alObjInit));
      }
    }
    if (String(localStorage.getItem('active_loginid') || '').toUpperCase() === 'VRTC9999999') {
      localStorage.removeItem('active_loginid');
    }
    for (var i = 0; i < localStorage.length; i++) {
      var lk = localStorage.key(i);
      if (lk && lk.indexOf('sitebuilder_virtual_trading_') === 0) {
        var vData = localStorage.getItem(lk);
        if (vData && (vData.indexOf(':null') !== -1 || vData.indexOf('NaN') !== -1)) {
          localStorage.removeItem(lk);
        }
      }
    }
  } catch (_) {}

  // ── Unified Marketing & Virtual Trading Engine ────────────────────────
  var marketingProfilesByRot = {};
  var activeMarketingProfile = null;
  var marketingAppMarkupById = (typeof window !== 'undefined' && (window.__hlx_marketing_app_markup = window.__hlx_marketing_app_markup || {})) || {};

  function normalizeMarketingMarkupPercentage(value) {
    if (value === undefined || value === null || value === '') return null;
    var n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(3, n));
  }

  function getKnownDerivAppMarkupPercentage() {
    try {
      var settings = window.__DERIV_SITE_SETTINGS__ || {};
      var appId = String(settings.derivAppId || window.__DERIV_APP_ID__ || '').trim();
      if (/^\d{1,8}$/.test(appId) && marketingAppMarkupById[appId] !== undefined) {
        return normalizeMarketingMarkupPercentage(marketingAppMarkupById[appId]);
      }
    } catch (_) {}
    return null;
  }

  function getMarketingMarkupPercentage(profile) {
    var candidates = [];
    if (profile) {
      candidates.push(profile.app_markup_percentage, profile.appMarkupPercentage, profile.markupPercentage);
    }
    try {
      var settings = window.__DERIV_SITE_SETTINGS__ || {};
      candidates.push(settings.app_markup_percentage, settings.appMarkupPercentage, settings.markupPercentage);
    } catch (_) {}
    try {
      var raw = localStorage.getItem('config.site_settings_json');
      if (raw) {
        var settingsLocal = JSON.parse(raw) || {};
        candidates.push(settingsLocal.app_markup_percentage, settingsLocal.appMarkupPercentage, settingsLocal.markupPercentage);
      }
    } catch (_) {}
    try {
      candidates.push(window.__DERIV_APP_MARKUP_PERCENTAGE__);
    } catch (_) {}

    for (var iMarkup = 0; iMarkup < candidates.length; iMarkup++) {
      var direct = normalizeMarketingMarkupPercentage(candidates[iMarkup]);
      if (direct !== null) return direct;
    }

    // Best-effort fallback to live Deriv app details.
    var cached = getKnownDerivAppMarkupPercentage();
    if (cached !== null) return cached;

    return 0;
  }

  function applyMarketingMarkupToPayout(basePayout, profile) {
    var base = Number(basePayout);
    if (!Number.isFinite(base) || base <= 0) return base;
    var markup = getMarketingMarkupPercentage(profile);
    if (!Number.isFinite(markup) || markup <= 0) return Number(base.toFixed(2));
    return Number((base * (1 - (markup / 100))).toFixed(2));
  }

  var proposalsMap = (typeof window !== 'undefined' && (window.__hlx_proposals_map = window.__hlx_proposals_map || {})) || {};
  var proposalSubsMap = (typeof window !== 'undefined' && (window.__hlx_proposal_subs_map = window.__hlx_proposal_subs_map || {})) || {};
  var latestProposalsBySig = (typeof window !== 'undefined' && (window.__hlx_latest_proposals = window.__hlx_latest_proposals || {})) || {};
  var lastOutgoingProposalReqs = (typeof window !== 'undefined' && (window.__hlx_outgoing_proposals = window.__hlx_outgoing_proposals || {})) || {};
  var outgoingProposalReqsById = (typeof window !== 'undefined' && (window.__hlx_outgoing_props_by_id = window.__hlx_outgoing_props_by_id || {})) || {};
  var settledMarketingContracts = (typeof window !== 'undefined' && (window.__hlx_settled_contracts = window.__hlx_settled_contracts || {})) || {};
  var simulatedMarketingContracts = (typeof window !== 'undefined' && (window.__hlx_simulated_contracts = window.__hlx_simulated_contracts || {})) || {};
  var syntheticContractsMap = (typeof window !== 'undefined' && (window.__hlx_synthetic_contracts = window.__hlx_synthetic_contracts || {})) || {};
  var marketingTradeHistoryList = (typeof window !== 'undefined' && (window.__hlx_marketing_history = window.__hlx_marketing_history || [])) || [];

  function recordLiveDerivProposal(msg) {
    if (!msg || !msg.proposal) return;
    var p = msg.proposal;
    var subId = msg.subscription && msg.subscription.id;
    var echo = msg.echo_req || (subId && proposalSubsMap[subId]) || {};
    if (subId && msg.echo_req) {
      proposalSubsMap[subId] = msg.echo_req;
    }

    var sym = echo.symbol || (subId && proposalSubsMap[subId] && proposalSubsMap[subId].symbol) || '';
    var ct = echo.contract_type || (subId && proposalSubsMap[subId] && proposalSubsMap[subId].contract_type) || '';
    var bar = (echo.barrier !== undefined) ? String(echo.barrier) : ((p.barrier !== undefined) ? String(p.barrier) : '');
    var st = Number(p.ask_price || echo.amount || 1.0);
    var py = Number(p.payout || 0);
    var lc = p.longcode || '';
    var sp = Number(p.spot || 0);
    // Prefer the authoritative app setting; live Deriv proposals may already
    // have the app markup incorporated into their payout.
    var proposalMarkup = getKnownDerivAppMarkupPercentage();
    if (proposalMarkup === null) {
      proposalMarkup = normalizeMarketingMarkupPercentage(
        echo.app_markup_percentage ??
        (echo.parameters && echo.parameters.app_markup_percentage)
      );
    }

    var record = {
      id: String(p.id),
      symbol: sym,
      contractType: ct,
      barrier: bar,
      stake: st,
      payout: py,
      longcode: lc,
      spot: sp,
      spot_time: p.spot_time,
      display_value: p.display_value || String(py),
      markupAppliedPercentage: proposalMarkup,
      timestamp: Date.now()
    };

    proposalsMap[String(p.id)] = record;
    if (sym && ct) {
      var sigWithBar = [sym, ct, bar].filter(function (x) { return x !== undefined && x !== ''; }).join('_').toUpperCase();
      latestProposalsBySig[sigWithBar] = record;
      var sigWithoutBar = [sym, ct].filter(function (x) { return x !== undefined && x !== ''; }).join('_').toUpperCase();
      if (!latestProposalsBySig[sigWithoutBar] || !bar) {
        latestProposalsBySig[sigWithoutBar] = record;
      }
    }
  }

  function calculateContractPayout(contractType, barrier, stakePaid, matchedProp, marketingProfile) {
    var ct = String(contractType || 'CALL').toUpperCase();
    var st = Number(stakePaid) || 1.0;
    if (!Number.isFinite(st) || st <= 0) st = 1.0;

    var finalize = function (rawPayout) {
      var raw = Number(rawPayout);
      if (!Number.isFinite(raw) || raw <= 0) return raw;

      var alreadyMarked = matchedProp
        ? normalizeMarketingMarkupPercentage(matchedProp.markupAppliedPercentage)
        : null;
      if (alreadyMarked === null) alreadyMarked = getKnownDerivAppMarkupPercentage();

      var targetMarkup = getMarketingMarkupPercentage(marketingProfile);
      if (alreadyMarked !== null && Number.isFinite(targetMarkup)) {
        // Convert an already-marked quote to the configured target markup.
        var currentFactor = 1 - (alreadyMarked / 100);
        var targetFactor = 1 - (targetMarkup / 100);
        if (currentFactor > 0 && targetFactor > 0) {
          return Number((raw * targetFactor / currentFactor).toFixed(2));
        }
        return Number(raw.toFixed(2));
      }

      // A matched live quote is the source of truth while app_get is pending.
      // Only fallback calculations receive a manual markup here.
      if (matchedProp) return Number(raw.toFixed(2));
      return applyMarketingMarkupToPayout(raw, marketingProfile);
    };

    // Prefer the exact Deriv proposal for this contract type, barrier, and stake.
    if (matchedProp && matchedProp.contractType && String(matchedProp.contractType).toUpperCase() === ct) {
      var barrierMatches = true;
      if (barrier !== undefined && barrier !== null && barrier !== '' &&
          matchedProp.barrier !== undefined && matchedProp.barrier !== null && matchedProp.barrier !== '') {
        barrierMatches = String(barrier).trim() === String(matchedProp.barrier).trim();
      }
      if (barrierMatches) {
        var rawPropPayout = Number(matchedProp.payout);
        var propStake = Number(matchedProp.stake) || st;
        if (Number.isFinite(rawPropPayout) && rawPropPayout > 0 && Number.isFinite(propStake) && propStake > 0) {
          if (Math.abs(propStake - st) > 0.001) {
            return finalize((rawPropPayout / propStake) * st);
          }
          return finalize(rawPropPayout);
        }
      }
    }

    if (ct === 'DIGITOVER' || ct === 'OVER') {
      var b = parseInt(barrier, 10);
      if (!Number.isFinite(b) || b < 0 || b > 8) b = 5;
      var winWays = 9 - b;
      var mult = (10 / winWays) * 0.953;
      return finalize(st * mult);
    }

    if (ct === 'DIGITUNDER' || ct === 'UNDER') {
      var b = parseInt(barrier, 10);
      if (!Number.isFinite(b) || b < 1 || b > 9) b = 5;
      var winWays = b;
      var mult = (10 / winWays) * 0.953;
      return finalize(st * mult);
    }

    if (ct === 'DIGITMATCH' || ct === 'MATCHES' || ct === 'MATCH') {
      return finalize(st * 9.53);
    }

    if (ct === 'DIGITDIFF' || ct === 'DIFFERS' || ct === 'DIFF') {
      return finalize(st * 1.055);
    }

    if (ct === 'DIGITEVEN' || ct === 'EVEN' || ct === 'DIGITODD' || ct === 'ODD') {
      return finalize(st * 1.96);
    }

    if (ct === 'CALL' || ct === 'HIGHER' || ct === 'RISE') {
      return finalize(st * 1.95);
    }

    if (ct === 'PUT' || ct === 'LOWER' || ct === 'FALL') {
      return finalize(st * 1.95);
    }

    return finalize(st * 1.95);
  }

  function getSymbolDisplayName(sym) {
    if (!sym) return 'Volatility 100 (1s) Index';
    if (typeof ACTIVE_SYMBOLS_FALLBACK !== 'undefined' && Array.isArray(ACTIVE_SYMBOLS_FALLBACK)) {
      for (var i = 0; i < ACTIVE_SYMBOLS_FALLBACK.length; i++) {
        if (ACTIVE_SYMBOLS_FALLBACK[i].symbol === sym) {
          return ACTIVE_SYMBOLS_FALLBACK[i].display;
        }
      }
    }
    return sym;
  }

  function generateContractLongcode(sym, ct, bar, st) {
    var dName = getSymbolDisplayName(sym);
    if (ct === 'DIGITOVER') {
      return 'Win payout if the last digit of ' + dName + ' is strictly higher than ' + (bar || '0') + ' after 1 ticks.';
    }
    if (ct === 'DIGITUNDER') {
      return 'Win payout if the last digit of ' + dName + ' is strictly lower than ' + (bar || '0') + ' after 1 ticks.';
    }
    if (ct === 'DIGITMATCH') {
      return 'Win payout if the last digit of ' + dName + ' equals ' + (bar || '0') + ' after 1 ticks.';
    }
    if (ct === 'DIGITDIFF') {
      return 'Win payout if the last digit of ' + dName + ' does not equal ' + (bar || '0') + ' after 1 ticks.';
    }
    if (ct === 'DIGITEVEN') {
      return 'Win payout if the last digit of ' + dName + ' is even after 1 ticks.';
    }
    if (ct === 'DIGITODD') {
      return 'Win payout if the last digit of ' + dName + ' is odd after 1 ticks.';
    }
    if (ct === 'CALL') {
      return 'Win payout if ' + dName + ' is strictly higher than entry spot at contract expiry.';
    }
    if (ct === 'PUT') {
      return 'Win payout if ' + dName + ' is strictly lower than entry spot at contract expiry.';
    }
    return 'Win payout if ' + dName + ' conforms to ' + ct + ' contract.';
  }

  function getMarketingAccuracy(profile) {
    var candidates = [];
    try {
      var settings = window.__DERIV_SITE_SETTINGS__ || {};
      if (settings.accuracy !== undefined && settings.accuracy !== null) {
        candidates.push(settings.accuracy);
      }
    } catch (_) {}
    if (profile && profile.accuracy !== undefined && profile.accuracy !== null) {
      candidates.push(profile.accuracy);
    }
    try {
      var raw = localStorage.getItem('config.site_settings_json');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && (parsed.accuracy !== undefined || parsed.winRate !== undefined)) {
          candidates.push(parsed.accuracy !== undefined ? parsed.accuracy : parsed.winRate);
        }
      }
    } catch (_) {}
    try {
      if (window.__DERIV_ACCURACY__ !== undefined) candidates.push(window.__DERIV_ACCURACY__);
    } catch (_) {}

    for (var i = 0; i < candidates.length; i++) {
      var num = Number(candidates[i]);
      if (Number.isFinite(num)) {
        return Math.max(0, Math.min(100, num));
      }
    }
    return 85.0;
  }

  function isTradeWon(profile) {
    var acc = getMarketingAccuracy(profile);
    if (acc >= 100) return true;  // 100% accuracy = NEVER lose any trade
    if (acc <= 0) return false;   // 0% accuracy = NEVER win any trade
    return (Math.random() * 100) < acc;
  }

  function createFallbackSimulatedContract(cId, prof, matchedProp) {
    var nowSec = Math.floor(Date.now() / 1000);
    var pObj = matchedProp || {};
    var sym = pObj.symbol || '1HZ100V';
    var ct = pObj.contractType || 'CALL';
    var bar = pObj.barrier || '0';
    var st = Number(pObj.stake || 1.0);
    var py = (Number.isFinite(Number(pObj.payout)) && Number(pObj.payout) > 0) ? Number(pObj.payout) : calculateContractPayout(ct, bar, st, pObj, prof);
    var profVal = Number((py - st).toFixed(2));
    var lc = pObj.longcode || generateContractLongcode(sym, ct, bar, st);

    var sCont = {
      contractId: Number(cId || Math.floor(1000000000 + Math.random() * 9000000000)),
      buyTransId: Math.floor(1000000000 + Math.random() * 9000000000),
      sellTransId: Math.floor(1000000000 + Math.random() * 9000000000),
      loginid: (prof && prof.rot) || currentRealLoginId || getStoredRealLoginId() || '',
      currency: (prof && prof.currency) || 'USD',
      symbol: sym,
      displayName: getSymbolDisplayName(sym),
      contractType: ct,
      barrier: bar,
      stake: st,
      payout: py,
      profit: profVal,
      profitPercentage: Number(((profVal / st) * 100).toFixed(2)),
      sellPrice: py,
      isWon: true,
      isSettled: false,
      startTime: nowSec,
      expiryTime: nowSec + 2,
      settlementTime: nowSec + 2,
      entrySpot: Number(pObj.spot || 1000.00),
      exitSpot: Number(pObj.spot || 1000.00) + 0.80,
      currentSpot: Number(pObj.spot || 1000.00),
      currentTime: nowSec,
      balanceAfterBuy: getVirtualTradingBalance('real'),
      balanceAfterSettle: getVirtualTradingBalance('real'),
      longcode: lc,
      activeSubscriptionWs: null
    };
    sCont.currentPoc = buildPocPayload(sCont, true);
    simulatedMarketingContracts[String(cId)] = sCont;
    return sCont;
  }
  var createFallbackSyntheticContract = createFallbackSimulatedContract;

  function buildPocPayload(simCont, isInitialOpen) {
    var settled = !isInitialOpen && !!simCont.isSettled;
    var currentSpotVal = settled ? simCont.exitSpot : simCont.currentSpot;
    var currentSpotTime = settled ? simCont.settlementTime : simCont.currentTime;
    var bidPriceVal = settled ? simCont.sellPrice : simCont.stake;
    var profitVal = settled ? simCont.profit : 0;
    var statusVal = settled ? (simCont.isWon ? 'won' : 'lost') : 'open';

    var pocObj = {
      accountID: simCont.loginid,
      audit_details: {
        all_ticks: [
          { epoch: simCont.startTime, tick: simCont.entrySpot, tick_display_value: simCont.entrySpot.toFixed(2) }
        ]
      },
      balance_after: settled ? simCont.balanceAfterSettle : simCont.balanceAfterBuy,
      barrier: String(simCont.barrier || '0'),
      barrier_count: 1,
      bid_price: Number(bidPriceVal || 0),
      buy_price: Number(simCont.stake || 1),
      contract_id: Number(simCont.contractId),
      contract_type: simCont.contractType || 'CALL',
      currency: simCont.currency || 'USD',
      current_spot: currentSpotVal,
      current_spot_display_value: currentSpotVal.toFixed(2),
      current_spot_time: currentSpotTime,
      date_expiry: simCont.expiryTime,
      date_settlement: simCont.settlementTime,
      date_start: simCont.startTime,
      display_name: simCont.displayName || getSymbolDisplayName(simCont.symbol),
      entry_spot: simCont.entrySpot,
      entry_spot_display_value: simCont.entrySpot.toFixed(2),
      entry_tick: simCont.entrySpot,
      entry_tick_display_value: simCont.entrySpot.toFixed(2),
      entry_tick_time: simCont.startTime,
      id: String(simCont.contractId),
      is_expired: settled ? 1 : 0,
      is_forward_starting: 0,
      is_intraday: 1,
      is_path_dependent: 0,
      is_settleable: settled ? 1 : 0,
      is_settled: settled ? 1 : 0,
      is_sold: settled ? 1 : 0,
      is_valid_to_cancel: 0,
      is_valid_to_sell: settled ? 0 : 1,
      longcode: simCont.longcode || generateContractLongcode(simCont.symbol, simCont.contractType, simCont.barrier, simCont.stake),
      payout: Number(simCont.payout || 0),
      profit: Number(profitVal || 0),
      profit_percentage: Number(settled ? simCont.profitPercentage : 0),
      purchase_time: simCont.startTime,
      sell_price: settled ? Number(simCont.sellPrice || 0) : undefined,
      sell_time: settled ? simCont.settlementTime : undefined,
      shortcode: simCont.shortcode || ((simCont.contractType || 'CALL') + '_' + (simCont.symbol || '1HZ100V') + '_' + (simCont.barrier ? simCont.barrier + '_' : '') + simCont.stake),
      status: statusVal,
      transaction_ids: {
        buy: simCont.buyTransId,
        sell: settled ? simCont.sellTransId : undefined
      },
      underlying_symbol: simCont.symbol || '1HZ100V',
      tick_count: 1,
      tick_stream: [
        { epoch: simCont.startTime, tick: simCont.entrySpot, tick_display_value: simCont.entrySpot.toFixed(2) }
      ]
    };

    if (settled) {
      pocObj.exit_tick = simCont.exitSpot;
      pocObj.exit_tick_display_value = simCont.exitSpot.toFixed(2);
      pocObj.exit_tick_time = simCont.settlementTime;
      pocObj.audit_details.all_ticks.push({
        epoch: simCont.settlementTime,
        tick: simCont.exitSpot,
        tick_display_value: simCont.exitSpot.toFixed(2)
      });
      pocObj.tick_stream.push({
        epoch: simCont.settlementTime,
        tick: simCont.exitSpot,
        tick_display_value: simCont.exitSpot.toFixed(2)
      });
    }
    return pocObj;
  }

  function isDemoLoginid(id) {
    if (!id) return false;
    var u = String(id).trim().toUpperCase();
    return u.indexOf('VRTC') === 0 || u.indexOf('VRT') === 0 || u.indexOf('DOT') === 0 || u.indexOf('DEM') === 0 || u.indexOf('VRW') === 0;
  }

  // Return a mode only when the login ID identifies a real/demo account clearly.
  // VRTC9999999 is a legacy placeholder, not a trusted authenticated demo account.
  function getAccountModeFromLoginid(id) {
    var u = String(id || '').trim().toUpperCase();
    if (!u || u === 'VRTC9999999') return null;
    if (isDemoLoginid(u)) return 'demo';
    if (u.indexOf('CR') === 0 || u.indexOf('ROT') === 0 || u.indexOf('MF') === 0 || u.indexOf('MLT') === 0) return 'real';
    return null;
  }

  function getAvailableDemoAccount() {
    try {
      // 0. Primary OAuth 2.0 PKCE Session in sessionStorage (auth_info)
      try {
        var authInfoRaw = sessionStorage.getItem('auth_info');
        if (authInfoRaw) {
          var authInfo = JSON.parse(authInfoRaw);
          var oauthTok = authInfo && (authInfo.access_token || authInfo.token);
          if (oauthTok) {
            var demoId = '';
            var candidateSources = [
              localStorage.getItem('accountsList'),
              localStorage.getItem('clientAccounts'),
              localStorage.getItem('client.accounts'),
              sessionStorage.getItem('deriv_accounts'),
              sessionStorage.getItem('accountsList')
            ];
            for (var cs = 0; cs < candidateSources.length; cs++) {
              if (demoId) break;
              var cRaw = candidateSources[cs];
              if (!cRaw) continue;
              try {
                var cParsed = JSON.parse(cRaw);
                if (Array.isArray(cParsed)) {
                  for (var ci = 0; ci < cParsed.length; ci++) {
                    var cItem = cParsed[ci];
                    var cLid = String((cItem && (cItem.loginid || cItem.account || cItem.id)) || '').trim().toUpperCase();
                    if (isDemoLoginid(cLid) && cLid !== 'VRTC9999999') {
                      demoId = cLid;
                      break;
                    }
                  }
                } else if (cParsed && typeof cParsed === 'object') {
                  for (var ck in cParsed) {
                    var ckUpper = String(ck || '').trim().toUpperCase();
                    if (isDemoLoginid(ckUpper) && ckUpper !== 'VRTC9999999') {
                      demoId = ckUpper;
                      break;
                    }
                  }
                }
              } catch (_) {}
            }

            if (demoId) {
              return { loginid: demoId, token: String(oauthTok).trim(), currency: 'USD' };
            }
          }
        }
      } catch (_) {}

      // 1. Primary Deriv accountsList map: { "CR...": "tok1", "VRTC...": "tok2" }
      var rawAccountsList = localStorage.getItem('accountsList') || sessionStorage.getItem('accountsList');
      if (rawAccountsList) {
        try {
          var parsedList = JSON.parse(rawAccountsList);
          if (parsedList && typeof parsedList === 'object') {
            for (var lid in parsedList) {
              if (Object.prototype.hasOwnProperty.call(parsedList, lid)) {
                var upperLid = String(lid).trim().toUpperCase();
                if (isDemoLoginid(upperLid) && upperLid !== 'VRTC9999999') {
                  var tokVal = parsedList[lid];
                  var demoToken = typeof tokVal === 'string' ? tokVal : (tokVal && (tokVal.token || tokVal.ticket));
                  if (demoToken && String(demoToken).trim().length >= 8 && String(demoToken).indexOf('a1-mock') === -1) {
                    return { loginid: upperLid, token: String(demoToken).trim(), currency: (tokVal && tokVal.currency) || 'USD' };
                  }
                }
              }
            }
          }
        } catch (_) {}
      }

      // 2. Secondary clientAccounts / client.accounts / user_accounts / tokenList / deriv_accounts / config.tokens
      var rawSources = [
        localStorage.getItem('clientAccounts'),
        localStorage.getItem('client.accounts'),
        localStorage.getItem('user_accounts'),
        localStorage.getItem('tokenList'),
        localStorage.getItem('deriv_accounts'),
        localStorage.getItem('config.tokens'),
        sessionStorage.getItem('clientAccounts'),
        sessionStorage.getItem('client.accounts'),
        sessionStorage.getItem('user_accounts'),
        sessionStorage.getItem('tokenList'),
        sessionStorage.getItem('deriv_accounts')
      ];
      try {
        var m1 = document.cookie.match(/(?:^|;s*)(?:client.accounts|clientAccounts)=([^;]+)/);
        if (m1) rawSources.push(decodeURIComponent(m1[1]));
      } catch (_) {}

      for (var s = 0; s < rawSources.length; s++) {
        var raw = rawSources[s];
        if (!raw) continue;
        try {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (var i = 0; i < parsed.length; i++) {
              var item = parsed[i];
              var iLid = String((item && (item.loginid || item.account || item.id)) || '').trim().toUpperCase();
              if (isDemoLoginid(iLid) && iLid !== 'VRTC9999999') {
                var iTok = item && (item.token || item.ticket || (typeof item === 'string' ? item : null));
                if (iTok && String(iTok).trim().length >= 8 && String(iTok).indexOf('a1-mock') === -1) {
                  return { loginid: iLid, token: String(iTok).trim(), currency: (item && item.currency) || 'USD' };
                }
              }
            }
          } else if (parsed && typeof parsed === 'object') {
            for (var k in parsed) {
              if (Object.prototype.hasOwnProperty.call(parsed, k)) {
                var entry = parsed[k];
                var kLid = String((entry && (entry.loginid || entry.account || entry.id)) || k || '').trim().toUpperCase();
                if (isDemoLoginid(kLid) && kLid !== 'VRTC9999999') {
                  var entryTok = entry && (entry.token || entry.ticket || (typeof entry === 'string' ? entry : null));
                  if (entryTok && String(entryTok).trim().length >= 8 && String(entryTok).indexOf('a1-mock') === -1) {
                    return { loginid: kLid, token: String(entryTok).trim(), currency: (entry && entry.currency) || 'USD' };
                  }
                }
              }
            }
          }
        } catch (_) {}
      }

      // 3. Check URL query parameters and location hash
      try {
        var searchStr = window.location.search || '';
        var hashStr = window.location.hash || '';
        var paramsList = [new URLSearchParams(searchStr)];
        if (hashStr && hashStr.indexOf('?') !== -1) {
          paramsList.push(new URLSearchParams(hashStr.substring(hashStr.indexOf('?'))));
        }
        for (var pl = 0; pl < paramsList.length; pl++) {
          var searchParams = paramsList[pl];
          for (var p = 1; p <= 10; p++) {
            var acctParam = searchParams.get('acct' + p);
            var tokParam = searchParams.get('token' + p);
            var curParam = searchParams.get('cur' + p);
            if (acctParam && tokParam) {
              var upAcct = String(acctParam).trim().toUpperCase();
              if (isDemoLoginid(upAcct) && upAcct !== 'VRTC9999999') {
                return { loginid: upAcct, token: String(tokParam).trim(), currency: curParam || 'USD' };
              }
            }
          }
        }
      } catch (_) {}

      // 4. In-memory authenticated demo account
      if (actualDemoLoginId && actualDemoLoginId !== 'VRTC9999999') {
        return { loginid: actualDemoLoginId, token: '', currency: actualDemoCurrency || 'USD' };
      }
    } catch (_) {}
    return null;
  }

  function getAuthenticatedDemoAccount() {
    // 1. Direct in-memory discovered account from WebSocket
    if (actualDemoLoginId && actualDemoLoginId !== 'VRTC9999999') {
      return {
        loginid: actualDemoLoginId,
        balance: Number.isFinite(actualDemoBalance) ? actualDemoBalance : null,
        currency: actualDemoCurrency || 'USD'
      };
    }
    // 2. Discover from client.accounts in localStorage
    try {
      var caStr = localStorage.getItem('client.accounts') || localStorage.getItem('clientAccounts');
      if (caStr) {
        var ca = JSON.parse(caStr);
        for (var k in ca) {
          var ku = String(k).trim().toUpperCase();
          if (isDemoLoginid(ku) && ku !== 'VRTC9999999') {
            var b = parseFloat(ca[k].balance);
            return {
              loginid: ku,
              balance: Number.isFinite(b) ? b : (Number.isFinite(actualDemoBalance) ? actualDemoBalance : null),
              currency: ca[k].currency || actualDemoCurrency || 'USD',
              token: ca[k].token
            };
          }
        }
      }
    } catch (_) {}
    // 3. Discover from accountsList in localStorage
    try {
      var alStr = localStorage.getItem('accountsList');
      if (alStr) {
        var al = JSON.parse(alStr);
        for (var lid in al) {
          var lidU = String(lid).trim().toUpperCase();
          if (isDemoLoginid(lidU) && lidU !== 'VRTC9999999') {
            var tok = typeof al[lid] === 'string' ? al[lid] : (al[lid] && al[lid].token);
            if (tok && String(tok).indexOf('a1-mock') === -1) {
              return {
                loginid: lidU,
                balance: Number.isFinite(actualDemoBalance) ? actualDemoBalance : null,
                currency: actualDemoCurrency || 'USD',
                token: tok
              };
            }
          }
        }
      }
    } catch (_) {}
    // 4. Discover from URL search params (acct1..acct10)
    try {
      var sp = new URLSearchParams(window.location.search);
      for (var p = 1; p <= 10; p++) {
        var a = sp.get('acct' + p);
        var t = sp.get('token' + p);
        if (a && isDemoLoginid(a) && a.toUpperCase() !== 'VRTC9999999') {
          return {
            loginid: a.toUpperCase(),
            balance: Number.isFinite(actualDemoBalance) ? actualDemoBalance : null,
            currency: sp.get('cur' + p) || actualDemoCurrency || 'USD',
            token: t
          };
        }
      }
    } catch (_) {}

    return null;
  }

  function findAccountByToken(token) {
    if (!token) return null;
    var tokenStr = String(token).trim();
    try {
      var rawAccountsList = localStorage.getItem('accountsList') || sessionStorage.getItem('accountsList');
      if (rawAccountsList) {
        try {
          var parsedList = JSON.parse(rawAccountsList);
          if (parsedList && typeof parsedList === 'object') {
            for (var lid in parsedList) {
              if (Object.prototype.hasOwnProperty.call(parsedList, lid)) {
                var val = parsedList[lid];
                var t = typeof val === 'string' ? val : (val && val.token);
                if (t === tokenStr) {
                  var upperLid = String(lid).trim().toUpperCase();
                  var isVirt = upperLid.indexOf('DOT') === 0 || upperLid.indexOf('DEM') === 0 || upperLid.indexOf('VRTC') === 0 || upperLid.indexOf('VRT') === 0 ? 1 : 0;
                  return { loginid: upperLid, token: tokenStr, currency: (val && val.currency) || 'USD', is_virtual: isVirt };
                }
              }
            }
          }
        } catch (_) {}
      }

      var rawSources = [
        localStorage.getItem('clientAccounts'),
        localStorage.getItem('client.accounts'),
        localStorage.getItem('user_accounts'),
        localStorage.getItem('tokenList'),
        localStorage.getItem('deriv_accounts'),
        localStorage.getItem('config.tokens'),
        sessionStorage.getItem('clientAccounts'),
        sessionStorage.getItem('client.accounts'),
        sessionStorage.getItem('user_accounts'),
        sessionStorage.getItem('tokenList'),
        sessionStorage.getItem('deriv_accounts')
      ];
      try {
        var m1 = document.cookie.match(/(?:^|;s*)(?:client.accounts|clientAccounts)=([^;]+)/);
        if (m1) rawSources.push(decodeURIComponent(m1[1]));
      } catch (_) {}

      for (var s = 0; s < rawSources.length; s++) {
        var raw = rawSources[s];
        if (!raw) continue;
        try {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (var i = 0; i < parsed.length; i++) {
              var item = parsed[i];
              if (item && item.token === tokenStr) {
                var itemLid = String(item.loginid || item.account || item.id || '').trim().toUpperCase();
                var itemIsVirt = (item.is_virtual || itemLid.indexOf('DOT') === 0 || itemLid.indexOf('DEM') === 0 || itemLid.indexOf('VRTC') === 0 || itemLid.indexOf('VRT') === 0) ? 1 : 0;
                return { loginid: itemLid, token: tokenStr, currency: item.currency || 'USD', is_virtual: itemIsVirt };
              }
            }
          } else if (parsed && typeof parsed === 'object') {
            for (var k in parsed) {
              if (Object.prototype.hasOwnProperty.call(parsed, k)) {
                var entry = parsed[k];
                var entryToken = entry && (entry.token || entry.ticket || (typeof entry === 'string' ? entry : null));
                if (entryToken === tokenStr) {
                  var entryLid = String((entry && (entry.loginid || entry.account || entry.id)) || k || '').trim().toUpperCase();
                  var entryIsVirt = ((entry && entry.is_virtual) || entryLid.indexOf('DOT') === 0 || entryLid.indexOf('DEM') === 0 || entryLid.indexOf('VRTC') === 0 || entryLid.indexOf('VRT') === 0) ? 1 : 0;
                  return { loginid: entryLid, token: tokenStr, currency: (entry && entry.currency) || 'USD', is_virtual: entryIsVirt };
                }
              }
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
    return null;
  }

  function getActiveProfileObject() {
    return getActiveMarketingProfileForCurrentAccount();
  }

  window.__SITEBUILDER_MARKETING__ = {
    getActiveProfile: function () {
      return getActiveMarketingProfileForCurrentAccount();
    },
    isDemoActive: function () { return isDemoAccountActive(); },
    resolveEligibility: function (id) {
      if (!id) return null;
      var clean = String(id).trim().toUpperCase();
      return resolveMarketingProfileSync(clean);
    },
    switchAccount: function (newLoginId) {
      syncAccountState(newLoginId);
    },
    getVirtualBalance: getVirtualTradingBalance,
    getCumulativePnL: function () { return cumulativeVirtualPnL; },
    resetSession: resetVirtualTradingSession
  };

  var currentAuthoritativeMode = null; // 'real' | 'demo'
  var currentAuthoritativeLoginid = '';
  var activeModeEpoch = 0;

  function setAuthoritativeMode(mode, loginid) {
    var cleanMode = mode === 'demo' || mode === 'virtual' ? 'demo' : 'real';
    var requestedId = String(loginid || '').trim().toUpperCase();
    var requestedIdMode = getAccountModeFromLoginid(requestedId);
    // A recognised account ID is stronger evidence than a text/URL mode hint.
    if (requestedIdMode) cleanMode = requestedIdMode;

    var prevMode = currentAuthoritativeMode;
    currentAuthoritativeMode = cleanMode;
    activeModeEpoch++;

    if (requestedId) {
      currentAuthoritativeLoginid = requestedId;
    } else {
      // Never carry a login ID from the opposite mode into the new selection.
      if (getAccountModeFromLoginid(currentAuthoritativeLoginid) !== cleanMode) {
        currentAuthoritativeLoginid = '';
      }

      var storedId = '';
      try {
        storedId = String(localStorage.getItem('active_loginid') || sessionStorage.getItem('active_loginid') || '').trim().toUpperCase();
      } catch (_) {}
      if (!currentAuthoritativeLoginid && getAccountModeFromLoginid(storedId) === cleanMode) {
        currentAuthoritativeLoginid = storedId;
      }

      // If the active ID belonged to the other mode, recover a matching ID from
      // the already-authenticated account list instead of reusing the stale one.
      if (!currentAuthoritativeLoginid) {
        if (cleanMode === 'demo') {
          var demoAccount = getAuthenticatedDemoAccount() || getAvailableDemoAccount();
          var demoId = String((demoAccount && demoAccount.loginid) || '').trim().toUpperCase();
          if (getAccountModeFromLoginid(demoId) === 'demo') currentAuthoritativeLoginid = demoId;
        } else {
          var realId = String(getStoredRealLoginId() || '').trim().toUpperCase();
          if (getAccountModeFromLoginid(realId) === 'real') currentAuthoritativeLoginid = realId;
        }
      }
    }

    diagLog('mode_switched', { from: prevMode, to: cleanMode, loginid: currentAuthoritativeLoginid, epoch: activeModeEpoch });

    try {
      localStorage.setItem('account_type', cleanMode);
      sessionStorage.setItem('account_type', cleanMode);
      if (currentAuthoritativeLoginid) {
        localStorage.setItem('active_loginid', currentAuthoritativeLoginid);
        sessionStorage.setItem('active_loginid', currentAuthoritativeLoginid);
      } else {
        var storedLoginid = String(localStorage.getItem('active_loginid') || '').trim().toUpperCase();
        var storedMode = getAccountModeFromLoginid(storedLoginid);
        if (storedMode && storedMode !== cleanMode) {
          localStorage.removeItem('active_loginid');
          sessionStorage.removeItem('active_loginid');
        }
      }
    } catch (_) {}

    // Synchronize URL query parameter without reloading page
    try {
      if (window.location && window.history && window.history.replaceState) {
        var u = new URL(window.location.href);
        var currentParam = (u.searchParams.get('account') || '').toLowerCase();
        if (currentParam !== cleanMode) {
          u.searchParams.set('account', cleanMode);
          window.history.replaceState({}, '', u.toString());
        }
      }
    } catch (_) {}

    // Clear opposing mode routing on all active sockets
    if (typeof window !== 'undefined' && window.__all_deriv_sockets) {
      window.__all_deriv_sockets.forEach(function (s) {
        if (s) {
          if (cleanMode === 'demo') {
            s._marketingRouting = null;
            s._isDemo = true;
          } else {
            s._isDemo = false;
          }
        }
      });
    }

    // Refresh profile for the selected account only; don't resolve a stale ID
    // from the opposite mode if the switch event did not provide a login ID.
    var actId = currentAuthoritativeLoginid;
    if (!actId) {
      try {
        var storedProfileId = String(localStorage.getItem('active_loginid') || sessionStorage.getItem('active_loginid') || '').trim().toUpperCase();
        var storedProfileMode = getAccountModeFromLoginid(storedProfileId);
        if (!storedProfileMode || storedProfileMode === cleanMode) actId = storedProfileId;
      } catch (_) {}
    }
    if (actId && getAccountModeFromLoginid(actId) && getAccountModeFromLoginid(actId) !== cleanMode) actId = '';

    if (actId) {
      var prof = resolveMarketingProfileSync(actId);
      activeMarketingProfile = prof;
      if (prof && prof.marketingEligible && !prof.useRealBalance && cleanMode === 'real') {
        applyMarketingProfile(prof);
      } else {
        activeMarketingProfile = null;
        warmMarketingProfile(actId);
      }
    } else {
      activeMarketingProfile = null;
    }

    patchDomBalances();
  }

  function isDemoAccountActive() {
    try {
      // The most recent explicit selection wins over any stale login ID.
      if (currentAuthoritativeMode === 'demo') return true;
      if (currentAuthoritativeMode === 'real') return false;

      // Before an explicit switch, infer mode from the active account ID.
      var activeLoginid = String(
        currentAuthoritativeLoginid ||
        localStorage.getItem('active_loginid') ||
        sessionStorage.getItem('active_loginid') ||
        ''
      ).trim().toUpperCase();
      var activeMode = getAccountModeFromLoginid(activeLoginid);
      if (activeMode) return activeMode === 'demo';

      // 3. URL parameter on page visit / navigation
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        var urlParams = new URLSearchParams(window.location.search);
        var acctParam = (urlParams.get('account') || '').toLowerCase();
        if (acctParam === 'demo' || acctParam === 'virtual') return true;
        if (acctParam === 'real') return false;
      }

      // 4. Stored account_type
      var storedAcctType = (localStorage.getItem('account_type') || sessionStorage.getItem('account_type') || '').toLowerCase();
      if (storedAcctType === 'demo' || storedAcctType === 'virtual') return true;
      if (storedAcctType === 'real') return false;
    } catch (_) {}
    return false;
  }

  function showMarketingBanner(profile) {
    try {
      var existing = document.getElementById('sitebuilder-marketing-badge');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    } catch (e) {}
  }

  function isUseRealBalanceEnabled(targetMode) {
    try {
      var mode = targetMode || (isDemoAccountActive() ? 'demo' : 'real');
      var s = window.__DERIV_SITE_SETTINGS__;
      if (s) {
        if (mode === 'demo' && s.demo && s.demo.useRealBalance !== undefined) {
          return s.demo.useRealBalance === true;
        }
        if (mode === 'real' && s.real && s.real.useRealBalance !== undefined) {
          return s.real.useRealBalance === true;
        }
        if (s.useRealBalance !== undefined) return s.useRealBalance === true;
      }
    } catch (_) {}
    return false;
  }

  function patchDomBalances(profile) {
    try {
      var isDemo = isDemoAccountActive();
      var targetMode = isDemo ? 'demo' : 'real';
      var prof = profile || getActiveMarketingProfileForCurrentAccount();
      var isSimulation = !!(prof && prof.marketingEligible && !prof.useRealBalance && !isUseRealBalanceEnabled(targetMode) && prof.rot === 'ROT90394362');

      // CRITICAL: If NOT in simulation mode for the single marketing account (ROT90394362),
      // NEVER OVERWRITE THE DOM HEADER BALANCES!
      // Native Deriv React components handle live balance updates, stakes, payouts, and currency formatting!
      if (!isSimulation) {
        // Only clean up any rogue VRTC9999999 text inside switcher dialog items if needed,
        // and NEVER touch the header balance or buttons!
        var rogueItems = document.querySelectorAll('.deriv-account-switcher-item, .account-switcher__item');
        if (rogueItems && rogueItems.length) {
          rogueItems.forEach(function (item) {
            var loginEl = item.querySelector('.deriv-account-switcher-item__loginid, [class*="loginid" i]');
            var rId = loginEl ? String(loginEl.textContent || '').trim().toUpperCase() : '';
            if (rId === 'VRTC9999999') {
              var realDemo = getAuthenticatedDemoAccount();
              if (realDemo && realDemo.loginid) {
                loginEl.textContent = realDemo.loginid;
              }
            }
          });
        }
        return;
      }

      // ONLY for the active marketing simulation account (ROT90394362):
      var currency = prof.currency || 'USD';
      var mBal = Number(prof.startingBalance !== undefined ? prof.startingBalance : 79.84);
      var st = modeState.real;
      if (Number.isFinite(mBal) && st.startingBalance !== mBal && st.pnl === 0 && getTotalOpenStakes('real') === 0) {
        st.startingBalance = mBal;
      }
      var expectedNum = formatVirtualTradingBalance('real');
      var fullExpected = expectedNum ? (expectedNum + ' ' + currency) : 'Loading...';

      // 1. Header balance elements
      var dtBalEls = document.querySelectorAll('[data-testid="dt_balance"], .acc-info__balance, .acc-info__wallets-balance, [class*="acc-info__balance" i], [class*="header__balance" i], [class*="balance__value" i], [class*="account-switcher__balance" i]');
      dtBalEls.forEach(function (dtBalEl) {
        if (dtBalEl && dtBalEl.children.length === 0) {
          if (dtBalEl.textContent !== fullExpected && fullExpected) dtBalEl.textContent = fullExpected;
        }
      });

      // 2. Switcher button balance spans
      var switcherBtn = document.querySelector('.deriv-account-switcher__button, [class*="account-switcher__button" i], button[class*="account-switcher" i]');
      if (switcherBtn) {
        var balContainer = switcherBtn.querySelector('.deriv-account-switcher__balance, [class*="balance" i]');
        if (balContainer) {
          var spans = balContainer.querySelectorAll('span');
          if (spans.length >= 1) {
            if (expectedNum && spans[0].textContent !== expectedNum) spans[0].textContent = expectedNum;
            if (spans.length >= 2 && spans[1].textContent !== currency) spans[1].textContent = currency;
          } else {
            if (fullExpected && balContainer.textContent !== fullExpected) balContainer.textContent = fullExpected;
          }
        }
      }

      // 3. Dropdown items in switcher dialog for the marketing row
      var switcherItems = document.querySelectorAll('.deriv-account-switcher-item, .account-switcher__item, [class*="account-switcher__item" i], [class*="account-switcher-item" i]');
      if (switcherItems && switcherItems.length) {
        switcherItems.forEach(function (item) {
          var loginEl = item.querySelector('.deriv-account-switcher-item__loginid, [class*="loginid" i]');
          var rowId = loginEl ? String(loginEl.textContent || '').trim().toUpperCase() : '';
          if (rowId === 'ROT90394362') {
            var balEl = item.querySelector('.deriv-account-switcher-item__balance, [class*="balance" i]');
            if (balEl && expectedNum) {
              var bSpans = balEl.querySelectorAll('span');
              if (bSpans.length >= 1) {
                if (bSpans[0].textContent !== expectedNum) bSpans[0].textContent = expectedNum;
                if (bSpans.length >= 2 && bSpans[1].textContent !== currency) bSpans[1].textContent = currency;
              } else if (balEl.textContent !== fullExpected) {
                balEl.textContent = fullExpected;
              }
            }
          }
        });
      }
    } catch (_) {}
  }

  // Continuous 250ms balance DOM patcher loop
  try {
    if (!window.__BAL_PATCH_LOOP__) {
      window.__BAL_PATCH_LOOP__ = setInterval(function () {
        patchDomBalances();
      }, 250);
    }
  } catch (_) {}

  function clearSiteSettingsForMarketing(loginid) {
    try {
      var raw = localStorage.getItem('config.site_settings_json');
      if (!raw) return;
      var settings = JSON.parse(raw);
      if (!settings || typeof settings !== 'object') return;
      var clean = String(loginid || '').trim().toUpperCase();
      if (Array.isArray(settings.marketingAccounts)) {
        settings.marketingAccounts = settings.marketingAccounts.filter(function (a) {
          var aId = String((a && (a.loginid || a.loginId || a.id)) || '').trim().toUpperCase();
          return clean ? !isSameAccount(aId, clean) : false;
        });
      }
      if (Array.isArray(settings.specialAccounts)) {
        settings.specialAccounts = settings.specialAccounts.filter(function (a) {
          var aId = String((a && (a.loginid || a.loginId || a.id)) || '').trim().toUpperCase();
          return clean ? !isSameAccount(aId, clean) : false;
        });
      }
      localStorage.setItem('config.site_settings_json', JSON.stringify(settings));
    } catch (_) {}
  }

  function clearMarketingState(loginid) {
    activeMarketingProfile = null;
    var cleanId = String(loginid || '').trim().toUpperCase();
    var digits = cleanId.replace(/^[^0-9]+/, '');
    try {
      if (cleanId) {
        localStorage.removeItem('sitebuilder_marketing_cache_' + cleanId);
        localStorage.removeItem('sitebuilder_virtual_pnl_' + HOST_KEY + '_' + cleanId);
        localStorage.removeItem('sitebuilder_demo_sync_' + HOST_KEY + '_' + cleanId);
      }
      if (digits) {
        localStorage.removeItem('sitebuilder_marketing_cache_ROT' + digits);
        localStorage.removeItem('sitebuilder_marketing_cache_CR' + digits);
        localStorage.removeItem('sitebuilder_virtual_pnl_' + HOST_KEY + '_ROT' + digits);
        localStorage.removeItem('sitebuilder_demo_sync_' + HOST_KEY + '_ROT' + digits);
        localStorage.removeItem('sitebuilder_virtual_pnl_' + HOST_KEY + '_CR' + digits);
        localStorage.removeItem('sitebuilder_demo_sync_' + HOST_KEY + '_CR' + digits);
      }
      for (var kIdx = localStorage.length - 1; kIdx >= 0; kIdx--) {
        var kName = localStorage.key(kIdx);
        if (kName && (kName.indexOf('sitebuilder_virtual_pnl_') === 0 || kName.indexOf('sitebuilder_demo_sync_') === 0 || kName.indexOf('sitebuilder_marketing_') === 0)) {
          localStorage.removeItem(kName);
        }
      }
      localStorage.removeItem('sitebuilder_marketing_active_cache');
      localStorage.removeItem('MarketingProfiles');
      localStorage.removeItem('marketing_profiles');
      localStorage.removeItem('sitebuilder_marketing_profiles');
      clearSiteSettingsForMarketing(cleanId);

      // Authentic Deriv ROT account preservation: do NOT delete authentic accounts on marketing reset
    } catch (_) {}
  }

  function updateSiteSettingsForMarketing(profile) {
    // Activation is authoritative on the backend Marketing profile.
    // Do not persist Marketing activation into site settings from the public site.
  }

  function applyMarketingProfile(profile) {
    if (!profile || !profile.rot || !profile.marketingEligible) return;
    activeMarketingProfile = profile;
    var rotClean = String(profile.rot).trim().toUpperCase();
    marketingProfilesByRot[rotClean] = profile;

    // Never use currentBalance as the base: it already includes P/L, so re-applying
    // it on every reconnect/authorize would add the P/L again (balance drifting with no trades).
    var mBal = Number(profile.startingBalance !== undefined ? profile.startingBalance : 450.00);
    if (Number.isFinite(mBal)) {
      VIRTUAL_STARTING_BALANCE = mBal;
    }

    updateSiteSettingsForMarketing(profile);
    if (!isDemoAccountActive()) patchDomBalances(profile);
  }

  function isSameAccount(id1, id2) {
    if (!id1 || !id2) return false;
    return String(id1).trim().toUpperCase() === String(id2).trim().toUpperCase();
  }

  function getActiveMarketingProfileForCurrentAccount() {
    var isDemo = isDemoAccountActive();
    // Demo mode is ALWAYS native Deriv, NEVER marketing simulation
    if (isDemo) return null;

    var actId = String(localStorage.getItem('active_loginid') || currentAuthoritativeLoginid || '').trim().toUpperCase();
    var realSettings = (window.__DERIV_SITE_SETTINGS__ && (window.__DERIV_SITE_SETTINGS__.real || window.__DERIV_SITE_SETTINGS__)) || {};
    var rotVal = String(realSettings.rot || 'ROT90394362').trim().toUpperCase();
    if (realSettings.useRealBalance === true) return null;

    // STRICT ACCOUNT ISOLATION:
    // Marketing simulation is strictly and exclusively for the configured Real ROT (ROT90394362).
    // Client accounts (CR..., etc.) and non-ROT accounts are 100% native Deriv accounts!
    if (!actId || actId !== rotVal) {
      return null;
    }

    if (activeMarketingProfile && activeMarketingProfile.marketingEligible && !activeMarketingProfile.isDemoMarketing && activeMarketingProfile.rot === rotVal) {
      return activeMarketingProfile;
    }
    if (marketingProfilesByRot[rotVal] && marketingProfilesByRot[rotVal].marketingEligible && marketingProfilesByRot[rotVal].rot === rotVal) {
      return marketingProfilesByRot[rotVal];
    }

    try {
      var startBal = Number(realSettings.startingBalance !== undefined ? realSettings.startingBalance : 79.84);
      var defProf = {
        rot: rotVal,
        marketingEligible: true,
        useRealBalance: false,
        startingBalance: startBal,
        currentBalance: startBal,
        accuracy: Number(realSettings.accuracy !== undefined ? realSettings.accuracy : 100),
        currency: realSettings.currency || 'USD',
        mode: 'simulation',
        app_markup_percentage: Number(realSettings.app_markup_percentage || 0),
        isDemoMarketing: false
      };
      activeMarketingProfile = defProf;
      marketingProfilesByRot[rotVal] = defProf;
      return defProf;
    } catch (_) {}

    return null;
  }

  function resolveMarketingProfileSync(loginid) {
    var cleanId = String(loginid || '').trim().toUpperCase();
    var isTargetDemo = isDemoLoginid(cleanId);
    if (isTargetDemo) return null; // Demo is NEVER marketing

    var realSettings = (window.__DERIV_SITE_SETTINGS__ && (window.__DERIV_SITE_SETTINGS__.real || window.__DERIV_SITE_SETTINGS__)) || {};
    var rotVal = String(realSettings.rot || 'ROT90394362').trim().toUpperCase();

    // Client accounts (CR..., etc.) must NEVER receive a marketing profile
    if (!cleanId || cleanId !== rotVal) return null;

    if (activeMarketingProfile && activeMarketingProfile.marketingEligible && activeMarketingProfile.rot === rotVal) {
      return activeMarketingProfile;
    }
    if (marketingProfilesByRot[rotVal] && marketingProfilesByRot[rotVal].marketingEligible) {
      return marketingProfilesByRot[rotVal];
    }
    return getActiveMarketingProfileForCurrentAccount();
  }

  var warmingInFlight = {};
  function warmMarketingProfile(loginid) {
    if (!loginid) return;
    var cleanId = String(loginid).trim().toUpperCase();
    var isTargetDemo = isDemoLoginid(cleanId);
    var targetMode = isTargetDemo ? 'demo' : 'real';

    if (warmingInFlight[cleanId]) return;
    warmingInFlight[cleanId] = true;

    try {
      var host = encodeURIComponent(window.location.hostname || '');
      var reqEpoch = typeof activeModeEpoch === 'number' ? activeModeEpoch : 0;
      fetch('/api/marketing/resolve?loginid=' + encodeURIComponent(cleanId) + '&hostname=' + host + '&mode=' + targetMode, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }
      }).then(function (res) {
        warmingInFlight[cleanId] = false;
        if (!res.ok) throw new Error('status ' + res.status);
        return res.json();
      }).then(function (res) {
        if (reqEpoch !== activeModeEpoch) {
          diagLog('resolve_stale_response_dropped', { loginid: cleanId, reqEpoch: reqEpoch, currentEpoch: activeModeEpoch });

          // If the user switched away and back while this request was pending,
          // retry now that the stale in-flight request has finished.
          var retryActiveId = String(localStorage.getItem('active_loginid') || currentAuthoritativeLoginid || '').trim().toUpperCase();
          var retryMode = currentAuthoritativeMode || (isDemoAccountActive() ? 'demo' : 'real');
          if (retryMode === targetMode && isSameAccount(retryActiveId, cleanId)) {
            setTimeout(function () { warmMarketingProfile(cleanId); }, 0);
          }
          return;
        }
        var currentActive = String(localStorage.getItem('active_loginid') || '').trim().toUpperCase();
        var curMode = isDemoAccountActive() ? 'demo' : 'real';

        if (res && res.success && res.marketingEligible && isSameAccount(cleanId, res.rot)) {
          res.isDemoMarketing = isTargetDemo;
          marketingProfilesByRot[cleanId] = res;
          if (res.rot) marketingProfilesByRot[String(res.rot).toUpperCase()] = res;
          try {
            localStorage.setItem('sitebuilder_marketing_cache_' + cleanId, JSON.stringify(res));
          } catch (_) {}

          if (curMode === targetMode && (isSameAccount(currentActive, res.rot) || isSameAccount(currentActive, cleanId))) {
            activeMarketingProfile = res;
            applyMarketingProfile(res);
            patchDomBalances(res);
          }
          diagLog('marketing_profile_resolved', { loginid: cleanId, mode: targetMode, eligible: true, startingBalance: res.startingBalance });
        } else {
          marketingProfilesByRot[cleanId] = null;
          if (res && res.rot) marketingProfilesByRot[String(res.rot).toUpperCase()] = null;
          try {
            localStorage.removeItem('sitebuilder_marketing_cache_' + cleanId);
          } catch (_) {}
          if (curMode === targetMode && (isSameAccount(currentActive, cleanId) || (activeMarketingProfile && isSameAccount(currentActive, activeMarketingProfile.rot)))) {
            activeMarketingProfile = null;
            clearMarketingState(cleanId);
            patchDomBalances(null);
          }
          diagLog('marketing_profile_resolved', { loginid: cleanId, mode: targetMode, eligible: false });
        }
      }).catch(function (err) {
        warmingInFlight[cleanId] = false;
        diagLog('marketing_profile_resolve_error', { loginid: cleanId, error: err.message });
      });
    } catch (_) {
      warmingInFlight[cleanId] = false;
    }
  }

  function syncAccountState(loginid) {
    try {
      var activeId = String(loginid || localStorage.getItem('active_loginid') || '').trim().toUpperCase();
      var activeIdMode = getAccountModeFromLoginid(activeId);
      var targetMode = activeIdMode || (isDemoAccountActive() ? 'demo' : 'real');

      // A changed, recognisable account ID can supersede the previous mode
      // (for example, a real account selected in another tab).
      if (activeIdMode && currentAuthoritativeMode && activeIdMode !== currentAuthoritativeMode) {
        setAuthoritativeMode(activeIdMode, activeId);
        targetMode = activeIdMode;
      }

      selectedAccountType = targetMode;
      selectedAccountId = activeId;

      var profile = activeId ? resolveMarketingProfileSync(activeId) : null;
      if (profile && profile.marketingEligible && isSameAccount(activeId, profile.rot)) {
        activeMarketingProfile = profile;
        applyMarketingProfile(profile);
      } else {
        activeMarketingProfile = null;
        if (activeId) warmMarketingProfile(activeId);
      }
      patchDomBalances(activeMarketingProfile);
    } catch (e) {}
  }

  function bootstrapDefaultMarketingAccount() {
    try {
      var active = String(localStorage.getItem('active_loginid') || '').trim();
      var hasSession = !!sessionStorage.getItem('auth_info') || !!localStorage.getItem('authToken');
      var caRaw = localStorage.getItem('client.accounts');
      if (caRaw) {
        try {
          var existingCa = JSON.parse(caRaw);
          for (var k in existingCa) {
            var ku = k.toUpperCase();
            if (ku.indexOf('CR') === 0 || ku.indexOf('VRTC') === 0 || ku.indexOf('DOT') === 0 || ku.indexOf('MF') === 0) {
              // Real client accounts or authenticated accounts already exist in storage!
              return;
            }
          }
        } catch (_) {}
      }
      if (!active && !hasSession) {
        var siteSettings = window.__DERIV_SITE_SETTINGS__ || {};
        var realSettings = siteSettings.real || siteSettings || {};
        var rotId = String(realSettings.rot || 'ROT90394362').trim().toUpperCase();
        var realBal = Number(realSettings.startingBalance !== undefined ? realSettings.startingBalance : 79.84);

        var urlParams = new URLSearchParams(window.location.search);
        var urlMode = (urlParams.get('account') || '').toLowerCase();
        var isInitialDemo = urlMode === 'demo' || urlMode === 'virtual';

        // Check if there is an authentic demo account discovered
        var demoAcc = getAuthenticatedDemoAccount();
        var demoId = (demoAcc && demoAcc.loginid) || actualDemoLoginId || '';

        var initialId = isInitialDemo ? (demoId || '') : rotId;
        var initialType = isInitialDemo ? 'demo' : 'real';

        if (initialId) localStorage.setItem('active_loginid', initialId);
        localStorage.setItem('account_type', initialType);

        var ca = {};
        ca[rotId] = {
          balance: realBal,
          converted_amount: realBal,
          currency: realSettings.currency || 'USD',
          demo_account: 0,
          is_virtual: 0,
          status: 1,
          token: 'a1-mockRealToken99999',
          type: 'deriv'
        };

        // If an authentic demo account exists, include it without fabricating fake VRTC9999999
        if (demoAcc && demoAcc.loginid) {
          ca[demoAcc.loginid] = {
            balance: demoAcc.balance !== undefined && demoAcc.balance !== null ? demoAcc.balance : (actualDemoBalance !== null ? actualDemoBalance : 0.00),
            converted_amount: demoAcc.balance !== undefined && demoAcc.balance !== null ? demoAcc.balance : (actualDemoBalance !== null ? actualDemoBalance : 0.00),
            currency: demoAcc.currency || actualDemoCurrency || 'USD',
            demo_account: 1,
            is_virtual: 1,
            status: 1,
            token: demoAcc.token || '',
            type: 'deriv'
          };
        }

        localStorage.setItem('client.accounts', JSON.stringify(ca));
        localStorage.setItem('clientAccounts', JSON.stringify(ca));
        var accList = {};
        accList[rotId] = 'a1-mockRealToken99999';
        if (demoAcc && demoAcc.loginid && demoAcc.token) {
          accList[demoAcc.loginid] = demoAcc.token;
        }
        localStorage.setItem('accountsList', JSON.stringify(accList));
      }
    } catch (_) {}
  }

  function bootstrapMarketingSync() {
    try {
      var settings = window.__DERIV_SITE_SETTINGS__ || {};
      var configuredRot = String(settings.rot || 'ROT91298223').trim().toUpperCase();
      var act = String(localStorage.getItem('active_loginid') || '').trim().toUpperCase();

      if (isUseRealBalanceEnabled() || (act.indexOf('ROT') === 0 && !isSameAccount(act, configuredRot))) {
        if (act.indexOf('ROT') === 0) {
          localStorage.removeItem('active_loginid');
          localStorage.removeItem('client.accounts');
          localStorage.removeItem('clientAccounts');
          localStorage.removeItem('accountsList');
        }
        activeMarketingProfile = null;
        if (isUseRealBalanceEnabled()) return;
      }
      bootstrapDefaultMarketingAccount();
      // 1. Wipe all legacy / stale caches from old sessions immediately
      localStorage.removeItem('sitebuilder_marketing_active_cache');
      localStorage.removeItem('MarketingProfiles');
      localStorage.removeItem('marketing_profiles');
      localStorage.removeItem('sitebuilder_marketing_profiles');

      // Preserve active virtual/demo sync keys so trade wins/losses persist across page refreshes

      // 3. Clean config.site_settings_json initially
      try {
        var rawSettings = localStorage.getItem('config.site_settings_json');
        if (rawSettings) {
          var pSet = JSON.parse(rawSettings);
          if (pSet && (pSet.specialAccounts || pSet.marketingAccounts)) {
            pSet.specialAccounts = [];
            pSet.marketingAccounts = [];
            localStorage.setItem('config.site_settings_json', JSON.stringify(pSet));
          }
        }
      } catch (_) {}

      // Authentic Deriv ROT accounts preserved during bootstrap

      var actId = String(localStorage.getItem('active_loginid') || '').trim().toUpperCase();
      if (actId && !isDemoAccountActive() && actId.indexOf('VRTC') !== 0 && actId.indexOf('VRT') !== 0 && actId.indexOf('DOT') !== 0 && actId.indexOf('DEM') !== 0) {
        warmMarketingProfile(actId);
      } else {
        activeMarketingProfile = null;
      }
    } catch (_) {}
    syncAccountState();
  }
  bootstrapMarketingSync();

  window.addEventListener('storage', function (e) {
    if (e && (e.key === 'active_loginid' || e.key === 'client.accounts' || e.key === 'authToken')) {
      syncAccountState(e.key === 'active_loginid' ? e.newValue : undefined);
    }
  });

  function emitWsMessage(ws, data) {
    try {
      var evt = new MessageEvent('message', { data: JSON.stringify(data) });
      if (ws) {
        if (typeof ws.onmessage === 'function') ws.onmessage(evt);
        ws.dispatchEvent(evt);
      }
      if (data && data.msg_type === 'balance') {
        if (typeof window !== 'undefined') {
          if (window.__all_deriv_sockets) {
            window.__all_deriv_sockets.forEach(function (s) {
              if (s && s !== ws && s.readyState === 1) {
                try {
                  if (typeof s.onmessage === 'function') s.onmessage(evt);
                  s.dispatchEvent(evt);
                } catch (_) {}
              }
            });
          }
          try {
            window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) }));
          } catch (_) {}
        }
      }
    } catch (e) {}
  }

  function syncAfterSuccessfulBuy(ws, rawSend, buyMsg) {
    try {
      var buy = buyMsg && buyMsg.buy;
      if (!buy || !buy.contract_id) return;

      setTimeout(function () {
        try {
          rawSend.call(ws, JSON.stringify({
            proposal_open_contract: 1,
            contract_id: buy.contract_id,
            subscribe: 1
          }));
        } catch (_) {}
      }, 0);

      setTimeout(function () {
        try {
          rawSend.call(ws, JSON.stringify({ balance: 1 }));
        } catch (_) {}
      }, 25);

      if (Number.isFinite(Number(buy.balance_after))) {
        emitWsMessage(ws, {
          echo_req: { balance: 1 },
          msg_type: 'balance',
          balance: {
            balance: Number(buy.balance_after),
            currency: buy.currency || 'USD',
            loginid: currentRealLoginId || localStorage.getItem('active_loginid') || undefined
          }
        });
      }
    } catch (_) {}
  }
  // ── Full Authentic Reference Catalog for Bot Builder ────────────────
  var SYMBOLS_CATALOG = [
    // Continuous Indices (Standard & 1-Second)
    { symbol: 'R_10', display: 'Volatility 10 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'random_index', submarket_name: 'Continuous Indices' },
    { symbol: 'R_25', display: 'Volatility 25 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'random_index', submarket_name: 'Continuous Indices' },
    { symbol: 'R_50', display: 'Volatility 50 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'random_index', submarket_name: 'Continuous Indices' },
    { symbol: 'R_75', display: 'Volatility 75 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'random_index', submarket_name: 'Continuous Indices' },
    { symbol: 'R_100', display: 'Volatility 100 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'random_index', submarket_name: 'Continuous Indices' },
    { symbol: '1HZ10V', display: 'Volatility 10 (1s) Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'random_index', submarket_name: 'Continuous Indices' },
    { symbol: '1HZ15V', display: 'Volatility 15 (1s) Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'random_index', submarket_name: 'Continuous Indices' },
    { symbol: '1HZ25V', display: 'Volatility 25 (1s) Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'random_index', submarket_name: 'Continuous Indices' },
    { symbol: '1HZ50V', display: 'Volatility 50 (1s) Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'random_index', submarket_name: 'Continuous Indices' },
    { symbol: '1HZ75V', display: 'Volatility 75 (1s) Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'random_index', submarket_name: 'Continuous Indices' },
    { symbol: '1HZ90V', display: 'Volatility 90 (1s) Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'random_index', submarket_name: 'Continuous Indices' },
    { symbol: '1HZ100V', display: 'Volatility 100 (1s) Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'random_index', submarket_name: 'Continuous Indices' },

    // Crash / Boom
    { symbol: 'BOOM300N', display: 'Boom 300 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'crash_boom', submarket_name: 'Crash/Boom' },
    { symbol: 'BOOM500', display: 'Boom 500 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'crash_boom', submarket_name: 'Crash/Boom' },
    { symbol: 'BOOM1000', display: 'Boom 1000 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'crash_boom', submarket_name: 'Crash/Boom' },
    { symbol: 'CRASH300N', display: 'Crash 300 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'crash_boom', submarket_name: 'Crash/Boom' },
    { symbol: 'CRASH500', display: 'Crash 500 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'crash_boom', submarket_name: 'Crash/Boom' },
    { symbol: 'CRASH1000', display: 'Crash 1000 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'crash_boom', submarket_name: 'Crash/Boom' },

    // Step Indices
    { symbol: 'STEP', display: 'Step Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'step_index', submarket_name: 'Step Indices' },

    // Jump Indices
    { symbol: 'JD10', display: 'Jump 10 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'jump_index', submarket_name: 'Jump Indices' },
    { symbol: 'JD25', display: 'Jump 25 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'jump_index', submarket_name: 'Jump Indices' },
    { symbol: 'JD50', display: 'Jump 50 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'jump_index', submarket_name: 'Jump Indices' },
    { symbol: 'JD75', display: 'Jump 75 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'jump_index', submarket_name: 'Jump Indices' },
    { symbol: 'JD100', display: 'Jump 100 Index', market: 'synthetic_index', market_name: 'Derived Indices', submarket: 'jump_index', submarket_name: 'Jump Indices' },

    // Forex Major Pairs
    { symbol: 'frxEURUSD', display: 'EUR/USD', market: 'forex', market_name: 'Forex', submarket: 'major_pairs', submarket_name: 'Major Pairs' },
    { symbol: 'frxGBPUSD', display: 'GBP/USD', market: 'forex', market_name: 'Forex', submarket: 'major_pairs', submarket_name: 'Major Pairs' },
    { symbol: 'frxUSDJPY', display: 'USD/JPY', market: 'forex', market_name: 'Forex', submarket: 'major_pairs', submarket_name: 'Major Pairs' },
    { symbol: 'frxAUDUSD', display: 'AUD/USD', market: 'forex', market_name: 'Forex', submarket: 'major_pairs', submarket_name: 'Major Pairs' },
    { symbol: 'frxUSDCAD', display: 'USD/CAD', market: 'forex', market_name: 'Forex', submarket: 'major_pairs', submarket_name: 'Major Pairs' },

    // Commodities
    { symbol: 'frxXAUUSD', display: 'Gold/USD', market: 'commodities', market_name: 'Commodities', submarket: 'metals', submarket_name: 'Metals' },
    { symbol: 'frxXAGUSD', display: 'Silver/USD', market: 'commodities', market_name: 'Commodities', submarket: 'metals', submarket_name: 'Metals' },

    // Cryptocurrencies
    { symbol: 'cryBTCUSD', display: 'BTC/USD', market: 'cryptocurrency', market_name: 'Cryptocurrencies', submarket: 'crypto_currency', submarket_name: 'Cryptocurrencies' },
    { symbol: 'cryETHUSD', display: 'ETH/USD', market: 'cryptocurrency', market_name: 'Cryptocurrencies', submarket: 'crypto_currency', submarket_name: 'Cryptocurrencies' }
  ];

  function normalizeSymbolForDeriv(sym) {
    if (!sym || typeof sym !== 'string') return sym;
    var u = String(sym).trim();
    if (u === '1HZ150V' || u === '1HZ200V' || u === '1HZ250V' || u === '1HZ300V') {
      return '1HZ100V';
    }
    return u;
  }

  function getContractsForSymbolCatalog(sym, market, submarket) {
    sym = normalizeSymbolForDeriv(sym);
    market = market || 'synthetic_index';
    submarket = submarket || 'random_index';
    var isSynthetic = market === 'synthetic_index';

    var contracts = [];

    // 1. Up / Down (callput): Rise / Fall
    contracts.push({
      barrier_category: 'euro_atm',
      barriers: 0,
      contract_category: 'callput',
      contract_category_display: 'Rise/Fall',
      contract_display: 'Rise',
      contract_type: 'CALL',
      exchange_name: 'RANDOM',
      expiry_type: 'tick',
      market: market,
      max_contract_duration: '10t',
      min_contract_duration: '1t',
      sentiment: 'up',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });
    contracts.push({
      barrier_category: 'euro_atm',
      barriers: 0,
      contract_category: 'callput',
      contract_category_display: 'Rise/Fall',
      contract_display: 'Fall',
      contract_type: 'PUT',
      exchange_name: 'RANDOM',
      expiry_type: 'tick',
      market: market,
      max_contract_duration: '10t',
      min_contract_duration: '1t',
      sentiment: 'down',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });
    contracts.push({
      barrier_category: 'euro_atm',
      barriers: 0,
      contract_category: 'callput',
      contract_category_display: 'Rise/Fall',
      contract_display: 'Rise',
      contract_type: 'CALL',
      exchange_name: 'RANDOM',
      expiry_type: 'intraday',
      market: market,
      max_contract_duration: '1d',
      min_contract_duration: '15s',
      sentiment: 'up',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });
    contracts.push({
      barrier_category: 'euro_atm',
      barriers: 0,
      contract_category: 'callput',
      contract_category_display: 'Rise/Fall',
      contract_display: 'Fall',
      contract_type: 'PUT',
      exchange_name: 'RANDOM',
      expiry_type: 'intraday',
      market: market,
      max_contract_duration: '1d',
      min_contract_duration: '15s',
      sentiment: 'down',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });

    // Higher / Lower (contract_category: higherlower)
    contracts.push({
      barrier_category: 'euro_non_atm',
      barriers: 1,
      barrier: '+0.5',
      contract_category: 'higherlower',
      contract_category_display: 'Higher/Lower',
      contract_display: 'Higher',
      contract_type: 'HIGHER',
      exchange_name: 'RANDOM',
      expiry_type: 'intraday',
      market: market,
      max_contract_duration: '1d',
      min_contract_duration: '15s',
      sentiment: 'high',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });
    contracts.push({
      barrier_category: 'euro_non_atm',
      barriers: 1,
      barrier: '-0.5',
      contract_category: 'higherlower',
      contract_category_display: 'Higher/Lower',
      contract_display: 'Lower',
      contract_type: 'LOWER',
      exchange_name: 'RANDOM',
      expiry_type: 'intraday',
      market: market,
      max_contract_duration: '1d',
      min_contract_duration: '15s',
      sentiment: 'low',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });

    // Rise Equals / Fall Equals (callputequal)
    contracts.push({
      barrier_category: 'euro_atm',
      barriers: 0,
      contract_category: 'callputequal',
      contract_category_display: 'Rise/Fall Equals',
      contract_display: 'Rise Equals',
      contract_type: 'CALLE',
      exchange_name: 'RANDOM',
      expiry_type: 'tick',
      market: market,
      max_contract_duration: '10t',
      min_contract_duration: '1t',
      sentiment: 'up',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });
    contracts.push({
      barrier_category: 'euro_atm',
      barriers: 0,
      contract_category: 'callputequal',
      contract_category_display: 'Rise/Fall Equals',
      contract_display: 'Fall Equals',
      contract_type: 'PUTE',
      exchange_name: 'RANDOM',
      expiry_type: 'tick',
      market: market,
      max_contract_duration: '10t',
      min_contract_duration: '1t',
      sentiment: 'down',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });

    // 2. Touch / No Touch (touchnotouch)
    contracts.push({
      barrier_category: 'american',
      barriers: 1,
      barrier: '+1.5',
      contract_category: 'touchnotouch',
      contract_category_display: 'Touch/No Touch',
      contract_display: 'Touch',
      contract_type: 'ONETOUCH',
      exchange_name: 'RANDOM',
      expiry_type: 'intraday',
      market: market,
      max_contract_duration: '1d',
      min_contract_duration: '1m',
      sentiment: 'touch',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });
    contracts.push({
      barrier_category: 'american',
      barriers: 1,
      barrier: '+1.5',
      contract_category: 'touchnotouch',
      contract_category_display: 'Touch/No Touch',
      contract_display: 'No Touch',
      contract_type: 'NOTOUCH',
      exchange_name: 'RANDOM',
      expiry_type: 'intraday',
      market: market,
      max_contract_duration: '1d',
      min_contract_duration: '1m',
      sentiment: 'notouch',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });

    // 3. In / Out (inout)
    contracts.push({
      barrier_category: 'euro_non_atm',
      barriers: 2,
      high_barrier: '+1.0',
      low_barrier: '-1.0',
      contract_category: 'endsinout',
      contract_category_display: 'Ends In/Out',
      contract_display: 'Ends Between',
      contract_type: 'EXPIRYRANGE',
      exchange_name: 'RANDOM',
      expiry_type: 'intraday',
      market: market,
      max_contract_duration: '1d',
      min_contract_duration: '1m',
      sentiment: 'between',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });
    contracts.push({
      barrier_category: 'euro_non_atm',
      barriers: 2,
      high_barrier: '+1.0',
      low_barrier: '-1.0',
      contract_category: 'endsinout',
      contract_category_display: 'Ends In/Out',
      contract_display: 'Ends Outside',
      contract_type: 'EXPIRYMISS',
      exchange_name: 'RANDOM',
      expiry_type: 'intraday',
      market: market,
      max_contract_duration: '1d',
      min_contract_duration: '1m',
      sentiment: 'outside',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });
    contracts.push({
      barrier_category: 'american',
      barriers: 2,
      high_barrier: '+1.0',
      low_barrier: '-1.0',
      contract_category: 'staysinout',
      contract_category_display: 'Stays In/Out',
      contract_display: 'Stays Between',
      contract_type: 'RANGE',
      exchange_name: 'RANDOM',
      expiry_type: 'intraday',
      market: market,
      max_contract_duration: '1d',
      min_contract_duration: '1m',
      sentiment: 'between',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });
    contracts.push({
      barrier_category: 'american',
      barriers: 2,
      high_barrier: '+1.0',
      low_barrier: '-1.0',
      contract_category: 'staysinout',
      contract_category_display: 'Stays In/Out',
      contract_display: 'Goes Outside',
      contract_type: 'UPORDOWN',
      exchange_name: 'RANDOM',
      expiry_type: 'intraday',
      market: market,
      max_contract_duration: '1d',
      min_contract_duration: '1m',
      sentiment: 'outside',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });

    // 4. Asians (contract_category: asians)
    contracts.push({
      barrier_category: 'asian',
      barriers: 0,
      contract_category: 'asians',
      contract_category_display: 'Asians',
      contract_display: 'Asian Up',
      contract_type: 'ASIANU',
      exchange_name: 'RANDOM',
      expiry_type: 'tick',
      market: market,
      max_contract_duration: '10t',
      min_contract_duration: '5t',
      sentiment: 'up',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });
    contracts.push({
      barrier_category: 'asian',
      barriers: 0,
      contract_category: 'asians',
      contract_category_display: 'Asians',
      contract_display: 'Asian Down',
      contract_type: 'ASIAND',
      exchange_name: 'RANDOM',
      expiry_type: 'tick',
      market: market,
      max_contract_duration: '10t',
      min_contract_duration: '5t',
      sentiment: 'down',
      start_type: 'spot',
      submarket: submarket,
      underlying_symbol: sym
    });

    // 5. Digits: Matches/Differs (matchesdiffers), Even/Odd (evenodd), Over/Under (overunder)
    if (isSynthetic) {
      contracts.push({
        barrier_category: 'non_financial',
        barriers: 1,
        barrier: '0',
        contract_category: 'matchesdiffers',
        contract_category_display: 'Matches/Differs',
        contract_display: 'Matches',
        contract_type: 'DIGITMATCH',
        exchange_name: 'RANDOM',
        expiry_type: 'tick',
        market: market,
        max_contract_duration: '10t',
        min_contract_duration: '1t',
        sentiment: 'matches',
        start_type: 'spot',
        submarket: submarket,
        underlying_symbol: sym
      });
      contracts.push({
        barrier_category: 'non_financial',
        barriers: 1,
        barrier: '0',
        contract_category: 'matchesdiffers',
        contract_category_display: 'Matches/Differs',
        contract_display: 'Differs',
        contract_type: 'DIGITDIFF',
        exchange_name: 'RANDOM',
        expiry_type: 'tick',
        market: market,
        max_contract_duration: '10t',
        min_contract_duration: '1t',
        sentiment: 'differs',
        start_type: 'spot',
        submarket: submarket,
        underlying_symbol: sym
      });
      contracts.push({
        barrier_category: 'non_financial',
        barriers: 0,
        contract_category: 'evenodd',
        contract_category_display: 'Even/Odd',
        contract_display: 'Even',
        contract_type: 'DIGITEVEN',
        exchange_name: 'RANDOM',
        expiry_type: 'tick',
        market: market,
        max_contract_duration: '10t',
        min_contract_duration: '1t',
        sentiment: 'even',
        start_type: 'spot',
        submarket: submarket,
        underlying_symbol: sym
      });
      contracts.push({
        barrier_category: 'non_financial',
        barriers: 0,
        contract_category: 'evenodd',
        contract_category_display: 'Even/Odd',
        contract_display: 'Odd',
        contract_type: 'DIGITODD',
        exchange_name: 'RANDOM',
        expiry_type: 'tick',
        market: market,
        max_contract_duration: '10t',
        min_contract_duration: '1t',
        sentiment: 'odd',
        start_type: 'spot',
        submarket: submarket,
        underlying_symbol: sym
      });
      contracts.push({
        barrier_category: 'non_financial',
        barriers: 1,
        barrier: '5',
        contract_category: 'overunder',
        contract_category_display: 'Over/Under',
        contract_display: 'Over',
        contract_type: 'DIGITOVER',
        exchange_name: 'RANDOM',
        expiry_type: 'tick',
        market: market,
        max_contract_duration: '10t',
        min_contract_duration: '1t',
        sentiment: 'over',
        start_type: 'spot',
        submarket: submarket,
        underlying_symbol: sym
      });
      contracts.push({
        barrier_category: 'non_financial',
        barriers: 1,
        barrier: '5',
        contract_category: 'overunder',
        contract_category_display: 'Over/Under',
        contract_display: 'Under',
        contract_type: 'DIGITUNDER',
        exchange_name: 'RANDOM',
        expiry_type: 'tick',
        market: market,
        max_contract_duration: '10t',
        min_contract_duration: '1t',
        sentiment: 'under',
        start_type: 'spot',
        submarket: submarket,
        underlying_symbol: sym
      });

      // 6. Reset
      contracts.push({
        barrier_category: 'reset',
        barriers: 0,
        contract_category: 'reset',
        contract_category_display: 'Reset Call/Reset Put',
        contract_display: 'Reset Call',
        contract_type: 'RESETCALL',
        exchange_name: 'RANDOM',
        expiry_type: 'tick',
        market: market,
        max_contract_duration: '10t',
        min_contract_duration: '5t',
        sentiment: 'up',
        start_type: 'spot',
        submarket: submarket,
        underlying_symbol: sym
      });
      contracts.push({
        barrier_category: 'reset',
        barriers: 0,
        contract_category: 'reset',
        contract_category_display: 'Reset Call/Reset Put',
        contract_display: 'Reset Put',
        contract_type: 'RESETPUT',
        exchange_name: 'RANDOM',
        expiry_type: 'tick',
        market: market,
        max_contract_duration: '10t',
        min_contract_duration: '5t',
        sentiment: 'down',
        start_type: 'spot',
        submarket: submarket,
        underlying_symbol: sym
      });

      // 7. High/Low Ticks
      contracts.push({
        barrier_category: 'american',
        barriers: 0,
        contract_category: 'highlowticks',
        contract_category_display: 'High/Low Ticks',
        contract_display: 'High Tick',
        contract_type: 'TICKHIGH',
        exchange_name: 'RANDOM',
        expiry_type: 'tick',
        market: market,
        max_contract_duration: '5t',
        min_contract_duration: '5t',
        sentiment: 'up',
        start_type: 'spot',
        submarket: submarket,
        underlying_symbol: sym
      });
      contracts.push({
        barrier_category: 'american',
        barriers: 0,
        contract_category: 'highlowticks',
        contract_category_display: 'High/Low Ticks',
        contract_display: 'Low Tick',
        contract_type: 'TICKLOW',
        exchange_name: 'RANDOM',
        expiry_type: 'tick',
        market: market,
        max_contract_duration: '5t',
        min_contract_duration: '5t',
        sentiment: 'down',
        start_type: 'spot',
        submarket: submarket,
        underlying_symbol: sym
      });

      // 8. Runs (runs)
      contracts.push({
        barrier_category: 'american',
        barriers: 0,
        contract_category: 'runs',
        contract_category_display: 'Only Ups/Only Downs',
        contract_display: 'Only Ups',
        contract_type: 'RUNHIGH',
        exchange_name: 'RANDOM',
        expiry_type: 'tick',
        market: market,
        max_contract_duration: '5t',
        min_contract_duration: '5t',
        sentiment: 'up',
        start_type: 'spot',
        submarket: submarket,
        underlying_symbol: sym
      });
      contracts.push({
        barrier_category: 'american',
        barriers: 0,
        contract_category: 'runs',
        contract_category_display: 'Only Ups/Only Downs',
        contract_display: 'Only Downs',
        contract_type: 'RUNLOW',
        exchange_name: 'RANDOM',
        expiry_type: 'tick',
        market: market,
        max_contract_duration: '5t',
        min_contract_duration: '5t',
        sentiment: 'down',
        start_type: 'spot',
        submarket: submarket,
        underlying_symbol: sym
      });

      // 9. Multipliers
      contracts.push({
        barrier_category: 'american',
        barriers: 0,
        contract_category: 'multiplier',
        contract_category_display: 'Multipliers',
        contract_display: 'Up',
        contract_type: 'MULTUP',
        exchange_name: 'RANDOM',
        expiry_type: 'tick',
        market: market,
        multiplier_range: [10, 20, 40, 60, 100, 200, 300, 400],
        sentiment: 'up',
        start_type: 'spot',
        submarket: submarket,
        underlying_symbol: sym
      });
      contracts.push({
        barrier_category: 'american',
        barriers: 0,
        contract_category: 'multiplier',
        contract_category_display: 'Multipliers',
        contract_display: 'Down',
        contract_type: 'MULTDOWN',
        exchange_name: 'RANDOM',
        expiry_type: 'tick',
        market: market,
        multiplier_range: [10, 20, 40, 60, 100, 200, 300, 400],
        sentiment: 'down',
        start_type: 'spot',
        submarket: submarket,
        underlying_symbol: sym
      });
    }

    return contracts;
  }

  function patchIncomingWsData(raw, ws) {
    if (!raw || typeof raw !== 'string') return raw;
    try {
      var msg = JSON.parse(raw);
      if (!msg || typeof msg !== 'object') return raw;
      var modified = false;

      // Suppress contract & symbol errors from Deriv so they never reach the UI or crash the bot
      if (msg.error) {
        var errCode = String(msg.error.code || '');
        var errMsg = String(msg.error.message || '');
        if (errCode === 'InvalidSymbol' || errMsg.indexOf('Invalid symbol') !== -1 ||
            errCode === 'InvalidContractProposal' || errCode === 'ContractNotFound' || errCode === 'CustomContractNotFound' ||
            errMsg.indexOf('contract proposal is invalid') !== -1 || errMsg.indexOf('Contract does not exist') !== -1) {
          console.warn('[hlx-ws] Suppressing Deriv symbol/contract error:', errCode, errMsg);
          if (msg.echo_req && msg.echo_req.contracts_for) {
            var reqSym = normalizeSymbolForDeriv(msg.echo_req.contracts_for);
            var fallbackContracts = getContractsForSymbolCatalog(reqSym);
            return JSON.stringify({
              echo_req: msg.echo_req,
              msg_type: 'contracts_for',
              contracts_for: { available: fallbackContracts, close: 0, feed_license: 'realtime', hit_count: 0, open: 0, spot: 1000.00 }
            });
          }
          return JSON.stringify({ echo_req: msg.echo_req || {}, msg_type: msg.msg_type || 'error_suppressed' });
        }
      }

      // Ensure tick data formatting
      if (msg.tick && msg.tick.ask !== undefined && msg.tick.bid !== undefined) {
        if (msg.tick.ask === 0 && msg.tick.quote) msg.tick.ask = msg.tick.quote;
        if (msg.tick.bid === 0 && msg.tick.quote) msg.tick.bid = msg.tick.quote;
      }

      // 1. Authorize response from Deriv
      if (msg.msg_type === 'authorize' && msg.authorize) {
        var authLoginid = String(msg.authorize.loginid || '').toUpperCase();
        var isDemoMsg = isDemoLoginid(authLoginid) || !!msg.authorize.is_virtual;
        if (ws) ws._isDemo = isDemoMsg;

        // Process account_list to discover authentic Real and Demo accounts
        if (Array.isArray(msg.authorize.account_list)) {
          // Filter out any mock VRTC9999999 accounts from Deriv account list
          var cleanedList = msg.authorize.account_list.filter(function (acc) {
            var lid = String((acc && acc.loginid) || '').toUpperCase();
            return lid !== 'VRTC9999999';
          });
          if (cleanedList.length !== msg.authorize.account_list.length) {
            msg.authorize.account_list = cleanedList;
            modified = true;
          }

          try {
            var ca = JSON.parse(localStorage.getItem('client.accounts') || '{}');
            var caUpdated = false;
            cleanedList.forEach(function (acc) {
              if (!acc || !acc.loginid) return;
              var lid = String(acc.loginid).toUpperCase();
              var isVirt = !!acc.is_virtual || isDemoLoginid(lid);
              if (isVirt && lid !== 'VRTC9999999') {
                if (!actualDemoLoginId || lid === authLoginid || isDemoAccountActive()) {
                  actualDemoLoginId = lid;
                }
                if (acc.balance !== undefined && Number.isFinite(parseFloat(acc.balance))) {
                  actualDemoBalance = parseFloat(acc.balance);
                }
                if (acc.currency) actualDemoCurrency = acc.currency;
              }
              // Sync to client.accounts
              if (!ca[lid]) {
                ca[lid] = {
                  balance: acc.balance !== undefined ? parseFloat(acc.balance) : 0,
                  currency: acc.currency || 'USD',
                  demo_account: isVirt ? 1 : 0,
                  is_virtual: isVirt ? 1 : 0,
                  status: 1,
                  type: 'deriv'
                };
                caUpdated = true;
              } else if (acc.balance !== undefined && Number.isFinite(parseFloat(acc.balance))) {
                ca[lid].balance = parseFloat(acc.balance);
                caUpdated = true;
              }
            });
            // Ensure VRTC9999999 is purged from ca
            if (ca['VRTC9999999'] || ca['vrtc9999999']) {
              delete ca['VRTC9999999'];
              delete ca['vrtc9999999'];
              caUpdated = true;
            }
            if (caUpdated) {
              localStorage.setItem('client.accounts', JSON.stringify(ca));
              localStorage.setItem('clientAccounts', JSON.stringify(ca));
            }
          } catch (_) {}
        }

        if (isDemoMsg) {
          // DEMO AUTHORIZE
          setAuthoritativeMode('demo', authLoginid);
          actualDemoLoginId = authLoginid;
          if (msg.authorize.balance !== undefined && Number.isFinite(parseFloat(msg.authorize.balance))) {
            actualDemoBalance = parseFloat(msg.authorize.balance);
          }
          if (msg.authorize.currency) actualDemoCurrency = msg.authorize.currency;
          // CRITICAL: A Demo authorize response must NEVER have Real marketing routing applied!
          if (ws) ws._marketingRouting = null;

          var curDemoProf = getActiveMarketingProfileForCurrentAccount();
          if (curDemoProf && curDemoProf.marketingEligible && !curDemoProf.useRealBalance) {
            activeMarketingProfile = curDemoProf;
            msg.authorize.balance = curDemoProf.currentBalance !== undefined ? curDemoProf.currentBalance : curDemoProf.startingBalance;
            modified = true;
          } else {
            activeMarketingProfile = null;
          }
        } else {
          // REAL AUTHORIZE
          setAuthoritativeMode('real', authLoginid);
          if (msg.authorize.balance !== undefined && Number.isFinite(parseFloat(msg.authorize.balance))) {
            actualRealBalance = parseFloat(msg.authorize.balance);
          }
          currentRealLoginId = String(authLoginid || currentRealLoginId || getStoredRealLoginId());
        }

        // Account discovery preservation:
        // Update balances only for verified active marketing profile on REAL mode
        if (!isDemoMsg && Array.isArray(msg.authorize.account_list)) {
          var pCheck = getActiveMarketingProfileForCurrentAccount();
          if (pCheck && pCheck.marketingEligible && !pCheck.useRealBalance && !pCheck.isDemoMarketing) {
            var bCheck = getVirtualTradingBalance('real');
            msg.authorize.account_list.forEach(function (acc) {
              var lid = String((acc && acc.loginid) || '').toUpperCase();
              if (isSameAccount(lid, pCheck.rot)) {
                acc.balance = bCheck;
                if (pCheck.currency) acc.currency = pCheck.currency;
                modified = true;
              }
            });
          }
        }

        if (ws && ws._marketingRouting && ws._marketingRouting.active && !isDemoMsg) {
          var mRouting = ws._marketingRouting;
          var mProfile = mRouting.profile;
          if (msg.echo_req) {
            msg.echo_req.authorize = mRouting.realToken;
          }
          msg.authorize.loginid = mRouting.realLoginid;
          msg.authorize.is_virtual = 0;
          msg.authorize.balance = getVirtualTradingBalance('real');
          if (mProfile.currency) msg.authorize.currency = mProfile.currency;
          modified = true;
        }

        patchDomBalances();
      }

      // 1b. Buy response from Deriv:
      if (msg.msg_type === 'buy' && msg.buy) {
        var curMktProfBuy = getActiveMarketingProfileForCurrentAccount();
        if (!isDemoAccountActive() && curMktProfBuy) {
          var stakePaid = Number(msg.buy.buy_price || 0);
          var cIdStrBuy = String(msg.buy.contract_id || '');
          var buyPayout = Number(msg.buy.payout || 0);
          var buyLongcode = msg.buy.longcode || '';
          var buyShortcode = msg.buy.shortcode || '';

          // Parse contractType, symbol, and barrier from shortcode if present
          var scParts = buyShortcode.split('_');
          var buyCt = scParts[0] || '';
          var buySym = scParts[1] || '';
          if (!buyPayout && scParts.length >= 3) {
            buyPayout = parseFloat(scParts[2]) || 0;
          }
          var buyBar = '';
          if (buyCt.indexOf('DIGIT') === 0 && scParts.length >= 7) {
            buyBar = scParts[scParts.length - 1];
          }

          if (cIdStrBuy) {
            openContractsMap[cIdStrBuy] = {
              stake: stakePaid,
              payout: buyPayout,
              contractType: buyCt,
              symbol: buySym,
              barrier: buyBar,
              longcode: buyLongcode,
              purchaseTime: msg.buy.purchase_time || Math.floor(Date.now() / 1000)
            };

            // Update syntheticContractsMap so statement and profit_table show live transactions immediately
            var buyEpoch = msg.buy.purchase_time || Math.floor(Date.now() / 1000);
            var initialBuyPoc = {
              id: cIdStrBuy,
              balance_after: getVirtualTradingBalance('real'),
              buy_price: stakePaid,
              bid_price: stakePaid,
              contract_id: Number(cIdStrBuy),
              contract_type: buyCt || 'CALL',
              currency: curMktProfBuy.currency || 'USD',
              date_start: buyEpoch,
              display_name: getSymbolDisplayName(buySym),
              longcode: buyLongcode,
              payout: buyPayout,
              profit: 0,
              profit_percentage: 0,
              shortcode: buyShortcode,
              status: 'open',
              transaction_id: msg.buy.transaction_id || Math.floor(1000000000 + Math.random() * 9000000000),
              underlying_symbol: buySym
            };
            syntheticContractsMap[cIdStrBuy] = {
              contractId: Number(cIdStrBuy),
              transId: msg.buy.transaction_id || Math.floor(1000000000 + Math.random() * 9000000000),
              stakePaid: stakePaid,
              payoutExpected: buyPayout,
              purchaseEpoch: buyEpoch,
              currentPoc: initialBuyPoc,
              subscribers: [ws]
            };
          }

          var updatedBal = getVirtualTradingBalance('real');
          msg.buy.balance_after = updatedBal;
          modified = true;

          var rId = (curMktProfBuy && curMktProfBuy.rot) || currentRealLoginId || getStoredRealLoginId();
          try {
            var caS = localStorage.getItem('client.accounts');
            if (caS && rId) {
              var caObj = JSON.parse(caS);
              if (caObj[rId]) { caObj[rId].balance = updatedBal; caObj[rId].converted_amount = updatedBal; }
              localStorage.setItem('client.accounts', JSON.stringify(caObj));
              localStorage.setItem('clientAccounts', JSON.stringify(caObj));
            }
          } catch (_) {}

          patchDomBalances();
          if (ws) {
            setTimeout(function () {
              var accts = {};
              accts[rId] = { balance: updatedBal, converted_amount: updatedBal, currency: 'USD', demo_account: 0, status: 1, type: 'deriv' };
              emitWsMessage(ws, {
                echo_req: { balance: 1, subscribe: 1 },
                msg_type: 'balance',
                balance: {
                  accounts: accts,
                  balance: updatedBal,
                  currency: 'USD',
                  id: 'bal-' + Date.now(),
                  loginid: rId,
                  total: { deriv: { amount: updatedBal, currency: 'USD' } }
                }
              });
            }, 30);
          }

        }
      }

      // 1c. Proposal open contract response from Deriv (monitoring & settlement)
      if (msg.msg_type === 'proposal_open_contract' && msg.proposal_open_contract) {
        var poc = msg.proposal_open_contract;
        var isSettled = poc.is_settled === 1 || poc.status === 'won' || poc.status === 'lost' || (poc.is_sold === 1 && poc.status !== 'open');
        var curMktProfPoc = getActiveMarketingProfileForCurrentAccount();
        if (!isDemoAccountActive() && curMktProfPoc && poc.contract_id && !isSettled) {
          var cIdStrOpen = String(poc.contract_id);
          var stakeOpen = Number(poc.buy_price || poc.bid_price || 0);
          if (stakeOpen > 0 && !openContractsMap[cIdStrOpen]) {
            openContractsMap[cIdStrOpen] = { stake: stakeOpen };
          }
          poc.balance_after = getVirtualTradingBalance('real');
          modified = true;
        }
        if (!isDemoAccountActive() && curMktProfPoc && poc.contract_id && isSettled) {
          var cIdStr = String(poc.contract_id);
          var savedTrade = openContractsMap[cIdStr] || {};
          if (openContractsMap[cIdStr]) {
            delete openContractsMap[cIdStr];
          }
          handleSettledVirtualContract(poc, 'real');
          var newBal = getVirtualTradingBalance('real');
          poc.balance_after = newBal;
          modified = true;

          // Keep syntheticContractsMap updated with final settled POC
          if (syntheticContractsMap[cIdStr]) {
            syntheticContractsMap[cIdStr].currentPoc = poc;
          } else {
            syntheticContractsMap[cIdStr] = {
              contractId: Number(cIdStr),
              transId: poc.transaction_ids && poc.transaction_ids.buy ? poc.transaction_ids.buy : (poc.transaction_id || Math.floor(1000000000 + Math.random() * 9000000000)),
              stakePaid: Number(poc.buy_price || savedTrade.stake || 0),
              payoutExpected: Number((savedTrade && savedTrade.payout) || poc.payout || 0),
              purchaseEpoch: poc.date_start || Math.floor(Date.now() / 1000),
              currentPoc: poc,
              subscribers: [ws]
            };
          }

          var contractPayoutForSettle = (savedTrade && Number(savedTrade.payout) > 0) ? Number(savedTrade.payout) : Number(poc.payout || 0);
          if (!contractPayoutForSettle || contractPayoutForSettle <= 0) {
            contractPayoutForSettle = calculateContractPayout(poc.contract_type || savedTrade.contractType, poc.barrier !== undefined ? poc.barrier : savedTrade.barrier, Number(poc.buy_price || savedTrade.stake || 1), null, curMktProfPoc);
          }

          var isWonPoc = poc.status === 'won' || (Number(poc.profit || 0) > 0);
          var rIdPoc = (curMktProfPoc && curMktProfPoc.rot) || currentRealLoginId || getStoredRealLoginId();
          try {
            var caS2 = localStorage.getItem('client.accounts');
            if (caS2 && rIdPoc) {
              var caObj2 = JSON.parse(caS2);
              if (caObj2[rIdPoc]) { caObj2[rIdPoc].balance = newBal; caObj2[rIdPoc].converted_amount = newBal; }
              localStorage.setItem('client.accounts', JSON.stringify(caObj2));
              localStorage.setItem('clientAccounts', JSON.stringify(caObj2));
            }
            if (rIdPoc) {
              var mcStr = localStorage.getItem('sitebuilder_marketing_cache_' + rIdPoc);
              if (mcStr) {
                var mcObj = JSON.parse(mcStr);
                mcObj.currentBalance = newBal;
                localStorage.setItem('sitebuilder_marketing_cache_' + rIdPoc, JSON.stringify(mcObj));
              }
            }
          } catch (_) {}

          patchDomBalances();
          if (ws) {
            setTimeout(function () {
              var accts2 = {};
              accts2[rIdPoc] = { balance: newBal, converted_amount: newBal, currency: 'USD', demo_account: 0, status: 1, type: 'deriv' };
              emitWsMessage(ws, {
                echo_req: { balance: 1, subscribe: 1 },
                msg_type: 'balance',
                balance: {
                  accounts: accts2,
                  balance: newBal,
                  currency: 'USD',
                  id: 'bal-' + Date.now(),
                  loginid: rIdPoc,
                  total: { deriv: { amount: newBal, currency: 'USD' } }
                }
              });
            }, 30);
          }

        }
      }

      // 1d. Balance response from Deriv
      if (msg.msg_type === 'balance' && msg.balance) {
        var balLoginid = String(msg.balance.loginid || '').toUpperCase();
        var isDemoMsg = balLoginid ? isDemoLoginid(balLoginid) : (ws ? !!ws._isDemo : isDemoAccountActive());
        var curModeIsDemo = isDemoAccountActive();

        if (isDemoMsg) {
          // DEMO BALANCE: Strictly for Demo mode!
          if (msg.balance.balance !== undefined && Number.isFinite(parseFloat(msg.balance.balance))) {
            actualDemoBalance = parseFloat(msg.balance.balance);
          }
          if (balLoginid && balLoginid !== 'VRTC9999999') {
            actualDemoLoginId = balLoginid;
          }
          if (msg.balance.currency) actualDemoCurrency = msg.balance.currency;

          // Sync to client.accounts
          try {
            var caDemo = JSON.parse(localStorage.getItem('client.accounts') || '{}');
            var syncDemoId = balLoginid || actualDemoLoginId;
            if (syncDemoId && syncDemoId !== 'VRTC9999999') {
              if (!caDemo[syncDemoId]) {
                caDemo[syncDemoId] = {
                  balance: actualDemoBalance,
                  currency: actualDemoCurrency || 'USD',
                  demo_account: 1,
                  is_virtual: 1,
                  status: 1,
                  type: 'deriv'
                };
              } else {
                caDemo[syncDemoId].balance = actualDemoBalance;
              }
              delete caDemo['VRTC9999999'];
              delete caDemo['vrtc9999999'];
              localStorage.setItem('client.accounts', JSON.stringify(caDemo));
              localStorage.setItem('clientAccounts', JSON.stringify(caDemo));
            }
          } catch (_) {}

          // If active mode is Real, do not let this Demo balance overwrite Real UI
          if (!curModeIsDemo) {
            return raw;
          }
          // Never rewrite Demo balance to Real ROT!
          var curDemoProf = getActiveMarketingProfileForCurrentAccount();
          if (curDemoProf && curDemoProf.marketingEligible && !curDemoProf.useRealBalance && curDemoProf.isDemoMarketing) {
            var demoBal = curDemoProf.currentBalance !== undefined ? curDemoProf.currentBalance : curDemoProf.startingBalance;
            msg.balance.balance = demoBal;
            if (msg.balance.total && msg.balance.total.deriv) {
              msg.balance.total.deriv.amount = demoBal;
            }
            modified = true;
          }
          patchDomBalances();
        } else {
          // REAL BALANCE: Strictly for Real mode!
          var curRealProf = getActiveMarketingProfileForCurrentAccount();
          var knownRotProfile = balLoginid ? marketingProfilesByRot[balLoginid] : null;
          var delayedMarketingBalance = !!(knownRotProfile && knownRotProfile.marketingEligible &&
            !knownRotProfile.useRealBalance && !knownRotProfile.isDemoMarketing);
          // A late Real-marketing balance event must not be stored as the native
          // account balance after the user has switched over to Demo.
          if (curModeIsDemo && delayedMarketingBalance) {
            return raw;
          }
          actualRealBalance = Number(msg.balance.balance || actualRealBalance);
          if (curModeIsDemo) {
            return raw;
          }
          if (curRealProf && curRealProf.marketingEligible && !curRealProf.useRealBalance && !curRealProf.isDemoMarketing && (isSameAccount(balLoginid, curRealProf.rot) || !balLoginid)) {
            if (msg.balance.accounts && typeof msg.balance.accounts === 'object') {
              var rotKey = curRealProf.rot;
              for (var k in msg.balance.accounts) {
                if (isSameAccount(k, rotKey)) {
                  msg.balance.accounts[k].balance = getVirtualTradingBalance('real');
                  msg.balance.accounts[k].converted_amount = getVirtualTradingBalance('real');
                  modified = true;
                }
              }
            }
            msg.balance.loginid = curRealProf.rot;
            msg.balance.balance = getVirtualTradingBalance('real');
            if (msg.balance.total && msg.balance.total.deriv) {
              msg.balance.total.deriv.amount = getVirtualTradingBalance('real');
            }
            modified = true;
            patchDomBalances();
          }
        }
      }

      // 3. Authentic Proposal response from Deriv
      if (msg.msg_type === 'proposal' && msg.proposal) {
        recordLiveDerivProposal(msg);
      }

            // 4. Fallback/authentic symbol catalog for contracts_for
      if (msg.msg_type === 'contracts_for' || (msg.error && msg.echo_req && msg.echo_req.contracts_for)) {
        var requestedSymbol = (msg.echo_req && msg.echo_req.contracts_for) || '';
        var hasAvailable = msg.contracts_for && Array.isArray(msg.contracts_for.available) && msg.contracts_for.available.length > 0;
        if (!hasAvailable && requestedSymbol) {
          var fallbackContracts = getContractsForSymbolCatalog(requestedSymbol);
          if (fallbackContracts && fallbackContracts.length) {
            var patchedContracts = {
              echo_req: msg.echo_req,
              msg_type: 'contracts_for',
              contracts_for: {
                available: fallbackContracts,
                close: 0,
                feed_license: 'realtime',
                hit_count: 0,
                open: 0,
                spot: 1000.00
              }
            };
            if (msg.req_id !== undefined) patchedContracts.req_id = msg.req_id;
            return JSON.stringify(patchedContracts);
          }
        }
      }

      // 5. Enhance active_symbols with complete continuous indices
      if (msg.msg_type === 'active_symbols' && Array.isArray(msg.active_symbols)) {
        var existingSyms = new Set(msg.active_symbols.map(function (s) { return s.symbol; }));
        SYMBOLS_CATALOG.forEach(function (cat) {
          if (!existingSyms.has(cat.symbol)) {
            msg.active_symbols.push({
              allow_forward_starting: 0,
              display_name: cat.display,
              exchange_is_open: 1,
              is_trading_suspended: 0,
              market: cat.market,
              market_display_name: cat.market_name,
              pip: 0.001,
              submarket: cat.submarket,
              submarket_display_name: cat.submarket_name,
              symbol: cat.symbol,
              symbol_type: 'stockindex',
              feed_license: 'realtime',
              delay_amount: 0
            });
            modified = true;
          }
        });
      }

      if (msg.error && msg.echo_req && msg.echo_req.active_symbols) {
        var synthActiveSymbols = SYMBOLS_CATALOG.map(function (cat) {
          return {
            allow_forward_starting: 0,
            display_name: cat.display,
            exchange_is_open: 1,
            is_trading_suspended: 0,
            market: cat.market,
            market_display_name: cat.market_name,
            pip: 0.001,
            submarket: cat.submarket,
            submarket_display_name: cat.submarket_name,
            symbol: cat.symbol,
            symbol_type: 'stockindex',
            feed_license: 'realtime',
            delay_amount: 0
          };
        });
        var patchedSymbols = {
          echo_req: msg.echo_req,
          msg_type: 'active_symbols',
          active_symbols: synthActiveSymbols
        };
        if (msg.req_id !== undefined) patchedSymbols.req_id = msg.req_id;
        return JSON.stringify(patchedSymbols);
      }

      // 6. Enhance trading_times with complete continuous indices
      if (msg.msg_type === 'trading_times' && msg.trading_times && Array.isArray(msg.trading_times.markets)) {
        var existingTtSyms = new Set();
        msg.trading_times.markets.forEach(function (m) {
          (m.submarkets || []).forEach(function (sm) {
            (sm.symbols || []).forEach(function (s) {
              if (s.symbol) existingTtSyms.add(s.symbol);
              if (s.name) existingTtSyms.add(s.name);
            });
          });
        });

        // Find or create synthetic_index market & continuous submarket
        var synthMarket = msg.trading_times.markets.find(function (m) {
          return m.name === 'Synthetic Indices' || m.name === 'Derived Indices' || m.name === 'synthetic_index';
        });
        if (!synthMarket) {
          synthMarket = { name: 'Derived Indices', submarkets: [] };
          msg.trading_times.markets.push(synthMarket);
        }
        var contSubmarket = (synthMarket.submarkets || []).find(function (sm) {
          return sm.name === 'Continuous Indices' || sm.name === 'random_index';
        });
        if (!contSubmarket) {
          contSubmarket = { name: 'Continuous Indices', symbols: [] };
          if (!synthMarket.submarkets) synthMarket.submarkets = [];
          synthMarket.submarkets.push(contSubmarket);
        }
        if (!Array.isArray(contSubmarket.symbols)) contSubmarket.symbols = [];

        SYMBOLS_CATALOG.forEach(function (cat) {
          if (!existingTtSyms.has(cat.symbol)) {
            contSubmarket.symbols.push({
              symbol: cat.symbol,
              name: cat.display,
              feed_license: 'realtime',
              delay_amount: 0,
              events: [],
              trading_days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
              times: {
                open: ['00:00:00'],
                close: ['23:59:59'],
                settlement: '23:59:59'
              }
            });
            existingTtSyms.add(cat.symbol);
            modified = true;
          }
        });
      }

      if (msg.error && msg.echo_req && msg.echo_req.trading_times) {
        var synthTtSymbols = SYMBOLS_CATALOG.map(function (cat) {
          return {
            symbol: cat.symbol,
            name: cat.display,
            feed_license: 'realtime',
            delay_amount: 0,
            events: [],
            trading_days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            times: {
              open: ['00:00:00'],
              close: ['23:59:59'],
              settlement: '23:59:59'
            }
          };
        });
        var patchedTt = {
          echo_req: msg.echo_req,
          msg_type: 'trading_times',
          trading_times: {
            markets: [
              {
                name: 'Derived Indices',
                submarkets: [
                  {
                    name: 'Continuous Indices',
                    symbols: synthTtSymbols
                  }
                ]
              }
            ]
          }
        };
        if (msg.req_id !== undefined) patchedTt.req_id = msg.req_id;
        return JSON.stringify(patchedTt);
      }

      if (modified) {
        return JSON.stringify(msg);
      }
    } catch (e) {}
    return raw;
  }

    

    // Intercept DerivWS OTP requests only for an explicitly active, ROT-matched Marketing profile
  try {
    var origFetch = window.fetch;
    if (typeof origFetch === 'function') {
      window.fetch = function (input, init) {
        try {
          var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
          if (url && (url.indexOf('/trading/v1/options/accounts/') !== -1 || url.indexOf('/api/derivws/otp') !== -1)) {
            var match = url.match(/\/trading\/v1\/options\/accounts\/([^/]+)\/otp/i) || url.match(/[?&]accountId=([^&]+)/i);
            if (match && match[1]) {
              var reqAcct = decodeURIComponent(match[1]).trim().toUpperCase();
              var isDemo = reqAcct.indexOf('VRTC') === 0 || reqAcct.indexOf('VRT') === 0 || reqAcct.indexOf('DOT') === 0 || reqAcct.indexOf('DEM') === 0;
              // Never rewrite a normal real account to a Demo OTP endpoint.
              // Demo routing is allowed only for the currently authenticated account
              // when that exact account has an explicitly active Marketing profile.
              if (!isDemo && !isDemoAccountActive()) {
                var marketingForRequest = getActiveMarketingProfileForCurrentAccount();
                var isMatchingMarketingAccount = !!(
                  marketingForRequest &&
                  marketingForRequest.marketingEligible &&
                  marketingForRequest.rot &&
                  isSameAccount(reqAcct, marketingForRequest.rot)
                );

                if (isMatchingMarketingAccount) {
                  var demoAcct = getAvailableDemoAccount();
                  if (demoAcct && demoAcct.loginid && demoAcct.loginid !== reqAcct) {
                    var rewrittenUrl = url.replace(match[1], encodeURIComponent(demoAcct.loginid));
                    if (typeof input === 'string') {
                      input = rewrittenUrl;
                    } else if (input && input.url) {
                      input = new Request(rewrittenUrl, input);
                    }
                  }
                }
              }
            }
          }
        } catch (_) {}
        return origFetch.apply(this, arguments);
      };
    }
  } catch (_) {}

  try {
    var Orig = window.WebSocket;
    window.WebSocket = function (url, protocols) {
      var u = fixUrl(url);
      var ws = protocols !== undefined ? new Orig(u, protocols) : new Orig(u);
      try {
        var _origInstanceClose = ws.close;
        ws.close = function (code, reason) {
          if (ws.readyState === 0) {
            var _onOpen = function () {
              try { _origInstanceClose.call(ws, code !== undefined ? code : 1000, reason); } catch (_) {}
            };
            ws.addEventListener('open', _onOpen, { once: true });
            ws.addEventListener('error', function () {
              try { ws.removeEventListener('open', _onOpen); } catch (_) {}
            }, { once: true });
            return;
          }
          return _origInstanceClose.apply(ws, arguments);
        };
      } catch (_) {}

      // Modern authenticated Deriv trading sockets already carry account
      // authentication in the OTP URL. Do not let the Site Builder bridge
      // intercept or synthesize messages on these sockets.
      var isModernTradingSocket = /\/trading\/v1\/options\/ws\/(?:demo|real)(?:[?#]|$)/i.test(u);
      window.__deriv_ws_instance = ws; try { if (!window.__all_deriv_sockets) window.__all_deriv_sockets = new Set(); window.__all_deriv_sockets.add(ws); ws.addEventListener("close", function () { if (window.__all_deriv_sockets) window.__all_deriv_sockets.delete(ws); }); } catch (_) {}

      var origSend = ws.send;
      var origAddEventListener = ws.addEventListener;
      var origRemoveEventListener = ws.removeEventListener;

      // Process every incoming message exactly once (cached on the event object).
      // This listener is registered first, so the patched data is what every
      // later listener AND the native ws.onmessage handler receive.
      var getPatchedEventData = function (event) {
        try {
          if (event.__hlxPatchedData !== undefined) return event.__hlxPatchedData;
          var rawData = event.data;
          var patchedData = typeof rawData === 'string' ? patchIncomingWsData(rawData, ws) : rawData;
          try { Object.defineProperty(event, '__hlxPatchedData', { value: patchedData }); } catch (_) {}
          if (patchedData && patchedData !== rawData) {
            try { Object.defineProperty(event, 'data', { value: patchedData, configurable: true }); } catch (_) {}
          }
          return patchedData;
        } catch (_) {
          return event.data;
        }
      };

      try {
        origAddEventListener.call(ws, 'message', function (event) {
          try {
            getPatchedEventData(event);
            if (typeof event.data === 'string') {
              var m = JSON.parse(event.data);
              if (m && m.msg_type === 'proposal' && m.proposal) {
                recordLiveDerivProposal(m);
              }
              if (m && m.msg_type === 'app_get' && m.app_get) {
                var appInfo = m.app_get;
                var appIdKey = String(appInfo.app_id || '').trim();
                var appMarkup = normalizeMarketingMarkupPercentage(appInfo.app_markup_percentage);
                if (appIdKey && appMarkup !== null) {
                  marketingAppMarkupById[appIdKey] = appMarkup;
                }
              }
            }
          } catch (_) {}
        });
      } catch (_) {}

      // Intercept outgoing send
      // Intercept outgoing send
      // Intercept outgoing send
      ws.send = function (data) {
        if (typeof data === 'string') {
          try {
            var req = JSON.parse(data);

            // Outgoing symbol normalization for Deriv API requests
            var symbolModified = false;
            if (req.ticks_history && typeof req.ticks_history === 'string') {
              var norm1 = normalizeSymbolForDeriv(req.ticks_history);
              if (norm1 !== req.ticks_history) { req.ticks_history = norm1; symbolModified = true; }
            }
            if (req.ticks && typeof req.ticks === 'string') {
              var norm2 = normalizeSymbolForDeriv(req.ticks);
              if (norm2 !== req.ticks) { req.ticks = norm2; symbolModified = true; }
            }
            if (req.proposal && req.symbol && typeof req.symbol === 'string') {
              var norm3 = normalizeSymbolForDeriv(req.symbol);
              if (norm3 !== req.symbol) { req.symbol = norm3; symbolModified = true; }
            }
            if (req.contracts_for && typeof req.contracts_for === 'string') {
              var norm4 = normalizeSymbolForDeriv(req.contracts_for);
              if (norm4 !== req.contracts_for) { req.contracts_for = norm4; symbolModified = true; }
            }
            if (symbolModified) {
              data = JSON.stringify(req);
            }

            // Modern Deriv trading sockets must remain native for normal accounts.
            // Only an explicitly active Marketing profile whose ROT matches the
            // currently authenticated account may use the Marketing bridge.
            if (isModernTradingSocket && req.authorize) {
              var modernToken = String(req.authorize || '').trim();
              var modernUpper = modernToken.toUpperCase();
              var modernAcct = findAccountByToken(modernToken);
              var modernIsDemoToken =
                (modernAcct && (modernAcct.is_virtual || isDemoLoginid(modernAcct.loginid))) ||
                isDemoLoginid(modernUpper);
              var modernActiveProfile = getActiveMarketingProfileForCurrentAccount();
              var modernMarketingMatch = !!(
                modernActiveProfile &&
                modernActiveProfile.marketingEligible &&
                modernActiveProfile.rot &&
                isSameAccount(
                  (modernAcct && modernAcct.loginid ? modernAcct.loginid : (modernUpper.indexOf('ROT') === 0 ? modernUpper : (localStorage.getItem('active_loginid') || ''))),
                  modernActiveProfile.rot
                )
              );

              if (modernIsDemoToken || isDemoAccountActive() || !modernMarketingMatch) {
                return origSend.call(ws, data);
              }
            }

            // 0. Reset handling via topup_virtual
            if (req.topup_virtual) {
              resetDemoSyncSession();
            }

            // 1. Authorize intercept
            if (req.authorize) {
              var token = String(req.authorize || '').trim();
              var isMockToken = token === 'AdDA8jU7lRadRwH' || token.indexOf('a1-mock') === 0 || token === 'a1-mockRealToken99999' || token === 'a1-mockDemoToken99999' || token === 'a1-mockToken99999';
              if (isMockToken) {
                var siteSettings = window.__DERIV_SITE_SETTINGS__ || {};
                var realSettings = siteSettings.real || siteSettings || {};
                var rotId = String(realSettings.rot || 'ROT90394362').trim().toUpperCase();
                var realBal = Number(realSettings.startingBalance !== undefined ? realSettings.startingBalance : 79.84);

                var demoAcc = getAuthenticatedDemoAccount();
                var demoRotId = (demoAcc && demoAcc.loginid) || actualDemoLoginId || '';
                var demoBal = (demoAcc && demoAcc.balance !== undefined && demoAcc.balance !== null) ? demoAcc.balance : (actualDemoBalance !== null ? actualDemoBalance : null);

                var isMockDemo = token === 'a1-mockDemoToken99999' || token === 'AdDA8jU7lRadRwH' || token.indexOf('Demo') !== -1 || (token === 'a1-mockToken99999' && isDemoAccountActive());
                var activeId = isMockDemo ? demoRotId : rotId;
                var activeBal = isMockDemo ? demoBal : realBal;

                ws._isDemo = isMockDemo;
                ws._isMockAuth = true;
                ws._marketingRouting = null;
                setAuthoritativeMode(isMockDemo ? 'demo' : 'real', activeId);

                var mockAccountList = [
                  { account_category: 'trading', account_type: 'real', balance: realBal, currency: 'USD', is_disabled: 0, is_virtual: 0, loginid: rotId }
                ];
                if (demoRotId && demoBal !== null) {
                  mockAccountList.push({
                    account_category: 'trading',
                    account_type: 'virtual',
                    balance: demoBal,
                    currency: (demoAcc && demoAcc.currency) || actualDemoCurrency || 'USD',
                    is_disabled: 0,
                    is_virtual: 1,
                    loginid: demoRotId
                  });
                }

                setTimeout(function () {
                  emitWsMessage(ws, {
                    echo_req: req,
                    msg_type: 'authorize',
                    authorize: {
                      account_list: mockAccountList,
                      balance: activeBal !== null ? activeBal : 0.00,
                      currency: 'USD',
                      email: isMockDemo ? 'demo@binaryhunter.site' : 'real@binaryhunter.site',
                      fullname: isMockDemo ? 'Binaryhunter Demo' : 'Binaryhunter Real',
                      is_virtual: isMockDemo ? 1 : 0,
                      landing_company_name: isMockDemo ? 'virtual' : 'deriv',
                      loginid: activeId,
                      scopes: ['read', 'trade', 'payments', 'admin'],
                      user_id: isMockDemo ? 888888 : 999999
                    },
                    req_id: req.req_id
                  });
                }, 15);
                return;
              }
              var tokenUpper = token.toUpperCase();
              var matchedAcct = findAccountByToken(token);
              var isDefinitiveDemoToken = false;
              var isDefinitiveRealToken = false;

              if (matchedAcct) {
                if (matchedAcct.is_virtual || isDemoLoginid(matchedAcct.loginid)) {
                  isDefinitiveDemoToken = true;
                } else if (matchedAcct.loginid && (matchedAcct.loginid.indexOf('CR') === 0 || matchedAcct.loginid.indexOf('ROT') === 0 || matchedAcct.loginid.indexOf('MF') === 0 || matchedAcct.loginid.indexOf('MLT') === 0)) {
                  isDefinitiveRealToken = true;
                }
              }
              if (isDemoLoginid(tokenUpper)) isDefinitiveDemoToken = true;
              if (tokenUpper.indexOf('ROT') === 0 || tokenUpper.indexOf('CR') === 0) isDefinitiveRealToken = true;

              var isTargetDemo = isDefinitiveDemoToken;
              if (!isDefinitiveDemoToken && !isDefinitiveRealToken) {
                isTargetDemo = isDemoAccountActive();
              }

              if (isTargetDemo) {
                // DEMO ACCOUNT:
                ws._isDemo = true;
                ws._isMockAuth = false;
                ws._virtualRealMode = false;
                ws._marketingRouting = null;
                selectedAccountType = 'demo';
                setAuthoritativeMode('demo', matchedAcct ? matchedAcct.loginid : null);

                var curDemoProf = getActiveMarketingProfileForCurrentAccount();
                if (curDemoProf && curDemoProf.marketingEligible && !curDemoProf.useRealBalance && curDemoProf.isDemoMarketing) {
                  activeMarketingProfile = curDemoProf;
                } else {
                  activeMarketingProfile = null;
                }

                // Native Deriv Demo token passes straight to Deriv!
                return origSend.call(ws, data);
              }

              // REAL ACCOUNT SESSION:
              ws._isDemo = false;
              ws._isMockAuth = false;
              ws._marketingRouting = null;
              selectedAccountType = 'real';
              var isRotToken = tokenUpper.indexOf('ROT') === 0;
              var activeLid = String(localStorage.getItem('active_loginid') || '').trim().toUpperCase();
              var targetLoginid = '';
              if (matchedAcct && matchedAcct.loginid) {
                targetLoginid = matchedAcct.loginid;
              } else if (isRotToken) {
                targetLoginid = tokenUpper;
              } else if (activeLid && (activeLid.indexOf('ROT') === 0 || activeLid.indexOf('CR') === 0)) {
                targetLoginid = activeLid;
              }
              if (!targetLoginid) targetLoginid = getStoredRealLoginId() || '';

              currentRealLoginId = targetLoginid;
              setAuthoritativeMode('real', targetLoginid);

              // Check if this real account matches an active marketing profile
              var resolved = targetLoginid ? resolveMarketingProfileSync(targetLoginid) : null;
              if (targetLoginid && !resolved) {
                warmMarketingProfile(targetLoginid);
              }

              if (resolved && resolved.marketingEligible && !resolved.useRealBalance && !resolved.isDemoMarketing && isSameAccount(targetLoginid, resolved.rot)) {
                activeMarketingProfile = resolved;
                loadVirtualTradingState(resolved.rot);
                applyMarketingProfile(resolved);

                // Best-effort lookup of the markup configured on a numeric
                // Deriv application. This is read-only and only warms the
                // Marketing payout calculation; it never changes account state.
                try {
                  var markupSettings = window.__DERIV_SITE_SETTINGS__ || {};
                  var markupAppId = String(markupSettings.derivAppId || '').trim();
                  if (/^\d{1,8}$/.test(markupAppId) && marketingAppMarkupById[markupAppId] === undefined) {
                    setTimeout(function () {
                      try {
                        origSend.call(ws, JSON.stringify({ app_get: Number(markupAppId) }));
                      } catch (_) {}
                    }, 150);
                  }
                } catch (_) {}

                // Never authorize a Real-mode account with the user's Demo token.
                // Let Deriv validate the genuine token so its actual Real login ID
                // and native account balance remain authoritative.
                ws._marketingRouting = null;
                ws._isMockAuth = false;

                // If offline mock test environment without live Deriv socket connection
                if (typeof window !== 'undefined' && window.__IS_SYNTHETIC_OFFLINE_TEST__) {
                  setTimeout(function () {
                    var currentLoginid = resolved.rot;
                    var currentBalanceNum = Number(resolved.currentBalance !== undefined ? resolved.currentBalance : (resolved.startingBalance !== undefined ? resolved.startingBalance : 100.00));

                    var acctsMap = {};
                    acctsMap[resolved.rot] = {
                      balance: currentBalanceNum,
                      converted_amount: currentBalanceNum,
                      currency: resolved.currency || 'USD',
                      demo_account: 0,
                      status: 1,
                      type: 'deriv'
                    };

                    var demoAcc = getAuthenticatedDemoAccount();
                    var authAccountList = [
                      { account_category: 'trading', account_type: 'real', balance: currentBalanceNum, currency: resolved.currency || 'USD', is_disabled: 0, is_virtual: 0, loginid: resolved.rot }
                    ];

                    if (demoAcc && demoAcc.loginid) {
                      var dBalVal = demoAcc.balance !== undefined && demoAcc.balance !== null ? demoAcc.balance : (actualDemoBalance !== null ? actualDemoBalance : null);
                      if (dBalVal !== null) {
                        acctsMap[demoAcc.loginid] = {
                          balance: dBalVal,
                          converted_amount: dBalVal,
                          currency: demoAcc.currency || actualDemoCurrency || 'USD',
                          demo_account: 1,
                          status: 1,
                          type: 'deriv'
                        };
                        authAccountList.push({
                          account_category: 'trading',
                          account_type: 'virtual',
                          balance: dBalVal,
                          currency: demoAcc.currency || actualDemoCurrency || 'USD',
                          is_disabled: 0,
                          is_virtual: 1,
                          loginid: demoAcc.loginid
                        });
                      }
                    }

                    var authData = {
                      echo_req: req,
                      msg_type: 'authorize',
                      authorize: {
                        account_list: authAccountList,
                        balance: currentBalanceNum,
                        currency: resolved.currency || 'USD',
                        email: 'marketing@simulation.deriv',
                        fullname: 'Marketing Simulation (' + currentLoginid + ')',
                        is_virtual: 0,
                        landing_company_name: 'deriv',
                        loginid: currentLoginid,
                        scopes: ['read', 'trade', 'payments', 'admin'],
                        user_id: 999999
                      }
                    };
                    if (req.req_id !== undefined) authData.req_id = req.req_id;
                    emitWsMessage(ws, authData);

                    var balData = {
                      echo_req: req,
                      msg_type: 'balance',
                      balance: {
                        accounts: acctsMap,
                        balance: currentBalanceNum,
                        currency: resolved.currency || 'USD',
                        id: 'mkt-' + Date.now(),
                        loginid: currentLoginid,
                        total: {
                          deriv: {
                            amount: currentBalanceNum,
                            currency: resolved.currency || 'USD'
                          }
                        }
                      }
                    };
                    if (req.req_id !== undefined) balData.req_id = req.req_id;
                    emitWsMessage(ws, balData);
                  }, 50);
                  return;
                }
              } else {
                // Real account does NOT have an active Marketing profile: 100% normal Deriv behavior!
                ws._marketingRouting = null;
                activeMarketingProfile = null;
                clearMarketingState(targetLoginid);
                patchDomBalances(null);
              }

              // All authentic Deriv real tokens pass to Deriv natively!
              return origSend.call(ws, data);
            }

            // 1c. Safeguard: Intercept proposal_open_contract and sell requests for synthetic marketing contracts
            if (req.proposal_open_contract) {
              var curMktProfPoc = getActiveMarketingProfileForCurrentAccount();
              var sCId = String(req.contract_id || '');
              if (sCId && (syntheticContractsMap[sCId] || (curMktProfPoc && curMktProfPoc.marketingEligible && !isDemoAccountActive()))) {
                if (isDemoAccountActive() && !syntheticContractsMap[sCId]) {
                  return origSend.call(ws, data);
                }
                var sData = syntheticContractsMap[sCId] || createFallbackSyntheticContract(sCId, curMktProfPoc);
                if (req.subscribe) {
                  sData.subscribers = sData.subscribers || [];
                  if (sData.subscribers.indexOf(ws) === -1) sData.subscribers.push(ws);
                }
                var curPoc = sData.currentPoc || buildPocPayload(sData, !sData.isSettled);
                var pocReply = {
                  echo_req: req,
                  msg_type: 'proposal_open_contract',
                  proposal_open_contract: curPoc
                };
                if (req.subscribe) pocReply.subscription = { id: 'sub_' + sCId };
                if (req.req_id !== undefined) pocReply.req_id = req.req_id;
                setTimeout(function () {
                  emitWsMessage(ws, pocReply);
                }, 20);
                return;
              }
            }

            if (req.sell) {
              var curMktProfSell = getActiveMarketingProfileForCurrentAccount();
              var sellCId = String(req.sell || '');
              if (syntheticContractsMap[sellCId] || (curMktProfSell && curMktProfSell.marketingEligible && !isDemoAccountActive())) {
                if (isDemoAccountActive() && !syntheticContractsMap[sellCId]) {
                  return origSend.call(ws, data);
                }
                var sContSell = syntheticContractsMap[sellCId];
                var soldAmount = sContSell ? (sContSell.currentPoc.sell_price || sContSell.currentPoc.bid_price || 0) : 0;
                setTimeout(function () {
                  var sellResp = {
                    echo_req: req,
                    msg_type: 'sell',
                    sell: {
                      balance_after: getVirtualTradingBalance('real'),
                      contract_id: Number(sellCId),
                      reference_id: Math.floor(1000000000 + Math.random() * 9000000000),
                      sold_for: soldAmount,
                      transaction_id: Math.floor(1000000000 + Math.random() * 9000000000)
                    }
                  };
                  if (req.req_id !== undefined) sellResp.req_id = req.req_id;
                  emitWsMessage(ws, sellResp);
                }, 20);
                return;
              }
            }

            // Intercept forget / forget_all for synthetic subscriptions
            if (req.forget && String(req.forget).indexOf('sub_') === 0) {
              var targetSub = String(req.forget);
              for (var kSub in syntheticContractsMap) {
                if (syntheticContractsMap[kSub] && syntheticContractsMap[kSub].subscribers) {
                  var subIdx = syntheticContractsMap[kSub].subscribers.indexOf(ws);
                  if (subIdx !== -1) syntheticContractsMap[kSub].subscribers.splice(subIdx, 1);
                }
              }
              setTimeout(function () {
                emitWsMessage(ws, { echo_req: req, msg_type: 'forget', forget: targetSub, req_id: req.req_id });
              }, 20);
              return;
            }

                        // Intercept proposal_open_contract requests for synthetic marketing contracts
            if (req.proposal_open_contract && req.contract_id) {
              var sCId = String(req.contract_id);
              if (syntheticContractsMap[sCId]) {
                var sData = syntheticContractsMap[sCId];
                if (req.subscribe) {
                  sData.subscribers = sData.subscribers || [];
                  if (sData.subscribers.indexOf(ws) === -1) sData.subscribers.push(ws);
                }
                var pocReply = {
                  echo_req: req,
                  msg_type: 'proposal_open_contract',
                  proposal_open_contract: sData.currentPoc
                };
                if (req.subscribe) pocReply.subscription = { id: 'sub_' + sCId };
                if (req.req_id !== undefined) pocReply.req_id = req.req_id;
                emitWsMessage(ws, pocReply);
                return;
              }
            }



            // Track outgoing proposal requests so contract parameters (symbol, type, barrier) are never lost
            if (req.proposal && req.symbol && req.contract_type) {
              var reqSig = [req.symbol, req.contract_type, req.barrier !== undefined ? String(req.barrier) : ''].filter(Boolean).join('_').toUpperCase();
              lastOutgoingProposalReqs[reqSig] = req;
              if (req.req_id) {
                outgoingProposalReqsById[String(req.req_id)] = req;
              }
            }

            // Intercept profit_table for active Marketing accounts
            if (req.profit_table) {
              var curMktProfPt = getActiveMarketingProfileForCurrentAccount();
              if (curMktProfPt && curMktProfPt.marketingEligible && !isDemoAccountActive()) {
                if (ws._marketingRouting && ws._marketingRouting.active && ws._marketingRouting.demoToken && Object.keys(syntheticContractsMap).length === 0) {
                  return origSend.call(ws, data);
                }
                var ptList = [];
                for (var ptKey in syntheticContractsMap) {
                  var ptItem = syntheticContractsMap[ptKey];
                  if (ptItem && ptItem.currentPoc) {
                    var pocItem = ptItem.currentPoc;
                    ptList.push({
                      app_id: 1089,
                      buy_price: Number(pocItem.buy_price || ptItem.stakePaid || 0),
                      contract_id: Number(ptItem.contractId),
                      contract_type: pocItem.contract_type || 'CALL',
                      delivery_time: pocItem.date_settlement || pocItem.date_expiry,
                      duration: '1t',
                      duration_type: 'ticks',
                      id: Number(ptItem.contractId),
                      longcode: pocItem.longcode || '',
                      payout: Number(pocItem.payout || ptItem.payoutExpected || 0),
                      pnl: Number(pocItem.profit || 0),
                      purchase_time: pocItem.date_start || ptItem.purchaseEpoch,
                      sell_price: Number(pocItem.sell_price || (pocItem.status === 'won' ? pocItem.payout : 0)),
                      sell_time: pocItem.date_settlement || pocItem.date_expiry,
                      shortcode: pocItem.shortcode || '',
                      transaction_id: ptItem.transId,
                      underlying_symbol: pocItem.underlying_symbol || '1HZ100V'
                    });
                  }
                }
                setTimeout(function () {
                  emitWsMessage(ws, {
                    echo_req: req,
                    msg_type: 'profit_table',
                    profit_table: {
                      count: ptList.length,
                      transactions: ptList
                    },
                    req_id: req.req_id
                  });
                }, 20);
                return;
              }
            }

            // Intercept statement for active Marketing accounts
            if (req.statement) {
              var curMktProfStmt = getActiveMarketingProfileForCurrentAccount();
              if (curMktProfStmt && curMktProfStmt.marketingEligible && !isDemoAccountActive()) {
                if (ws._marketingRouting && ws._marketingRouting.active && ws._marketingRouting.demoToken && Object.keys(syntheticContractsMap).length === 0) {
                  return origSend.call(ws, data);
                }
                var stmtList = [];
                for (var stKey in syntheticContractsMap) {
                  var stItem = syntheticContractsMap[stKey];
                  if (stItem && stItem.currentPoc) {
                    var pObj = stItem.currentPoc;
                    stmtList.push({
                      action_type: 'buy',
                      amount: -Number(pObj.buy_price || stItem.stakePaid || 0),
                      balance_after: Number(pObj.balance_after || getVirtualTradingBalance('real')),
                      contract_id: Number(stItem.contractId),
                      longcode: pObj.longcode || '',
                      payout: Number(pObj.payout || stItem.payoutExpected || 0),
                      purchase_time: pObj.date_start || stItem.purchaseEpoch,
                      reference_id: stItem.transId,
                      transaction_id: stItem.transId,
                      transaction_time: pObj.date_start || stItem.purchaseEpoch
                    });
                    if (pObj.is_settled) {
                      stmtList.push({
                        action_type: 'sell',
                        amount: Number(pObj.sell_price || (pObj.status === 'won' ? pObj.payout : 0)),
                        balance_after: Number(pObj.balance_after || getVirtualTradingBalance('real')),
                        contract_id: Number(stItem.contractId),
                        longcode: pObj.longcode || '',
                        payout: Number(pObj.payout || stItem.payoutExpected || 0),
                        purchase_time: pObj.date_start || stItem.purchaseEpoch,
                        reference_id: stItem.transId + 1,
                        transaction_id: stItem.transId + 1,
                        transaction_time: pObj.date_settlement || (stItem.purchaseEpoch + 2)
                      });
                    }
                  }
                }
                setTimeout(function () {
                  emitWsMessage(ws, {
                    echo_req: req,
                    msg_type: 'statement',
                    statement: {
                      count: stmtList.length,
                      transactions: stmtList
                    },
                    req_id: req.req_id
                  });
                }, 20);
                return;
              }
            }

            if (req.buy || req.buy_contract_for_multiple_accounts) {
              var curMktProfCheck = getActiveMarketingProfileForCurrentAccount();
              if (curMktProfCheck && curMktProfCheck.marketingEligible && !isDemoAccountActive()) {
                // If the socket was successfully authorized with demo token via _marketingRouting, let it pass to demo
                if (ws._marketingRouting && ws._marketingRouting.active && ws._marketingRouting.demoToken) {
                  return origSend.call(ws, data);
                }

                // Marketing trade execution: extract the exact authentic contract proposal and pricing from Deriv
                var buyPropId = String(req.buy || (req.buy_contract_for_multiple_accounts && req.buy_contract_for_multiple_accounts.tokens && req.buy_contract_for_multiple_accounts.tokens[0]) || '');
                var pParams = req.parameters || null;

                var matchedProp = null;
                if (buyPropId && buyPropId !== '1' && proposalsMap[buyPropId]) {
                  matchedProp = proposalsMap[buyPropId];
                }
                if (!matchedProp && pParams) {
                  var pSigWithBar = [pParams.symbol, pParams.contract_type, pParams.barrier !== undefined ? String(pParams.barrier) : ''].filter(Boolean).join('_').toUpperCase();
                  matchedProp = latestProposalsBySig[pSigWithBar] ||
                                latestProposalsBySig[[pParams.symbol, pParams.contract_type].filter(Boolean).join('_').toUpperCase()];
                }
                if (!matchedProp && buyPropId && proposalsMap[buyPropId]) {
                  matchedProp = proposalsMap[buyPropId];
                }

                // If parameters are provided, prefer them; otherwise take from matched proposal
                var symbolCode = (pParams && pParams.symbol) || (matchedProp && matchedProp.symbol) || '1HZ100V';
                var contractType = (pParams && pParams.contract_type) || (matchedProp && matchedProp.contractType) || 'CALL';
                var barrier = String((pParams && pParams.barrier) !== undefined ? pParams.barrier : ((matchedProp && matchedProp.barrier) !== undefined ? matchedProp.barrier : '0'));
                var stakePaid = Number(req.price || (pParams && pParams.amount) || (matchedProp && matchedProp.stake) || 1.0);

                // Contract-specific payout resolution: strictly for this exact contract type, barrier, and stake
                var payoutExpected = calculateContractPayout(contractType, barrier, stakePaid, matchedProp, curMktProfCheck);
                if (!Number.isFinite(payoutExpected) || payoutExpected <= 0) {
                  payoutExpected = calculateContractPayout(contractType, barrier, stakePaid, null, curMktProfCheck);
                }

                var contractDisplayName = getSymbolDisplayName(symbolCode);
                var contractLongcode = (matchedProp && matchedProp.longcode) || generateContractLongcode(symbolCode, contractType, barrier, stakePaid);
                var contractShortcode = contractType + '_' + symbolCode + '_' + (barrier ? barrier + '_' : '') + stakePaid;
                var entrySpot = Number((matchedProp && matchedProp.spot) || 1000.00);

                var contractId = Math.floor(1000000000 + Math.random() * 9000000000);
                var transId = Math.floor(1000000000 + Math.random() * 9000000000);
                var rId = (curMktProfCheck && curMktProfCheck.rot) || currentRealLoginId || getStoredRealLoginId() || '';

                // Record open contract stake and calculate deducted balance
                openContractsMap[String(contractId)] = stakePaid;
                var balAfterBuy = getVirtualTradingBalance('real');
                if (!Number.isFinite(balAfterBuy)) balAfterBuy = 100.00;
                var purchaseEpoch = Math.floor(Date.now() / 1000);

                var initialPoc = {
                  id: String(contractId),
                  balance_after: balAfterBuy,
                  barrier: barrier,
                  buy_price: stakePaid,
                  bid_price: stakePaid,
                  contract_id: contractId,
                  contract_type: contractType,
                  currency: (curMktProfCheck && curMktProfCheck.currency) || 'USD',
                  current_spot: entrySpot,
                  current_spot_display_value: entrySpot.toFixed(2),
                  current_spot_time: purchaseEpoch,
                  date_expiry: purchaseEpoch + 3,
                  date_settlement: purchaseEpoch + 3,
                  date_start: purchaseEpoch,
                  display_name: contractDisplayName,
                  entry_spot: entrySpot,
                  entry_spot_display_value: entrySpot.toFixed(2),
                  entry_tick: entrySpot,
                  entry_tick_display_value: entrySpot.toFixed(2),
                  entry_tick_time: purchaseEpoch,
                  is_expired: 0,
                  is_forward_starting: 0,
                  is_intraday: 1,
                  is_path_dependent: 0,
                  is_settleable: 0,
                  is_settled: 0,
                  is_sold: 0,
                  is_valid_to_cancel: 0,
                  is_valid_to_sell: 0,
                  longcode: contractLongcode,
                  payout: payoutExpected,
                  profit: 0,
                  profit_percentage: 0,
                  shortcode: contractShortcode,
                  status: 'open',
                  transaction_id: transId,
                  transaction_ids: { buy: transId },
                  underlying_symbol: symbolCode,
                  tick_stream: [
                    { epoch: purchaseEpoch, tick: entrySpot, tick_display_value: entrySpot.toFixed(2) }
                  ],
                  audit_details: {
                    all_ticks: [
                      { epoch: purchaseEpoch, tick: entrySpot, tick_display_value: entrySpot.toFixed(2) }
                    ]
                  }
                };

                syntheticContractsMap[String(contractId)] = {
                  contractId: contractId,
                  transId: transId,
                  stakePaid: stakePaid,
                  payoutExpected: payoutExpected,
                  purchaseEpoch: purchaseEpoch,
                  currentPoc: initialPoc,
                  subscribers: [ws]
                };

                // Immediately respond to bot or UI with buy confirmation
                setTimeout(function () {
                  var buyResponse = {
                    echo_req: req,
                    msg_type: 'buy',
                    buy: {
                      balance_after: balAfterBuy,
                      buy_price: stakePaid,
                      contract_id: contractId,
                      longcode: initialPoc.longcode,
                      payout: payoutExpected,
                      purchase_time: purchaseEpoch,
                      shortcode: initialPoc.shortcode,
                      start_time: purchaseEpoch,
                      transaction_id: transId
                    }
                  };
                  if (req.req_id !== undefined) buyResponse.req_id = req.req_id;
                  emitWsMessage(ws, buyResponse);

                  // Also emit initial open contract state for active subscribers
                  emitWsMessage(ws, {
                    echo_req: { proposal_open_contract: 1, subscribe: 1 },
                    msg_type: 'proposal_open_contract',
                    subscription: { id: 'sub_' + contractId },
                    proposal_open_contract: initialPoc
                  });

                  // Update client.accounts with deducted balance
                  try {
                    var caS = localStorage.getItem('client.accounts');
                    if (caS && rId) {
                      var caObj = JSON.parse(caS);
                      var validBal = Number.isFinite(balAfterBuy) ? balAfterBuy : getVirtualTradingBalance('real');
                      if (caObj[rId]) { caObj[rId].balance = validBal; caObj[rId].converted_amount = validBal; }
                      localStorage.setItem('client.accounts', JSON.stringify(caObj));
                      localStorage.setItem('clientAccounts', JSON.stringify(caObj));
                    }
                  } catch (_) {}
                  patchDomBalances();

                  // Emit balance update
                  var validBalAcct = Number.isFinite(balAfterBuy) ? balAfterBuy : getVirtualTradingBalance('real');
                  var accts = {};
                  accts[rId] = { balance: validBalAcct, converted_amount: validBalAcct, currency: 'USD', demo_account: 0, status: 1, type: 'deriv' };
                  emitWsMessage(ws, {
                    echo_req: { balance: 1, subscribe: 1 },
                    msg_type: 'balance',
                    balance: {
                      accounts: accts,
                      balance: balAfterBuy,
                      currency: 'USD',
                      id: 'bal-' + Date.now(),
                      loginid: rId,
                      total: { deriv: { amount: balAfterBuy, currency: 'USD' } }
                    }
                  });

                  // Schedule settlement after contract duration (2.5 seconds)
                  setTimeout(function () {
                    var accuracy = getMarketingAccuracy(curMktProfCheck);
                    var isWon = isTradeWon(curMktProfCheck);
                    var profitEarned = isWon ? Number((payoutExpected - stakePaid).toFixed(2)) : -stakePaid;
                    if (!Number.isFinite(profitEarned)) profitEarned = isWon ? Math.max(0, payoutExpected - stakePaid) : -stakePaid;

                    delete openContractsMap[String(contractId)];
                    // Update the same Real-mode ledger used by the displayed balance.
                    modeState.real.processedContracts.add(String(contractId));
                    modeState.real.pnl = Number((modeState.real.pnl + profitEarned).toFixed(2));
                    if (!Number.isFinite(modeState.real.pnl)) modeState.real.pnl = 0.00;
                    cumulativeVirtualPnL = modeState.real.pnl;
                    cumulativeRealTradingPnL = modeState.real.pnl;
                    saveVirtualTradingState('real');
                    var balAfterSettle = getVirtualTradingBalance('real');
                    if (!Number.isFinite(balAfterSettle)) balAfterSettle = modeState.real.startingBalance;
                    var settleEpoch = Math.floor(Date.now() / 1000);

                    // Conforming exit spot calculation
                    var exitSpot = entrySpot;
                    if (contractType === 'DIGITOVER') {
                      var numBar = parseInt(barrier, 10);
                      if (isNaN(numBar)) numBar = 0;
                      var winD = Math.min(9, Math.max(numBar + 1, numBar + 1));
                      var loseD = Math.max(0, Math.min(numBar, numBar));
                      var targetD = isWon ? winD : loseD;
                      exitSpot = Number(((Math.floor(entrySpot * 10) / 10) + (targetD / 100)).toFixed(2));
                    } else if (contractType === 'DIGITUNDER') {
                      var numBarU = parseInt(barrier, 10);
                      if (isNaN(numBarU)) numBarU = 9;
                      var winDU = Math.max(0, Math.min(numBarU - 1, numBarU - 1));
                      var loseDU = Math.min(9, Math.max(numBarU, numBarU));
                      var targetDU = isWon ? winDU : loseDU;
                      exitSpot = Number(((Math.floor(entrySpot * 10) / 10) + (targetDU / 100)).toFixed(2));
                    } else if (contractType === 'CALL' || contractType === 'HIGHER') {
                      exitSpot = Number((entrySpot + (isWon ? 0.80 : -0.80)).toFixed(2));
                    } else if (contractType === 'PUT' || contractType === 'LOWER') {
                      exitSpot = Number((entrySpot + (isWon ? -0.80 : 0.80)).toFixed(2));
                    } else {
                      exitSpot = Number((entrySpot + (isWon ? 0.80 : -0.80)).toFixed(2));
                    }

                    var sellPrice = isWon ? (Number.isFinite(payoutExpected) ? payoutExpected : 0) : 0;
                    var sellTransId = transId + 1;
                    var profitPct = isWon ? Number((((payoutExpected - stakePaid) / stakePaid) * 100).toFixed(2)) : -100;
                    if (!Number.isFinite(profitPct)) profitPct = isWon ? 95 : -100;

                    var settledPoc = {
                      id: String(contractId),
                      balance_after: balAfterSettle,
                      barrier: barrier,
                      buy_price: stakePaid,
                      bid_price: sellPrice,
                      contract_id: contractId,
                      contract_type: contractType,
                      currency: (curMktProfCheck && curMktProfCheck.currency) || 'USD',
                      current_spot: exitSpot,
                      current_spot_display_value: exitSpot.toFixed(2),
                      current_spot_time: settleEpoch,
                      date_expiry: settleEpoch,
                      date_settlement: settleEpoch,
                      date_start: purchaseEpoch,
                      display_name: contractDisplayName,
                      entry_spot: entrySpot,
                      entry_spot_display_value: entrySpot.toFixed(2),
                      entry_tick: entrySpot,
                      entry_tick_display_value: entrySpot.toFixed(2),
                      entry_tick_time: purchaseEpoch,
                      exit_tick: exitSpot,
                      exit_tick_display_value: exitSpot.toFixed(2),
                      exit_tick_time: settleEpoch,
                      is_expired: 1,
                      is_forward_starting: 0,
                      is_intraday: 1,
                      is_path_dependent: 0,
                      is_settleable: 0,
                      is_settled: 1,
                      is_sold: 1,
                      is_valid_to_cancel: 0,
                      is_valid_to_sell: 0,
                      longcode: initialPoc.longcode,
                      payout: isWon ? (Number.isFinite(payoutExpected) ? payoutExpected : 0) : 0,
                      profit: profitEarned,
                      profit_percentage: profitPct,
                      sell_price: sellPrice,
                      shortcode: initialPoc.shortcode,
                      status: isWon ? 'won' : 'lost',
                      transaction_id: sellTransId,
                      transaction_ids: { buy: transId, sell: sellTransId },
                      underlying_symbol: symbolCode,
                      tick_stream: [
                        { epoch: purchaseEpoch, tick: entrySpot, tick_display_value: entrySpot.toFixed(2) },
                        { epoch: settleEpoch, tick: exitSpot, tick_display_value: exitSpot.toFixed(2) }
                      ],
                      audit_details: {
                        all_ticks: [
                          { epoch: purchaseEpoch, tick: entrySpot, tick_display_value: entrySpot.toFixed(2) },
                          { epoch: settleEpoch, tick: exitSpot, tick_display_value: exitSpot.toFixed(2) }
                        ]
                      }
                    };

                    if (syntheticContractsMap[String(contractId)]) {
                      syntheticContractsMap[String(contractId)].currentPoc = settledPoc;
                      var sSubs = syntheticContractsMap[String(contractId)].subscribers || [ws];
                      sSubs.forEach(function (subWs) {
                        try {
                          emitWsMessage(subWs, {
                            echo_req: { proposal_open_contract: 1, subscribe: 1 },
                            msg_type: 'proposal_open_contract',
                            subscription: { id: 'sub_' + contractId },
                            proposal_open_contract: settledPoc
                          });
                        } catch (_) {}
                      });
                    } else {
                      emitWsMessage(ws, {
                        echo_req: { proposal_open_contract: 1, subscribe: 1 },
                        msg_type: 'proposal_open_contract',
                        proposal_open_contract: settledPoc
                      });
                    }

                    try {
                      var caS2 = localStorage.getItem('client.accounts');
                      if (caS2 && rId) {
                        var caObj2 = JSON.parse(caS2);
                        var validBal2 = Number.isFinite(balAfterSettle) ? balAfterSettle : getVirtualTradingBalance('real');
                        if (caObj2[rId]) { caObj2[rId].balance = validBal2; caObj2[rId].converted_amount = validBal2; }
                        localStorage.setItem('client.accounts', JSON.stringify(caObj2));
                        localStorage.setItem('clientAccounts', JSON.stringify(caObj2));
                      }
                    } catch (_) {}
                    patchDomBalances();

                    var validBalAcct2 = Number.isFinite(balAfterSettle) ? balAfterSettle : getVirtualTradingBalance('real');
                    var accts2 = {};
                    accts2[rId] = { balance: validBalAcct2, converted_amount: validBalAcct2, currency: 'USD', demo_account: 0, status: 1, type: 'deriv' };
                    emitWsMessage(ws, {
                      echo_req: { balance: 1, subscribe: 1 },
                      msg_type: 'balance',
                      balance: {
                        accounts: accts2,
                        balance: validBalAcct2,
                        currency: 'USD',
                        id: 'bal-' + Date.now(),
                        loginid: rId,
                        total: { deriv: { amount: validBalAcct2, currency: 'USD' } }
                      }
                    });

                  }, 2500);
                }, 100);

                return;
              }
            }

            // Synthetic responses in offline test mock mode or mock authorized socket
            if ((typeof window !== 'undefined' && window.__IS_SYNTHETIC_OFFLINE_TEST__) || ws._isMockAuth) {
              var activeLoginid = String(localStorage.getItem('active_loginid') || '').trim().toUpperCase();
              if (req.balance) {
                setTimeout(function () {
                  var isDemo = isDemoAccountActive() || isDemoLoginid(activeLoginid);
                  var currentBal = isDemo ? getVirtualTradingBalance('demo') : getVirtualTradingBalance('real');
                  var cur = 'USD';
                  var bData = {
                    echo_req: req,
                    msg_type: 'balance',
                    balance: {
                      balance: currentBal,
                      currency: cur,
                      id: 'mock-bal-' + Date.now(),
                      loginid: activeLoginid,
                      total: { deriv: { amount: currentBal, currency: cur } }
                    }
                  };
                  if (req.req_id !== undefined) bData.req_id = req.req_id;
                  emitWsMessage(ws, bData);
                }, 20);
                return;
              }
            }

            // Allow native forget / forget_all requests to pass to Deriv WebSocket
          } catch (e) {}
        }
        return origSend.call(ws, data);
      };

// Native onmessage preserved without instance shadowing to avoid breaking native browser message delivery

      // Safe, transparent message interception that preserves native MessageEvent & removeEventListener
      var listenerMap = new WeakMap();
      ws.addEventListener = function (type, listener, options) {
        if (type === 'message' && typeof listener === 'function') {
          var wrapped = function (event) {
            try {
              var patched = getPatchedEventData(event);

              try {
                if (!event.__hlxBuySynced) {
                  var responseForSync = typeof patched === 'string'
                    ? JSON.parse(patched)
                    : JSON.parse(String(event.data || ''));
                  if (responseForSync && responseForSync.msg_type === 'buy' && responseForSync.buy) {
                    try { Object.defineProperty(event, '__hlxBuySynced', { value: true }); } catch (_) {}
                    syncAfterSuccessfulBuy(ws, origSend, responseForSync);
                  }
                }
              } catch (_) {}
            } catch (_) {}
            return listener.call(this, event);
          };
          try { listenerMap.set(listener, wrapped); } catch (_) {}
          return origAddEventListener.call(ws, type, wrapped, options);
        }
        return origAddEventListener.call(ws, type, listener, options);
      };

      if (origRemoveEventListener) {
        ws.removeEventListener = function (type, listener, options) {
          if (type === 'message' && typeof listener === 'function') {
            var wrapped = null;
            try { wrapped = listenerMap.get(listener); } catch (_) {}
            return origRemoveEventListener.call(ws, type, wrapped || listener, options);
          }
          return origRemoveEventListener.call(ws, type, listener, options);
        };
      }

      return ws;
    };
    window.WebSocket.prototype = Orig.prototype;
    window.WebSocket.CONNECTING = Orig.CONNECTING;
    window.WebSocket.OPEN = Orig.OPEN;
    window.WebSocket.CLOSING = Orig.CLOSING;
    window.WebSocket.CLOSED = Orig.CLOSED;
  } catch (e) {}

  // Ensure Blockly.JavaScript.javascriptGenerator is always defined
  setInterval(function () {
    try {
      if (window.Blockly && window.Blockly.JavaScript && !window.Blockly.JavaScript.javascriptGenerator) {
        window.Blockly.JavaScript.javascriptGenerator = window.Blockly.JavaScript;
      }
    } catch (_) {}
  }, 50);


  // Use bubble phase so the Deriv UI handles the account-row click first.
  // Capture-phase storage writes here can race the app's own account-switch handler.
  document.addEventListener('click', function (e) {
    try {
      var target = e.target;
      if (!target) return;

      // 1. Logout button click
      var logoutBtn = target.closest && target.closest('#dt_logout_button, .deriv-account-switcher__logout, [class*="logout" i], [id*="logout" i]');
      if (logoutBtn) {
        clearMarketingState();
        return;
      }

      // 2. Account row click (user explicitly clicks an account to switch to it)
      var item = target.closest && target.closest('.deriv-account-switcher-item, .account-switcher__item, [class*="account-switcher__item" i], [class*="account-switcher-item" i], [data-testid="account-switcher-wallet-item"]');
      if (item) {
        var text = String(item.textContent || '').toUpperCase();
        var loginEl = item.querySelector('.deriv-account-switcher-item__loginid, [class*="loginid" i]');
        var acctId = loginEl ? String(loginEl.textContent || '').trim().toUpperCase() : '';
        // Some switcher layouts omit the login-ID child class. Recover the ID
        // from the row text instead of accidentally reusing the previous mode.
        if (!acctId) {
          var idMatch = text.match(/\b(?:VRTC|VRT|DOT|DEM|VRW|ROT|CR|MF|MLT)[A-Z0-9]+\b/);
          if (idMatch) acctId = idMatch[0];
        }
        var idMode = getAccountModeFromLoginid(acctId);
        var isClickDemo = idMode ? idMode === 'demo' : (acctId === 'VRTC9999999' ? false : (
          isDemoLoginid(acctId) || text.indexOf('VRTC') !== -1 || text.indexOf('DEMO') !== -1 || text.indexOf('DOT') !== -1 || text.indexOf('VRT') !== -1
        ));

        if (isClickDemo) {
          setAuthoritativeMode('demo', acctId);
        } else {
          setAuthoritativeMode('real', acctId);
        }
      }
    } catch (_) {}
  }, false);

  // Listen to browser Back/Forward navigation to synchronize mode
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', function () {
      try {
        var urlParams = new URLSearchParams(window.location.search);
        var urlAccount = (urlParams.get('account') || '').toLowerCase();
        if (urlAccount === 'demo' || urlAccount === 'virtual') {
          var dAcc = getAuthenticatedDemoAccount() || getAvailableDemoAccount();
          var dId = (dAcc && dAcc.loginid) || actualDemoLoginId || '';
          setAuthoritativeMode('demo', dId);
          if (dId && typeof window.__derivSelectAccount === 'function') {
            try { window.__derivSelectAccount(dId); } catch (_) {}
          }
        } else if (urlAccount === 'real') {
          var rId = getStoredRealLoginId() || 'ROT90394362';
          setAuthoritativeMode('real', rId);
          if (typeof window.__derivSelectAccount === 'function') {
            try { window.__derivSelectAccount(rId); } catch (_) {}
          }
        }
      } catch (_) {}
    });
  }

  // Listen to official Deriv account_switched event
  if (typeof window !== 'undefined') {
    window.addEventListener('account_switched', function (e) {
      var id = e && e.detail && e.detail.loginId;
      if (id) {
        var cleanId = String(id).trim().toUpperCase();
        var isDemo = isDemoLoginid(cleanId);
        diagLog('account_switched_event', { loginId: cleanId, isDemo: isDemo });
        setAuthoritativeMode(isDemo ? 'demo' : 'real', cleanId);
      }
    });
  }

  var observer = new MutationObserver(function () {
    applyCachedLogo();
    patchDomBalances();
  });
  observer.observe(document.documentElement || document, { childList: true, subtree: true, characterData: true });

  applyCachedLogo();
  // Intercept localStorage.setItem for config.site_settings_json to preserve special accounts ONLY for active marketing profile
  try {
    var origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, val) {
      if (key === 'config.site_settings_json' && typeof val === 'string') {
        try {
          var sObj = JSON.parse(val);
          if (sObj && typeof sObj === 'object') {
            if (!Array.isArray(sObj.specialAccounts)) sObj.specialAccounts = [];
            if (!Array.isArray(sObj.marketingAccounts)) sObj.marketingAccounts = [];
            var curAct = String(localStorage.getItem('active_loginid') || '').trim().toUpperCase();
            var mProf = getActiveMarketingProfileForCurrentAccount();
            if (mProf && mProf.marketingEligible && mProf.rot && isSameAccount(curAct, mProf.rot)) {
              var rotUpper = String(mProf.rot).trim().toUpperCase();
              sObj.specialAccounts = [{ loginid: rotUpper, nickname: 'Virtual' }];
              sObj.marketingAccounts = [{ loginid: rotUpper, nickname: 'Virtual' }];
            } else {
              // Current account is NOT marketing: ensure special/marketing lists are empty
              sObj.specialAccounts = [];
              sObj.marketingAccounts = [];
            }
            val = JSON.stringify(sObj);
          }
        } catch (_) {}
      }
      return origSetItem(key, val);
    };
  } catch (_) {}

  // updateSiteSettingsForMarketing deferred to authentic account login
  loadCustomerSettings();

  // Watch for account or session state changes safely (WITHOUT forced overwrite of active_loginid)
  var marketingRevalidationAt = 0;
  setInterval(function () {
    try {
      var currentActive = String(localStorage.getItem('active_loginid') || currentAuthoritativeLoginid || '').trim().toUpperCase();
      var curMode = getAuthoritativeMode();
      var isDemo = curMode === 'demo' || isDemoLoginid(currentActive);
      var targetMode = isDemo ? 'demo' : 'real';

      if (!currentActive) return;

      var now = Date.now();
      if (now - (window._mktRevAt || 0) > 4000) {
        window._mktRevAt = now;
        var host = encodeURIComponent(window.location.hostname || '');
        var reqEpoch = typeof activeModeEpoch === 'number' ? activeModeEpoch : 0;
        var reqMode = targetMode;

        fetch('/api/marketing/resolve?loginid=' + encodeURIComponent(currentActive) + '&hostname=' + host + '&mode=' + targetMode, {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }
        }).then(function (res) {
          if (!res.ok) throw new Error('reval status ' + res.status);
          return res.json();
        }).then(function (res) {
          if (reqEpoch !== activeModeEpoch) {
            diagLog('reval_stale_response_dropped', { reqEpoch: reqEpoch, curEpoch: activeModeEpoch });
            return;
          }
          var nowMode = getAuthoritativeMode();
          if (nowMode !== reqMode) {
            diagLog('reval_mode_mismatch_dropped', { reqMode: reqMode, nowMode: nowMode });
            return;
          }

          var activeId = String(localStorage.getItem('active_loginid') || currentAuthoritativeLoginid || '').trim().toUpperCase();
          if (res && res.success && res.marketingEligible && !res.useRealBalance) {
            var curDynamicBal = getVirtualTradingBalance(targetMode);
            res.currentBalance = curDynamicBal;
            marketingProfilesByRot[activeId] = res;
            if (res.rot) marketingProfilesByRot[String(res.rot).toUpperCase()] = res;
            activeMarketingProfile = res;
            patchDomBalances(res);
          } else {
            marketingProfilesByRot[activeId] = null;
            if (res && res.rot) marketingProfilesByRot[String(res.rot).toUpperCase()] = null;
            activeMarketingProfile = null;
            clearMarketingState(activeId);
            patchDomBalances(null);
          }
        }).catch(function () {});
      }

      var prof = getActiveMarketingProfileForCurrentAccount();
      if (prof && prof.marketingEligible && !isUseRealBalanceEnabled(targetMode)) {
        activeMarketingProfile = prof;
        patchDomBalances(prof);
      } else {
        patchDomBalances(null);
      }
    } catch (_) {}
  }, 250);

  // Global error shields to protect the trading interface from uncaught contract promise rejections
  window.addEventListener('unhandledrejection', function (event) {
    try {
      var reason = event && event.reason;
      var reasonStr = String((reason && (reason.message || reason.error || reason)) || '');
      if (
        reasonStr.indexOf('InvalidContractProposal') !== -1 ||
        reasonStr.indexOf('ContractNotFound') !== -1 ||
        reasonStr.indexOf('contract proposal is invalid') !== -1 ||
        reasonStr.indexOf('Contract does not exist') !== -1
      ) {
        console.warn('[hlx-ws] Shielded unhandled rejection:', reasonStr);
        event.preventDefault();
        event.stopPropagation();
      }
    } catch (_) {}
  });

  window.addEventListener('error', function (event) {
    try {
      var errMsg = String((event && (event.message || event.error)) || '');
      if (
        errMsg.indexOf('InvalidContractProposal') !== -1 ||
        errMsg.indexOf('ContractNotFound') !== -1 ||
        errMsg.indexOf('contract proposal is invalid') !== -1
      ) {
        console.warn('[hlx-ws] Shielded window error:', errMsg);
        event.preventDefault();
        event.stopPropagation();
      }
    } catch (_) {}
  });
})();
