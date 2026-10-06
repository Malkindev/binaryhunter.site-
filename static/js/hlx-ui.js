/* Deriv Site Builder runtime configuration bridge. */
(function () {
  'use strict';
  var state = { settings: null };
  var STYLE_ID = 'sitebuilder-live-settings';

  
  function renderSuspendedScreen() {
    if (document.getElementById('sitebuilder-suspended-screen')) return;

    // Immediately suppress any loaders
    var loaders = document.querySelectorAll('.loaderx-root, .initial-loader, #hlx-loader');
    loaders.forEach(function (el) {
      if (el && el.style) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
      }
    });

    // Disable WebSockets to block any trading logic or tickers
    try {
      window.WebSocket = function () {
        console.warn('[SiteBuilder] WebSocket connection blocked: site is suspended.');
        return {
          close: function () {},
          send: function () {},
          addEventListener: function () {},
          removeEventListener: function () {}
        };
      };
    } catch (_) {}

    var wrap = document.createElement('div');
    wrap.id = 'sitebuilder-suspended-screen';
    wrap.style.cssText = 'position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100vh!important;z-index:2147483647!important;background-color:#08090e!important;background-image:radial-gradient(circle at 0% 0%,rgba(180,20,50,0.35) 0%,transparent 45%),radial-gradient(circle at 100% 100%,rgba(160,15,45,0.3) 0%,transparent 45%),radial-gradient(circle at 50% 20%,rgba(255,30,60,0.08) 0%,transparent 55%)!important;background-repeat:no-repeat!important;background-attachment:fixed!important;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;color:#f1f5f9!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow-y:auto!important;margin:0!important;padding:24px!important;box-sizing:border-box!important;-webkit-font-smoothing:antialiased!important;';

    wrap.innerHTML = '<div style="width:100%;max-width:580px;margin:auto;text-align:center;display:flex;flex-direction:column;align-items:center;position:relative;z-index:10;box-sizing:border-box;">' +
      '<div style="position:relative;margin-bottom:24px;display:inline-flex;align-items:center;justify-content:center;">' +
        '<div style="position:absolute;width:74px;height:74px;border-radius:50%;background:#ff2847;filter:blur(24px);opacity:0.75;z-index:1;"></div>' +
        '<div style="position:relative;z-index:2;width:76px;height:76px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ff3b59 0%,#e61938 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 0 35px rgba(255,40,70,0.5),inset 0 1px 2px rgba(255,255,255,0.4);">' +
          '<svg viewBox="0 0 24 24" fill="none" style="width:34px;height:34px;display:block;"><rect x="4.5" y="10.5" width="15" height="11" rx="2.5" fill="#ffffff"/><path d="M7.5 10.5V7a4.5 4.5 0 1 1 9 0v3.5" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="15" r="1.5" fill="#e61938"/><path d="M12 16.5v2.2" stroke="#e61938" stroke-width="1.8" stroke-linecap="round"/></svg>' +
        '</div>' +
      '</div>' +
      '<h1 class="suspended-title" style="color:#ff334b!important;font-size:38px!important;font-weight:900!important;letter-spacing:0.8px!important;line-height:1.15!important;text-transform:uppercase!important;margin:0 0 14px 0!important;">SITE SUSPENDED</h1>' +
      '<p class="suspended-subtitle" style="color:#f1f5f9!important;font-size:16px!important;font-weight:500!important;line-height:1.5!important;max-width:480px!important;margin:0 0 28px 0!important;">This website has been temporarily suspended due to an outstanding payment.</p>' +
      '<div style="width:100%;background:rgba(22,10,16,0.75);border:1.5px solid rgba(255,45,75,0.38);border-radius:18px;padding:18px 24px;display:flex;align-items:center;gap:20px;text-align:left;margin-bottom:26px;backdrop-filter:blur(8px);box-shadow:0 8px 32px rgba(0,0,0,0.35);box-sizing:border-box;">' +
        '<div style="flex-shrink:0;display:flex;align-items:center;justify-content:center;">' +
          '<svg width="42" height="42" viewBox="0 0 24 24" fill="none"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" stroke="#ff334b" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 7h18v10H3z" stroke="#ff334b" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17.5" cy="16" r="4.2" fill="#ff334b" stroke="#160a10" stroke-width="1.4"/><line x1="17.5" y1="13.8" x2="17.5" y2="16.4" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/><circle cx="17.5" cy="18.2" r="0.65" fill="#ffffff"/></svg>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:3px;">' +
          '<div class="commission-label" style="color:#e2e8f0;font-size:13.5px;font-weight:600;letter-spacing:0.1px;">Outstanding Amount / Commission:</div>' +
          '<div style="display:flex;align-items:baseline;gap:6px;">' +
            '<span class="commission-rate" style="color:#ff334b;font-size:28px;font-weight:900;line-height:1.1;">15%</span>' +
            '<span class="commission-hint" style="color:#cbd5e1;font-size:13.5px;font-weight:500;">(of your earnings)</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<p class="instruction-text" style="color:#94a3b8!important;font-size:13.5px!important;font-weight:400!important;line-height:1.6!important;max-width:460px!important;margin:0 0 26px 0!important;">To continue using your site and restore full access,<br>please make the required payment or contact the developer.</p>' +
      '<a href="https://wa.me/254708747606" target="_blank" rel="noopener noreferrer" class="whatsapp-btn" style="display:inline-flex;align-items:center;justify-content:space-between;min-width:300px;max-width:100%;background:linear-gradient(135deg,#00d757 0%,#00b047 100%);color:#ffffff!important;text-decoration:none!important;padding:12px 24px;border-radius:9999px;box-shadow:0 4px 20px rgba(0,200,83,0.4),0 0 0 1px rgba(255,255,255,0.15) inset;cursor:pointer;box-sizing:border-box;">' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
          '<svg style="width:28px;height:28px;fill:#ffffff;flex-shrink:0;" viewBox="0 0 24 24"><path d="M17.472 14.382c-.301-.15-1.782-.879-2.058-.98-.276-.1-.477-.15-.678.15-.201.3-.778.98-.954 1.18-.176.2-.352.226-.653.075s-1.272-.469-2.423-1.496c-.896-.799-1.501-1.786-1.677-2.087-.176-.301-.019-.464.132-.614.136-.135.301-.351.452-.527.151-.176.201-.301.301-.502.101-.201.05-.377-.025-.527s-.678-1.633-.929-2.235c-.245-.587-.494-.508-.678-.517-.176-.009-.377-.01-.578-.01s-.527.075-.803.377c-.276.301-1.054 1.03-1.054 2.512 0 1.482 1.079 2.914 1.23 3.115.151.201 2.124 3.243 5.145 4.548.719.311 1.28.497 1.718.636.722.23 1.378.197 1.898.12.58-.087 1.782-.728 2.033-1.431.251-.703.251-1.306.176-1.431-.075-.125-.276-.201-.577-.351zm-5.461 7.424c-1.803 0-3.571-.485-5.127-1.405l-.367-.218-3.81 1 .998-3.714-.24-.382a10.024 10.024 0 0 1-1.536-5.35c0-5.545 4.512-10.057 10.057-10.057 2.685 0 5.209 1.046 7.108 2.946a10.007 10.007 0 0 1 2.946 7.111c0 5.546-4.512 10.058-10.029 10.058v.011zm8.814-16.036A11.935 11.935 0 0 0 12.011.894C5.433.894.075 6.252.075 12.83c0 2.103.548 4.156 1.589 5.969L0 24l5.354-1.405a11.89 11.89 0 0 0 5.657 1.442h.005c6.578 0 11.936-5.358 11.936-11.936a11.867 11.867 0 0 0-3.488-8.455z"/></svg>' +
          '<div style="width:1px;height:26px;background:rgba(255,255,255,0.3);flex-shrink:0;"></div>' +
          '<div style="display:flex;flex-direction:column;text-align:left;">' +
            '<span style="font-size:15px;font-weight:700;color:#ffffff;line-height:1.2;">Contact Developer</span>' +
            '<span style="font-size:12px;font-weight:500;color:#e6fced;line-height:1.2;">via WhatsApp</span>' +
          '</div>' +
        '</div>' +
        '<svg style="width:18px;height:18px;stroke:#ffffff;stroke-width:2.8;fill:none;margin-left:20px;flex-shrink:0;" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>' +
      '</a>' +
      '<p class="suspended-footer" style="color:#64748b!important;font-size:11.5px!important;font-weight:400!important;line-height:1.6!important;max-width:440px!important;margin:32px 0 0 0!important;">We appreciate your cooperation.<br>Once the payment is received, your site will be reactivated as soon as possible.</p>' +
    '</div>';

    var parent = document.body || document.documentElement;
    parent.appendChild(wrap);
    try {
      document.documentElement.style.overflow = 'hidden';
      if (document.body) document.body.style.overflow = 'hidden';
    } catch (_) {}

    // Polling interval: if admin starts the site, automatically restore
    var pollInterval = setInterval(function () {
      getSettings().then(function (newSettings) {
        if (newSettings && !newSettings.suspended && newSettings.status !== 'UNPUBLISHED') {
          clearInterval(pollInterval);
          window.location.reload();
        }
      }).catch(function () {});
    }, 8000);
  }

  function getSettings() {
    var host = encodeURIComponent(window.location.hostname || '');
    return fetch('/api/appwrite/site-settings?hostname=' + host, {
      method: 'GET', cache: 'no-store', headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', 'x-customer-host': window.location.hostname || '' }
    }).then(function (res) {
      if (!res.ok) throw new Error('settings ' + res.status);
      return res.json();
    }).then(function (payload) {
      var site = payload && payload.site;
      if (!site) throw new Error('missing site settings');
      var settings = site.settingsJson;
      if (typeof settings === 'string') {
        try { settings = JSON.parse(settings); } catch (e) { settings = {}; }
      }
      var isSuspended = Boolean(payload.suspended || site.suspended || (settings && settings.suspended) || payload.status === 'UNPUBLISHED' || site.status === 'UNPUBLISHED');
      return Object.assign({}, site, settings || {}, { suspended: isSuspended, status: payload.status || site.status });
    });
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  function absoluteAssetUrl(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    try { return new URL(raw, window.location.origin).href; } catch (e) { return raw; }
  }

  function setFavicon(url) {
    if (!url) return;
    var absolute = absoluteAssetUrl(url);
    var links = document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"]');
    if (!links.length) {
      var link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
      links = [link];
    }
    Array.prototype.forEach.call(links, function (link) { link.href = absolute; });
  }

  function updateMeta(name, value) {
    var n = document.querySelector('meta[name="' + name + '"]');
    if (n && value) n.setAttribute('content', value);
  }
  function updateProperty(name, value) {
    var n = document.querySelector('meta[property="' + name + '"]');
    if (n && value) n.setAttribute('content', value);
  }

  function applyHead(s) {
    var brand = String(s.brandName || s.appName || s.platformName || '').trim();
    var suffix = String(s.titleSuffix || s.tagline || '').trim();
    var title = String(s.siteTitle || (brand + (suffix ? ' - ' + suffix : ''))).trim();
    if (title) document.title = title;

    var logo = absoluteAssetUrl(s.logoUrl || s.logo || '');
    if (logo) {
      document.querySelectorAll('.logo-holder img.d-apollo-logo__image--uploaded,.logo-holder img:first-child,img[data-site-logo]').forEach(function (img) {
        if (img.classList && img.classList.contains('d-apollo-logo__image--branded')) return;
        if (img.src !== logo) img.src = logo;
      });
    }
    setFavicon(s.faviconUrl || s.favicon || '');
    updateMeta('title', title);
    updateMeta('description', s.description || '');
    updateMeta('theme-color', s.primaryColor || '');
    updateProperty('og:site_name', brand);
    updateProperty('og:title', title);
    updateProperty('og:description', s.description || '');
    if (s.primaryDomain) updateProperty('og:url', 'https://' + s.primaryDomain + '/');
  }

  function applyCss(s) {
    var primary = s.primaryColor || '#9d0698';
    var accent = s.accentColor || s.tabActiveColor || primary;
    var secondary = s.secondaryColor || '#0b0f19';
    var background = s.backgroundColor || '#0a0713';
    var text = s.textColor || s.text || s.tabLabelColor || '#e5e7eb';
    var tabActive = s.tabActiveColor || accent;
    var label = s.tabLabelColor || text;
    var login = s.loginButtonColor || primary;
    var loginText = s.loginTextColor || '#fff';
    var load = s.loadBotButtonColor || primary;
    var loadText = s.loadBotButtonTextColor || '#fff';
    var iconSize = Math.max(12, Math.min(48, Number(s.tabIconSize) || 24));
    var logoText = esc(s.brandName || s.appName || '');
    var font = String(s.fontFamily || 'Inter').replace(/["'\\;]/g, '');
    var loaderPrimary = s.loaderPrimaryColor || primary;
    var loaderAccent = s.loaderSecondaryColor || s.loaderAccentColor || accent;
    var loaderHighlight = s.loaderHighlightColor || accent;
    var loaderText = s.loaderTextColor || '#ffffff';
    var loaderImage = absoluteAssetUrl(String(s.loaderBackgroundImage || s.loaderBackgroundImageUrl || s.loaderImage || ''));
    var loaderBg = loaderPrimary === loaderAccent ? loaderPrimary : 'linear-gradient(135deg,' + loaderPrimary + ',' + loaderAccent + ')';
    var botBg = s.botCardStyle === 'card' ? 'linear-gradient(180deg,#f8fafc 0%,#e2e8f0 100%)' : s.botCardStyle === 'compact' ? secondary : s.botCardStyle === 'minimal' ? secondary : 'linear-gradient(135deg,' + secondary + ' 0%,' + primary + ' 48%,' + accent + ' 100%)';
    var style = document.getElementById(STYLE_ID);
    if (!style) { style = document.createElement('style'); style.id = STYLE_ID; document.head.appendChild(style); }
    style.textContent = ':root,body,.theme--dark,.theme--light{' +
      '--site-primary:' + primary + ';--site-accent:' + accent + ';--site-secondary:' + secondary + ';--site-background:' + background + ';--site-text:' + text + ';--site-tab-active:' + tabActive + ';--site-tab-label:' + label + ';--site-login:' + login + ';--site-login-text:' + loginText + ';--site-load:' + load + ';--site-load-text:' + loadText + ';--site-tab-icon-size:' + iconSize + 'px;' +
      '--button-primary-default:' + primary + ';--button-primary-hover:' + accent + ';--du-button-primary-default:' + primary + ';--du-button-primary-hover:' + accent + ';--du-color-blue-1:' + primary + ';--du-color-blue-2:' + accent + ';--du-text-blue:' + accent + ';--du-text-info:' + accent + ';--du-status-info:' + primary + ';--du-button-info-default:' + primary + ';' +
      'background-color:' + background + ';color:' + text + ';font-family:' + font + ',system-ui,sans-serif}' +
      'html,body{background-color:' + background + ' !important;color:' + text + ' !important}' +
      'body *{--site-primary:' + primary + ';--site-accent:' + accent + ';--site-secondary:' + secondary + ';--site-background:' + background + ';--site-text:' + text + '}' +
      '[role="tab"],.dc-tabs__item,[class*="tabs__item"],[class*="tab-item"]{color:#0f172a !important;-webkit-text-fill-color:#0f172a !important;font-weight:700 !important;cursor:pointer !important;user-select:none !important;-webkit-user-select:none !important;touch-action:manipulation !important}' +
      '[role="tab"] *,.dc-tabs__item *,[class*="tabs__item"] *{pointer-events:none !important;color:inherit !important;-webkit-text-fill-color:inherit !important;font-weight:inherit !important}' +
      '[role="tab"][aria-selected="true"],.dc-tabs__item--active,.dc-tabs__item.active,button[class*="tab"][class*="active"]{color:#020617 !important;-webkit-text-fill-color:#020617 !important;font-weight:800 !important;border-bottom:3px solid ' + tabActive + ' !important}' +
      '[role="tab"] svg,.dc-tabs__item svg{width:' + iconSize + 'px !important;height:' + iconSize + 'px !important}' +
      '.auth-actions button,.auth-actions__primary,.login-button,[class*="login"] button,[class*="sign-up"] button{background:' + login + ' !important;color:' + loginText + ' !important}' +
      '[class*="bot-list"] button,.bot-card button,.bot-list__card button,[class*="bot"] button[class*="load"]{background:' + load + ' !important;color:' + loadText + ' !important}' +
      '.bot-card,[class*="bot-list__card"]{background:' + botBg + ' !important}' +
      '.loaderx-root,.initial-loader,#hlx-loader{background:' + (loaderImage ? 'linear-gradient(135deg,rgba(10,7,19,.62),rgba(10,7,19,.88)),url("' + loaderImage.replace(/"/g, '\\"') + '") !important;background-size:cover !important;background-position:center !important;' : loaderBg + ' !important;') + '}' +
      (loaderImage ? '.loaderx-root{background-image:linear-gradient(135deg,rgba(10,7,19,0.72),rgba(10,7,19,0.85)),url("' + loaderImage.replace(/"/g, '\\"') + '") !important;background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important}' +
      '.loaderx-root--basic{background-image:linear-gradient(135deg,rgba(255,255,255,0.82),rgba(255,255,255,0.92)),url("' + loaderImage.replace(/"/g, '\\"') + '") !important;background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important}' +
      '.loaderx__panel,.loaderx__terminal,.loaderx__rings-card{background:rgba(2,6,16,0.65) !important;backdrop-filter:blur(8px) !important}' : '') +
      '.logo-holder::after{content:"' + logoText.replace(/"/g, '\\"') + '" !important;color:' + tabActive + ' !important}' +
      '.logo-holder .d-apollo-logo__image--branded,.logo-holder img ~ img{display:none !important}' +
      '.hlx-load-word em{color:' + accent + ' !important}.hlx-load-bar::before{background:linear-gradient(90deg,' + primary + ',' + accent + ',#c4a8ff) !important}' +
"/* SiteBuilder Bot Builder Theme Integration */#db-toolbar__get-started-button,.toolbar__btn--start,.quick-strategy__button,button[class*=\"quick-strategy\"]{background-color:" + tabActive + " !important;background:" + tabActive + " !important;border-color:" + tabActive + " !important;color:#ffffff !important}#db-toolbar__get-started-button *,.toolbar__btn--start *,.quick-strategy__button *,button[class*=\"quick-strategy\"] *{color:#ffffff !important;--text-color:#ffffff !important}.zelos-renderer.zelos_renderer-theme .blocklyTextRootBlockHeader,.blocklyTextRootBlockHeader{fill:#ffffff !important;color:#ffffff !important}g:not(.blocklyEditableText):not(.blocklyNonEditableText) > text.blocklyText:not(.blocklyTextRootBlockHeader){fill:#333333 !important}.theme--dark g.blocklyEditableText text,.theme--dark g.blocklyNonEditableText text,.theme--dark text.blocklyDropdownText,.theme--dark .blocklyDropdownText{fill:#ffffff !important;color:#ffffff !important}.theme--light g.blocklyEditableText text,.theme--light g.blocklyNonEditableText text,.theme--light text.blocklyDropdownText,.theme--light .blocklyDropdownText{fill:#182026 !important;color:#182026 !important}.theme--dark .bot-builder,.theme--dark .bot-builder__content,.theme--dark .bot-builder .injectionDiv,.theme--dark .bot-builder .blocklySvg,.theme--dark .main-container,.theme--dark .bot-builder-wrapper{background-color:#0e0e0e !important;color:#ffffff !important}.theme--light .bot-builder,.theme--light .bot-builder__content,.theme--light .bot-builder .injectionDiv,.theme--light .bot-builder .blocklySvg,.theme--light .main-container,.theme--light .bot-builder-wrapper{background-color:#ffffff !important;color:#182026 !important}.theme--dark .blocklyMainBackground,.theme--dark .zelos-renderer.zelos_renderer-theme .blocklyMainBackground,.theme--dark .load-strategy__container .blocklyMainBackground{fill:#0e0e0e !important;stroke:none !important}.theme--light .blocklyMainBackground,.theme--light .zelos-renderer.zelos_renderer-theme .blocklyMainBackground,.theme--light .load-strategy__container .blocklyMainBackground{fill:#ffffff !important;stroke:none !important}.theme--dark .zelos-renderer.zelos_renderer-theme rect.blocklyFieldRect.blocklyDropdownRect,.theme--dark .zelos-renderer.zelos_renderer-theme .blocklyNonEditableText>rect:not(.blocklyDropdownRect),.theme--dark .zelos-renderer.zelos_renderer-theme .blocklyEditableText>rect:not(.blocklyDropdownRect),.theme--dark rect.blocklyFieldRect{fill:#1d1f20 !important;stroke:#323738 !important;stroke-width:1px !important}.theme--light .zelos-renderer.zelos_renderer-theme rect.blocklyFieldRect.blocklyDropdownRect,.theme--light .zelos-renderer.zelos_renderer-theme .blocklyNonEditableText>rect:not(.blocklyDropdownRect),.theme--light .zelos-renderer.zelos_renderer-theme .blocklyEditableText>rect:not(.blocklyDropdownRect),.theme--light rect.blocklyFieldRect{fill:#ffffff !important;stroke:#d6dadb !important;stroke-width:1px !important}.theme--dark .bot-builder__sidebar,.theme--dark .db-toolbox,.theme--dark .db-flyout,.theme--dark .flyout{background-color:#151717 !important;color:#ffffff !important;border-right:1px solid #242828 !important;border-color:#242828 !important}.theme--dark .bot-builder__sidebar *,.theme--dark .db-toolbox *,.theme--dark .db-flyout *,.theme--dark .flyout *{color:#ffffff !important}.theme--dark .db-toolbox__title,.theme--dark .db-toolbox__category-name,.theme--dark .db-toolbox__item{color:#c2c2c2 !important}.theme--dark .db-toolbox__category--active,.theme--dark .db-toolbox__item:hover{background-color:#242828 !important;color:#ffffff !important}.theme--light .bot-builder__sidebar,.theme--light .db-toolbox,.theme--light .db-flyout,.theme--light .flyout{background-color:#ffffff !important;color:#182026 !important;border-right:1px solid #eaebec !important;border-color:#eaebec !important}.theme--light .bot-builder__sidebar *,.theme--light .db-toolbox *,.theme--light .db-flyout *,.theme--light .flyout *{color:#182026 !important}.theme--light .db-toolbox__title,.theme--light .db-toolbox__category-name,.theme--light .db-toolbox__item{color:#182026 !important}.theme--light .db-toolbox__category--active,.theme--light .db-toolbox__item:hover{background-color:#e6f0ff !important;color:#002bba !important}.theme--dark .blocklyDropDownDiv{background-color:#151717 !important;border:1px solid #323738 !important;box-shadow:0 4px 16px rgba(0,0,0,0.5) !important}.theme--dark .blocklyDropDownDiv *{color:#ffffff !important}.theme--dark .blocklyWidgetDiv .goog-menu{background:#151717 !important;border:1px solid #323738 !important}.theme--dark .blocklyWidgetDiv .goog-menuitem{color:#c2c2c2 !important}.theme--dark .blocklyWidgetDiv .goog-menuitem-highlight{background-color:#242828 !important;color:#ffffff !important}.theme--light .blocklyDropDownDiv{background-color:#ffffff !important;border:1px solid #d6dadb !important;box-shadow:0 4px 16px rgba(0,0,0,0.12) !important}.theme--light .blocklyDropDownDiv *{color:#182026 !important}.theme--light .blocklyWidgetDiv .goog-menu{background:#ffffff !important;border:1px solid #d6dadb !important}.theme--light .blocklyWidgetDiv .goog-menuitem{color:#182026 !important}.theme--light .blocklyWidgetDiv .goog-menuitem-highlight{background-color:#e6f0ff !important;color:#002bba !important}.theme--dark .quick-strategy,.theme--dark .quick-strategy__container,.theme--dark [class*=\"quick-strategy\"],.theme--dark .qs,.theme--dark .qs__body,.theme--dark .qs__header,.theme--dark .qs__footer,.theme--dark .load-strategy__container,.theme--dark .dc-modal__container,.theme--dark .dc-dialog__content,.theme--dark .dc-modal__header,.theme--dark .dc-modal__footer{background-color:#0e0e0e !important;color:#ffffff !important;border-color:#242828 !important}.theme--dark .qs__tabs,.theme--dark [class*=\"quick-strategy\"] [role=\"tablist\"],.theme--dark .dc-tabs{background-color:#151717 !important;border-color:#242828 !important}.theme--dark .animation__wrapper,.theme--dark .controls__animation{background-color:#0e0e0e !important;border-top:1px solid #242828 !important;color:#ffffff !important}.theme--dark .animation__container{background-color:#0e0e0e !important;color:#ffffff !important}.theme--dark .animation__text{color:#c2c2c2 !important}.theme--dark .animation__progress-line{background-color:#242828 !important}.theme--dark .static-circle{border-color:#323738 !important}.theme--light .animation__wrapper,.theme--light .controls__animation{background-color:#f8fafc !important;border-top:1px solid #eaebec !important;color:#182026 !important}.theme--light .animation__container{background-color:#f8fafc !important;color:#182026 !important}.theme--light .animation__text{color:#182026 !important}.theme--light .animation__progress-line{background-color:#eaebec !important}.theme--light .static-circle{border-color:#d6dadb !important}.theme--dark .bot-builder input,.theme--dark .bot-builder select,.theme--dark .bot-builder textarea,.theme--dark .flyout input,.theme--dark .db-toolbox input,.theme--dark .dc-modal input,.theme--dark .dc-modal select,.theme--dark .dc-input__field{background-color:#151717 !important;color:#ffffff !important;border-color:#323738 !important}.theme--dark .dc-checkbox__box{border-color:#5c5c5c !important;background-color:#151717 !important}.theme--dark .dc-checkbox__box--active{background-color:#00a79e !important;border-color:#00a79e !important}.theme--dark .dc-btn--secondary{background:transparent !important;color:#ffffff !important;border-color:#5c5c5c !important}.theme--light .bot-builder input,.theme--light .bot-builder select,.theme--light .bot-builder textarea,.theme--light .flyout input,.theme--light .db-toolbox input,.theme--light .dc-modal input,.theme--light .dc-modal select,.theme--light .dc-input__field{background-color:#ffffff !important;color:#182026 !important;border-color:#d6dadb !important}.theme--dark html,.theme--dark body{background-color:#0e0e0e !important;color:#ffffff !important}.theme--light html,.theme--light body{background-color:#ffffff !important;color:#182026 !important}" +

      '/* Original Deposit Button Appearance */' +
      '.app-header__cashier-button.deposit-button{display:inline-flex !important;align-items:center !important;justify-content:center !important;background:linear-gradient(135deg,#7c3aed 0%,#6366f1 100%) !important;color:#ffffff !important;border:1px solid rgba(255,255,255,0.22) !important;border-radius:9999px !important;height:32px !important;min-width:104px !important;padding:0 12px !important;box-shadow:0 2px 10px rgba(124,58,237,0.42),0 0 0 1px rgba(255,255,255,0.15) inset !important;cursor:pointer !important;overflow:hidden !important;position:relative !important;transition:transform 0.18s ease,box-shadow 0.18s ease,filter 0.18s ease !important;user-select:none !important;vertical-align:middle !important;font-family:inherit !important;font-size:13px !important;font-weight:600 !important;line-height:1 !important;margin-right:8px !important}.app-header__cashier-button.deposit-button:hover{transform:translateY(-1px) !important;box-shadow:0 4px 14px rgba(124,58,237,0.58),0 0 0 1px rgba(255,255,255,0.25) inset !important;filter:brightness(1.08) !important}.app-header__cashier-button.deposit-button:active{transform:translateY(0) !important;box-shadow:0 1px 6px rgba(124,58,237,0.35) !important}';
  }

  function tabElements() { return Array.prototype.slice.call(document.querySelectorAll('[role="tab"],.dc-tabs__item')); }
  function tabIdFromElement(el, tabs) {
    var href = (el.getAttribute('href') || el.getAttribute('data-route') || el.getAttribute('data-tab-id') || '').toLowerCase();
    for (var i = 0; i < tabs.length; i++) if (href.indexOf(String(tabs[i].id).toLowerCase()) !== -1) return tabs[i].id;
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    for (var j = 0; j < tabs.length; j++) if (text === String(tabs[j].label || '').trim().toLowerCase()) return tabs[j].id;
    return '';
  }
  function applyTabs(s) {
    var tabs = Array.isArray(s.tabs) ? s.tabs.slice() : [];
    if (!tabs.length) return;
    var byId = {};
    tabs.forEach(function (t, i) { byId[t.id] = Object.assign({}, t, { __order: i }); });
    tabElements().forEach(function (el) {
      var id = tabIdFromElement(el, tabs); if (!id || !byId[id]) return;
      var tab = byId[id];
      var targetDisplay = tab.visible === false ? 'none' : '';
      if (el.style.display !== targetDisplay) el.style.display = targetDisplay;
      if (el.getAttribute('data-sitebuilder-tab-id') !== id) el.setAttribute('data-sitebuilder-tab-id', id);
    });
  }
  function applyBots(s) {
    var bots = Array.isArray(s.bots) ? s.bots.slice().sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); }) : [];
    if (!bots.length) return;
    document.querySelectorAll('.bot-card,[class*="bot-list__card"],[data-bot-id]').forEach(function (card) {
      var id = card.getAttribute('data-bot-id') || card.getAttribute('data-id') || '', match = bots.find(function (b) { return String(b.id) === String(id) || String(b.storageFileId || '') === String(id); });
      if (!match) { var text = (card.textContent || '').toLowerCase(); match = bots.find(function (b) { return text.indexOf(String(b.name || b.displayName || '').toLowerCase()) !== -1; }); }
      if (!match) return;
      card.setAttribute('data-sitebuilder-bot-id', match.id);
      var title = card.querySelector('h1,h2,h3,h4,[class*="title"],[class*="name"]'); if (title && match.name) title.textContent = match.name;
      var desc = card.querySelector('p,[class*="description"]'); if (desc && match.description) desc.textContent = match.description;
    });
  }
  function applyLinks(s) {
    var links = { whatsapp:s.socialWhatsapp || '', telegram:s.socialTelegram || '', instagram:s.socialInstagram || '', facebook:s.socialFacebook || '', youtube:s.socialYoutube || '', tiktok:s.socialTiktok || '', website:s.socialWebsite || '', signup:s.signupUrl || s.referralUrl || '' };
    var selectors = { whatsapp:'[aria-label*="WhatsApp" i],a[href*="wa.me"],a[href*="whatsapp"]', telegram:'[aria-label*="Telegram" i],a[href*="t.me"]', instagram:'[aria-label*="Instagram" i],a[href*="instagram.com"]', facebook:'[aria-label*="Facebook" i],a[href*="facebook.com"]', youtube:'[aria-label*="YouTube" i],a[href*="youtube.com"]', tiktok:'[aria-label*="TikTok" i],a[href*="tiktok.com"]', website:'[aria-label*="Website" i]', signup:'[class*="sign-up"] a,[class*="signup"] a,a[href*="signup"]' };
    Object.keys(links).forEach(function (key) { if (!links[key]) return; document.querySelectorAll(selectors[key]).forEach(function (el) { el.href = links[key]; }); });
  }
  function applyLoader(s) {
    var staticLoader = document.getElementById('hlx-loader');
    if (staticLoader && staticLoader.parentNode) staticLoader.parentNode.removeChild(staticLoader);
    // Never call removeChild on React-managed nodes (.loaderx-root) as that breaks React reconciler.
    // Instead, if still visible after 6 seconds, safely hide via CSS.
    setTimeout(function () {
      var loaders = document.querySelectorAll('.loaderx-root, .initial-loader');
      loaders.forEach(function (el) {
        if (el) {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
        }
      });
    }, 6000);
  }
  function rewriteLegacyBranding(s) {
    var brand = String(s.brandName || s.appName || ''), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) { var v = n.nodeValue; if (!v) continue; if (/\b(D[-‑]?Bot|Binary[Tt]ool)\b/g.test(v)) v = v.replace(/\b(D[-‑]?Bot|Binary[Tt]ool)\b/g, brand); if (/Trader\s*Mike/gi.test(v)) v = v.replace(/Trader\s*Mike/gi, brand); if (v !== n.nodeValue) n.nodeValue = v; }
    document.querySelectorAll('h1,h2,h3,[class*="title"],[class*="heading"]').forEach(function (el) { var txt = (el.textContent || '').trim(); if (/analysis\s?tool|binarytool/i.test(txt) && txt.length < 60) { el.style.color = s.accentColor || s.tabActiveColor || '#9d6ef0'; el.style.textShadow = '0 0 14px rgba(114,62,195,.5)'; } });
  }

  function patchDerivNetwork(s) {
    var rawAppId = (s && (s.derivAppId || s.legacyAppId || s.appId)) || (typeof window !== 'undefined' ? window.__DERIV_APP_ID__ : '') || '';
    var appId = (/^\d{1,8}$/.test(rawAppId) && Number(rawAppId) > 0) ? rawAppId : '1089';
    try {
      localStorage.removeItem('config.new_app_id');
      localStorage.removeItem('config.oauth_client_id');
      localStorage.setItem('config.app_id', appId);
      localStorage.setItem('config.legacy_app_id', appId);
    } catch (e) {}
    if (window.__SITEBUILDER_DERIV_NETWORK_PATCHED__) return;
    window.__SITEBUILDER_DERIV_NETWORK_PATCHED__ = true;

    var NativeWebSocket = window.WebSocket;
    function patchedUrl(value) {
      var raw = String(value || '');
      if (!raw) return raw;
      return raw.replace(/([?&]app_id=)[^&]+/g, '$1' + encodeURIComponent(appId));
    }
    try {
      function SiteBuilderWebSocket(url, protocols) {
        var args = Array.prototype.slice.call(arguments);
        args[0] = patchedUrl(args[0]);
        return protocols === undefined ? new NativeWebSocket(args[0]) : new NativeWebSocket(args[0], protocols);
      }
      SiteBuilderWebSocket.prototype = NativeWebSocket.prototype;
      SiteBuilderWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
      SiteBuilderWebSocket.OPEN = NativeWebSocket.OPEN;
      SiteBuilderWebSocket.CLOSING = NativeWebSocket.CLOSING;
      SiteBuilderWebSocket.CLOSED = NativeWebSocket.CLOSED;
      window.WebSocket = SiteBuilderWebSocket;
    } catch (e) {}

    var originalFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        if (typeof input === 'string') input = patchedUrl(input);
        else if (input && input.url) input = new Request(patchedUrl(input.url), input);
      } catch (e) {}
      return originalFetch.call(this, input, init);
    };
  }
  try { patchDerivNetwork({ derivAppId: (typeof window !== 'undefined' && window.__DERIV_APP_ID__) || '' }); } catch (e) {}

  function apply(s) {
    state.settings = s;
    applyHead(s);
    applyCss(s);
    applyLoader(s);
    applyTabs(s);
    applyBots(s);
    applyLinks(s);
    rewriteLegacyBranding(s);
    patchDerivNetwork(s);
    window.__DERIV_SITE_SETTINGS__ = s;
  }

  function syncExistingTheme() {
    try {
      var storedTheme = localStorage.getItem('theme');
      var isDark = storedTheme === 'dark';
      if (!storedTheme && document.body) {
        isDark = document.body.classList.contains('theme--dark');
      }
      var targetClass = isDark ? 'theme--dark' : 'theme--light';
      var removeClass = isDark ? 'theme--light' : 'theme--dark';
      [document.documentElement, document.body].forEach(function (el) {
        if (!el) return;
        if (!el.classList.contains(targetClass)) el.classList.add(targetClass);
        if (el.classList.contains(removeClass)) el.classList.remove(removeClass);
      });
    } catch (_) {}
  }

  function observe() {
    if (!window.MutationObserver || !document.body) return;
    var timer = null;
    var observer = new MutationObserver(function () {
      syncExistingTheme();
      if (!state.settings) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        applyHead(state.settings);
        applyCss(state.settings);
        applyTabs(state.settings);
        applyBots(state.settings);
      }, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    try {
      new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].attributeName === 'class') {
            if (document.body.classList.contains('theme--dark') && localStorage.getItem('theme') !== 'dark') {
              try { localStorage.setItem('theme', 'dark'); } catch (_) {}
            } else if (document.body.classList.contains('theme--light') && localStorage.getItem('theme') !== 'light') {
              try { localStorage.setItem('theme', 'light'); } catch (_) {}
            }
            syncExistingTheme();
            break;
          }
        }
      }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (_) {}
  }

  function start() {
    syncExistingTheme();
    getSettings().then(function (settings) {
      if (settings && settings.suspended) {
        renderSuspendedScreen();
        return;
      }
      apply(settings);
      syncExistingTheme();
      observe();
    }).catch(function (err) {
      console.warn('[SiteBuilder runtime settings]', err && err.message ? err.message : err);
    });
  }
  syncExistingTheme();
  window.addEventListener('hashchange', syncExistingTheme);
  window.addEventListener('storage', function (e) {
    if (e.key === 'theme') syncExistingTheme();
  });
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target) return;
    if (target.closest && (target.closest('[data-testid="dt_menu_item"]') || target.closest('.mobile-menu') || target.closest('.app-header__menu'))) {
      setTimeout(syncExistingTheme, 50);
      setTimeout(syncExistingTheme, 250);
    }
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* SITEBUILDER_ACTION_CYCLER_STYLES */
(function () {
  if (typeof document === 'undefined') return;
  function inject() {
    if (document.getElementById('sitebuilder-action-cycler-styles')) return;
    var style = document.createElement('style');
    style.id = 'sitebuilder-action-cycler-styles';
    style.textContent = "\n  /* Header Action Cycler Button Styling */\n  .app-header__action-cycler-btn,\n  .app-header__cashier-button {\n    display: inline-flex !important;\n    align-items: center !important;\n    justify-content: center !important;\n    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%) !important;\n    color: #ffffff !important;\n    border: 1px solid rgba(255, 255, 255, 0.22) !important;\n    border-radius: 9999px !important;\n    height: 32px !important;\n    min-width: 104px !important;\n    padding: 0 12px !important;\n    box-shadow: 0 2px 10px rgba(124, 58, 237, 0.42), 0 0 0 1px rgba(255, 255, 255, 0.15) inset !important;\n    cursor: pointer !important;\n    overflow: hidden !important;\n    position: relative !important;\n    transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease !important;\n    user-select: none !important;\n    vertical-align: middle !important;\n    font-family: inherit !important;\n    font-size: 13px !important;\n    font-weight: 600 !important;\n    line-height: 1 !important;\n    margin-right: 8px !important;\n  }\n  .app-header__action-cycler-btn:hover,\n  .app-header__cashier-button:hover {\n    transform: translateY(-1px) !important;\n    box-shadow: 0 4px 14px rgba(124, 58, 237, 0.58), 0 0 0 1px rgba(255, 255, 255, 0.25) inset !important;\n    filter: brightness(1.08) !important;\n  }\n  .app-header__action-cycler-btn:active,\n  .app-header__cashier-button:active {\n    transform: translateY(0) !important;\n    box-shadow: 0 1px 6px rgba(124, 58, 237, 0.35) !important;\n  }\n  .app-header__action-cycler-content {\n    display: inline-flex !important;\n    align-items: center !important;\n    justify-content: center !important;\n    gap: 5px !important;\n    color: #ffffff !important;\n    white-space: nowrap !important;\n    animation: hlx-action-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;\n  }\n  .app-header__action-cycler-icon {\n    display: inline-flex !important;\n    align-items: center !important;\n    justify-content: center !important;\n    width: 13px !important;\n    height: 13px !important;\n    flex-shrink: 0 !important;\n  }\n  @keyframes hlx-action-slide-in {\n    0% {\n      opacity: 0;\n      transform: translateY(7px);\n    }\n    100% {\n      opacity: 1;\n      transform: translateY(0);\n    }\n  }\n";
    if (document.head) document.head.appendChild(style);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();

/* SITEBUILDER_PUBLIC_AUTH_MARKET_RUNTIME_V4 */
(function(){
  'use strict';
  if (window.__SITEBUILDER_PUBLIC_AUTH_MARKET_RUNTIME_V4__) return;
  window.__SITEBUILDER_PUBLIC_AUTH_MARKET_RUNTIME_V4__ = true;
  var AUTH_LABELS = {login:'Login',signup:'Sign Up'};
  var publicSettings = null;
  var isRepairing = false;
  var observerTimer = null;

  function hexToRgb(hex){
    if(!hex||typeof hex!=='string')return '';
    var clean=hex.trim().replace(/^#/,'');
    if(clean.length===3)clean=clean[0]+clean[0]+clean[1]+clean[1]+clean[2]+clean[2];
    if(clean.length===6){
      var r=parseInt(clean.slice(0,2),16),g=parseInt(clean.slice(2,4),16),b=parseInt(clean.slice(4,6),16);
      if(!isNaN(r)&&!isNaN(g)&&!isNaN(b))return 'rgb('+r+', '+g+', '+b+')';
    }
    return hex.toLowerCase();
  }

  function text(el){ return String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g,' ').trim(); }
  function hint(el){ return String([text(el), el && el.getAttribute('aria-label'), el && el.getAttribute('title'), el && el.getAttribute('data-testid'), el && el.getAttribute('name'), el && el.className].join(' ')).toLowerCase(); }
  function isApiToken(el){ var t=text(el); return !!t && t.length < 48 && /api\s*token/i.test(t); }
  function copyTypography(target, source){ if(!target || !source) return; var s=window.getComputedStyle(source); ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textTransform'].forEach(function(p){ try{ target.style.setProperty(p,s.getPropertyValue(p),'important'); }catch(_){} }); }
  function paint(el,color){
    if(!el)return;
    ['color','--text-color','--text-general','--text-prominent','--text-primary','--text-default'].forEach(function(p){ el.style.setProperty(p,color,'important'); });
    el.style.setProperty('opacity','1','important');
    el.style.setProperty('visibility','visible','important');
    el.style.setProperty('-webkit-text-fill-color',color,'important');
    el.querySelectorAll('span,label,strong,b,em,i').forEach(function(n){ n.style.setProperty('color',color,'important'); n.style.setProperty('-webkit-text-fill-color',color,'important'); n.style.setProperty('opacity','1','important'); n.style.setProperty('visibility','visible','important'); });
  }
  function ensureLabel(button,key,color,sample){
    var label=AUTH_LABELS[key], re=key==='login'?/log\s*in|login/i:/sign\s*up|signup/i;
    var existing=Array.prototype.find.call(button.querySelectorAll('span,label,strong,b,em'),function(n){return re.test(text(n));});
    if(existing){ existing.textContent=label; copyTypography(existing,sample); paint(existing,color); return; }
    var node=document.createElement('span');
    node.setAttribute('data-sitebuilder-auth-label',key);
    node.textContent=label;
    copyTypography(node,sample);
    node.style.setProperty('display','inline-block','important');
    node.style.setProperty('color',color,'important');
    node.style.setProperty('-webkit-text-fill-color',color,'important');
    node.style.setProperty('opacity','1','important');
    node.style.setProperty('visibility','visible','important');
    node.style.setProperty('text-shadow','none','important');
    button.appendChild(node);
    paint(button,color);
  }
  function findSample(){
    return Array.prototype.find.call(document.querySelectorAll('button,a,[role="button"],span,label'),function(el){return isApiToken(el);}) || null;
  }
  function likelyAuth(el,color){
    var h=hint(el);
    if(/log\s*in|login|sign\s*up|signup/.test(h))return true;
    var bg=window.getComputedStyle(el).backgroundColor;
    if(!bg||bg==='transparent'||bg==='rgba(0, 0, 0, 0)')return false;
    var target=hexToRgb(color);
    return !!target && (bg===target || bg.replace(/\s+/g,'')===target.replace(/\s+/g,''));
  }
  function findButtons(settings){
    var color=String((settings&&settings.loginButtonColor)||'').trim();
    var roots=Array.prototype.slice.call(document.querySelectorAll('.auth-actions,.auth-actions__container,[class*="auth-actions"],[data-testid*="auth" i]'));
    var sample=findSample(), ancestor=sample&&sample.parentElement;
    if(!roots.length && ancestor){ for(var i=0;ancestor&&i<7;i++,ancestor=ancestor.parentElement){ if(ancestor.querySelectorAll('button,a,[role="button"]').length>=2){ roots=[ancestor]; break; } } }
    var candidates=[];
    roots.forEach(function(root){ Array.prototype.forEach.call(root.querySelectorAll('button,a,[role="button"]'),function(el){ if(!isApiToken(el)&&candidates.indexOf(el)<0)candidates.push(el); }); });
    var likely=candidates.filter(function(el){return likelyAuth(el,color);});
    if(likely.length>=2)candidates=likely;
    var login=candidates.find(function(el){return /log\s*in|login/.test(hint(el));})||candidates[0]||null;
    var signup=candidates.find(function(el){return /sign\s*up|signup/.test(hint(el));})||candidates.find(function(el){return el!==login;})||null;
    return {login:login,signup:signup,sample:sample};
  }
  function repairAuth(settings){
    if(isRepairing)return false;
    isRepairing=true;
    try{
      var s=settings||publicSettings||{}; var color=String(s.loginTextColor||'#ffffff').trim()||'#ffffff'; var found=findButtons(s);
      if(!found.login||!found.signup)return false;
      ensureLabel(found.login,'login',color,found.sample); ensureLabel(found.signup,'signup',color,found.sample); paint(found.login,color); paint(found.signup,color); return true;
    }finally{
      isRepairing=false;
    }
  }
  function loadSettings(){
    var host=encodeURIComponent(window.location.hostname||'');
    return fetch('/api/appwrite/site-settings?hostname='+host,{cache:'no-store',headers:{Accept:'application/json'}})
      .then(function(r){if(!r.ok)throw new Error('settings '+r.status);return r.json();})
      .then(function(payload){var site=payload&&payload.site||{};var merged=Object.assign({},site);var raw=site.settingsJson;if(typeof raw==='string'){try{raw=JSON.parse(raw)||{};}catch(_){raw={};}}Object.assign(merged,raw||{});publicSettings=merged;window.__SITEBUILDER_SETTINGS__=merged;return merged;})
      .catch(function(){return publicSettings||window.__SITEBUILDER_SETTINGS__||{};});
  }
  function getWebpackRequire(){
    var req=null; try{var chunk=self.webpackChunkbot;if(!chunk||typeof chunk.push!=='function')return null;chunk.push([[Date.now()],{},function(r){req=r;}]);}catch(_){} return req;
  }
  function findApiBase(req){
    if(!req)return null; var ids=[]; try{ids=Object.keys(req.m||{});}catch(_){}
    for(var i=0;i<ids.length;i++){var id=ids[i],factory=req.m&&req.m[id];if(!factory)continue;var src='';try{src=Function.prototype.toString.call(factory);}catch(_){} if(!/(api_base|generateDerivApiInstance|ApiHelpers)/.test(src))continue;try{var mod=req(id);if(mod&&mod.api_base&&typeof mod.api_base.init==='function')return mod.api_base;if(mod&&mod.default&&typeof mod.default.init==='function'&&('api' in mod.default||'init' in mod.default))return mod.default;}catch(_){}}
    try{var cacheIds=Object.keys(req.c||{});for(var j=0;j<cacheIds.length;j++){var exp=req.c[cacheIds[j]]&&req.c[cacheIds[j]].exports;if(exp&&exp.api_base&&typeof exp.api_base.init==='function')return exp.api_base;if(exp&&exp.default&&typeof exp.default.init==='function'&&('api' in exp.default||'init' in exp.default))return exp.default;}}catch(_){ }
    return null;
  }
  function isLoggedIn(){try{if(sessionStorage.getItem('auth_info'))return true;}catch(_){} try{if(localStorage.getItem('active_loginid'))return true;}catch(_){} return false;}

  /* ── Public-mode market data → Blockly workspace refresh ─────────────── */
  var _publicSymbolsFetched = false;
  var _blocklyRefreshTimer = null;
  var _blocklyRefreshAttempts = 0;

  function findApiHelpers(req){
    if(!req)return null;
    var ids=[];try{ids=Object.keys(req.m||{});}catch(_){}
    for(var i=0;i<ids.length;i++){
      var id=ids[i],factory=req.m&&req.m[id];if(!factory)continue;
      var src='';try{src=Function.prototype.toString.call(factory);}catch(_){}
      if(!/(ApiHelpers|active_symbols|setInstance)/.test(src))continue;
      try{
        var mod=req(id);
        if(mod&&mod.ApiHelpers&&typeof mod.ApiHelpers.setInstance==='function')return mod.ApiHelpers;
        if(mod&&mod.default&&typeof mod.default.setInstance==='function')return mod.default;
      }catch(_){}
    }
    try{
      var cids=Object.keys(req.c||{});
      for(var j=0;j<cids.length;j++){
        var exp=req.c[cids[j]]&&req.c[cids[j]].exports;
        if(exp&&exp.ApiHelpers&&typeof exp.ApiHelpers.setInstance==='function')return exp.ApiHelpers;
        if(exp&&exp.default&&typeof exp.default.setInstance==='function')return exp.default;
      }
    }catch(_){}
    return null;
  }

  function refreshBlocklyMarketFields(as,cf){
    try{
      var workspace=window.Blockly&&(window.Blockly.derivWorkspace||window.Blockly.getMainWorkspace&&window.Blockly.getMainWorkspace());
      if(!workspace)return false;
      var blocks=workspace.getAllBlocks();
      if(!blocks||!blocks.length)return false;

      var marketOpts=[];var submarketOpts=[];var symbolOpts=[];
      try{marketOpts=as.getMarketDropdownOptions();}catch(_){}
      try{submarketOpts=as.getSubmarketDropdownOptions('synthetic_index');}catch(_){}
      try{
        var symMap=as.getSymbolsForV2?as.getSymbolsForV2():null;
        if(!symMap)symbolOpts=as.getSymbolDropdownOptions('random_index');
        else{var k=Object.keys(symMap);if(k.length)symbolOpts=k.map(function(s){return[symMap[s]||s,s];});}
      }catch(_){}

      if(!marketOpts.length&&!symbolOpts.length)return false;

      blocks.forEach(function(b){
        try{
          if(b.type==='trade_definition_market'){
            var mf=b.getField('MARKET_LIST');
            var sf2=b.getField('SUBMARKET_LIST');
            var sym=b.getField('SYMBOL_LIST');
            if(mf&&marketOpts.length)mf.updateOptions(marketOpts,{default_value:marketOpts[0][1]});
            if(sf2&&submarketOpts.length)sf2.updateOptions(submarketOpts,{default_value:submarketOpts[0][1]});
            if(sym&&symbolOpts.length)sym.updateOptions(symbolOpts,{default_value:symbolOpts[0][1]});
          }
        }catch(_){}
      });
      return true;
    }catch(_){return false;}
  }

  function scheduleBlocklyRefresh(as,cf){
    if(_blocklyRefreshTimer)return;
    _blocklyRefreshTimer=setInterval(function(){
      _blocklyRefreshAttempts++;
      var done=refreshBlocklyMarketFields(as,cf);
      if(done||_blocklyRefreshAttempts>=30){clearInterval(_blocklyRefreshTimer);_blocklyRefreshTimer=null;}
    },500);
  }

  function retrievePublicSymbols(){
    if(_publicSymbolsFetched||isLoggedIn())return;
    var req=getWebpackRequire();if(!req)return;
    var AH=findApiHelpers(req);if(!AH)return;
    var instance=AH.instance;if(!instance){
      try{
        var ab=findApiBase(req);
        if(ab&&ab.api)AH.setInstance({server_time:{get:function(){return Math.floor(Date.now()/1000);}},ws:ab.api});
        instance=AH.instance;
      }catch(_){}
    }
    if(!instance)return;
    var as=instance.active_symbols;var cf=instance.contracts_for;
    if(!as||typeof as.retrieveActiveSymbols!=='function')return;
    _publicSymbolsFetched=true;
    Promise.resolve(as.retrieveActiveSymbols(true)).then(function(){
      scheduleBlocklyRefresh(as,cf);
    }).catch(function(err){
      _publicSymbolsFetched=false;
      console.warn('[SiteBuilder] retrieveActiveSymbols failed:',err&&err.message||err);
    });
  }

  function bootstrapPublicApi(){
    if(window.__SITEBUILDER_PUBLIC_API_INIT_STARTED__||isLoggedIn())return false;
    var req=getWebpackRequire(); if(!req)return false; var apiBase=findApiBase(req); if(!apiBase)return false;
    window.__SITEBUILDER_PUBLIC_API_INIT_STARTED__=true;
    try{
      Promise.resolve(apiBase.init(false)).then(function(){
        window.dispatchEvent(new CustomEvent('sitebuilder-public-api-ready'));
        retrievePublicSymbols();
      }).catch(function(err){
        window.__SITEBUILDER_PUBLIC_API_INIT_STARTED__=false;
        console.warn('[SiteBuilder] public market-data init failed:',err&&err.message||err);
      });
    }catch(err){
      window.__SITEBUILDER_PUBLIC_API_INIT_STARTED__=false;
      console.warn('[SiteBuilder] public market-data init failed:',err&&err.message||err);
    }
    return true;
  }
  window.addEventListener('sitebuilder-public-api-ready',function(){retrievePublicSymbols();});

  function tick(){repairAuth(publicSettings||{});bootstrapPublicApi();}
  function run(){loadSettings().then(function(){tick();var tries=0,t=setInterval(function(){tick();if(++tries>=40)clearInterval(t);},500);});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  window.addEventListener('load',run);
  try{
    new MutationObserver(function(){
      if(isRepairing||observerTimer)return;
      observerTimer=setTimeout(function(){
        observerTimer=null;
        repairAuth(publicSettings||{});
      },400);
    }).observe(document.documentElement,{childList:true,subtree:true});
  }catch(_){ }
})();
