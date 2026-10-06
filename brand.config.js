// ─────────────────────────────────────────────────────────────────────────
// BRAND CONFIG — The SINGLE master file to configure this standalone
// Deriv Third Party Trading Template.
// Edit this file to customize domain, identity, colors, loaders, tabs,
// bots, marketing accounts (ROT / Login ID + Starting Balance), and social links.
// ─────────────────────────────────────────────────────────────────────────

module.exports = {
  // ── 1. Domain Lock ───────────────────────────────────────────────────────
  // Primary domain & allowed domains where this template is deployed.
  primaryDomain: 'volatilitymaster.site',
  allowedDomains: ['volatilitymaster.site', 'www.volatilitymaster.site'],

  // ── 2. Deriv OAuth App ID ───────────────────────────────────────────────
  // Registered App ID / Client ID from https://api.deriv.com/dashboard
  derivAppId: '34Bj1avoL2syX7K07WkQh',

  // ── 3. Platform Identity & Wordmark ──────────────────────────────────────
  appName: 'Volatilitymaster',
  brandName: 'Volatilitymaster',
  logoTextMain: 'Volatility',
  logoTextAccent: 'Master',
  tagline: 'Advanced AI Trading Platform',
  titleSuffix: 'Advanced AI Trading Platform',
  description: 'Volatilitymaster is an automated trading platform on Deriv. Build and run trading bots, scan live markets, and execute automated strategies.',

  // ── 4. Assets (Images / Logo / Favicon) ──────────────────────────────────
  // Paths or URLs for logo and favicon (defaults fallback to assets/media/)
  logo: '/assets/media/logo.png',
  favicon: '/assets/media/favicon.png',
  loaderBackgroundImage: '', // Optional background image URL for loader screen

  // ── 5. Theme Colors & Visual Styles ──────────────────────────────────────
  primaryColor: '#9D0698',
  accentColor: '#FF00FF',
  secondaryColor: '#0B0F19',
  backgroundColor: '#0A0713',
  tabActiveColor: '#FF00FF',
  loginButtonColor: '#FF00FF',
  loginTextColor: '#FFFFFF',
  loadBotButtonColor: '#FF00FF',
  loadBotButtonTextColor: '#FFFFFF',
  tabIconSize: 24,
  tabLabelColor: '#FFFFFF',
  tabIconColor: '#FFFFFF',
  activeLabelColor: '#FFFFFF',

  // UI Component Styles
  botCardStyle: 'gradient',      // Choices: 'gradient' | 'card' | 'minimal' | 'compact'
  tabNavigationStyle: 'solid',   // Choices: 'solid' | 'underline' | 'pill' | 'stacked'

  // ── 6. Typography ────────────────────────────────────────────────────────
  fontFamily: 'Inter',
  fontGoogleParam: 'Inter:wght@300;400;500;600;700;800',

  // ── 7. Loader Configuration ──────────────────────────────────────────────
  // Available loader animation options (pick any one):
  //   'orbit_terminal' — Advanced command center loader with live terminal status readout (default)
  //   'signal_grid'    — Matrix-style 24-bar scanning grid with animated signal beams
  //   'pulse_deck'     — Financial radar deck with dynamic market pulse readouts
  //   'trade_rings'    — Multi-layered rotating trading ring animation with live percentage core
  //   'glass_meter'    — Glassmorphism progress meter with fluid indicator
  //   'logo_spin'      — Animated 3D spinning brand logo
  //   'cube_3d'        — 3D rotating cube with glowing brand borders
  //   'wave'           — Dynamic 7-bar wave animation
  //   'bars'           — Equalizer bars with staggered delays
  //   'orbit'          — Single orbital particle ring
  //   'bouncing_dots'  — Modern 3-dot jumping loader
  //   'pulse'          — Breathing glow pulse sphere
  //   'spinner'        — Clean dual-ring spinner
  //   'progress_bar'   — Minimal horizontal glowing progress bar
  //   'typing'         — Typing indicator dots
  //   'bounce'         — Bouncing ball indicator
  //   'basic'          — Classic minimalist circular spinner ring
  loaderStyle: 'orbit_terminal',
  loaderPrimaryColor: '#00FF66',
  loaderAccentColor: '#FF5577',
  loaderHighlightColor: '#22FF88',
  loaderTextColor: '#FFFFFF',


  // ── 8. Marketing Simulation Profile (ROT / Login ID & Starting Balance) ──
  // ROT / Login ID for paper/virtual account sync (e.g., 'CR1234567')
  rot: 'ROT91298223',
  startingBalance: 450.00,       // Starting balance in USD
  currency: 'USD',
  accuracy: 93.0,
  mode: 'simulation',
  app_markup_percentage: 3,      // Marketing price markup percentage (0% to 3%)


  // ── 9. Signup & Referral Link ─────────────────────────────────────────────
  signupUrl: 'https://track.deriv.com/_oq3-w9_7dyRZl7VyVw174GNd7ZgqdRLk/1/',
  referralUrl: 'https://track.deriv.com/_oq3-w9_7dyRZl7VyVw174GNd7ZgqdRLk/1/',

  // ── 10. Social Links ─────────────────────────────────────────────────────
  socialLinks: {
    whatsapp: 'https://wa.me/254768116434',
    telegram: '',
    instagram: '',
    facebook: '',
    youtube: '',
    tiktok: '',
    website: ''
  },

  // ── 11. Tab Navigation Config ────────────────────────────────────────────
  tabs: [
    { id: 'dashboard', label: 'Dashboard', icon: 'FaHome', visible: true, always: true },
    { id: 'bot_builder', label: 'Bot Builder', icon: 'FaRobot', visible: true, always: true },
    { id: 'free_bots', label: 'Free Bots', icon: 'FaRobot', visible: true },
    { id: 'analysis', label: 'Analysis', icon: 'FaChartLine', visible: true },
    { id: 'dtrader', label: 'D-Trader', icon: 'FaChartBar', visible: true },
    { id: 'smart_analysis', label: 'Smart Analysis', icon: 'FaChartLine', visible: true },
    { id: 'signals', label: 'Signals', icon: 'FaSignal', visible: true },
    { id: 'matches', label: 'Matches', icon: 'FaCrown', visible: true },
    { id: 'speedbot', label: 'Speedbot', icon: 'FaBolt', visible: true },
    { id: 'charts', label: 'Charts', icon: 'FaChartLine', visible: true },
    { id: 'copy_trader', label: 'Copy Trading', icon: 'FaCopy', visible: true },
  ],

  // ── 12. Bot Builder & Free Bots Catalog ──────────────────────────────────
  includeFreeBots: true,
  bots: [
    { id: 'hyprlvx-pro-ai', file: 'HyprlvxProAI.xml', displayName: 'HYPRLVX Pro AI', description: 'Advanced AI-powered signal engine built exclusively for HYPRLVX', category: 'AI Signal', folderId: 'hyprlvx', folderName: 'HYPRLVX' },
    { id: 'ximi', file: 'XIMI.xml', displayName: 'XIMI', description: 'Even/Odd digit bot with virtual loss filter and martingale recovery', category: 'Digits', folderId: 'hyprlvx', folderName: 'HYPRLVX' },
    { id: 'bluebeam', file: 'BlueBeam.xml', displayName: 'BlueBeam Pro AI', description: 'Over/Under digit strategy with dual-window market analysis', category: 'Over/Under', folderId: 'hyprlvx', folderName: 'HYPRLVX' },
    { id: 'dark-owl', file: 'DarkOwl.xml', displayName: 'Dark Owl', description: 'Alternating Under 4 / Over 5 strategy with smart martingale', category: 'Over/Under', folderId: 'hyprlvx', folderName: 'HYPRLVX' },
    { id: 'black-box-spider', file: 'BlackBoxSpider.xml', displayName: 'Black Box Spider', description: 'Under 4 / Over 5 strategy with virtual loss filter and 1.8x martingale recovery', category: 'Over/Under', folderId: 'hyprlvx', folderName: 'HYPRLVX' },
  ]
};

