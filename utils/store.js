const fs = require('fs');
const path = require('path');

const STORE_FILE = path.resolve(__dirname, '..', 'data', 'store.json');
const PURCHASES_FILE = path.resolve(__dirname, '..', 'data', 'purchases.json');

function ensureFile(file, def) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(def, null, 2));
}

function loadStore() {
  ensureFile(STORE_FILE, { items: [], nextId: 1 });
  let data;
  try {
    data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch (e) {
    data = null;
  }
  if (!data || !Array.isArray(data.items)) {
    data = { items: [], nextId: 1 };
    saveStore(data);
  }
  return data;
}

function saveStore(data) {
  ensureFile(STORE_FILE, { items: [], nextId: 1 });
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

function getItems() {
  const items = loadStore().items;
  return Array.isArray(items) ? items : [];
}

function addItem({ name, cost, type, roleId, stock }) {
  const data = loadStore();
  const item = {
    id: String(data.nextId),
    name,
    cost: parseInt(cost),
    type,
    roleId: roleId || null,
    stock: stock === null || stock === undefined ? null : parseInt(stock)
  };
  data.nextId += 1;
  data.items.push(item);
  saveStore(data);
  return item;
}

function isSoldOut(item) {
  return item && item.stock !== null && item.stock !== undefined && item.stock <= 0;
}

function consumeStock(id) {
  const data = loadStore();
  const it = data.items.find(i => i.id === String(id).trim());
  if (!it) return { ok: false, reason: 'not_found' };
  if (isSoldOut(it)) return { ok: false, reason: 'sold_out' };
  if (it.stock !== null && it.stock !== undefined) {
    it.stock -= 1;
    saveStore(data);
  }
  return { ok: true, item: it };
}

function removeItem(id) {
  const data = loadStore();
  const before = data.items.length;
  data.items = data.items.filter(i => i.id !== String(id).trim());
  saveStore(data);
  return data.items.length < before;
}

function loadPurchases() {
  ensureFile(PURCHASES_FILE, []);
  return JSON.parse(fs.readFileSync(PURCHASES_FILE, 'utf8'));
}

function savePurchases(list) {
  ensureFile(PURCHASES_FILE, []);
  fs.writeFileSync(PURCHASES_FILE, JSON.stringify(list, null, 2));
}

function logPurchase(entry) {
  const list = loadPurchases();
  list.push(entry);
  savePurchases(list);
}

module.exports = { getItems, addItem, removeItem, isSoldOut, consumeStock, loadPurchases, logPurchase };