const express = require('express');
const path = require('path');
const fs = require('fs');
const BRAND = require('./brand.config');
const app = express();
const PORT = process.env.PORT || 3001;

// ─── TEMPLATE TOKEN RENDERING ────────────────────────────────────────────────
// index.html / manifest.json ship with %%TOKEN%% placeholders instead of
// hardcoded brand strings. Fill them in from brand.config.js on every request
// (cheap — these are small files) so editing brand.config.js is enough to
// re-skin the whole app; no rebuild step needed.
function darken(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
const TOKENS = {
  '%%APP_NAME%%': BRAND.appName,
  '%%LOGO_TEXT_MAIN%%': BRAND.logoTextMain,
  '%%LOGO_TEXT_ACCENT%%': BRAND.logoTextAccent,
  '%%TAGLINE%%': BRAND.tagline,
  '%%DESCRIPTION%%': BRAND.description,
  '%%PRIMARY_DOMAIN%%': BRAND.primaryDomain,
  '%%ALLOWED_DOMAINS_JSON%%': JSON.stringify(BRAND.allowedDomains),
  '%%PRIMARY_COLOR%%': BRAND.primaryColor,
  '%%PRIMARY_COLOR_DARK%%': darken(BRAND.primaryColor, 0x20),
  '%%ACCENT_COLOR%%': BRAND.accentColor,
  '%%SECONDARY_COLOR%%': BRAND.secondaryColor,
  '%%BACKGROUND_COLOR%%': BRAND.backgroundColor,
  '%%FONT_FAMILY%%': `'${BRAND.fontFamily}'`,
  '%%FONT_GOOGLE_PARAM%%': BRAND.fontGoogleParam,
  '%%DERIV_APP_ID%%': BRAND.derivAppId,
  '%%OAUTH_REDIRECT_URI%%': (BRAND.oauthRedirectUrl || BRAND.oauthRedirectUri || `https://${BRAND.primaryDomain}`).replace(/\/+$/, ''),
};
function renderTemplate(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  for (const [token, value] of Object.entries(TOKENS)) s = s.split(token).join(value);
  return s;
}

// ─── SECURITY / ANTI-CLONE HEADERS ───────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

function noCache(res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

// ─── SITE CONFIG (sourced from brand.config.js) ──────────────────────────────
// The app build configures itself entirely from /api/appwrite/site-settings:
// branding, theme colours, tab list, referral link, loader styles, and Deriv OAuth IDs.
const DERIV_CLIENT_ID = BRAND.derivAppId;

const socialLinksObj = BRAND.socialLinks || {};
const socialLinksMap = {
  socialWhatsapp: socialLinksObj.whatsapp || '',
  socialWhatsapp2: socialLinksObj.whatsapp2 || '',
  socialTelegram: socialLinksObj.telegram || '',
  socialInstagram: socialLinksObj.instagram || '',
  socialFacebook: socialLinksObj.facebook || '',
  socialYoutube: socialLinksObj.youtube || '',
  socialTiktok: socialLinksObj.tiktok || '',
  socialWebsite: socialLinksObj.website || ''
};

// Marketing Simulation profile configuration (ROT login ID & starting balance)
const marketingAccount = BRAND.rot ? [{
  id: BRAND.rot,
  rot: BRAND.rot,
  loginid: BRAND.rot,
  currency: BRAND.currency || 'USD',
  startingBalance: Number(BRAND.startingBalance || 100.00),
  currentBalance: Number(BRAND.startingBalance || 100.00),
  accuracy: Number(BRAND.accuracy !== undefined ? BRAND.accuracy : 85.0),
  active: true,
  mode: BRAND.mode || 'simulation'
}] : [];

const HLX_SETTINGS = {
  brandName: BRAND.brandName || BRAND.appName,
  platformName: BRAND.appName,
  siteTitle: `${BRAND.appName} — ${BRAND.titleSuffix || BRAND.tagline}`,
  logoUrl: BRAND.logo || '/assets/media/logo.png',
  logoFileId: '',
  faviconUrl: BRAND.favicon || '/assets/media/favicon.png?v=bh2',
  faviconFileId: '',

  // ── Deriv OAuth ── newAppId present ⇒ PKCE flow
  newAppId: DERIV_CLIENT_ID,
  oauthClientId: DERIV_CLIENT_ID,
  appId: /^\d+$/.test(DERIV_CLIENT_ID) ? DERIV_CLIENT_ID : '1089',
  derivAppId: DERIV_CLIENT_ID,
  legacyAppId: /^\d+$/.test(DERIV_CLIENT_ID) ? DERIV_CLIENT_ID : '1089',
  oauthRedirectUrl: (BRAND.oauthRedirectUrl || BRAND.oauthRedirectUri || `https://${BRAND.primaryDomain}`).replace(/\/+$/, ''),
  redirectUri: (BRAND.oauthRedirectUrl || BRAND.oauthRedirectUri || `https://${BRAND.primaryDomain}`).replace(/\/+$/, ''),
  app_markup_percentage: Number(BRAND.app_markup_percentage || BRAND.appMarkupPercentage || 0),
  appMarkupPercentage: Number(BRAND.app_markup_percentage || BRAND.appMarkupPercentage || 0),
  accuracy: Number(BRAND.accuracy !== undefined ? BRAND.accuracy : 85.0),

  // ── Theme Colors ──
  primaryColor: BRAND.primaryColor || '#00A3E0',
  secondaryColor: BRAND.secondaryColor || '#0B0F19',
  accentColor: BRAND.accentColor || '#00D2FF',
  tabActiveColor: BRAND.tabActiveColor || BRAND.accentColor || '#00A3E0',
  buttonPrimaryColor: BRAND.primaryColor || '#00A3E0',
  buttonLoginColor: BRAND.loginButtonColor || '#00A3E0',
  loginButtonColor: BRAND.loginButtonColor || '#00A3E0',
  loginTextColor: BRAND.loginTextColor || '#FFFFFF',
  loadBotButtonColor: BRAND.loadBotButtonColor || '#00A3E0',
  loadBotButtonTextColor: BRAND.loadBotButtonTextColor || '#FFFFFF',
  tabIconSize: Number(BRAND.tabIconSize || 24),
  tabLabelColor: BRAND.tabLabelColor || '#FFFFFF',
  tabIconColor: BRAND.tabIconColor || '#FFFFFF',
  activeLabelColor: BRAND.activeLabelColor || '#FFFFFF',
  backgroundColor: BRAND.backgroundColor || '#0A0713',

  // ── Visual Styles & Component Cards ──
  botCardStyle: BRAND.botCardStyle || 'gradient',
  tabNavigationStyle: BRAND.tabNavigationStyle || 'solid',
  listItemBackgroundGradient: BRAND.botCardStyle === 'gradient'
    ? `linear-gradient(135deg, #131B2E 0%, ${BRAND.primaryColor || '#00A3E0'} 52%, ${BRAND.accentColor || '#00D2FF'} 100%)`
    : '',
  listItemHoverGradient: `linear-gradient(135deg, #0f2b48 0%, ${BRAND.primaryColor || '#00A3E0'} 55%, ${BRAND.accentColor || '#00D2FF'} 100%)`,

  // ── Loaders ──
  loaderStyle: BRAND.loaderStyle || 'orbit_terminal',
  loaderPrimaryColor: BRAND.loaderPrimaryColor || BRAND.primaryColor || '#00A3E0',
  loaderSecondaryColor: BRAND.loaderAccentColor || BRAND.accentColor || '#00D2FF',
  loaderAccentColor: BRAND.loaderAccentColor || BRAND.accentColor || '#00D2FF',
  loaderHighlightColor: BRAND.loaderHighlightColor || BRAND.accentColor || '#38BDF8',
  loaderTextColor: BRAND.loaderTextColor || '#FFFFFF',
  loaderBackgroundColor: BRAND.backgroundColor || '#0A0713',
  loaderBackgroundImage: BRAND.loaderBackgroundImage || '/assets/media/logo.png',
  loaderBackgroundImageUrl: BRAND.loaderBackgroundImage || '/assets/media/logo.png',

  // ── Referral & Links ──
  signupUrl: BRAND.signupUrl || BRAND.referralUrl || '',
  referralUrl: BRAND.referralUrl || BRAND.signupUrl || '',
  referralTitle: 'INVITE FRIENDS',
  referralText: '',

  // ── Marketing / ROT Accounts ──
  marketingAccounts: marketingAccount,
  rot: BRAND.rot || '',
  startingBalance: Number(BRAND.startingBalance || 100.00),
  useRealBalance: BRAND.useRealBalance === true,

  // ── Social Links ──
  ...socialLinksMap,

  // ── Tabs Config ──
  tabs: BRAND.tabs || [],
  bots: BRAND.bots || []
};

const HLX_SITE = {
  $id: BRAND.appName.toLowerCase(),
  name: BRAND.brandName || BRAND.appName,
  domains: BRAND.allowedDomains || [BRAND.primaryDomain],
  domainList: BRAND.primaryDomain,
  settingsJson: JSON.stringify(HLX_SETTINGS),
  suspended: false,
  appId: /^\d+$/.test(DERIV_CLIENT_ID) ? DERIV_CLIENT_ID : '1089',
  derivAppId: DERIV_CLIENT_ID,
  newAppId: DERIV_CLIENT_ID,
  oauthClientId: DERIV_CLIENT_ID,
  legacyAppId: /^\d+$/.test(DERIV_CLIENT_ID) ? DERIV_CLIENT_ID : '1089',
  oauthRedirectUrl: (BRAND.oauthRedirectUrl || BRAND.oauthRedirectUri || `https://${BRAND.primaryDomain}`).replace(/\/+$/, ''),
  redirectUri: (BRAND.oauthRedirectUrl || BRAND.oauthRedirectUri || `https://${BRAND.primaryDomain}`).replace(/\/+$/, ''),
  app_markup_percentage: Number(BRAND.app_markup_percentage || BRAND.appMarkupPercentage || 0),
  appMarkupPercentage: Number(BRAND.app_markup_percentage || BRAND.appMarkupPercentage || 0),
  useRealBalance: BRAND.useRealBalance === true,
  brandName: BRAND.brandName || BRAND.appName,
  logoUrl: BRAND.logo || '/assets/media/logo.png',
  faviconUrl: BRAND.favicon || '/assets/media/favicon.png?v=bh2',
  loaderBackgroundImage: BRAND.loaderBackgroundImage || '/assets/media/logo.png',
  primaryColor: BRAND.primaryColor,
  secondaryColor: BRAND.secondaryColor,
  accentColor: BRAND.tabActiveColor || BRAND.accentColor,
  backgroundColor: BRAND.backgroundColor,
  textColor: BRAND.loginTextColor || '#ffffff',
  fontFamily: BRAND.fontFamily,
  socialWhatsapp: socialLinksMap.socialWhatsapp,
  socialWhatsapp2: socialLinksMap.socialWhatsapp2,
  socialTelegram: socialLinksMap.socialTelegram,
  socialTiktok: socialLinksMap.socialTiktok,
  tabsConfig: HLX_SETTINGS.tabs,
  includeFreeBots: BRAND.includeFreeBots !== false,
  bots: BRAND.bots || []
};

// ─── ADMIN STORE INTEGRATION ────────────────────────────────────────────────
const adminStore = require('./admin-store');

// ─── FREE BOTS LIBRARY ───────────────────────────────────────────────────────
const BOT_DIR = path.join(__dirname, 'bots');
const nowIso = new Date().toISOString();

// ─── APPWRITE-CONTRACT ENDPOINTS (served locally) ─────────────────────────────
function jsonCors(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token, x-api-key');
}

// OPTIONS pre-flight for all API routes
app.options('/api/*', (req, res) => {
  jsonCors(res);
  res.sendStatus(204);
});

function isDemoLoginid(id) {
  if (!id) return false;
  const u = String(id).trim().toUpperCase();
  return u.startsWith('VRTC') || u.startsWith('VRT') || u.startsWith('DOT') || u.startsWith('DEM') || u.startsWith('VRW');
}

app.get('/api/appwrite/site-settings', (req, res) => {
  jsonCors(res); noCache(res);
  const reqMode = String(req.query.mode || req.query.account_type || '').toLowerCase();
  const mode = reqMode === 'demo' || reqMode === 'virtual' ? 'demo' : 'real';
  const mkt = adminStore.getMarketingConfig(mode);
  const allMkt = adminStore.getMarketingConfig('all');
  const dynamicSite = {
    ...HLX_SITE,
    rot: mkt.rot,
    startingBalance: mkt.startingBalance,
    useRealBalance: mkt.useRealBalance === true,
    app_markup_percentage: mkt.app_markup_percentage,
    real: allMkt.real,
    demo: allMkt.demo,
    settingsJson: JSON.stringify({
      ...HLX_SETTINGS,
      rot: mkt.rot,
      startingBalance: mkt.startingBalance,
      useRealBalance: mkt.useRealBalance === true,
      app_markup_percentage: mkt.app_markup_percentage,
      real: allMkt.real,
      demo: allMkt.demo
    })
  };
  res.json({ ok: true, hostname: req.query.hostname || BRAND.primaryDomain, site: dynamicSite });
});

app.get('/api/appwrite/site-entitlement', (req, res) => {
  jsonCors(res); noCache(res);
  res.json({ ok: true, entitlement: {
    allowed: true, status: 'active', reason: 'ok',
    hostname: req.query.hostname || BRAND.primaryDomain,
    siteId: HLX_SITE.$id, siteName: BRAND.appName, ownerId: HLX_SITE.$id, hasSiteToken: false,
  }});
});

app.get('/api/appwrite/bots', async (req, res) => {
  jsonCors(res);
  try {
    await adminStore.syncWithRemoteRegistry();
  } catch (_) {}
  const dest = req.query.destination || null;
  const published = adminStore.getPublishedBots(dest);
  res.json({
    ok: true,
    bots: published.map(b => ({
      id: b.id,
      name: b.displayName || b.name,
      botName: b.displayName || b.name,
      displayName: b.displayName || b.name,
      description: b.description || 'Deriv DBot automated strategy',
      folderId: b.folderId || 'custom',
      folderName: b.folderName || (b.destination === 'store' ? 'Bot Store' : (b.destination === 'both' ? 'Free & Store' : 'Free Bots')),
      category: b.category || 'General',
      destination: b.destination || 'free',
      file: b.file,
      botFile: b.file,
      storageFileId: b.id,
      createdAt: b.uploadedAt || nowIso,
    }))
  });
});

app.get('/api/appwrite/bot-xml', (req, res) => {
  const id = String(req.query.id || '');
  const bot = adminStore.getBotById(id);
  if (!bot) return res.status(404).type('text/plain').send('bot not found');
  const full = path.join(BOT_DIR, bot.file);
  const tmpFull = path.join('/tmp', bot.file);
  const filePath = fs.existsSync(full) ? full : (fs.existsSync(tmpFull) ? tmpFull : null);
  if (!filePath) {
    fetch(`https://raw.githubusercontent.com/Malkindev/binaryhunter.site-/main/bots/${encodeURIComponent(bot.file)}?t=${Date.now()}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) return res.status(404).type('text/plain').send('bot xml not found');
        const xml = await r.text();
        res.setHeader('Content-Type', 'application/xml');
        res.send(xml);
      })
      .catch(() => res.status(404).type('text/plain').send('bot xml not found'));
    return;
  }
  fs.readFile(filePath, 'utf8', (err, xml) => {
    if (err) return res.status(404).type('text/plain').send('bot xml not found');
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  });
});

// Marketing profile & simulation sync endpoints for Real and Demo account prices/balances
app.get('/api/marketing/resolve', (req, res) => {
  jsonCors(res); noCache(res);
  const reqLid = String(req.query.loginid || '').trim().toUpperCase();
  const isDemo = isDemoLoginid(reqLid) || req.query.mode === 'demo' || req.query.account_type === 'demo';
  const targetMode = isDemo ? 'demo' : 'real';
  const mkt = adminStore.getMarketingConfig(targetMode);
  const configuredRot = String(mkt.rot || '').trim().toUpperCase();
  const useReal = mkt.useRealBalance === true;

  if (useReal) {
    return res.json({
      success: true,
      mode: targetMode,
      marketingEligible: false,
      useRealBalance: true
    });
  }

  const reqDigits = reqLid.replace(/^[^0-9]+/, '');
  const rotDigits = configuredRot.replace(/^[^0-9]+/, '');
  const isMatch = !!configuredRot && !!reqLid && (reqLid === configuredRot || (reqDigits && rotDigits && reqDigits === rotDigits));

  if (configuredRot && (isMatch || !reqLid)) {
    const activeRot = reqLid || configuredRot;
    res.json({
      success: true,
      mode: targetMode,
      marketingEligible: true,
      useRealBalance: false,
      rot: activeRot,
      loginid: activeRot,
      currency: mkt.currency || 'USD',
      startingBalance: Number(mkt.startingBalance !== undefined ? mkt.startingBalance : (isDemo ? 10000.00 : 800.00)),
      currentBalance: Number(mkt.startingBalance !== undefined ? mkt.startingBalance : (isDemo ? 10000.00 : 800.00)),
      accuracy: Number(mkt.accuracy !== undefined ? mkt.accuracy : 100),
      targetMode: targetMode,
      account_mode: targetMode,
      mode: targetMode,
      tradingMode: mkt.mode || 'simulation',
      marketingMode: mkt.mode || 'simulation',
      app_markup_percentage: Number(mkt.app_markup_percentage || 0)
    });
  } else {
    res.json({ success: false, mode: targetMode, marketingEligible: false, useRealBalance: false });
  }
});

app.get('/api/marketing/demo-sync', (req, res) => {
  jsonCors(res); noCache(res);
  const reqLid = String(req.query.loginid || '').trim().toUpperCase();
  const isDemo = isDemoLoginid(reqLid) || req.query.mode === 'demo';
  const targetMode = isDemo ? 'demo' : 'real';
  const mkt = adminStore.getMarketingConfig(targetMode);
  const activeLid = reqLid || mkt.rot || '';
  res.json({
    success: true,
    mode: targetMode,
    rot: activeLid,
    useRealBalance: mkt.useRealBalance === true,
    startingBalance: Number(mkt.startingBalance !== undefined && mkt.startingBalance !== null ? mkt.startingBalance : (isDemo ? null : 800.00)),
    app_markup_percentage: Number(mkt.app_markup_percentage || 0),
    processedContractIds: []
  });
});

app.post('/api/marketing/demo-sync', express.json(), (req, res) => {
  jsonCors(res); noCache(res);
  const body = req.body || {};
  const reqLid = String(body.loginid || '').trim().toUpperCase();
  const isDemo = isDemoLoginid(reqLid) || body.mode === 'demo';
  const targetMode = isDemo ? 'demo' : 'real';
  const mkt = adminStore.getMarketingConfig(targetMode);
  const activeLid = reqLid || mkt.rot || '';
  res.json({
    success: true,
    mode: targetMode,
    action: body.action || 'sync',
    rot: activeLid,
    useRealBalance: mkt.useRealBalance === true,
    startingBalance: Number(mkt.startingBalance !== undefined && mkt.startingBalance !== null ? mkt.startingBalance : (isDemo ? null : 800.00)),
    app_markup_percentage: Number(mkt.app_markup_percentage || 0)
  });
});

// ─── ADMIN MANAGEMENT ROUTE GROUP ────────────────────────────────────────────
function requireAdminAuth(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  if (!adminStore.checkAdminAuth(req)) {
    jsonCors(res); noCache(res);
    return res.status(401).json({ ok: false, error: 'Unauthorized: Valid administrator authorization required.' });
  }
  next();
}

// 1. Admin Authentication
app.post('/api/admin/auth/login', express.json(), (req, res) => {
  jsonCors(res); noCache(res);
  const { username, password, token } = req.body || {};

  // Support direct API token login or username + password
  if (token && token === adminStore.ADMIN_API_KEY) {
    return res.json({ ok: true, token: adminStore.ADMIN_API_KEY, username: adminStore.ADMIN_USERNAME });
  }

  const result = adminStore.authenticateAdmin(username, password);
  if (result.authenticated) {
    return res.json({ ok: true, token: result.token, username: result.username });
  }
  return res.status(401).json({ ok: false, error: 'Invalid administrator credentials.' });
});

app.get('/api/admin/auth/verify', requireAdminAuth, (req, res) => {
  jsonCors(res); noCache(res);
  res.json({ ok: true, authenticated: true, username: adminStore.ADMIN_USERNAME });
});

// 2. Admin Dashboard Overview
app.get('/api/admin/overview', requireAdminAuth, (req, res) => {
  jsonCors(res); noCache(res);
  const allBots = adminStore.getAllBots();
  const publishedBots = allBots.filter(b => b.published !== false);
  const mkt = adminStore.getMarketingConfig();
  const auditLogs = adminStore.getAuditLog();

  res.json({
    ok: true,
    overview: {
      totalBots: allBots.length,
      publishedBots: publishedBots.length,
      unpublishedBots: allBots.length - publishedBots.length,
      marketingStatus: mkt.useRealBalance ? 'Inactive' : 'Active',
      useRealBalance: mkt.useRealBalance,
      rot: mkt.rot,
      startingBalance: mkt.startingBalance,
      currency: mkt.currency,
      markupPercentage: mkt.app_markup_percentage,
      lastActivatedAt: mkt.lastActivatedAt,
      lastDeactivatedAt: mkt.lastDeactivatedAt,
      lastConfigUpdate: mkt.updatedAt,
      recentAuditLogs: auditLogs.slice(0, 5)
    }
  });
});

// 3. Bot Management Endpoints
app.get('/api/admin/bots', requireAdminAuth, (req, res) => {
  jsonCors(res); noCache(res);
  res.json({ ok: true, bots: adminStore.getAllBots() });
});

app.post('/api/admin/bots/upload', express.json({ limit: '10mb' }), requireAdminAuth, (req, res) => {
  jsonCors(res); noCache(res);
  try {
    const { filename, displayName, description, category, destination, folderName, xmlContent } = req.body || {};
    if (!xmlContent) {
      return res.status(400).json({ ok: false, error: 'Bot XML content is required.' });
    }
    const actor = req.headers['x-admin-actor'] || adminStore.ADMIN_USERNAME;
    const ip = req.ip || req.connection.remoteAddress;
    const saved = adminStore.saveBot({
      filename,
      displayName,
      description,
      category,
      destination,
      folderName,
      xmlContent
    }, actor, ip);

    res.json({ ok: true, message: `Bot '${saved.displayName}' uploaded and validated successfully.`, bot: saved });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/bots/:id/download', requireAdminAuth, (req, res) => {
  const bot = adminStore.getBotById(req.params.id);
  if (!bot) return res.status(404).json({ ok: false, error: 'Bot not found.' });

  const fullPath = path.join(BOT_DIR, bot.file);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ ok: false, error: 'Bot file missing on server.' });
  }

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${bot.file}"`);
  fs.createReadStream(fullPath).pipe(res);
});

app.patch('/api/admin/bots/:id/publish', express.json(), requireAdminAuth, (req, res) => {
  jsonCors(res); noCache(res);
  try {
    const published = req.body && req.body.published === true;
    const actor = req.headers['x-admin-actor'] || adminStore.ADMIN_USERNAME;
    const ip = req.ip || req.connection.remoteAddress;
    const updated = adminStore.togglePublishBot(req.params.id, published, actor, ip);
    res.json({ ok: true, message: `Bot '${updated.displayName}' is now ${updated.published ? 'published' : 'unpublished'}.`, bot: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.patch('/api/admin/bots/:id/destination', express.json(), requireAdminAuth, (req, res) => {
  jsonCors(res); noCache(res);
  try {
    const { destination } = req.body || {};
    if (!destination) {
      return res.status(400).json({ ok: false, error: 'Destination is required (free, store, or both).' });
    }
    const actor = req.headers['x-admin-actor'] || adminStore.ADMIN_USERNAME;
    const ip = req.ip || req.connection.remoteAddress;
    const updated = adminStore.updateBot(req.params.id, { destination }, actor, ip);
    res.json({ ok: true, message: `Bot '${updated.displayName}' destination set to '${updated.destination}'.`, bot: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.put('/api/admin/bots/:id', express.json(), requireAdminAuth, (req, res) => {
  jsonCors(res); noCache(res);
  try {
    const actor = req.headers['x-admin-actor'] || adminStore.ADMIN_USERNAME;
    const ip = req.ip || req.connection.remoteAddress;
    const updated = adminStore.updateBot(req.params.id, req.body || {}, actor, ip);
    res.json({ ok: true, message: `Bot '${updated.displayName}' updated successfully.`, bot: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.delete('/api/admin/bots/:id', requireAdminAuth, (req, res) => {
  jsonCors(res); noCache(res);
  try {
    const actor = req.headers['x-admin-actor'] || adminStore.ADMIN_USERNAME;
    const ip = req.ip || req.connection.remoteAddress;
    const deleted = adminStore.deleteBot(req.params.id, actor, ip);
    res.json({ ok: true, message: `Bot '${deleted.displayName}' deleted successfully.`, bot: deleted });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 4. Marketing Profile Management Endpoints
app.get('/api/admin/marketing', requireAdminAuth, (req, res) => {
  jsonCors(res); noCache(res);
  const allMkt = adminStore.getMarketingConfig('all');
  const targetMode = String(req.query.mode || 'real').toLowerCase() === 'demo' ? 'demo' : 'real';
  const current = allMkt[targetMode] || allMkt.real;
  res.json({
    ok: true,
    marketing: {
      ...current,
      activeMode: targetMode,
      status: current.useRealBalance ? 'Inactive' : 'Active',
      isMarketingActive: !current.useRealBalance,
      real: {
        ...allMkt.real,
        status: allMkt.real.useRealBalance ? 'Inactive' : 'Active',
        isMarketingActive: !allMkt.real.useRealBalance
      },
      demo: {
        ...allMkt.demo,
        status: allMkt.demo.useRealBalance ? 'Inactive' : 'Active',
        isMarketingActive: !allMkt.demo.useRealBalance
      }
    }
  });
});

app.put('/api/admin/marketing', express.json(), requireAdminAuth, (req, res) => {
  jsonCors(res); noCache(res);
  try {
    const actor = req.headers['x-admin-actor'] || adminStore.ADMIN_USERNAME;
    const ip = req.ip || req.connection.remoteAddress;
    const targetMode = (req.body && (req.body.mode || req.body.account_mode)) || req.query.mode || 'real';
    const saved = adminStore.saveMarketingConfig(req.body || {}, actor, ip, targetMode);
    const allMkt = adminStore.getMarketingConfig('all');
    res.json({
      ok: true,
      message: `Marketing configuration (${targetMode.toUpperCase()}) saved successfully.`,
      marketing: {
        ...saved,
        activeMode: targetMode,
        status: saved.useRealBalance ? 'Inactive' : 'Active',
        isMarketingActive: !saved.useRealBalance,
        real: {
          ...allMkt.real,
          status: allMkt.real.useRealBalance ? 'Inactive' : 'Active',
          isMarketingActive: !allMkt.real.useRealBalance
        },
        demo: {
          ...allMkt.demo,
          status: allMkt.demo.useRealBalance ? 'Inactive' : 'Active',
          isMarketingActive: !allMkt.demo.useRealBalance
        }
      }
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/marketing/activate', express.json(), requireAdminAuth, (req, res) => {
  jsonCors(res); noCache(res);
  try {
    const actor = req.headers['x-admin-actor'] || adminStore.ADMIN_USERNAME;
    const ip = req.ip || req.connection.remoteAddress;
    const targetMode = (req.body && (req.body.mode || req.body.account_mode)) || req.query.mode || 'real';
    const activated = adminStore.activateMarketing(actor, ip, targetMode);
    const allMkt = adminStore.getMarketingConfig('all');
    res.json({
      ok: true,
      message: `Marketing profile activated for [${targetMode.toUpperCase()}] mode ('${activated.rot}'). Simulation mode enabled.`,
      marketing: {
        ...activated,
        activeMode: targetMode,
        status: 'Active',
        isMarketingActive: true,
        real: {
          ...allMkt.real,
          status: allMkt.real.useRealBalance ? 'Inactive' : 'Active',
          isMarketingActive: !allMkt.real.useRealBalance
        },
        demo: {
          ...allMkt.demo,
          status: allMkt.demo.useRealBalance ? 'Inactive' : 'Active',
          isMarketingActive: !allMkt.demo.useRealBalance
        }
      }
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/marketing/deactivate', express.json(), requireAdminAuth, (req, res) => {
  jsonCors(res); noCache(res);
  try {
    const actor = req.headers['x-admin-actor'] || adminStore.ADMIN_USERNAME;
    const ip = req.ip || req.connection.remoteAddress;
    const targetMode = (req.body && (req.body.mode || req.body.account_mode)) || req.query.mode || 'real';
    const deactivated = adminStore.deactivateMarketing(actor, ip, targetMode);
    const allMkt = adminStore.getMarketingConfig('all');
    res.json({
      ok: true,
      message: `Marketing profile deactivated for [${targetMode.toUpperCase()}] mode. Genuine Deriv balances restored.`,
      marketing: {
        ...deactivated,
        activeMode: targetMode,
        status: 'Inactive',
        isMarketingActive: false,
        real: {
          ...allMkt.real,
          status: allMkt.real.useRealBalance ? 'Inactive' : 'Active',
          isMarketingActive: !allMkt.real.useRealBalance
        },
        demo: {
          ...allMkt.demo,
          status: allMkt.demo.useRealBalance ? 'Inactive' : 'Active',
          isMarketingActive: !allMkt.demo.useRealBalance
        }
      }
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 5. Audit Log
app.get('/api/admin/audit-log', requireAdminAuth, (req, res) => {
  jsonCors(res); noCache(res);
  res.json({ ok: true, logs: adminStore.getAuditLog() });
});

// 6. Live GitHub/Vercel Sync
app.post('/api/admin/sync-live', requireAdminAuth, async (req, res) => {
  jsonCors(res); noCache(res);
  try {
    const actor = req.headers['x-admin-actor'] || adminStore.ADMIN_USERNAME;
    const result = await adminStore.syncToGit(`Admin manual sync by ${actor}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/sync-status', requireAdminAuth, (req, res) => {
  jsonCors(res); noCache(res);
  res.json(adminStore.getSyncStatus());
});




// ─── DERIV OAUTH PKCE TOKEN EXCHANGE PROXY ───────────────────────────────────
// The bundle POSTs { grant_type, client_id, code, environment, redirect_uri,
// code_verifier } here; we forward it to Deriv's token endpoint (server-side to
// avoid browser CORS on the token endpoint) and return the JSON verbatim.
app.post('/api/oauth/token', express.json(), async (req, res) => {
  jsonCors(res); noCache(res);
  try {
    const b = req.body || {};
    const env = (b.environment || '').toString().toLowerCase();
    const tokenUrl = env === 'staging'
      ? 'https://staging-auth.deriv.com/oauth2/token'
      : 'https://auth.deriv.com/oauth2/token';
    const configuredRedirect = (BRAND.oauthRedirectUrl || BRAND.oauthRedirectUri || '').trim();
    const effectiveRedirectUri = (b.redirect_uri || configuredRedirect || `https://${BRAND.primaryDomain}`).replace(/\/+$/, '');
    const form = new URLSearchParams({
      grant_type: b.grant_type || 'authorization_code',
      client_id: b.client_id || DERIV_CLIENT_ID,
      code: b.code || '',
      redirect_uri: effectiveRedirectUri,
      code_verifier: b.code_verifier || '',
    });
    const upstream = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: form.toString(),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: 'token_exchange_failed', detail: String(e && e.message || e) });
  }
});

// ─── HTML SHELL + STATIC ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  noCache(res);
  res.type('html').send(renderTemplate(path.join(__dirname, 'index.html')));
});
app.get('/manifest.json', (req, res) => {
  res.type('json').send(renderTemplate(path.join(__dirname, 'manifest.json')));
});
app.get(['/favicon.ico', '/favicon.png'], (req, res) => {
  noCache(res);
  res.setHeader('Content-Type', 'image/png');
  res.sendFile(path.join(__dirname, 'assets', 'media', 'favicon.png'));
});

// Minimal no-op service worker: the build registers a SW for PWA support, but we
// intentionally ship one with no fetch/caching handler so nothing is cached
// (freshness matters on a trading UI) and registration stops erroring on the
// SPA-fallback HTML it otherwise received.
app.get('/service-worker.js', (req, res) => {
  noCache(res);
  res.setHeader('Content-Type', 'application/javascript');
  res.send(
    "self.addEventListener('install',function(){self.skipWaiting();});\n" +
    "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});\n"
  );
});
app.get(/^\/static\/js\/hlx-.*\.js$/, (req, res, next) => { noCache(res); next(); });

function resolveStatic(relPath) {
  try {
    const p1 = path.join(__dirname, relPath);
    if (fs.existsSync(p1) && fs.statSync(p1).isFile()) return p1;
  } catch (_) {}
  try {
    const p2 = path.join(process.cwd(), relPath);
    if (fs.existsSync(p2) && fs.statSync(p2).isFile()) return p2;
  } catch (_) {}
  return null;
}

app.use('/static', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const cleanPath = req.path.replace(/\0/g, '');
  const target = resolveStatic(path.join('static', cleanPath));
  if (target) {
    if (cleanPath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=UTF-8');
    else if (cleanPath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    return res.sendFile(target);
  }
  next();
});

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/loaders', express.static(path.join(__dirname, 'loaders')));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/translations', express.static(path.join(__dirname, 'translations')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/bots', express.static(BOT_DIR));
app.use('/docs', express.static(path.join(__dirname, 'docs'))); // strategy guide PDFs
app.get('/deriv-logo.svg', (req, res) => res.sendFile(path.join(__dirname, 'deriv-logo.svg')));
app.get('/robots.txt', (req, res) => res.sendFile(path.join(__dirname, 'robots.txt')));

// Legacy HYPRLVX config endpoint (kept for any of our own overlays).
app.get('/api/site-config', (req, res) => {
  jsonCors(res);
  res.sendFile(path.join(__dirname, 'api', 'site-config.html'));
});

// Featured bots (dynamically served from published bots store)
app.get('/api/featured-bots', (req, res) => {
  jsonCors(res);
  const published = adminStore.getPublishedBots();
  res.json({
    bots: published.map(b => ({
      id: b.id,
      name: b.displayName,
      file: `/bots/${b.file}`,
      description: b.description,
      category: b.category,
      destination: b.destination || 'free'
    }))
  });
});

// Empty/OK stubs for any other /api/* the bundle probes.
app.all('/api/*', (req, res) => { jsonCors(res); res.json({ ok: true, data: null, status: 'ok' }); });

// Missing static assets must 404 cleanly (never fall through to the SPA HTML) so
// webpack's chunk loader degrades gracefully instead of trying to parse HTML as JS.
app.get(['/static/*', '/assets/*', '/translations/*', '/loaders/*'], (req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

// ─── SPA FALLBACK ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  noCache(res);
  res.type('html').send(renderTemplate(path.join(__dirname, 'index.html')));
});

// Vercel invokes this file as a serverless function (via module.exports) instead
// of binding a port, so only listen when actually run as a standalone process
// (local dev / Railway).
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`${BRAND.appName} running on port ${PORT}`));
}

module.exports = app;
