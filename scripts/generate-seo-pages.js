const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadAllPosts, publicPost, publishedPosts } = require('./content-utils');

const root = path.join(__dirname, '..');
const siteUrl = 'https://arcade-world.web.app';

function loadBrowserData(file, key) {
    const sandbox = { window: {} };
    const code = fs.readFileSync(path.join(root, file), 'utf8');
    vm.runInNewContext(code, sandbox, { filename: file });
    return sandbox.window[key];
}

function ensureDir(dir) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
}

function writeFile(file, content) {
    fs.writeFileSync(path.join(root, file), content, 'utf8');
}

function slugify(value) {
    return value
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function gameImage(game) {
    return game.cover || game.image || '/img/arcade.png';
}

function gameMode(game) {
    if (game.mode === 'desktop' || (game.emulator && game.romPath)) {
        return `${game.emulator.toUpperCase()} desktop launcher`;
    }

    return game.rom ? 'Own player ready' : 'External fallback';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeXml(value) {
    return escapeHtml(value);
}

function absoluteUrl(value) {
    if (/^https?:\/\//i.test(value || '')) return value;
    return `${siteUrl}/${String(value || '').replace(/^\//, '')}`;
}

function formatDate(value) {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(value));
}

function articleSection(section) {
    const paragraphs = section.paragraphs || (section.body ? [section.body] : []);
    const bullets = section.bullets || [];
    return `<section class="article-section">
                <h2>${escapeHtml(section.title)}</h2>
                ${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n                ')}
                ${bullets.length ? `<ul>${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : ''}
            </section>`;
}

function readingMinutes(post) {
    const text = [
        post.excerpt,
        post.quickTake,
        post.whyCare,
        post.playerMove,
        ...(post.sections || []).flatMap((section) => [section.body, ...(section.paragraphs || []), ...(section.bullets || [])])
    ].filter(Boolean).join(' ');
    return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 220));
}

function nav(prefix = '') {
    return `
    <nav class="navbar" id="nav">
        <a href="${prefix}index.html" class="logo"><img src="${prefix}img/coin.png" alt="Insert Coin logo">Insert<br>Coin</a>
        <a href="${prefix}help.html">HELP</a>
        <a href="${prefix}freeplay.html">FREEPLAY</a>
        <a href="${prefix}library.html">LIBRARY</a>
        <a href="${prefix}blog.html">BLOG</a>
        <a href="${prefix}games.html">GAMES</a>
        <a href="javascript:void(0);" class="icon" onclick="myFunc()" aria-label="Open navigation"><i class="fa fa-bars"></i></a>
    </nav>`;
}

function analytics(prefix = '') {
    return `
    <script src="${prefix}analytics-config.js"></script>
    <script src="${prefix}analytics.js"></script>
    <script src="${prefix}main.js?v=8"></script>`;
}

const categoryGuides = {
    shooter: {
        hook: 'shooters reward pattern reading, fast recovery and clean positioning more than random firing.',
        controls: ['Keep movement short so you can dodge without losing the lane.', 'Prioritize dangerous enemies before chasing bonus points.', 'Learn enemy waves before trying aggressive score routes.'],
        faq: ['Is this good for high-score runs?', 'Yes. Shooter pages usually work well for short sessions because every mistake is visible and measurable.']
    },
    maze: {
        hook: 'maze games are about routing, pressure control and knowing when to take risks.',
        controls: ['Plan the next turn before you reach it.', 'Use corners to reset enemy movement.', 'Do not chase every pickup if the route becomes unsafe.'],
        faq: ['What should beginners practice first?', 'Focus on safe routes and repeatable escapes before score optimization.']
    },
    platform: {
        hook: 'platform arcade games mix timing, enemy spacing and vertical route control.',
        controls: ['Wait for moving hazards instead of rushing every jump.', 'Use ladders and platforms to reset enemy pressure.', 'Learn one reliable opening route before improvising.'],
        faq: ['Are platform arcade games beginner friendly?', 'They can be, but the best results come from memorizing early-stage timing.']
    },
    fighting: {
        hook: 'fighting games are built around spacing, simple confirms and matchup awareness.',
        controls: ['Start with movement, blocking and one reliable attack.', 'Avoid jumping too often unless it beats a clear pattern.', 'Play short rounds and review what hit you.'],
        faq: ['Do I need advanced combos?', 'No. Early progress comes from spacing, blocking and repeatable punishes.']
    },
    sports: {
        hook: 'sports cabinets compress competition into fast inputs, timing windows and score pressure.',
        controls: ['Learn the rhythm of each event before chasing records.', 'Use keyboard/controller inputs consistently.', 'Restart quickly when practicing a single event.'],
        faq: ['Why are sports arcade games fun today?', 'They are easy to understand, fast to replay and useful for leaderboard-style sessions.']
    },
    racing: {
        hook: 'racing games are about clean lines, controlled speed and not overcorrecting.',
        controls: ['Brake before the turn, not halfway through it.', 'Use small steering corrections.', 'Treat traffic as a rhythm problem, not a reaction test.'],
        faq: ['What matters most in arcade racing?', 'Consistency matters more than raw speed until the route is memorized.']
    },
    puzzle: {
        hook: 'puzzle arcade games stay relevant because they are readable, replayable and easy to measure.',
        controls: ['Look one move ahead instead of reacting only to the current piece.', 'Keep the playfield clean before chasing risky clears.', 'Use short sessions to improve pattern recognition.'],
        faq: ['Are puzzle games strong SEO pages?', 'Yes. They attract long-tail searches from players looking for rules, tips and quick play sessions.']
    }
};

function primaryGuide(game) {
    const category = game.category.find((item) => categoryGuides[item]) || game.category[0] || 'arcade';
    return categoryGuides[category] || {
        hook: 'classic arcade games work because the objective is clear and every session teaches something useful.',
        controls: ['Start slowly and learn the first stage.', 'Use repeatable routes before chasing scores.', 'Try similar cabinets to build category muscle memory.'],
        faq: ['What is the best way to start?', 'Play a few short runs, learn the controls and then focus on one improvement at a time.']
    };
}

function schemaTag(schema) {
    return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

function gamePage(game, allGames) {
    const slug = game.slug || slugify(game.title);
    const desktopGame = game.mode === 'desktop' || Boolean(game.emulator && game.romPath);
    const related = allGames
        .filter((item) => item.title !== game.title && item.category.some((cat) => game.category.includes(cat)))
        .slice(0, 4);
    const categoryText = game.category.map((cat) => cat.charAt(0).toUpperCase() + cat.slice(1)).join(', ');
    const platform = game.platform || 'Arcade';
    const description = desktopGame
        ? `${game.title} is a ${game.year} ${game.label.toLowerCase()} game for ${platform} by ${game.publisher}. Find it in the public Arcade World catalog and launch your legitimate local copy from the desktop app.`
        : `${game.title} is a ${game.year} ${game.label.toLowerCase()} game for ${platform} by ${game.publisher}. Learn how it plays, what category it belongs to and launch it from Arcade World.`;
    const guide = primaryGuide(game);
    const gameSchema = {
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        name: game.title,
        description,
        image: gameImage(game),
        genre: game.category,
        datePublished: String(game.year),
        publisher: { '@type': 'Organization', name: game.publisher },
        applicationCategory: 'Game',
        url: `${siteUrl}/games/${slug}.html`
    };
    const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `Can I play ${game.title} on Arcade World?`,
                acceptedAnswer: { '@type': 'Answer', text: desktopGame
                    ? `Arcade World lists ${game.title} publicly, but the game runs only in the desktop app with a locally installed emulator and a legitimate local game copy.`
                    : `Arcade World lists ${game.title} in the catalog and opens the available player flow from the Game Room.` }
            },
            {
                '@type': 'Question',
                name: guide.faq[0],
                acceptedAnswer: { '@type': 'Answer', text: guide.faq[1] }
            }
        ]
    };
    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
            { '@type': 'ListItem', position: 2, name: 'Game Room', item: `${siteUrl}/games.html` },
            { '@type': 'ListItem', position: 3, name: game.title, item: `${siteUrl}/games/${slug}.html` }
        ]
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="stylesheet" href="/css/detail.css">
    <link rel="icon" type="image/png" href="/img/favcoin.png">
    <title>${escapeHtml(game.title)} | Play and Guide | Arcade World</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${siteUrl}/games/${slug}.html">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(game.title)} | Arcade World">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${siteUrl}/games/${slug}.html">
    <meta property="og:image" content="${escapeHtml(gameImage(game))}">
    <meta name="twitter:card" content="summary_large_image">
    <script src="https://kit.fontawesome.com/70dc13288a.js" crossorigin="anonymous"></script>
    ${schemaTag(gameSchema)}
    ${schemaTag(faqSchema)}
    ${schemaTag(breadcrumbSchema)}
</head>
<body>
${nav('../')}
    <main>
        <div class="breadcrumb"><a href="../index.html">Home</a> / <a href="../games.html">Game Room</a> / ${escapeHtml(game.title)}</div>
        <section class="hero-detail">
            <div>
                <p class="eyebrow">${escapeHtml(game.label)}</p>
                <h1>${escapeHtml(game.title)}</h1>
                <p>${escapeHtml(game.description)}</p>
                <div class="cta-row">
                    <a class="button" href="../games.html?search=${encodeURIComponent(game.title)}">Open in Game Room</a>
                    ${desktopGame
                        ? `<a class="button secondary" href="${escapeHtml(game.emulatorUrl)}">Get ${escapeHtml(game.emulator.toUpperCase())}</a>`
                        : '<a class="button secondary" href="../player.html?local=1">Import local ROM</a>'}
                </div>
            </div>
            <figure class="cover"><img src="${escapeHtml(gameImage(game))}" alt="${escapeHtml(game.title)} game cover" loading="lazy"></figure>
        </section>
        <section class="meta-grid">
            <div class="meta-card"><span>Year</span><strong>${game.year}</strong></div>
            <div class="meta-card"><span>Publisher</span><strong>${escapeHtml(game.publisher)}</strong></div>
            <div class="meta-card"><span>Genre</span><strong>${escapeHtml(categoryText)}</strong></div>
            <div class="meta-card"><span>Mode</span><strong>${escapeHtml(gameMode(game))}</strong></div>
        </section>
        <section class="content-grid">
            <article class="panel">
                <h2>Why ${escapeHtml(game.title)} belongs in the catalog</h2>
                <p>${escapeHtml(game.title)} is part of Arcade World's ${escapeHtml(categoryText)} collection. It works as a discovery page for players who want a fast overview before opening the cabinet.</p>
                <p>As a ${escapeHtml(game.label.toLowerCase())}, it belongs in the catalog because ${escapeHtml(guide.hook)} The page also gives search engines stable metadata, related game links and a clear path into the playable room.</p>
                <h2>How to play</h2>
                <ul>
                    ${guide.controls.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('\n                    ')}
                    <li>${desktopGame
                        ? `Use the Arcade World desktop app with ${escapeHtml(game.emulator.toUpperCase())} and a legitimate local game copy. The public website does not host or stream the game.`
                        : 'Use local import in the desktop/player flow when you have a supported ROM file you are allowed to use.'}</li>
                </ul>
                <h2>Player FAQ</h2>
                <h3>Can I play ${escapeHtml(game.title)} on Arcade World?</h3>
                <p>${desktopGame
                    ? `The game is listed in the public catalog. Playing it requires the Arcade World desktop app, ${escapeHtml(game.emulator.toUpperCase())} and a legitimate local copy.`
                    : `Yes. Open the Game Room and search for ${escapeHtml(game.title)} to launch the available player flow.`}</p>
                <h3>${escapeHtml(guide.faq[0])}</h3>
                <p>${escapeHtml(guide.faq[1])}</p>
            </article>
            <aside class="panel">
                <h2>Library notes</h2>
                <p>Arcade World is designed as a large retro game library with search, categories, desktop import and guide content. The public catalog can scale while the app handles local files and save-state reliability.</p>
                <p><a class="button secondary" href="../get-games.html">Get more games</a></p>
            </aside>
        </section>
        <section class="link-grid">
            ${related.map((item) => `<div class="link-card"><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.label)} · ${item.year}</p><a href="${slugify(item.title)}.html">View game</a></div>`).join('\n            ')}
        </section>
    </main>
${analytics('../')}
</body>
</html>`;
}

