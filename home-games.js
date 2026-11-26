const homeGames = window.ARCADE_GAMES || [];
const homeTrack = document.getElementById('homeGameTrack');
const homeCategories = document.getElementById('homeGameCategories');
const homeCategoryLink = document.getElementById('homeCategoryLink');
const homeShowcase = document.getElementById('homeGameShowcase');
const homeStatus = document.getElementById('homeRotationStatus');
const homeProgress = document.getElementById('homeRotationProgress');
const homePrev = document.getElementById('homeGamesPrev');
const homeNext = document.getElementById('homeGamesNext');
const homePause = document.getElementById('homeGamesPause');
const heroGameCount = document.getElementById('heroGameCount');

if (heroGameCount) {
    heroGameCount.textContent = `${homeGames.length} ${homeGames.length === 1 ? 'Game' : 'Games'}`;
}

if (homeTrack && homeCategories && homeGames.length) {
    const rotationDelay = 5200;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let activeCategory = 'all';
    let rotationIndex = 0;
    let rotationTimer;
    let isPaused = reducedMotion.matches;
    let visibleCount = getVisibleCount();

    function slugifyGame(value) {
        return value
            .toLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function formatCategory(value) {
        return value === 'all' ? 'All games' : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
    }

    function getVisibleCount() {
        if (window.innerWidth < 640) {
            return 1;
        }

        if (window.innerWidth < 980) {
            return 2;
        }

        return 3;
    }

    function getCategoryGames() {
        return activeCategory === 'all'
            ? homeGames
            : homeGames.filter((game) => game.category.includes(activeCategory));
    }

    function getVisibleGames() {
        const categoryGames = getCategoryGames();
        return Array.from({ length: Math.min(visibleCount, categoryGames.length) }, (_, offset) => (
            categoryGames[(rotationIndex + offset) % categoryGames.length]
        ));
    }

    function gameCard(game, position) {
        const slug = slugifyGame(game.title);
        return `
            <article class="game-card rotating-game-card" style="--card-order: ${position}">
                <a class="game-card-visual" href="games/${slug}.html" aria-label="Open ${game.title}">
                    <img src="${game.image}" alt="${game.title} arcade preview" loading="lazy">
                    <span class="game-year">${game.year}</span>
                </a>
                <div>
                    <span>${game.label}</span>
                    <h3>${game.title}</h3>
                    <p>${game.description}</p>
                    <div class="rotating-card-footer">
                        <small>${game.publisher}</small>
                        <a href="games/${slug}.html">View game <i class="fa fa-arrow-right" aria-hidden="true"></i></a>
                    </div>
                </div>
            </article>`;
    }

    function restartProgress() {
        if (!homeProgress) {
            return;
        }

        homeProgress.classList.remove('is-running');
        void homeProgress.offsetWidth;

        if (!isPaused) {
            homeProgress.classList.add('is-running');
        }
    }

    function renderGames(announce = false) {
        const categoryGames = getCategoryGames();

        if (!categoryGames.length) {
            homeTrack.innerHTML = '';
            return;
        }

        rotationIndex %= categoryGames.length;
        homeTrack.classList.remove('is-entering');
        homeTrack.innerHTML = getVisibleGames().map(gameCard).join('');
        void homeTrack.offsetWidth;
        homeTrack.classList.add('is-entering');

        if (announce) {
            homeTrack.setAttribute('aria-live', 'polite');
            window.setTimeout(() => homeTrack.setAttribute('aria-live', 'off'), 600);
        }

        if (homeStatus) {
            const first = rotationIndex + 1;
            const last = Math.min(rotationIndex + visibleCount, categoryGames.length);
            homeStatus.textContent = `${formatCategory(activeCategory)} · ${first}-${last} of ${categoryGames.length}`;
        }

        restartProgress();
    }

    function scheduleRotation() {
        window.clearInterval(rotationTimer);

        if (!isPaused) {
            rotationTimer = window.setInterval(() => {
                rotationIndex = (rotationIndex + visibleCount) % getCategoryGames().length;
                renderGames();
            }, rotationDelay);
        }

        restartProgress();
    }

    function moveRotation(direction) {
        const total = getCategoryGames().length;
        rotationIndex = (rotationIndex + direction * visibleCount + total) % total;
        renderGames(true);
        scheduleRotation();
        window.awTrack?.('home_game_rotation', { direction, category: activeCategory });
    }

    function updatePauseButton() {
        if (!homePause) {
            return;
        }

        homePause.innerHTML = `<i class="fa fa-${isPaused ? 'play' : 'pause'}" aria-hidden="true"></i>`;
        homePause.setAttribute('aria-label', `${isPaused ? 'Resume' : 'Pause'} game rotation`);
        homePause.classList.toggle('active', isPaused);
    }

    const genres = [...new Set(homeGames.flatMap((game) => game.category))].sort();
    homeCategories.innerHTML = ['all', ...genres].map((genre) => `
        <button class="category-chip${genre === activeCategory ? ' active' : ''}" type="button" data-home-category="${genre}">${formatCategory(genre)}</button>
    `).join('');

    homeCategories.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-home-category]');

        if (!button) {
            return;
        }

        activeCategory = button.dataset.homeCategory;
        rotationIndex = 0;
        homeCategories.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
        homeCategoryLink.href = activeCategory === 'all' ? 'games.html' : `games.html?genre=${encodeURIComponent(activeCategory)}`;
        homeCategoryLink.textContent = activeCategory === 'all' ? 'Browse all games' : `Browse ${formatCategory(activeCategory)} games`;
        renderGames(true);
        scheduleRotation();
        window.awTrack?.('home_category_select', { category: activeCategory });
    });

    homePrev?.addEventListener('click', () => moveRotation(-1));
    homeNext?.addEventListener('click', () => moveRotation(1));
    homePause?.addEventListener('click', () => {
        isPaused = !isPaused;
        updatePauseButton();
        scheduleRotation();
    });

    homeShowcase?.addEventListener('mouseenter', () => {
        window.clearInterval(rotationTimer);
        homeProgress?.classList.remove('is-running');
    });
    homeShowcase?.addEventListener('mouseleave', scheduleRotation);

    window.addEventListener('resize', () => {
        const nextCount = getVisibleCount();

        if (nextCount !== visibleCount) {
            visibleCount = nextCount;
            renderGames();
            scheduleRotation();
        }
    });

    reducedMotion.addEventListener('change', (event) => {
        isPaused = event.matches;
        updatePauseButton();
        scheduleRotation();
    });

    updatePauseButton();
    renderGames();
    scheduleRotation();
}
