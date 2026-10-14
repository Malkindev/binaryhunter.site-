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
  faviconUrl: BRAND.favicon || '/assets/media/favicon.png',
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
  primaryColor: BRAND.primaryColor || '#9D0698',
  secondaryColor: BRAND.secondaryColor || '#0B0F19',
  accentColor: BRAND.accentColor || '#FF00FF',
  tabActiveColor: BRAND.tabActiveColor || BRAND.accentColor || '#FF00FF',
  buttonPrimaryColor: BRAND.primaryColor || '#9D0698',
  buttonLoginColor: BRAND.loginButtonColor || '#FF00FF',
  loginButtonColor: BRAND.loginButtonColor || '#FF00FF',
  loginTextColor: BRAND.loginTextColor || '#FFFFFF',
  loadBotButtonColor: BRAND.loadBotButtonColor || '#FF00FF',
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
    ? `linear-gradient(135deg, #131B2E 0%, ${BRAND.primaryColor} 52%, ${BRAND.accentColor} 100%)`
    : '',
  listItemHoverGradient: `linear-gradient(135deg, #241640 0%, ${BRAND.primaryColor} 55%, ${BRAND.accentColor} 100%)`,

  // ── Loaders ──
  loaderStyle: BRAND.loaderStyle || 'orbit_terminal',
  loaderPrimaryColor: BRAND.loaderPrimaryColor || BRAND.primaryColor || '#00FF66',
  loaderSecondaryColor: BRAND.loaderAccentColor || BRAND.accentColor || '#FF5577',
  loaderAccentColor: BRAND.loaderAccentColor || BRAND.accentColor || '#FF5577',
  loaderHighlightColor: BRAND.loaderHighlightColor || BRAND.accentColor || '#22FF88',
  loaderTextColor: BRAND.loaderTextColor || '#FFFFFF',
  loaderBackgroundColor: BRAND.backgroundColor || '#0A0713',
  loaderBackgroundImage: BRAND.loaderBackgroundImage || '',
  loaderBackgroundImageUrl: BRAND.loaderBackgroundImage || '',

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
  faviconUrl: BRAND.favicon || '/assets/media/favicon.png',
  loaderBackgroundImage: BRAND.loaderBackgroundImage || '',
  primaryColor: BRAND.primaryColor,
  secondaryColor: BRAND.secondaryColor,
  accentColor: BRAND.tabActiveColor || BRAND.accentColor,
  backgroundColor: BRAND.backgroundColor,
  textColor: BRAND.loginTextColor || '#ffffff',
  fontFamily: BRAND.fontFamily,
  socialWhatsapp: socialLinksMap.socialWhatsapp,
  socialTelegram: socialLinksMap.socialTelegram,
  tabsConfig: HLX_SETTINGS.tabs,
  includeFreeBots: BRAND.includeFreeBots !== false,
  bots: BRAND.bots || []
};

// ─── FREE BOTS LIBRARY ───────────────────────────────────────────────────────
const BOT_DIR = path.join(__dirname, 'bots');
const HLX_BOTS = BRAND.bots && BRAND.bots.length > 0 ? BRAND.bots.map(b => ({
  id: b.id,
  file: b.file,
  displayName: b.displayName || b.name,
  description: b.description,
  category: b.category || 'General',
  folderId: b.folderId || 'default',
  folderName: b.folderName || 'Free Bots'
})) : [
  { id: 'hyprlvx-pro-ai', file: 'HyprlvxProAI.xml', displayName: 'HYPRLVX Pro AI', description: 'Advanced AI-powered signal engine', category: 'AI Signal', folderId: 'hyprlvx', folderName: 'HYPRLVX' },
  { id: 'ximi',           file: 'XIMI.xml',         displayName: 'XIMI',           description: 'Even/Odd digit bot with virtual loss filter', category: 'Digits', folderId: 'hyprlvx', folderName: 'HYPRLVX' },
  { id: 'bluebeam',       file: 'BlueBeam.xml',     displayName: 'BlueBeam Pro AI', description: 'Over/Under digit strategy', category: 'Over/Under', folderId: 'hyprlvx', folderName: 'HYPRLVX' },
];
const nowIso = new Date().toISOString();
function botCards() {
  return HLX_BOTS.map(b => ({
    id: b.id,
    displayName: b.displayName,
    description: b.description,
    folderId: b.folderId,
    folderName: b.folderName,
    category: b.category,
    storageFileId: b.id,
    createdAt: nowIso,
  }));
}

