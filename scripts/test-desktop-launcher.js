const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { emulatorRegistry } = require('../electron/emulators');
const { getGameStatus, sanitizeGame } = require('../electron/launcher');
const { isPathInside, resolveStaticPath } = require('../electron/static-path');

const rootDir = path.join(__dirname, '..');
const sandbox = { window: {} };
const catalogSource = fs.readFileSync(path.join(rootDir, 'data', 'games-data.js'), 'utf8');
vm.runInNewContext(catalogSource, sandbox, { filename: 'data/games-data.js' });

const game = sandbox.window.ARCADE_GAMES.find((item) => item.id === 'mercenaries-2-world-in-flames');
const requiredFields = ['id', 'title', 'platform', 'emulator', 'cover', 'description', 'romPath', 'status'];

assert(game, 'Mercenaries 2 must exist in the catalog.');
requiredFields.forEach((field) => assert.strictEqual(typeof game[field], 'string', `${field} must be a string.`));
assert(fs.existsSync(path.join(rootDir, game.cover.replace(/^\//, ''))), 'The generated cover must exist.');
assert(sanitizeGame(game), 'The desktop launcher metadata must be valid.');

const status = getGameStatus({ rootDir, registry: emulatorRegistry, game });
assert(['ready', 'setup-required'].includes(status.status), `Unexpected launcher status: ${status.status}`);

const unsafeStatus = getGameStatus({
    rootDir,
    registry: emulatorRegistry,
    game: { ...game, romPath: '../outside.iso' }
});
assert.strictEqual(unsafeStatus.status, 'unsafe-game-path');

const unsupportedStatus = getGameStatus({
    rootDir,
    registry: emulatorRegistry,
    game: { ...game, emulator: 'unknown-emulator' }
});
assert.strictEqual(unsupportedStatus.status, 'unsupported-emulator');

const indexPath = resolveStaticPath(rootDir, '/');
assert.strictEqual(indexPath, path.join(rootDir, 'index.html'));
assert.strictEqual(isPathInside(rootDir, indexPath), true);
assert.strictEqual(resolveStaticPath(rootDir, '/data/games-data.js'), path.join(rootDir, 'data', 'games-data.js'));
[
    '/analytics-local.json',
    '/analytics-local.example.json',
    '/analytics-ga4-setup.json',
    '/package.json',
    '/EDITORIAL_PLAYBOOK.md',
    '/data/README.md'
].forEach((privateUrl) => {
    assert.strictEqual(resolveStaticPath(rootDir, privateUrl), null, `${privateUrl} must not be served.`);
});
[
    '/%2e%2e%5cArcade_World-secret.txt',
    '/%2e%2e%5cArcade_World2%5csecret.txt',
    '/..%5coutside.txt',
    '/%00invalid.txt',
    '/%E0%A4%A'
].forEach((unsafeUrl) => {
    assert.strictEqual(resolveStaticPath(rootDir, unsafeUrl), null, `${unsafeUrl} must be rejected.`);
});

console.log(`Desktop launcher checks passed. Current Mercenaries 2 status: ${status.status}.`);
