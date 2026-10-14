const fs = require('fs');
const path = require('path');
const BRAND = require('./brand.config');

const DATA_DIR = path.join(__dirname, 'data');
const BOTS_DIR = path.join(__dirname, 'bots');
const MARKETING_FILE = path.join(DATA_DIR, 'marketing-config.json');
const BOTS_FILE = path.join(DATA_DIR, 'bots-registry.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-log.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── ADMIN AUTH CONFIG ────────────────────────────────────────────────────────
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || process.env.ADMIN_TOKEN || 'binaryhunter_admin_secret_key_2026';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'binaryhunter2026';

// ─── INITIAL SEEDING ──────────────────────────────────────────────────────────
function initMarketingConfig() {
  if (fs.existsSync(MARKETING_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(MARKETING_FILE, 'utf8'));
    } catch (e) {
      console.error('Error reading marketing-config.json:', e);
    }
  }

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

  fs.writeFileSync(MARKETING_FILE, JSON.stringify(initial, null, 2), 'utf8');
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
  if (fs.existsSync(BOTS_FILE)) {
    try {
      const bots = JSON.parse(fs.readFileSync(BOTS_FILE, 'utf8'));
      if (Array.isArray(bots)) {
        const cleaned = bots.filter(b => !isRemovedBot(b.id, b.file)).map(b => ({
          ...b,
          destination: (b.destination === 'store' || b.destination === 'both') ? b.destination : 'free'
        }));
        fs.writeFileSync(BOTS_FILE, JSON.stringify(cleaned, null, 2), 'utf8');
        return cleaned;
      }
    } catch (e) {
      console.error('Error reading bots-registry.json:', e);
    }
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

  fs.writeFileSync(BOTS_FILE, JSON.stringify(initial, null, 2), 'utf8');
  return initial;
}

function initAuditLog() {
  if (fs.existsSync(AUDIT_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
    } catch (e) {
      console.error('Error reading audit-log.json:', e);
    }
  }
  const initial = [
    {
      id: 'audit-' + Date.now(),
      timestamp: new Date().toISOString(),
      action: 'SYSTEM_INIT',
      details: 'Binaryhunter administrative store initialized',
      actor: 'system'
    }
  ];
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(initial, null, 2), 'utf8');
  return initial;
}

// ─── AUDIT LOGGING ────────────────────────────────────────────────────────────
function appendAuditLog(action, details, actor = 'admin', ip = '') {
  try {
    let logs = [];
    if (fs.existsSync(AUDIT_FILE)) {
      logs = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
    }
    const entry = {
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      action,
      details,
      actor,
      ip: ip || ''
    };
    logs.unshift(entry);
    // Keep max 200 entries
    if (logs.length > 200) logs = logs.slice(0, 200);
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2), 'utf8');
    return entry;
  } catch (e) {
    console.error('Audit log failed:', e);
    return null;
  }
}

