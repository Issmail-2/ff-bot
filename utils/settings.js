const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'data', 'settings.json');

const DEFAULTS = {
  checkerRoleIds: [],
  checkerRoleId: null,
  cheaterMarkRoleId: null,
  reportChannelId: null,
  checkChannelId: null,
  exposeChannelId: null,
  reportCost: 50,
  reportReward: 100,
  exposeCategoryId: null
};

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify(DEFAULTS, null, 2));
}

function loadSettings() {
  ensureFile();
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Object.assign({}, DEFAULTS, data);
  } catch (e) {
    return Object.assign({}, DEFAULTS);
  }
}

function saveSettings(s) {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2));
}

function setSetting(key, value) {
  const s = loadSettings();
  s[key] = value;
  saveSettings(s);
  return s;
}

module.exports = { loadSettings, saveSettings, setSetting };