// ─── APPWRITE-CONTRACT ENDPOINTS (served locally) ─────────────────────────────
function jsonCors(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

app.get('/api/appwrite/site-settings', (req, res) => {
  jsonCors(res); noCache(res);
  res.json({ ok: true, hostname: req.query.hostname || BRAND.primaryDomain, site: HLX_SITE });
});

app.get('/api/appwrite/site-entitlement', (req, res) => {
  jsonCors(res); noCache(res);
  res.json({ ok: true, entitlement: {
    allowed: true, status: 'active', reason: 'ok',
    hostname: req.query.hostname || BRAND.primaryDomain,
    siteId: HLX_SITE.$id, siteName: BRAND.appName, ownerId: HLX_SITE.$id, hasSiteToken: false,
  }});
});

app.get('/api/appwrite/bots', (req, res) => {
  jsonCors(res);
  res.json({ ok: true, bots: botCards() });
});

app.get('/api/appwrite/bot-xml', (req, res) => {
  const id = String(req.query.id || '');
  const bot = HLX_BOTS.find(b => b.id === id || b.file === id);
  if (!bot) return res.status(404).type('text/plain').send('bot not found');
  const full = path.join(BOT_DIR, bot.file);
  fs.readFile(full, 'utf8', (err, xml) => {
    if (err) return res.status(404).type('text/plain').send('bot xml not found');
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  });
});

// Marketing profile & simulation sync endpoints for ROT account prices/balances
app.get('/api/marketing/resolve', (req, res) => {
  jsonCors(res); noCache(res);
  const reqLid = String(req.query.loginid || '').trim().toUpperCase();
  const configuredRot = String(BRAND.rot || '').trim().toUpperCase();
  const useReal = BRAND.useRealBalance === true;

  if (useReal) {
    return res.json({
      success: true,
      marketingEligible: false,
      useRealBalance: true
    });
  }

  const reqDigits = reqLid.replace(/^[^0-9]+/, '');
  const rotDigits = configuredRot.replace(/^[^0-9]+/, '');
  const isMatch = !!configuredRot && !!reqLid && (reqLid === configuredRot || (reqDigits && rotDigits && reqDigits === rotDigits));

  if (configuredRot && isMatch) {
    const activeRot = reqLid || configuredRot;
    res.json({
      success: true,
      marketingEligible: true,
      useRealBalance: false,
      rot: activeRot,
      loginid: activeRot,
      currency: BRAND.currency || 'USD',
      startingBalance: Number(BRAND.startingBalance || 100.00),
      currentBalance: Number(BRAND.startingBalance || 100.00),
      accuracy: Number(BRAND.accuracy !== undefined ? BRAND.accuracy : 85.0),
      mode: BRAND.mode || 'simulation',
      app_markup_percentage: Number(BRAND.app_markup_percentage || BRAND.appMarkupPercentage || 0)
    });
  } else {
    res.json({ success: false, marketingEligible: false, useRealBalance: false });
  }
});

app.get('/api/marketing/demo-sync', (req, res) => {
  jsonCors(res); noCache(res);
  const reqLid = String(req.query.loginid || BRAND.rot || 'CR1234567').trim().toUpperCase();
  res.json({
    success: true,
    rot: reqLid,
    startingBalance: Number(BRAND.startingBalance || 100.00),
    // No cumulativeVirtualPnL here: this server is stateless (no database), so the
    // browser's localStorage is the source of truth for running wins/losses.
    app_markup_percentage: Number(BRAND.app_markup_percentage || BRAND.appMarkupPercentage || 0),
    processedContractIds: []
  });
});

app.post('/api/marketing/demo-sync', express.json(), (req, res) => {
  jsonCors(res); noCache(res);
  const body = req.body || {};
  const reqLid = String(body.loginid || BRAND.rot || 'CR1234567').trim().toUpperCase();
  res.json({
    success: true,
    action: body.action || 'sync',
    rot: reqLid,
    startingBalance: Number(BRAND.startingBalance || 100.00),
    app_markup_percentage: Number(BRAND.app_markup_percentage || BRAND.appMarkupPercentage || 0)
  });
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

// Featured bots (used by our own bot-library overlay).
app.get('/api/featured-bots', (req, res) => res.json({ bots: [
  { id: 'hyprlvx-pro-ai', name: 'HYPRLVX Pro AI', file: '/bots/HyprlvxProAI.xml', description: 'Advanced AI-powered signal engine built exclusively for HYPRLVX', category: 'AI Signal', badge: 'EXCLUSIVE' },
  { id: 'ximi', name: 'XIMI', file: '/bots/XIMI.xml', description: 'Even/Odd digit bot with virtual loss filter and martingale recovery', category: 'Digits', badge: 'POPULAR' },
  { id: 'bluebeam', name: 'BlueBeam Pro AI', file: '/bots/BlueBeam.xml', description: 'Over/Under digit strategy with dual-window market analysis', category: 'Over/Under', badge: 'HOT' },
  { id: 'dark-owl', name: 'Dark Owl', file: '/bots/DarkOwl.xml', description: 'Alternating Under 4 / Over 5 strategy with smart martingale', category: 'Over/Under', badge: null },
]}));

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
