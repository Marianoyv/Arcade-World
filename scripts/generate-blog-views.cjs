const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const reportPath = path.join(root, 'analytics', 'lifetime', 'ga4_pages.csv');
const outputPath = path.join(root, 'data', 'blog-views.js');

if (!fs.existsSync(reportPath)) {
    console.log('No lifetime analytics export available; keeping the existing blog view snapshot.');
    process.exit(0);
}

const report = fs.readFileSync(reportPath, 'utf8');
const start = /# Fecha de inicio: (\d{4})(\d{2})(\d{2})/.exec(report);
const end = /# Fecha de finalizaci[^:]*: (\d{4})(\d{2})(\d{2})/.exec(report);
if (!start || !end) {
    throw new Error('The GA4 export is missing its date range.');
}

const views = {};
for (const line of report.split(/\r?\n/)) {
    const match = /,\/blog\/([a-z0-9-]+)\.html,(\d+),/.exec(line);
    if (match && Number(match[2]) > 0) {
        views[match[1]] = (views[match[1]] || 0) + Number(match[2]);
    }
}

const snapshot = {
    start: `${start[1]}-${start[2]}-${start[3]}`,
    end: `${end[1]}-${end[2]}-${end[3]}`,
    views: Object.fromEntries(Object.entries(views).sort(([a], [b]) => a.localeCompare(b)))
};
fs.writeFileSync(outputPath, `window.ARCADE_BLOG_VIEWS = ${JSON.stringify(snapshot, null, 2)};\n`);
console.log(`Lifetime blog views updated for ${Object.keys(views).length} articles through ${snapshot.end}.`);
