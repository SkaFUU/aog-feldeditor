// Baut den Editor als eine einzige HTML-Datei (zum Weitergeben oder für die Offline-Nutzung).
// Aufruf: node tools/build-single.js [Zieldatei]   (Standard: dist/aog-feldeditor.html)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'dist', 'aog-feldeditor.html');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, f) => '<style>\n' + fs.readFileSync(path.join(root, f), 'utf8') + '</style>');
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, f) => '<script>\n' + fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('gebaut: ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
