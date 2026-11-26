const playerName = document.getElementById('playerName');
const playerInfo = document.getElementById('playerInfo');
const setupPanel = document.getElementById('setupPanel');
const localLoader = document.getElementById('localLoader');
const localCore = document.getElementById('localCore');
const localRom = document.getElementById('localRom');
const resetPlayer = document.getElementById('resetPlayer');
const games = window.ARCADE_GAMES || [];
const params = new URLSearchParams(window.location.search);
const gameId = params.get('id');
const isLocalMode = params.get('local') === '1';
const requestedCore = params.get('core');
const game = games.find((item) => item.id === gameId || item.slug === gameId || item.title === gameId);
let currentObjectUrl;

function showSetup(message) {
    if (playerInfo) {
        playerInfo.textContent = message;
    }

    if (setupPanel) {
        setupPanel.hidden = false;
    }
}

if (!game) {
    if (isLocalMode) {
        if (playerName) {
            playerName.textContent = 'Import local ROM';
        }

        if (playerInfo) {
            playerInfo.textContent = 'Choose a system and a ROM file from this device.';
        }

        if (localLoader) {
            localLoader.hidden = false;
        }

        if (localCore && requestedCore) {
            localCore.value = requestedCore;
        }
    } else {
    if (playerName) {
        playerName.textContent = 'Game not found';
    }

    showSetup('Return to the catalog and choose a valid game.');
    }
} else {
    if (playerName) {
        playerName.textContent = game.title;
    }

    if (!game.rom || !game.core) {
        showSetup(`${game.title} is still using an external provider. Add a compatible ROM and EmulatorJS core to make it ad-free.`);
    } else {
        if (playerInfo) {
            playerInfo.textContent = `${game.year} · ${game.publisher} · ${game.core}`;
        }

        window.EJS_player = '#game';
        window.EJS_core = game.core;
        window.EJS_gameName = game.title;
        window.EJS_gameUrl = game.rom;
        window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
        window.EJS_color = '#22d3ee';

        const loader = document.createElement('script');
        loader.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
        document.body.appendChild(loader);
    }
}

function loadLocalRom(file, core) {
    if (!file || !core) {
        return;
    }

    if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
    }

    currentObjectUrl = URL.createObjectURL(file);

    if (localLoader) {
        localLoader.hidden = true;
    }

    if (resetPlayer) {
        resetPlayer.hidden = false;
    }

    if (playerName) {
        playerName.textContent = file.name.replace(/\.[^.]+$/, '');
    }

    if (playerInfo) {
        playerInfo.textContent = `${core} · local file · not uploaded`;
    }

    window.awTrack?.('local_rom_loaded', {
        core,
        file_extension: file.name.split('.').pop().toLowerCase()
    });

    try {
        const imports = JSON.parse(localStorage.getItem('arcadeWorldLocalImports')) || [];
        const extension = file.name.split('.').pop().toLowerCase();
        const nextImports = [
            {
                name: file.name.replace(/\.[^.]+$/, ''),
                core,
                extension,
                playedAt: new Date().toISOString()
            },
            ...imports.filter((item) => item.name !== file.name.replace(/\.[^.]+$/, '') || item.core !== core)
        ].slice(0, 12);

        localStorage.setItem('arcadeWorldLocalImports', JSON.stringify(nextImports));
    } catch (error) {
        // Browsers can block storage in strict/private modes; emulation should still continue.
    }

    window.EJS_player = '#game';
    window.EJS_core = core;
    window.EJS_gameName = file.name;
    window.EJS_gameUrl = currentObjectUrl;
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
    window.EJS_color = '#22d3ee';

    const loader = document.createElement('script');
    loader.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
    document.body.appendChild(loader);
}

if (localLoader) {
    localLoader.addEventListener('submit', (event) => {
        event.preventDefault();
        loadLocalRom(localRom.files[0], localCore.value);
    });
}

if (resetPlayer) {
    resetPlayer.addEventListener('click', () => {
        window.location.href = 'player.html?local=1';
    });
}
