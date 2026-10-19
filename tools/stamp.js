// Hängt an jede eingebundene CSS-/JS-Datei in index.html einen Kennwert aus ihrem Inhalt (?v=…).
// Ändert sich eine Datei, ändert sich der Kennwert – Browser laden sie dann sofort neu statt aus dem Zwischenspeicher.
// Aufruf vor dem Veröffentlichen: node tools/stamp.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..'), file = path.join(root, 'index.html');
let html = fs.readFileSync(file, 'utf8'), n = 0;
html = html.replace(/((?:src|href)=")((?:css|js)\/[^"?]+)(?:\?v=[0-9a-f]+)?(")/g, (_, a, f, b) => {
  const hash = crypto.createHash('sha1').update(fs.readFileSync(path.join(root, f))).digest('hex').slice(0, 8);
  n++;
  return a + f + '?v=' + hash + b;
});
fs.writeFileSync(file, html);
console.log('Kennwerte gesetzt: ' + n + ' Dateien');