// ─── MARKETING REPOSITORY ─────────────────────────────────────────────────────
function getMarketingConfig() {
  try {
    if (fs.existsSync(MARKETING_FILE)) {
      return JSON.parse(fs.readFileSync(MARKETING_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed reading marketing config:', e);
  }
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

  fs.writeFileSync(MARKETING_FILE, JSON.stringify(updated, null, 2), 'utf8');
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

  fs.writeFileSync(MARKETING_FILE, JSON.stringify(updated, null, 2), 'utf8');
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

  fs.writeFileSync(MARKETING_FILE, JSON.stringify(updated, null, 2), 'utf8');
  appendAuditLog('MARKETING_DEACTIVATED', `Deactivated Marketing profile. Restored real Deriv account behavior.`, actor, ip);
  return updated;
}

// ─── BOTS REPOSITORY ──────────────────────────────────────────────────────────
function getAllBots() {
  try {
    if (fs.existsSync(BOTS_FILE)) {
      const bots = JSON.parse(fs.readFileSync(BOTS_FILE, 'utf8'));
      if (Array.isArray(bots)) {
        return bots.filter(b => !isRemovedBot(b.id, b.file)).map(b => ({
          ...b,
          destination: (b.destination === 'store' || b.destination === 'both') ? b.destination : 'free'
        }));
      }
    }
  } catch (e) {
    console.error('Failed reading bots registry:', e);
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

function validateDbotXml(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') {
    throw new Error('Bot content is empty or invalid.');
  }
  if (xmlString.length > 5 * 1024 * 1024) {
    throw new Error('Bot file exceeds the 5MB size limit.');
  }

  const clean = xmlString.trim();
  if (!clean.startsWith('<xml') && !clean.includes('<xml')) {
    throw new Error('Invalid bot format: Must be a valid XML file.');
  }

  // Must be Deriv DBot compatible
  if (!clean.includes('is_dbot="true"') && !clean.includes('blockly') && !clean.includes('<block')) {
    throw new Error('Incompatible bot: File must be a valid Deriv DBot XML with Blockly trading blocks.');
  }

  // Basic XML structure balance check
  if (!clean.includes('</xml>')) {
    throw new Error('Malformed XML: Missing closing </xml> tag.');
  }

  // Reject embedded malicious scripts
  if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(clean)) {
    throw new Error('Security rejection: Script tags are forbidden in bot XML.');
  }

  return true;
}

function saveBot({ id, displayName, description, category, destination, folderName, xmlContent, filename }, actor = 'admin', ip = '') {
  validateDbotXml(xmlContent);

  // Generate safe ID and filename
  const baseName = (displayName || filename || 'Custom Bot').trim().replace(/[^a-zA-Z0-9_\-\s]/g, '');
  const botId = (id || baseName.toLowerCase().replace(/\s+/g, '-')).replace(/[^a-z0-9\-]/g, '');

  let safeFilename = (filename || `${baseName.replace(/\s+/g, '')}.xml`).trim();
  if (!safeFilename.toLowerCase().endsWith('.xml')) safeFilename += '.xml';
  safeFilename = path.basename(safeFilename).replace(/[^a-zA-Z0-9_\-\.]/g, '');

  if (isRemovedBot(botId, safeFilename)) {
    throw new Error('This bot has been permanently removed and cannot be uploaded.');
  }

  const validDestination = (destination === 'store' || destination === 'both') ? destination : 'free';

  // Prevent path traversal
  const targetPath = path.join(BOTS_DIR, safeFilename);
  if (!targetPath.startsWith(BOTS_DIR)) {
    throw new Error('Security rejection: Invalid target path.');
  }

  // Write file to bots directory
  fs.writeFileSync(targetPath, xmlContent, 'utf8');
  const stats = fs.statSync(targetPath);

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
    fileSize: stats.size,
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

  fs.writeFileSync(BOTS_FILE, JSON.stringify(bots, null, 2), 'utf8');
  return botRecord;
}

function togglePublishBot(id, published, actor = 'admin', ip = '') {
  const bots = getAllBots();
  const bot = bots.find(b => b.id === id);
  if (!bot) {
    throw new Error(`Bot with ID '${id}' not found.`);
  }

  bot.published = published === true;
  fs.writeFileSync(BOTS_FILE, JSON.stringify(bots, null, 2), 'utf8');
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

  fs.writeFileSync(BOTS_FILE, JSON.stringify(bots, null, 2), 'utf8');
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

  // Safely delete file if it exists and is within BOTS_DIR
  if (fs.existsSync(targetPath) && targetPath.startsWith(BOTS_DIR)) {
    try {
      fs.unlinkSync(targetPath);
    } catch (e) {
      console.warn(`Could not delete file ${targetPath}:`, e.message);
    }
  }

  fs.writeFileSync(BOTS_FILE, JSON.stringify(bots, null, 2), 'utf8');
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
  const tokenHeader = req.headers['x-admin-token'] || req.headers['x-api-key'] || '';

  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (authHeader) {
    token = authHeader.trim();
  } else if (tokenHeader) {
    token = tokenHeader.trim();
  }

  if (token && token === ADMIN_API_KEY) {
    return true;
  }
  return false;
}

// Initialize files immediately
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
  getAuditLog: () => {
    try {
      if (fs.existsSync(AUDIT_FILE)) return JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
    } catch (_) {}
    return [];
  },
  appendAuditLog,
  authenticateAdmin,
  checkAdminAuth
};