function postPage(post, allPosts) {
    const description = post.excerpt;
    const shortTitle = post.shortTitle || post.title;
    const quickTake = post.quickTake || post.excerpt;
    const whyCare = post.whyCare || 'This matters because players want less friction, clearer choices and faster ways to get into a good session.';
    const playerMove = post.playerMove || 'Open the catalog, save what looks interesting and use local import when you want a cleaner setup.';
    const imageCredit = post.imageCredit || post.category;
    const showImageCredit = post.showImageCredit === true;
    const imageAlt = post.imageAlt || `${post.title} visual`;
    const publishedAt = post.publishedAt || `${post.date}T12:00:00-03:00`;
    const modifiedAt = post.modifiedAt || publishedAt;
    const contentType = post.type || 'guide';
    const schemaType = contentType === 'news' ? 'NewsArticle' : 'BlogPosting';
    const author = post.author || { name: 'Arcade World Editorial', type: 'Organization', url: `${siteUrl}/about.html` };
    const related = allPosts
        .filter((item) => item.slug !== post.slug)
        .sort((a, b) => Number(b.category === post.category) - Number(a.category === post.category))
        .slice(0, 3);
    const schema = {
        '@context': 'https://schema.org',
        '@type': schemaType,
        headline: post.title,
        description,
        datePublished: publishedAt,
        dateModified: modifiedAt,
        image: [absoluteUrl(post.image)],
        author: { '@type': author.type || 'Organization', name: author.name, url: author.url },
        publisher: {
            '@type': 'Organization',
            name: 'Arcade World',
            url: `${siteUrl}/about.html`,
            logo: { '@type': 'ImageObject', url: `${siteUrl}/img/logo.png` }
        },
        mainEntityOfPage: `${siteUrl}/blog/${post.slug}.html`,
        articleSection: post.category,
        keywords: post.keywords || [],
        inLanguage: 'en',
        isAccessibleForFree: true
    };
    const keywordLine = (post.keywords || []).join(', ');
    const sources = post.sources || [];
    const sectionLead = post.sections || [
        {
            title: 'What players should know',
            body: `${post.excerpt} The useful version of this topic is practical: what to click, what to avoid and how it improves the Arcade World library.`
        },
        {
            title: 'How it fits Arcade World',
            body: `This topic connects discovery, local play and reliable catalog pages. It helps players understand the difference between browsing a game page and running a personal file in the emulator.`
        },
        {
            title: 'Practical checklist',
            body: `Use clear game names, stable pages, creator source notes and local-only file handling. That combination is stronger for trust, SEO and long-term platform growth.`
        }
    ];

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="stylesheet" href="/css/detail.css">
    <link rel="alternate" type="application/rss+xml" title="Arcade World News and Guides" href="/feed.xml">
    <link rel="icon" type="image/png" href="/img/favcoin.png">
    <title>${escapeHtml(post.title)} | Arcade World Blog</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${siteUrl}/blog/${post.slug}.html">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(post.title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${siteUrl}/blog/${post.slug}.html">
    <meta property="og:image" content="${escapeHtml(absoluteUrl(post.image))}">
    <meta property="article:published_time" content="${escapeHtml(publishedAt)}">
    <meta property="article:modified_time" content="${escapeHtml(modifiedAt)}">
    <meta property="article:section" content="${escapeHtml(post.category)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="author" content="${escapeHtml(author.name)}">
    <script src="https://kit.fontawesome.com/70dc13288a.js" crossorigin="anonymous"></script>
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body data-article-slug="${escapeHtml(post.slug)}" data-content-type="${escapeHtml(contentType)}">
${nav('../')}
    <main>
        <div class="breadcrumb"><a href="../index.html">Home</a> / <a href="../blog.html">Blog</a> / ${escapeHtml(post.title)}</div>
        <article class="panel article-panel">
            <header class="article-hero">
                <div class="article-copy">
                    <p class="eyebrow">${escapeHtml(contentType)} · ${escapeHtml(post.category)}</p>
                    <h1>${escapeHtml(shortTitle)}</h1>
                    <p class="article-dek">${escapeHtml(post.excerpt)}</p>
                    <div class="article-meta">
                        <span>By <a href="${escapeHtml(author.url)}">${escapeHtml(author.name)}</a></span>
                        <time datetime="${escapeHtml(publishedAt)}">${escapeHtml(formatDate(publishedAt))}</time>
                        <span>${readingMinutes(post)} min read</span>
                        ${modifiedAt !== publishedAt ? `<span>Updated <time datetime="${escapeHtml(modifiedAt)}">${escapeHtml(formatDate(modifiedAt))}</time></span>` : ''}
                    </div>
                </div>
                <figure class="article-visual ${escapeHtml(slugify(post.category))}">
                    <img src="../${escapeHtml(post.image)}" alt="${escapeHtml(imageAlt)}" loading="eager">
                    ${showImageCredit ? `<figcaption>${escapeHtml(imageCredit)}</figcaption>` : ''}
                </figure>
            </header>
            <section class="quick-read" aria-label="Quick summary">
                <div>
                    <span>TL;DR</span>
                    <strong>${escapeHtml(quickTake)}</strong>
                </div>
                <div>
                    <span>Why gamers care</span>
                    <strong>${escapeHtml(whyCare)}</strong>
                </div>
                <div>
                    <span>Move</span>
                    <strong>${escapeHtml(playerMove)}</strong>
                </div>
            </section>
            ${sectionLead.map(articleSection).join('\n            ')}
            ${keywordLine ? `<section class="article-tags" aria-label="Article topics"><h2>Topics</h2><p>${(post.keywords || []).map((keyword) => `<span>${escapeHtml(keyword)}</span>`).join('')}</p></section>` : ''}
            ${sources.length ? `<section class="article-sources"><h2>Sources and further reading</h2>
            <ul>
                ${sources.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer" data-article-source="${escapeHtml(source.label)}">${escapeHtml(source.label)}</a></li>`).join('\n                ')}
            </ul></section>` : ''}
            <section class="article-next">
                <h2>Keep exploring</h2>
                <p>Open the <a class="button secondary" href="../games.html" data-article-cta="game-room">Game Room</a> or visit the <a class="button secondary" href="../blog.html" data-article-cta="more-stories">latest stories</a>.</p>
            </section>
        </article>
        <section class="link-grid related-stories" aria-label="Related stories">
            ${related.map((item) => `<div class="link-card"><p class="eyebrow">${escapeHtml(item.category)}</p><h2>${escapeHtml(item.shortTitle || item.title)}</h2><p>${escapeHtml(item.excerpt)}</p><a href="${item.slug}.html" data-related-article="${escapeHtml(item.slug)}">Read next</a></div>`).join('\n            ')}
        </section>
    </main>
${analytics('../')}
</body>
</html>`;
}

