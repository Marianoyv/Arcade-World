const favoriteLibrary = document.getElementById('favoriteLibrary');
const recentLibrary = document.getElementById('recentLibrary');
const importLibrary = document.getElementById('importLibrary');
const favoriteCount = document.getElementById('favoriteCount');
const recentCount = document.getElementById('recentCount');
const importCount = document.getElementById('importCount');
const catalogGames = window.ARCADE_GAMES || [];

function readStoredList(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch (error) {
        return [];
    }
}

function gameKey(game) {
    return game.id || game.slug || game.title;
}

function gameSlug(title) {
    return title
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function emptyCard(message, href, label) {
    return `<div class="library-empty">${message}<br><br><a class="button secondary" href="${href}">${label}</a></div>`;
}

function renderGameCard(game, meta) {
    const slug = game.slug || gameSlug(game.title);

    return `
        <article class="library-card">
            <img src="${game.image}" alt="${game.title} arcade preview" loading="lazy">
            <span>${meta}</span>
            <strong>${game.title}</strong>
            <a href="games.html?search=${encodeURIComponent(game.title)}">Open game</a>
        </article>
    `;
}

function renderImportCard(item) {
    const label = item.playedAt ? new Date(item.playedAt).toLocaleDateString() : 'Local import';

    return `
        <article class="library-card">
            <span>${label}</span>
            <strong>${item.name}</strong>
            <span>${item.core} · .${item.extension} · not uploaded</span>
            <a href="player.html?local=1">Import again</a>
        </article>
    `;
}

function renderLibrary() {
    const favoriteKeys = readStoredList('arcadeWorldFavorites');
    const recent = readStoredList('arcadeWorldRecentGames');
    const imports = readStoredList('arcadeWorldLocalImports');
    const favoriteGames = favoriteKeys
        .map((key) => catalogGames.find((game) => gameKey(game) === key))
        .filter(Boolean);

    if (favoriteCount) {
        favoriteCount.textContent = String(favoriteGames.length);
    }

    if (recentCount) {
        recentCount.textContent = String(recent.length);
    }

    if (importCount) {
        importCount.textContent = String(imports.length);
    }

    if (favoriteLibrary) {
        favoriteLibrary.innerHTML = favoriteGames.length
            ? favoriteGames.map((game) => renderGameCard(game, `${game.year} · ${game.publisher}`)).join('')
            : emptyCard('No favorites yet. Save games from the Game Room to build your library.', 'games.html', 'Browse games');
    }

    if (recentLibrary) {
        recentLibrary.innerHTML = recent.length
            ? recent.map((item) => renderGameCard(item, `${item.mode || 'played'} · ${item.year || 'classic'}`)).join('')
            : emptyCard('No recent sessions yet. Play any game and it will appear here.', 'games.html', 'Start playing');
    }

    if (importLibrary) {
        importLibrary.innerHTML = imports.length
            ? imports.map(renderImportCard).join('')
            : emptyCard('No local imports yet. Import a supported ROM file you are allowed to use.', 'player.html?local=1', 'Import local ROM');
    }

    window.awTrack?.('library_view', {
        favorites: favoriteGames.length,
        recent: recent.length,
        imports: imports.length
    });
}

renderLibrary();
