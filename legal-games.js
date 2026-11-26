const legalGames = window.ARCADE_LEGAL_GAMES || [];
const legalGameGrid = document.getElementById('legalGameGrid');
const legalSearch = document.getElementById('legalSearch');
const legalPlatformFilter = document.getElementById('legalPlatformFilter');
const legalEmptyState = document.getElementById('legalEmptyState');
const legalGameCount = document.getElementById('legalGameCount');
const legalPlatformCount = document.getElementById('legalPlatformCount');

function renderLegalPlatformOptions() {
    if (!legalPlatformFilter) {
        return;
    }

    const platforms = [...new Set(legalGames.map((game) => game.platform))].sort();
    legalPlatformFilter.innerHTML = [
        '<option value="all">All platforms</option>',
        ...platforms.map((platform) => `<option value="${platform}">${platform}</option>`)
    ].join('');

    if (legalPlatformCount) {
        legalPlatformCount.textContent = String(platforms.length);
    }
}

function renderLegalGames() {
    if (!legalGameGrid) {
        return;
    }

    const query = legalSearch ? legalSearch.value.trim().toLowerCase() : '';
    const platform = legalPlatformFilter ? legalPlatformFilter.value : 'all';
    const visible = legalGames.filter((game) => {
        const searchable = `${game.title} ${game.platform} ${game.genre} ${game.creator} ${game.license} ${game.description}`.toLowerCase();
        return (platform === 'all' || game.platform === platform) && searchable.includes(query);
    });

    legalGameGrid.innerHTML = visible.map((game) => `
        <article class="game-card legal-card">
            <div class="game-meta">
                <span>${game.platform} · ${game.status}</span>
                <h2>${game.title}</h2>
                <div class="game-details">
                    <small>${game.genre}</small>
                    <small>${game.creator}</small>
                    <small>${game.license}</small>
                </div>
                <p>${game.description}</p>
                <div class="trust-strip">
                    <strong>From:</strong> creator or official directory
                </div>
                <div class="game-actions">
                    <a class="card-button" href="${game.sourceUrl}" target="_blank" rel="noopener" data-legal-source="${game.title}">Official page</a>
                    <a class="card-button secondary" href="player.html?local=1&core=${encodeURIComponent(game.core)}">Load in player</a>
                </div>
            </div>
        </article>
    `).join('');

    legalGameGrid.querySelectorAll('a[data-legal-source]').forEach((link) => {
        link.addEventListener('click', () => {
            window.awTrack?.('legal_source_click', {
                game_title: link.dataset.legalSource,
                link_domain: new URL(link.href).hostname
            });
        });
    });

    if (legalEmptyState) {
        legalEmptyState.hidden = visible.length > 0;
    }

    if (legalGameCount) {
        legalGameCount.textContent = String(legalGames.length);
    }
}

renderLegalPlatformOptions();
renderLegalGames();

legalSearch?.addEventListener('input', renderLegalGames);
legalPlatformFilter?.addEventListener('change', () => {
    renderLegalGames();
    window.awTrack?.('legal_platform_filter', {
        platform: legalPlatformFilter.value
    });
});