function hubPage(file, title, description, links, type = 'CollectionPage') {
    const prefix = file.includes('/') ? '../' : '';
    const schema = {
        '@context': 'https://schema.org',
        '@type': type,
        name: title,
        description,
        url: `${siteUrl}/${file}`
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="stylesheet" href="/css/detail.css">
    <link rel="icon" type="image/png" href="/img/favcoin.png">
    <title>${escapeHtml(title)} | Arcade World</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${siteUrl}/${file}">
    <script src="https://kit.fontawesome.com/70dc13288a.js" crossorigin="anonymous"></script>
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
${nav(prefix)}
    <main>
        <section class="panel">
            <p class="eyebrow">Arcade World hub</p>
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(description)}</p>
        </section>
        <section class="link-grid">
            ${links.map((link) => `<div class="link-card"><h2>${escapeHtml(link.title)}</h2><p>${escapeHtml(link.description)}</p><a href="${link.href}">Open</a></div>`).join('\n            ')}
        </section>
    </main>
${analytics(prefix)}
</body>
</html>`;
}

function trustPage(file, title, description, sections) {
    return hubPage(file, title, description, sections.map((section) => ({
        title: section.title,
        description: section.description,
        href: section.href
    })), 'WebPage');
}

function injectBetween(content, start, end, replacement) {
    const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
    return content.replace(pattern, `${start}\n${replacement}\n${end}`);
}

const games = loadBrowserData('data/games-data.js', 'ARCADE_GAMES');
const posts = publishedPosts(loadAllPosts(root));

ensureDir('games');
ensureDir('blog');
ensureDir('categories');

const gamesWithSlugs = games.map((game) => ({ ...game, slug: game.slug || slugify(game.title) }));
gamesWithSlugs.forEach((game) => writeFile(`games/${game.slug}.html`, gamePage(game, gamesWithSlugs)));
posts.forEach((post) => writeFile(`blog/${post.slug}.html`, postPage(post, posts)));
writeFile('data/blog-index.js', `window.ARCADE_POSTS = ${JSON.stringify(posts.map(publicPost), null, 4).replace(/</g, '\\u003c')};\n`);

const genres = [...new Set(gamesWithSlugs.flatMap((game) => game.category))].sort();
genres.forEach((genre) => {
    const genreGames = gamesWithSlugs.filter((game) => game.category.includes(genre));
    const title = `${genre.charAt(0).toUpperCase() + genre.slice(1)} Arcade Games`;
    const description = `Browse ${genreGames.length} ${genre} arcade games in Arcade World, with game pages, metadata, related classics and local import paths.`;
    const links = genreGames.map((game) => ({
        title: game.title,
        description: `${game.year} · ${game.publisher} · ${game.label}`,
        href: `../games/${game.slug}.html`
    }));
    writeFile(`categories/${genre}-games.html`, hubPage(`categories/${genre}-games.html`, title, description, links));
});

const topGameLinks = gamesWithSlugs.slice(0, 16).map((game) => ({
    title: game.title,
    description: `${game.year} · ${game.publisher} · ${game.label}`,
    href: `games/${game.slug}.html`
}));
const guideLinks = posts.filter((post) => post.type !== 'news').slice(0, 12).map((post) => ({
    title: post.title,
    description: post.excerpt,
    href: `blog/${post.slug}.html`
}));

writeFile('arcade-games.html', hubPage('arcade-games.html', 'Arcade Games Library', 'Browse the Arcade World library by classic arcade genre, publisher and era.', topGameLinks));
writeFile('retro-games.html', hubPage('retro-games.html', 'Retro Games Hub', 'Guides, game pages and collections for retro players building a personal arcade library.', [...topGameLinks.slice(0, 8), ...guideLinks.slice(0, 4)]));
writeFile('emulators.html', hubPage('emulators.html', 'Emulators and Local Play', 'Learn how Arcade World uses browser and desktop emulation, local ROM import and save states.', guideLinks.filter((link) => /emulat|rom|save|desktop/i.test(link.title + link.description))));
writeFile('homebrew-games.html', hubPage('homebrew-games.html', 'Homebrew Games', 'Discover why modern homebrew games are the cleanest playable path for a public arcade platform.', guideLinks.filter((link) => /homebrew|legal|creator/i.test(link.title + link.description))));
writeFile('guides.html', hubPage('guides.html', 'Retro Gaming Guides', 'Practical guides for arcade emulation, local imports, save states and game discovery.', guideLinks));
writeFile('creators.html', trustPage('creators.html', 'For Homebrew Creators', 'Arcade World can feature creator-approved retro games, demos and homebrew releases with clear attribution and safe player flows.', [
    { title: 'Creator-first catalog pages', description: 'Each approved game can receive a page with title, platform/core notes, screenshots, release links and attribution.', href: 'contact.html' },
    { title: 'No hidden uploads', description: 'Local imports stay on the user device. Public playable files should only be creator-approved or otherwise licensed for distribution.', href: 'privacy.html' },
    { title: 'Submission checklist', description: 'Send game title, creator name, allowed platforms, official download URL, license/permission note and cover image.', href: 'submit-game.html' }
]));
writeFile('submit-game.html', trustPage('submit-game.html', 'Submit a Homebrew Game', 'Send Arcade World a retro game, demo or homebrew release that is allowed to be listed publicly.', [
    { title: 'What to include', description: 'Game name, creator/publisher, release year, genre, platform/core, official page, screenshots and permission notes.', href: 'contact.html' },
    { title: 'Best fit', description: 'Original homebrew, demos, jam games, public-domain releases and creator-approved downloads are the strongest fit.', href: 'homebrew-games.html' },
    { title: 'Rights and removals', description: 'Creators and rights holders can request corrections, attribution changes or removals.', href: 'dmca.html' }
]));
writeFile('analytics.html', trustPage('analytics.html', 'Analytics Disclosure', 'Arcade World uses Google Analytics 4 to understand aggregate usage and improve catalog, search and player flows.', [
    { title: 'What is measured', description: 'Page views, game launches, searches, filters, favorites, reading depth, performance and aggregate interaction events.', href: 'privacy.html' },
    { title: 'Your controls', description: 'Use Analytics & privacy to keep full analytics on, switch to cookieless measurement or turn measurement off. The choice is remembered for up to 180 days.', href: 'privacy.html' },
    { title: 'What is not uploaded', description: 'Local ROM files stay on the device. Arcade World only records the selected emulator core and file extension, never the file name or contents.', href: 'player.html?local=1' },
    { title: 'Why it matters', description: 'Analytics helps identify which games, guides and features deserve priority as the catalog grows.', href: 'library.html' }
]));

writeFile('privacy.html', hubPage('privacy.html', 'Privacy Policy', 'Arcade World uses privacy-controlled analytics to understand aggregate traffic and improve the game room. Local ROM imports stay on the user device.', [
    { title: 'Analytics', description: 'GA4 measures page views and product events. Advertising storage, Google Signals and ad personalization are disabled. Visitors can use full, cookieless or disabled measurement.', href: 'analytics.html' },
    { title: 'Local files', description: 'Files selected through Import local ROM remain on the device running the browser or desktop app.', href: 'player.html?local=1' }
], 'WebPage'));
writeFile('terms.html', hubPage('terms.html', 'Terms of Use', 'Arcade World is a catalog, guide and emulator frontend. Users are responsible for using game files they own or have permission to use.', [
    { title: 'Game Room', description: 'Browse catalog entries and open available play modes.', href: 'games.html' },
    { title: 'Get Games', description: 'Find homebrew releases, creator pages and local import sources.', href: 'get-games.html' }
], 'WebPage'));
writeFile('dmca.html', hubPage('dmca.html', 'DMCA and Content Policy', 'Arcade World respects rights holders and provides a clear path for content concerns, catalog corrections and source attribution updates.', [
    { title: 'Contact', description: 'Send rights, attribution or correction requests through the contact page.', href: 'contact.html' },
    { title: 'Catalog', description: 'Review current game metadata and sources.', href: 'games.html' }
], 'WebPage'));

const gameLinksHtml = gamesWithSlugs.map((game) => `<a href="games/${game.slug}.html">${escapeHtml(game.title)}</a>`).join('\n                ');
const categoryLinksHtml = genres.map((genre) => `<a href="categories/${genre}-games.html">${escapeHtml(genre.charAt(0).toUpperCase() + genre.slice(1))} games</a>`).join('\n                ');
let gamesHtml = fs.readFileSync(path.join(root, 'games.html'), 'utf8');
if (!gamesHtml.includes('<!-- SEO_GAME_LINKS_START -->')) {
    gamesHtml = gamesHtml.replace('</main>', `        <section class="seo-game-links" aria-label="Indexed game pages">
            <h2>Indexed arcade game pages</h2>
            <div>
                <!-- SEO_GAME_LINKS_START -->
                <!-- SEO_GAME_LINKS_END -->
            </div>
        </section>
    </main>`);
}
if (!gamesHtml.includes('<!-- SEO_CATEGORY_LINKS_START -->')) {
    gamesHtml = gamesHtml.replace('<section class="seo-game-links" aria-label="Indexed game pages">', `<section class="seo-game-links" aria-label="Indexed category pages">
            <h2>Browse by arcade genre</h2>
            <div>
                <!-- SEO_CATEGORY_LINKS_START -->
                <!-- SEO_CATEGORY_LINKS_END -->
            </div>
        </section>

        <section class="seo-game-links" aria-label="Indexed game pages">`);
}
gamesHtml = injectBetween(gamesHtml, '<!-- SEO_CATEGORY_LINKS_START -->', '<!-- SEO_CATEGORY_LINKS_END -->', `                ${categoryLinksHtml}`);
gamesHtml = injectBetween(gamesHtml, '<!-- SEO_GAME_LINKS_START -->', '<!-- SEO_GAME_LINKS_END -->', `                ${gameLinksHtml}`);
writeFile('games.html', gamesHtml);

const postLinksHtml = posts.map((post) => `<a href="blog/${post.slug}.html">${escapeHtml(post.title)}</a>`).join('\n                ');
let blogHtml = fs.readFileSync(path.join(root, 'blog.html'), 'utf8');
if (!blogHtml.includes('<!-- SEO_POST_LINKS_START -->')) {
    blogHtml = blogHtml.replace('</main>', `        <section class="seo-post-links" aria-label="Indexed blog posts">
            <h2>All stories</h2>
            <div>
                <!-- SEO_POST_LINKS_START -->
                <!-- SEO_POST_LINKS_END -->
            </div>
        </section>
    </main>`);
}
blogHtml = injectBetween(blogHtml, '<!-- SEO_POST_LINKS_START -->', '<!-- SEO_POST_LINKS_END -->', `                ${postLinksHtml}`);
writeFile('blog.html', blogHtml);

const sitemapUrls = [
    '',
    'games.html',
    'blog.html',
    'get-games.html',
    'freeplay.html',
    'arcade-games.html',
    'retro-games.html',
    'emulators.html',
    'homebrew-games.html',
    'guides.html',
    'library.html',
    'creators.html',
    'submit-game.html',
    'analytics.html',
    'press-kit.html',
    'insights.html',
    'editorial-policy.html',
    'about.html',
    'contact.html',
    'help.html',
    'privacy.html',
    'terms.html',
    'dmca.html',
    ...gamesWithSlugs.map((game) => `games/${game.slug}.html`),
    ...genres.map((genre) => `categories/${genre}-games.html`),
    ...posts.map((post) => `blog/${post.slug}.html`)
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((url) => {
        const post = posts.find((item) => url === `blog/${item.slug}.html`);
        return `  <url><loc>${siteUrl}/${url}</loc>${post ? `<lastmod>${escapeXml(post.modifiedAt || post.date)}</lastmod>` : ''}</url>`;
    }).join('\n')}
</urlset>
`;
writeFile('sitemap.xml', sitemap);

const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
const freshNews = posts.filter((post) => post.type === 'news' && Date.parse(post.publishedAt) >= twoDaysAgo);
const newsSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${freshNews.map((post) => `  <url>
    <loc>${siteUrl}/blog/${escapeXml(post.slug)}.html</loc>
    <news:news>
      <news:publication><news:name>Arcade World</news:name><news:language>en</news:language></news:publication>
      <news:publication_date>${escapeXml(post.publishedAt)}</news:publication_date>
      <news:title>${escapeXml(post.title)}</news:title>
    </news:news>
  </url>`).join('\n')}
</urlset>
`;
writeFile('news-sitemap.xml', newsSitemap);

const rssPosts = posts.slice(0, 30);
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Arcade World News and Guides</title>
    <link>${siteUrl}/blog.html</link>
    <description>Gaming news, retro guides, industry analysis and Arcade World updates.</description>
    <language>en</language>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
${rssPosts.map((post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${siteUrl}/blog/${escapeXml(post.slug)}.html</link>
      <guid isPermaLink="true">${siteUrl}/blog/${escapeXml(post.slug)}.html</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <category>${escapeXml(post.category)}</category>
      <description>${escapeXml(post.excerpt)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;
writeFile('feed.xml', feed);

console.log(`Generated ${gamesWithSlugs.length} game pages, ${posts.length} blog posts, ${freshNews.length} fresh news sitemap entries and ${sitemapUrls.length} sitemap URLs.`);
