const fs = require('fs');
const path = require('path');
const BRAND = require('./brand.config');

const DATA_DIR = path.join(__dirname, 'data');
const BOTS_DIR = path.join(__dirname, 'bots');
const MARKETING_FILE = path.join(DATA_DIR, 'marketing-config.json');
const BOTS_FILE = path.join(DATA_DIR, 'bots-registry.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-log.json');

// Safe filesystem helpers that NEVER throw EROFS in serverless (e.g. Vercel)
function safeMkdir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (_) {}
}

safeMkdir(DATA_DIR);

function safeWriteJson(filePath, data) {
  try {
    safeMkdir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    // If running in a read-only serverless environment (e.g. Vercel), fallback to /tmp
    try {
      const tmpPath = path.join('/tmp', path.basename(filePath));
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (_) {
      return false;
    }
  }
}

function safeReadJson(filePath, fallback) {
  // Check /tmp first for serverless runtime mutations
  try {
    const tmpPath = path.join('/tmp', path.basename(filePath));
    if (fs.existsSync(tmpPath)) {
      return JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
    }
  } catch (_) {}

  // Check bundled file path
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (_) {}

  return fallback;
}

// ─── ADMIN AUTH CONFIG ────────────────────────────────────────────────────────
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || process.env.ADMIN_TOKEN || 'binaryhunter_admin_secret_key_2026';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'binaryhunter2026';

// ─── INITIAL SEEDING ──────────────────────────────────────────────────────────
function initMarketingConfig() {
  const existing = safeReadJson(MARKETING_FILE, null);
  if (existing) return existing;

  const initial = {
    useRealBalance: BRAND.useRealBalance === true,
    rot: BRAND.rot || 'USD ROT91155080',
    startingBalance: Number(BRAND.startingBalance || 800.00),
    currency: BRAND.currency || 'USD',
    accuracy: Number(BRAND.accuracy !== undefined ? BRAND.accuracy : 100),
    mode: BRAND.mode || 'simulation',
    app_markup_percentage: Number(BRAND.app_markup_percentage || BRAND.appMarkupPercentage || 3),
    updatedAt: new Date().toISOString(),
    lastActivatedAt: BRAND.useRealBalance === false ? new Date().toISOString() : null,
    lastDeactivatedAt: BRAND.useRealBalance === true ? new Date().toISOString() : null
  };

  safeWriteJson(MARKETING_FILE, initial);
  return initial;
}

// ─── PERMANENTLY REMOVED BOTS BLOCKLIST ──────────────────────────────────────
const PERMANENTLY_REMOVED_BOT_IDS = new Set([
  'hyprlvx-pro-ai',
  'ximi',
  'bluebeam',
  'dark-owl',
  'black-box-spider'
]);
const PERMANENTLY_REMOVED_BOT_FILES = new Set([
  'hyprlvxproai.xml',
  'ximi.xml',
  'bluebeam.xml',
  'darkowl.xml',
  'blackboxspider.xml'
]);

function isRemovedBot(id, filename) {
  const cleanId = String(id || '').trim().toLowerCase();
  const cleanFile = String(filename || '').trim().toLowerCase();
  return PERMANENTLY_REMOVED_BOT_IDS.has(cleanId) || PERMANENTLY_REMOVED_BOT_FILES.has(cleanFile);
}

function initBotsRegistry() {
  const existing = safeReadJson(BOTS_FILE, null);
  if (Array.isArray(existing)) {
    return existing.filter(b => !isRemovedBot(b.id, b.file)).map(b => ({
      ...b,
      destination: (b.destination === 'store' || b.destination === 'both') ? b.destination : 'free'
    }));
  }

  const brandBots = Array.isArray(BRAND.bots) ? BRAND.bots : [];
  const initial = brandBots
    .filter(b => !isRemovedBot(b.id, b.file))
    .map(b => {
      let fileSize = 0;
      try {
        const stats = fs.statSync(path.join(BOTS_DIR, b.file));
        fileSize = stats.size;
      } catch (_) {}

      return {
        id: b.id,
        file: b.file,
        displayName: b.displayName || b.name,
        description: b.description || '',
        category: b.category || 'General',
        destination: b.destination || 'free',
        folderId: 'custom',
        folderName: b.destination === 'store' ? 'Bot Store' : 'Free Bots',
        fileSize: fileSize,
        uploadedAt: new Date().toISOString(),
        published: true
      };
    });

  safeWriteJson(BOTS_FILE, initial);
  return initial;
}

function initAuditLog() {
  const existing = safeReadJson(AUDIT_FILE, null);
  if (Array.isArray(existing)) return existing;

  const initial = [
    {
      id: 'audit-' + Date.now(),
      timestamp: new Date().toISOString(),
      action: 'SYSTEM_INIT',
      details: 'Binaryhunter administrative store initialized',
      actor: 'system'
    }
  ];
  safeWriteJson(AUDIT_FILE, initial);
  return initial;
}

// ─── AUDIT LOGGING ────────────────────────────────────────────────────────────
function appendAuditLog(action, details, actor = 'admin', ip = '') {
  try {
    let logs = safeReadJson(AUDIT_FILE, []);
    const entry = {
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      action,
      details,
      actor,
      ip: ip || ''
    };
    logs.unshift(entry);
    if (logs.length > 200) logs = logs.slice(0, 200);
    safeWriteJson(AUDIT_FILE, logs);
    return entry;
  } catch (e) {
    console.error('Audit log failed:', e);
    return null;
  }
}

// ─── MARKETING REPOSITORY ─────────────────────────────────────────────────────
function getMarketingConfig() {
  const cfg = safeReadJson(MARKETING_FILE, null);
  if (cfg) return cfg;
  return initMarketingConfig();
}

function saveMarketingConfig(data, actor = 'admin', ip = '') {
  const current = getMarketingConfig();

  // Field validation
  const rot = String(data.rot !== undefined ? data.rot : current.rot).trim();
  if (!rot) {
    throw new Error('ROT / Login ID is required.');
  }

  const startingBalance = Number(data.startingBalance !== undefined ? data.startingBalance : current.startingBalance);
  if (isNaN(startingBalance) || startingBalance < 0) {
    throw new Error('Starting balance must be a non-negative number.');
  }

  const markup = Number(data.app_markup_percentage !== undefined ? data.app_markup_percentage : current.app_markup_percentage);
  if (isNaN(markup) || markup < 0 || markup > 3) {
    throw new Error('Markup percentage must be between 0% and 3%.');
  }

  const currency = String(data.currency || current.currency || 'USD').trim().toUpperCase();
  const allowedCurrencies = ['USD', 'EUR', 'GBP', 'AUD', 'BTC', 'ETH', 'LTC', 'USDT'];
  if (!allowedCurrencies.includes(currency)) {
    throw new Error(`Currency ${currency} is not supported. Allowed: ${allowedCurrencies.join(', ')}`);
  }

  const updated = {
    ...current,
    rot: rot,
    startingBalance: startingBalance,
    currency: currency,
    accuracy: Number(data.accuracy !== undefined ? data.accuracy : current.accuracy),
    mode: 'simulation',
    app_markup_percentage: markup,
    updatedAt: new Date().toISOString()
  };

  safeWriteJson(MARKETING_FILE, updated);
  appendAuditLog('MARKETING_CONFIG_SAVED', `Updated ROT: ${rot}, Balance: ${startingBalance} ${currency}, Markup: ${markup}%`, actor, ip);
  return updated;
}

function activateMarketing(actor = 'admin', ip = '') {
  const current = getMarketingConfig();
  if (!current.rot || current.rot.trim() === '') {
    throw new Error('Cannot activate Marketing: ROT / Login ID is not configured.');
  }

  const updated = {
    ...current,
    useRealBalance: false, // Marketing is ACTIVE (simulation)
    lastActivatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  safeWriteJson(MARKETING_FILE, updated);
  appendAuditLog('MARKETING_ACTIVATED', `Activated Marketing profile for ROT: ${current.rot} (Simulation mode)`, actor, ip);
  return updated;
}

function deactivateMarketing(actor = 'admin', ip = '') {
  const current = getMarketingConfig();
  const updated = {
    ...current,
    useRealBalance: true, // Marketing is DEACTIVATED (real Deriv balance restored)
    lastDeactivatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  safeWriteJson(MARKETING_FILE, updated);
  appendAuditLog('MARKETING_DEACTIVATED', `Deactivated Marketing profile. Restored real Deriv account behavior.`, actor, ip);
  return updated;
}

// ─── BOTS REPOSITORY ──────────────────────────────────────────────────────────
function getAllBots() {
  const bots = safeReadJson(BOTS_FILE, null);
  if (Array.isArray(bots)) {
    return bots.filter(b => !isRemovedBot(b.id, b.file)).map(b => ({
      ...b,
      destination: (b.destination === 'store' || b.destination === 'both') ? b.destination : 'free'
    }));
  }
  return initBotsRegistry();
}

function getPublishedBots(destination = null) {
  const published = getAllBots().filter(b => b.published !== false);
  if (!destination) return published;
  const dest = String(destination).trim().toLowerCase();
  if (dest === 'free') {
    return published.filter(b => b.destination === 'free' || b.destination === 'both' || !b.destination);
  }
  if (dest === 'store') {
    return published.filter(b => b.destination === 'store' || b.destination === 'both');
  }
  if (dest === 'both') {
    return published.filter(b => b.destination === 'both');
  }
  return published;
}

function getBotById(id) {
  if (!id) return null;
  const cleanId = String(id).trim().toLowerCase();
  if (isRemovedBot(cleanId, cleanId)) return null;
  return getAllBots().find(b => b.id.toLowerCase() === cleanId || b.file.toLowerCase() === cleanId);
}

// ─── BOT FILE VALIDATION ──────────────────────────────────────────────────────
function validateDbotXml(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') {
    throw new Error('Bot file content is empty or unreadable.');
  }
  const trimmed = xmlString.trim();

  // Root XML tag validation
  if (!trimmed.includes('<xml') || !trimmed.includes('</xml>')) {
    throw new Error('Invalid bot XML: Missing root <xml> tags.');
  }

  // Deriv DBot schema validation
  const hasDbotAttr = trimmed.includes('is_dbot="true"');
  const hasBlocklyBlock = trimmed.includes('<block') && (trimmed.includes('blockly') || trimmed.includes('xmlns="http://www.w3.org/1999/xhtml"'));
  if (!hasDbotAttr && !hasBlocklyBlock) {
    throw new Error('Invalid bot XML: Must be a Deriv DBot compatible strategy.');
  }

  // Security: Check for dangerous executable tags
  if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(trimmed)) {
    throw new Error('Security violation: XML file contains forbidden script elements.');
  }

  return true;
}

function saveBot({ id, displayName, description, category, destination, folderName, xmlContent, filename }, actor = 'admin', ip = '') {
  validateDbotXml(xmlContent);

  // Generate safe ID and filename
  const baseName = (displayName || filename || 'Custom Bot').trim().replace(/[^a-zA-Z0-9_\-\s]/g, '');
  const botId = (id || baseName.toLowerCase().replace(/\s+/g, '-')).replace(/[^a-z0-9\-]/g, '');
  let safeFilename = (filename || `${botId}.xml`).trim();
  if (!safeFilename.toLowerCase().endsWith('.xml')) safeFilename += '.xml';
  safeFilename = path.basename(safeFilename).replace(/[^a-zA-Z0-9_\-\.]/g, '');

  if (isRemovedBot(botId, safeFilename)) {
    throw new Error('This bot has been permanently removed and cannot be uploaded.');
  }

  const validDestination = (destination === 'store' || destination === 'both') ? destination : 'free';

  // Prevent path traversal
  const targetPath = path.join(BOTS_DIR, safeFilename);
  let fileSize = Buffer.byteLength(xmlContent, 'utf8');

  try {
    safeMkdir(BOTS_DIR);
    fs.writeFileSync(targetPath, xmlContent, 'utf8');
    const stats = fs.statSync(targetPath);
    fileSize = stats.size;
  } catch (err) {
    try {
      const tmpTarget = path.join('/tmp', safeFilename);
      fs.writeFileSync(tmpTarget, xmlContent, 'utf8');
    } catch (_) {}
  }

  const bots = getAllBots();
  const existingIndex = bots.findIndex(b => b.id === botId || b.file === safeFilename);
  const botRecord = {
    id: botId,
    file: safeFilename,
    displayName: displayName || baseName,
    description: description || 'Deriv DBot automated strategy',
    category: category || 'General',
    destination: validDestination,
    folderId: 'custom',
    folderName: folderName || (validDestination === 'store' ? 'Bot Store' : (validDestination === 'both' ? 'Free & Store' : 'Free Bots')),
    fileSize: fileSize,
    uploadedAt: new Date().toISOString(),
    published: true
  };

  if (existingIndex >= 0) {
    bots[existingIndex] = { ...bots[existingIndex], ...botRecord };
    appendAuditLog('BOT_REPLACED', `Replaced bot '${botRecord.displayName}' (${safeFilename}, destination: ${validDestination})`, actor, ip);
  } else {
    bots.push(botRecord);
    appendAuditLog('BOT_UPLOADED', `Uploaded new bot '${botRecord.displayName}' (${safeFilename}, destination: ${validDestination})`, actor, ip);
  }

  safeWriteJson(BOTS_FILE, bots);
  return botRecord;
}

function togglePublishBot(id, published, actor = 'admin', ip = '') {
  const bots = getAllBots();
  const bot = bots.find(b => b.id === id);
  if (!bot) {
    throw new Error(`Bot with ID '${id}' not found.`);
  }

  bot.published = published === true;
  safeWriteJson(BOTS_FILE, bots);
  appendAuditLog(bot.published ? 'BOT_PUBLISHED' : 'BOT_UNPUBLISHED', `${bot.published ? 'Published' : 'Unpublished'} bot '${bot.displayName}' (${bot.file})`, actor, ip);
  return bot;
}

function updateBot(id, { displayName, description, category, destination, folderName }, actor = 'admin', ip = '') {
  const bots = getAllBots();
  const bot = bots.find(b => b.id === id);
  if (!bot) {
    throw new Error(`Bot with ID '${id}' not found.`);
  }

  if (displayName) bot.displayName = displayName.trim();
  if (description !== undefined) bot.description = description.trim();
  if (category) bot.category = category.trim();
  if (folderName) bot.folderName = folderName.trim();
  if (destination) {
    const d = destination.trim().toLowerCase();
    if (d === 'free' || d === 'store' || d === 'both') {
      bot.destination = d;
      bot.folderName = d === 'store' ? 'Bot Store' : (d === 'both' ? 'Free & Store' : 'Free Bots');
    }
  }

  safeWriteJson(BOTS_FILE, bots);
  appendAuditLog('BOT_METADATA_UPDATED', `Updated metadata for bot '${bot.displayName}' (destination: ${bot.destination})`, actor, ip);
  return bot;
}

function deleteBot(id, actor = 'admin', ip = '') {
  const bots = getAllBots();
  const botIndex = bots.findIndex(b => b.id === id);
  if (botIndex === -1) {
    throw new Error(`Bot with ID '${id}' not found.`);
  }

  const [bot] = bots.splice(botIndex, 1);
  const targetPath = path.join(BOTS_DIR, bot.file);

  try {
    if (fs.existsSync(targetPath) && targetPath.startsWith(BOTS_DIR)) {
      fs.unlinkSync(targetPath);
    }
  } catch (_) {}

  try {
    const tmpTarget = path.join('/tmp', bot.file);
    if (fs.existsSync(tmpTarget)) fs.unlinkSync(tmpTarget);
  } catch (_) {}

  safeWriteJson(BOTS_FILE, bots);
  appendAuditLog('BOT_DELETED', `Deleted bot '${bot.displayName}' (${bot.file})`, actor, ip);
  return bot;
}

// ─── AUTHENTICATION HELPERS ───────────────────────────────────────────────────
function authenticateAdmin(username, password) {
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return {
      authenticated: true,
      token: ADMIN_API_KEY,
      username: ADMIN_USERNAME,
      role: 'administrator'
    };
  }
  return { authenticated: false };
}

function checkAdminAuth(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  const customHeader = req.headers['x-admin-token'] || req.headers['x-api-key'] || '';

  return token === ADMIN_API_KEY || customHeader === ADMIN_API_KEY;
}

// Initialize on module load without throwing read-only filesystem errors
initMarketingConfig();
initBotsRegistry();
initAuditLog();

module.exports = {
  ADMIN_API_KEY,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  getMarketingConfig,
  saveMarketingConfig,
  activateMarketing,
  deactivateMarketing,
  getAllBots,
  getPublishedBots,
  getBotById,
  saveBot,
  togglePublishBot,
  updateBot,
  deleteBot,
  getAuditLog: () => safeReadJson(AUDIT_FILE, []),
  appendAuditLog,
  authenticateAdmin,
  checkAdminAuth
};
