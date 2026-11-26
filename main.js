// Contact form
const contactForm = document.getElementById('contactForm');

if (contactForm) {
    contactForm.addEventListener('submit', (event) => {
        const name = document.getElementById('name');
        const email = document.getElementById('email');
        const subject = document.getElementById('subject');
        const messages = [];

        if (!name || name.value.trim() === '') {
            messages.push('Name is required');
        }

        if (!email || email.value.trim() === '') {
            messages.push('Email is required');
        }

        if (!subject || subject.value.trim() === '') {
            messages.push('Message is required');
        }

        if (messages.length > 0) {
            event.preventDefault();
            alert(messages.join('\n'));
        }
    });
}

function myFunc() {
    const menu = document.getElementById('nav');

    if (!menu) {
        return;
    }

    const isOpen = menu.classList.toggle('responsive');
    menu.querySelector('.icon')?.setAttribute('aria-expanded', String(isOpen));
}

const siteNav = document.getElementById('nav');

if (siteNav) {
    const menuToggle = siteNav.querySelector('.icon');
    const currentPath = window.location.pathname.replace(/\/$/, '/index.html');
    const sectionPath = currentPath.startsWith('/blog/')
        ? '/blog.html'
        : currentPath.startsWith('/games/') || currentPath.startsWith('/categories/')
            ? '/games.html'
            : currentPath;

    menuToggle?.setAttribute('aria-expanded', 'false');

    siteNav.querySelectorAll('a:not(.icon)').forEach((link) => {
        const linkPath = new URL(link.href, window.location.href).pathname.replace(/\/$/, '/index.html');

        if (linkPath === sectionPath) {
            link.setAttribute('aria-current', 'page');
        }

        link.addEventListener('click', () => {
            siteNav.classList.remove('responsive');
            menuToggle?.setAttribute('aria-expanded', 'false');
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            siteNav.classList.remove('responsive');
            menuToggle?.setAttribute('aria-expanded', 'false');
            menuToggle?.focus();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 860) {
            siteNav.classList.remove('responsive');
            menuToggle?.setAttribute('aria-expanded', 'false');
        }
    });
}

const games = window.ARCADE_GAMES || [];
const gameGrid = document.getElementById('gameGrid');
const gameSearch = document.getElementById('gameSearch');
const gameFilters = document.getElementById('gameFilters');
const decadeFilter = document.getElementById('decadeFilter');
const modeFilter = document.getElementById('modeFilter');
const sortFilter = document.getElementById('sortFilter');
const emptyState = document.getElementById('emptyState');
const gameCount = document.getElementById('gameCount');
const genreCount = document.getElementById('genreCount');
const gamePlayer = document.getElementById('gamePlayer');
const playerTitle = document.getElementById('playerTitle');
const playerDescription = document.getElementById('playerDescription');
const playerMeta = document.getElementById('playerMeta');
const playerSource = document.getElementById('playerSource');
const playerPlaceholder = document.getElementById('playerPlaceholder');
const posts = window.ARCADE_POSTS || [];
const postGrid = document.getElementById('postGrid');
const postSearch = document.getElementById('postSearch');
const postCategory = document.getElementById('postCategory');
const postCount = document.getElementById('postCount');
const postEmpty = document.getElementById('postEmpty');
const postLoadMore = document.getElementById('postLoadMore');

let activeFilter = 'all';
let searchTrackTimer;
let lastNoResultQuery = '';

const storageKeys = {
    favorites: 'arcadeWorldFavorites',
    recent: 'arcadeWorldRecentGames'
};

function readJsonStorage(key, fallback = []) {
    try {
        return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (error) {
        return fallback;
    }
}

function writeJsonStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getGameKey(game) {
    return game.id || game.slug || game.title;
}

function getFavoriteKeys() {
    return readJsonStorage(storageKeys.favorites);
}

function isFavorite(game) {
    return getFavoriteKeys().includes(getGameKey(game));
}

function toggleFavorite(game) {
    const key = getGameKey(game);
    const favorites = getFavoriteKeys();
    const exists = favorites.includes(key);
    const nextFavorites = exists ? favorites.filter((item) => item !== key) : [key, ...favorites];

    writeJsonStorage(storageKeys.favorites, nextFavorites);
    window.awTrack?.(exists ? 'favorite_remove' : 'favorite_add', {
        game_title: game.title,
        game_key: key
    });
    renderGames();
}

function rememberRecentGame(game, mode) {
    const recent = readJsonStorage(storageKeys.recent);
    const key = getGameKey(game);
    const nextRecent = [
        {
            key,
            title: game.title,
            label: game.label,
            year: game.year,
            publisher: game.publisher,
            image: getGameImage(game),
            mode,
            playedAt: new Date().toISOString()
        },
        ...recent.filter((item) => item.key !== key)
    ].slice(0, 12);

    writeJsonStorage(storageKeys.recent, nextRecent);
}

function isOwnPlayerGame(game) {
    return isEmulatorJsGame(game) || isDesktopGame(game);
}

function isEmulatorJsGame(game) {
    return game.mode === 'emulatorjs' || Boolean(game.rom && game.core);
}

function isDesktopGame(game) {
    return game.mode === 'desktop' || Boolean(game.emulator && game.romPath);
}

function getGameImage(game) {
    return game.cover || game.image || '/img/arcade.png';
}

function getPlayModeLabel(game) {
    if (isDesktopGame(game)) {
        return `${game.platform || 'Desktop'} · ${game.emulator?.toUpperCase() || 'Emulator'}`;
    }

    return isEmulatorJsGame(game) ? 'Own player ready' : 'External provider: may show ads';
}

function formatGameStatus(status) {
    return String(status || 'desktop')
        .replace(/-/g, ' ')
        .replace(/^./, (character) => character.toUpperCase());
}

async function refreshDesktopGameStatuses(visibleGames) {
    if (!window.arcadeWorldDesktop?.isDesktop || !gameGrid) {
        return;
    }

    await Promise.all(visibleGames.map(async (game) => {
        if (!isDesktopGame(game)) {
            return;
        }

        const statusKey = slugify(getGameKey(game));
        const statusElement = gameGrid.querySelector(`[data-desktop-status="${statusKey}"]`);

        if (!statusElement) {
            return;
        }

        try {
            const result = await window.arcadeWorldDesktop.getGameStatus(game);
            statusElement.textContent = result.ok ? 'Ready' : 'Setup required';
            statusElement.dataset.status = result.status;
        } catch (error) {
            statusElement.textContent = 'Status unavailable';
        }
    }));
}

function getGenres() {
    return [...new Set(games.flatMap((game) => game.category))].sort();
}

function formatGenre(genre) {
    return genre.charAt(0).toUpperCase() + genre.slice(1);
}

function slugify(value) {
    return String(value)
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function getDecade(game) {
    return `${Math.floor(Number(game.year) / 10) * 10}s`;
}

function getSelectedValue(select, fallback = 'all') {
    return select ? select.value : fallback;
}

function renderAdvancedFilters() {
    if (decadeFilter) {
        const decades = [...new Set(games.map(getDecade))].sort();
        decadeFilter.innerHTML = [
            '<option value="all">All years</option>',
            ...decades.map((decade) => `<option value="${decade}">${decade}</option>`)
        ].join('');
    }
}

function renderFilters() {
    if (!gameFilters) {
        return;
    }

    const genres = getGenres();
    gameFilters.innerHTML = [
        `<button class="${activeFilter === 'all' ? 'active' : ''}" type="button" data-filter="all">All</button>`,
        ...genres.map((genre) => `<button class="${activeFilter === genre ? 'active' : ''}" type="button" data-filter="${genre}">${formatGenre(genre)}</button>`)
    ].join('');

    if (genreCount) {
        genreCount.textContent = String(genres.length);
    }
}

function renderGames() {
    if (!gameGrid) {
        return;
    }

    const searchTerm = gameSearch ? gameSearch.value.trim().toLowerCase() : '';
    const selectedDecade = getSelectedValue(decadeFilter);
    const selectedMode = getSelectedValue(modeFilter);
    const selectedSort = getSelectedValue(sortFilter, 'title');
    const visibleGames = games.filter((game) => {
        const matchesFilter = activeFilter === 'all' || game.category.includes(activeFilter);
        const matchesDecade = selectedDecade === 'all' || getDecade(game) === selectedDecade;
        const matchesMode = selectedMode === 'all' || (selectedMode === 'own' ? isOwnPlayerGame(game) : !isOwnPlayerGame(game));
        const searchableText = `${game.title} ${game.label} ${game.publisher} ${game.year} ${game.description} ${game.category.join(' ')}`.toLowerCase();
        return matchesFilter && matchesDecade && matchesMode && searchableText.includes(searchTerm);
    }).sort((a, b) => {
        if (selectedSort === 'year-desc') {
            return Number(b.year) - Number(a.year);
        }

        if (selectedSort === 'year-asc') {
            return Number(a.year) - Number(b.year);
        }

        if (selectedSort === 'publisher') {
            return a.publisher.localeCompare(b.publisher) || a.title.localeCompare(b.title);
        }

        return a.title.localeCompare(b.title);
    });

    gameGrid.innerHTML = visibleGames.map((game, index) => {
        const isAdFreeReady = isOwnPlayerGame(game);

        return `
        <article class="game-card">
            <img src="${getGameImage(game)}" alt="${game.title} game cover" loading="lazy">
            <div class="game-meta">
                <span>${game.label}</span>
                <h2>${game.title}</h2>
                <div class="game-details">
                    <small>${game.year}</small>
                    <small>${game.publisher}</small>
                    <small>${getDecade(game)}</small>
                </div>
                <p>${game.description}</p>
                <div class="trust-strip ${isAdFreeReady ? 'clean' : 'external'}">
                    ${getPlayModeLabel(game)}
                </div>
                <div class="game-actions">
                    <button type="button" data-game-index="${index}">${isDesktopGame(game) ? 'Launch' : isAdFreeReady ? 'Ad-free Play' : 'Play'}</button>
                    <button class="favorite-button${isFavorite(game) ? ' active' : ''}" type="button" data-favorite-game-index="${index}" aria-label="${isFavorite(game) ? 'Remove from library' : 'Save to library'}">${isFavorite(game) ? 'Saved' : 'Save'}</button>
                    <a class="card-button secondary" href="games/${slugify(game.title)}.html">Details</a>
                    <small${isDesktopGame(game) ? ` data-desktop-status="${slugify(getGameKey(game))}"` : ''}>${isDesktopGame(game) ? formatGameStatus(game.status) : isAdFreeReady ? 'Own player' : game.scoreTag}</small>
                </div>
            </div>
        </article>
    `;
    }).join('');

    gameGrid.querySelectorAll('button[data-game-index]').forEach((button) => {
        button.addEventListener('click', () => {
            const selectedGame = visibleGames[Number(button.dataset.gameIndex)];
            loadGame(selectedGame);
        });
    });

    gameGrid.querySelectorAll('button[data-favorite-game-index]').forEach((button) => {
        button.addEventListener('click', () => {
            const selectedGame = visibleGames[Number(button.dataset.favoriteGameIndex)];
            toggleFavorite(selectedGame);
        });
    });

    refreshDesktopGameStatuses(visibleGames);

    if (emptyState) {
        emptyState.hidden = visibleGames.length > 0;
    }

    if (visibleGames.length === 0 && searchTerm && searchTerm !== lastNoResultQuery) {
        lastNoResultQuery = searchTerm;
        window.awTrack?.('game_search_no_results', {
            search_term: searchTerm,
            filter_name: activeFilter,
            decade: selectedDecade,
            mode: selectedMode
        });
    }

    if (gameCount) {
        gameCount.textContent = String(games.length);
    }

}

function updatePlayerPlaceholder(title, message) {
    if (!playerPlaceholder) {
        return;
    }

    const titleElement = playerPlaceholder.querySelector('strong');
    const messageElement = playerPlaceholder.querySelector('span');

    playerPlaceholder.hidden = false;

    if (titleElement) {
        titleElement.textContent = title;
    }

    if (messageElement) {
        messageElement.textContent = message;
    }
}

async function loadDesktopGame(game, shouldScroll = true) {
    gamePlayer.src = 'about:blank';
    gamePlayer.dataset.loaded = 'false';
    gamePlayer.hidden = true;
    playerTitle.textContent = `${game.title} · desktop launcher`;
    playerDescription.textContent = `${game.description} Arcade World checks the emulator and your legitimate local game image before launch.`;
    playerMeta.textContent = `${game.year} · ${game.publisher} · ${game.platform} · ${game.emulator.toUpperCase()}`;
    playerSource.href = game.emulatorUrl || 'https://pcsx2.net/downloads/';
    playerSource.textContent = `Get ${game.emulator.toUpperCase()}`;
    updatePlayerPlaceholder('Checking local setup', 'Arcade World is looking for the emulator and game image on this computer.');
    rememberRecentGame(game, 'desktop');

    if (shouldScroll) {
        document.getElementById('player')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (!window.arcadeWorldDesktop?.isDesktop) {
        playerTitle.textContent = `${game.title} requires the desktop app`;
        updatePlayerPlaceholder('Desktop app required', 'Open Arcade World with npm run desktop to use external emulators.');
        return;
    }

    try {
        const status = await window.arcadeWorldDesktop.getGameStatus(game);

        if (!status.ok) {
            playerTitle.textContent = `${game.title} needs setup`;
            playerDescription.textContent = status.message;
            updatePlayerPlaceholder('Setup required', status.message);
            window.awTrack?.('desktop_game_setup_required', {
                game_title: game.title,
                emulator: game.emulator,
                status: status.status
            });
            return;
        }

        playerTitle.textContent = `Launching ${game.title}`;
        updatePlayerPlaceholder('Launching game', `${status.emulator} is starting in a separate window.`);
        const result = await window.arcadeWorldDesktop.launchGame(game);
        playerTitle.textContent = result.ok ? `${game.title} launched` : `${game.title} could not launch`;
        playerDescription.textContent = result.message;
        updatePlayerPlaceholder(result.ok ? 'Game launched' : 'Launch failed', result.message);
        window.awTrack?.('desktop_game_launch', {
            game_title: game.title,
            emulator: game.emulator,
            status: result.status
        });
    } catch (error) {
        playerTitle.textContent = `${game.title} could not launch`;
        playerDescription.textContent = error.message;
        updatePlayerPlaceholder('Launch failed', error.message);
    }
}

function loadGame(game, shouldScroll = true) {
    if (!game || !gamePlayer || !playerTitle || !playerDescription) {
        return;
    }

    if (isDesktopGame(game)) {
        loadDesktopGame(game, shouldScroll);
        return;
    }

    const usesOwnPlayer = isEmulatorJsGame(game);
    const playerUrl = usesOwnPlayer
        ? `player.html?id=${encodeURIComponent(game.id || game.slug || game.title)}`
        : game.embed;

    gamePlayer.src = playerUrl;
    gamePlayer.dataset.loaded = 'true';
    gamePlayer.hidden = false;
    gamePlayer.title = `${game.title} arcade emulator`;
    playerTitle.textContent = `${game.title} is ready`;
    playerDescription.textContent = usesOwnPlayer
        ? `${game.description} This game is assigned to the Arcade World EmulatorJS player.`
        : `${game.description} This external provider may show ads before the game loads.`;

    if (playerPlaceholder) {
        playerPlaceholder.hidden = true;
    }

    if (playerMeta) {
        playerMeta.textContent = `${game.year} · ${game.publisher} · ${game.category.map(formatGenre).join(', ')}`;
    }

    if (playerSource) {
        playerSource.href = usesOwnPlayer ? playerUrl : game.source;
        playerSource.textContent = usesOwnPlayer ? 'Open own player' : 'Provider source';
    }

    rememberRecentGame(game, usesOwnPlayer ? 'emulatorjs' : 'external');

    if (shouldScroll) {
        document.getElementById('player')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    window.awTrack?.('game_play', {
        game_title: game.title,
        game_mode: usesOwnPlayer ? 'emulatorjs' : 'external',
        game_year: game.year,
        game_publisher: game.publisher,
        game_category: game.category.join(',')
    });
}

if (gameGrid) {
    const gameParams = new URLSearchParams(window.location.search);
    const searchParam = gameParams.get('search');
    const genreParam = gameParams.get('genre')?.toLowerCase();

    if (gameSearch && searchParam) {
        gameSearch.value = searchParam;
    }

    if (genreParam && getGenres().includes(genreParam)) {
        activeFilter = genreParam;
    }

    renderFilters();
    renderAdvancedFilters();
    renderGames();
}

if (gameSearch) {
    gameSearch.addEventListener('input', () => {
        renderGames();
        window.clearTimeout(searchTrackTimer);
        searchTrackTimer = window.setTimeout(() => {
            const query = gameSearch.value.trim();

            if (query.length > 1) {
                window.awTrack?.('game_search', {
                    search_term: query
                });
            }
        }, 700);
    });
}

[decadeFilter, modeFilter, sortFilter].forEach((select) => {
    select?.addEventListener('change', () => {
        renderGames();
        window.awTrack?.('advanced_filter_select', {
            filter_id: select.id,
            filter_value: select.value
        });
    });
});

if (gameFilters) {
    gameFilters.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-filter]');

        if (!button) {
            return;
        }

        activeFilter = button.dataset.filter;
        gameFilters.querySelectorAll('button').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        renderGames();
        window.awTrack?.('filter_select', {
            filter_name: activeFilter
        });
    });
}

if (postGrid) {
    let visiblePostLimit = 12;
    let postSearchTimer;

    const escapeBlogMarkup = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const displayPostDate = (value) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? value
            : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    };

    const categories = [...new Set(posts.map((post) => post.category))].sort();
    if (postCategory) {
        postCategory.innerHTML = [
            '<option value="all">All categories</option>',
            ...categories.map((category) => `<option value="${escapeBlogMarkup(category)}">${escapeBlogMarkup(category)}</option>`)
        ].join('');
    }

    const renderPosts = () => {
        const query = postSearch?.value.trim().toLowerCase() || '';
        const category = postCategory?.value || 'all';
        const matchingPosts = posts.filter((post) => {
            const searchable = `${post.title} ${post.excerpt} ${post.category} ${post.type || ''}`.toLowerCase();
            return (category === 'all' || post.category === category) && searchable.includes(query);
        });
        const visiblePosts = matchingPosts.slice(0, visiblePostLimit);

        postGrid.innerHTML = visiblePosts.map((post, index) => `
            <article class="post-card${index === 0 && !query && category === 'all' ? ' lead-story' : ''}">
                <img src="${escapeBlogMarkup(post.image)}" alt="${escapeBlogMarkup(post.imageAlt || `${post.title} visual`)}" loading="${index === 0 ? 'eager' : 'lazy'}">
                <div>
                    <span class="story-label">${escapeBlogMarkup(post.type || 'guide')} · ${escapeBlogMarkup(post.category)}</span>
                    <time datetime="${escapeBlogMarkup(post.publishedAt || post.date)}">${escapeBlogMarkup(displayPostDate(post.publishedAt || post.date))}</time>
                    <h2>${escapeBlogMarkup(post.shortTitle || post.title)}</h2>
                    <p>${escapeBlogMarkup(post.excerpt)}</p>
                    <a href="${escapeBlogMarkup(post.url || `blog/${post.slug}.html`)}" data-post-title="${escapeBlogMarkup(post.title)}" data-post-type="${escapeBlogMarkup(post.type || 'guide')}">${post.type === 'news' ? 'Read news' : 'Read story'}</a>
                </div>
            </article>
        `).join('');

        if (postCount) postCount.textContent = `${matchingPosts.length} ${matchingPosts.length === 1 ? 'story' : 'stories'}`;
        if (postEmpty) postEmpty.hidden = matchingPosts.length !== 0;
        if (postLoadMore) postLoadMore.hidden = matchingPosts.length <= visiblePostLimit;

        postGrid.querySelectorAll('a[data-post-title]').forEach((link) => {
            link.addEventListener('click', () => {
                window.awTrack?.('blog_post_open', {
                    post_title: link.dataset.postTitle,
                    content_type: link.dataset.postType
                });
            });
        });
    };

    postSearch?.addEventListener('input', () => {
        visiblePostLimit = 12;
        renderPosts();
        window.clearTimeout(postSearchTimer);
        postSearchTimer = window.setTimeout(() => {
            const query = postSearch.value.trim();
            if (query) window.awTrack?.('blog_search', { search_term: query });
        }, 700);
    });

    postCategory?.addEventListener('change', () => {
        visiblePostLimit = 12;
        renderPosts();
        window.awTrack?.('blog_category_select', { category: postCategory.value });
    });

    postLoadMore?.addEventListener('click', () => {
        visiblePostLimit += 12;
        renderPosts();
        window.awTrack?.('blog_load_more', { visible_count: visiblePostLimit });
    });

    renderPosts();
}

const articleSlug = document.body.dataset.articleSlug;
if (articleSlug) {
    document.querySelectorAll('a[data-article-source]').forEach((link) => {
        link.addEventListener('click', () => {
            window.awTrack?.('article_source_open', {
                article_slug: articleSlug,
                source_name: link.dataset.articleSource
            });
        });
    });

    document.querySelectorAll('a[data-related-article]').forEach((link) => {
        link.addEventListener('click', () => {
            window.awTrack?.('article_related_open', {
                article_slug: articleSlug,
                related_slug: link.dataset.relatedArticle
            });
        });
    });

    document.querySelectorAll('a[data-article-cta]').forEach((link) => {
        link.addEventListener('click', () => {
            window.awTrack?.('article_cta_click', {
                article_slug: articleSlug,
                cta_name: link.dataset.articleCta
            });
        });
    });
}

document.querySelectorAll('a[href*="player.html?local=1"]').forEach((link) => {
    link.addEventListener('click', () => {
        window.awTrack?.('local_import_open', {
            source_page: window.location.pathname
        });
    });
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}

window.addEventListener('beforeinstallprompt', () => {
    window.awTrack?.('pwa_install_prompt', {
        source_page: window.location.pathname
    });
});
