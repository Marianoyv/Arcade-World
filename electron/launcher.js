const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function isInside(parent, target) {
    const relative = path.relative(parent, target);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function sanitizeGame(game) {
    if (!game || typeof game !== 'object') {
        return null;
    }

    const fields = ['id', 'title', 'emulator', 'romPath'];
    const sanitized = {};

    fields.forEach((field) => {
        if (typeof game[field] === 'string') {
            sanitized[field] = game[field].trim();
        }
    });

    return fields.every((field) => sanitized[field]) ? sanitized : null;
}

function findExecutable(emulator, rootDir) {
    return emulator.executableCandidates(rootDir)
        .map((candidate) => path.resolve(candidate))
        .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

function getGameStatus({ rootDir, registry, game }) {
    const safeGame = sanitizeGame(game);

    if (!safeGame) {
        return { ok: false, status: 'invalid-game', message: 'The game launcher metadata is incomplete.' };
    }

    const emulator = registry[safeGame.emulator.toLowerCase()];

    if (!emulator) {
        return { ok: false, status: 'unsupported-emulator', message: `${safeGame.emulator} is not registered yet.` };
    }

    const romRoot = path.resolve(rootDir, 'roms');
    const gamePath = path.resolve(rootDir, safeGame.romPath);

    if (!isInside(romRoot, gamePath)) {
        return { ok: false, status: 'unsafe-game-path', message: 'Game files must stay inside the Arcade World roms folder.' };
    }

    const extension = path.extname(gamePath).toLowerCase();

    if (!emulator.supportedExtensions.includes(extension)) {
        return { ok: false, status: 'unsupported-game-file', message: `${emulator.name} does not accept the configured ${extension || 'file'} format.` };
    }

    const executablePath = findExecutable(emulator, rootDir);
    const emulatorReady = Boolean(executablePath);
    const gameReady = fs.existsSync(gamePath) && fs.statSync(gamePath).isFile();
    const status = emulatorReady && gameReady ? 'ready' : 'setup-required';
    const missing = [
        !emulatorReady && `${emulator.name} is not installed`,
        !gameReady && `the legitimate game image is missing at ${safeGame.romPath}`
    ].filter(Boolean);

    return {
        ok: emulatorReady && gameReady,
        status,
        emulator: emulator.name,
        emulatorReady,
        gameReady,
        gamePath,
        executablePath: executablePath || null,
        setupUrl: emulator.website,
        message: missing.length ? `Setup required: ${missing.join(' and ')}.` : `${safeGame.title} is ready to launch.`
    };
}

async function launchGame(options) {
    const status = getGameStatus(options);

    if (!status.ok) {
        return status;
    }

    const emulator = options.registry[options.game.emulator.toLowerCase()];
    const child = spawn(status.executablePath, emulator.buildArguments(status.gamePath), {
        detached: true,
        stdio: 'ignore',
        windowsHide: false
    });

    await new Promise((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', reject);
    });

    child.unref();

    return {
        ...status,
        status: 'launched',
        message: `${options.game.title} was launched with ${emulator.name}.`
    };
}

module.exports = { getGameStatus, isInside, launchGame, sanitizeGame };
