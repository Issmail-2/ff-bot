const fs = require('fs');
const files = ['index.js', 'utils/playFlow.js', 'utils/storage.js', 'utils/matchManager.js',
  'utils/maintenance.js', 'utils/invites.js', 'utils/ui.js', 'utils/settings.js',
  'utils/backfillBanner.js', 'utils/slash.js'];

const out = [];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (!/\.catch\(\(\) => \{\}\)/.test(l)) return;
    // classify by what is on the left of the catch
    const left = l.slice(0, l.indexOf('.catch')).trim();
    let cat = 'other';
    if (/interaction\./.test(left)) cat = 'INTERACTION';
    else if (/\.send\(/.test(left)) cat = 'SEND';
    else if (/\.edit\(/.test(left)) cat = 'EDIT';
    else if (/points|Points/.test(left)) cat = 'POINTS';
    else if (/persist|save|write/i.test(left)) cat = 'PERSIST';
    else if (/prune|backup|log|clean|sweep/i.test(left)) cat = 'CLEANUP';
    else if (/role|permission|overwrite/i.test(left)) cat = 'ROLE';
    else if (/delete/.test(left)) cat = 'DELETE';
    out.push({ f, n: i + 1, cat, left: left.slice(-70) });
  });
}
const by = {};
for (const o of out) (by[o.cat] = by[o.cat] || []).push(o);
for (const c of Object.keys(by).sort((a, b) => by[b].length - by[a].length)) {
  console.log('=== ' + c + ' (' + by[c].length + ') ===');
  for (const o of by[c]) console.log('  ' + o.f + ':' + o.n + '  ' + o.left);
}
console.log('');
console.log('total: ' + out.length);
