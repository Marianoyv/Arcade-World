const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const outputDir = path.join(root, 'img', 'blog');

const coverSlugs = new Set([
    'how-arcade-world-handles-roms',
    'how-to-play-arcade-games-on-pc',
    'best-legal-homebrew-rom-sources',
    'mame-vs-emulatorjs',
    'what-are-save-states',
    'best-arcade-beat-em-ups',
    'best-arcade-shooters',
    'pac-man-history-and-how-to-play',
    'galaga-beginner-guide',
    'metal-slug-why-it-still-hits',
    'street-fighter-ii-arcade-basics',
    'how-to-build-a-retro-game-library',
    'browser-vs-desktop-emulation',
    'best-platform-arcade-games',
    'best-puzzle-arcade-games',
    'how-to-use-a-local-rom-importer',
    'arcade-world-roadmap',
    'why-game-pages-matter-for-seo',
    'homebrew-creators-and-arcade-world',
    'retro-controllers-for-desktop-arcade',
    'best-mame-arcade-games-for-beginners',
    'how-to-organize-rom-files',
    'what-is-a-bios-file-in-emulation',
    'arcade-vs-console-roms',
    'how-save-data-works-in-desktop-emulators',
    'best-retro-games-for-short-sessions',
    'how-to-use-keyboard-controls-in-arcade-games',
    'why-homebrew-games-are-important',
    'how-to-find-public-domain-games',
    'arcade-game-genres-explained',
    'how-to-build-a-high-score-routine',
    'best-coop-arcade-games',
    'retro-game-preservation-explained',
    'how-arcade-world-local-library-works',
    'best-arcade-racing-games',
    'how-to-choose-an-emulator-core',
    'why-ads-hurt-browser-games',
    'how-to-submit-homebrew-to-arcade-world',
    'best-games-for-arcade-sticks',
    'how-to-make-a-retro-site-rank'
]);

const palettes = {
    'Arcade lists': ['#ff2f7d', '#22d3ee', '#c8ff4d'],
    'Game guide': ['#ffbd3d', '#ff2f7d', '#22d3ee'],
    Emulation: ['#22d3ee', '#8b5cf6', '#c8ff4d'],
    Guide: ['#c8ff4d', '#22d3ee', '#ffbd3d'],
    Homebrew: ['#c8ff4d', '#ff2f7d', '#22d3ee'],
    Library: ['#8b5cf6', '#22d3ee', '#ffbd3d'],
    Product: ['#ff2f7d', '#ffbd3d', '#22d3ee'],
    SEO: ['#22d3ee', '#c8ff4d', '#ff2f7d'],
    Community: ['#ffbd3d', '#c8ff4d', '#ff2f7d'],
    Hardware: ['#ffbd3d', '#22d3ee', '#ff2f7d'],
    Preservation: ['#8b5cf6', '#ffbd3d', '#22d3ee']
};

function loadPosts() {
    const sandbox = { window: {} };
    const source = fs.readFileSync(path.join(root, 'data', 'blog-data.js'), 'utf8');
    vm.runInNewContext(source, sandbox, { filename: 'data/blog-data.js' });
    return sandbox.window.ARCADE_POSTS;
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function hash(value) {
    return [...value].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
}

function wrapTitle(title) {
    const cleaned = title
        .replace(/^How to /i, '')
        .replace(/^Why /i, '')
        .replace(/:.*$/, '')
        .replace(/\?$/, '')
        .toUpperCase();
    const words = cleaned.split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > 15 && current) {
            lines.push(current);
            current = word;
        } else {
            current = candidate;
        }
    }
    if (current) lines.push(current);
    if (lines.length > 4) {
        lines[3] = `${lines.slice(3).join(' ').slice(0, 13)}…`;
        lines.length = 4;
    }
    return lines;
}

function motif(seed, colors) {
    const variant = seed % 5;
    if (variant === 0) {
        return `<circle cx="870" cy="342" r="150" fill="none" stroke="${colors[0]}" stroke-width="18"/>
  <circle cx="870" cy="342" r="72" fill="${colors[1]}"/>
  <path d="M870 166v352M694 342h352" stroke="#08090d" stroke-width="24"/>`;
    }
    if (variant === 1) {
        return `<path d="M706 472V248l164-96 164 96v224l-164 96z" fill="#11131d" stroke="${colors[0]}" stroke-width="16"/>
  <path d="M774 342h192M870 246v192" stroke="${colors[1]}" stroke-width="28"/>`;
    }
    if (variant === 2) {
        return `<rect x="700" y="180" width="340" height="330" rx="36" fill="#11131d" stroke="${colors[0]}" stroke-width="16"/>
  <path d="M760 270h220M760 345h150M760 420h190" stroke="${colors[1]}" stroke-width="24"/>
  <circle cx="1010" cy="510" r="48" fill="${colors[2]}"/>`;
    }
    if (variant === 3) {
        return `<path d="M710 430l92-180 92 180 92-180 92 180" fill="none" stroke="${colors[0]}" stroke-width="30" stroke-linejoin="round"/>
  <circle cx="802" cy="250" r="38" fill="${colors[1]}"/>
  <circle cx="986" cy="250" r="38" fill="${colors[2]}"/>`;
    }
    return `<rect x="718" y="206" width="304" height="232" rx="42" fill="${colors[0]}"/>
  <path d="M778 322h92M824 276v92" stroke="#08090d" stroke-width="28"/>
  <circle cx="950" cy="292" r="24" fill="${colors[2]}"/>
  <circle cx="908" cy="350" r="24" fill="${colors[1]}"/>`;
}

function render(post) {
    const colors = palettes[post.category] || ['#22d3ee', '#ff2f7d', '#c8ff4d'];
    const seed = hash(post.slug);
    const lines = wrapTitle(post.shortTitle || post.title);
    const lineHeight = lines.length === 4 ? 62 : lines.length === 3 ? 70 : 78;
    const fontSize = lines.length === 4 ? 48 : lines.length === 3 ? 54 : 60;
    const title = lines.map((line, index) =>
        `<text x="80" y="${300 + (index * lineHeight)}" fill="#f7f7fb" font-family="monospace" font-size="${fontSize}" font-weight="700">${escapeXml(line)}</text>`
    ).join('\n  ');
    const dots = Array.from({ length: 8 }, (_, index) => {
        const x = 720 + ((seed >>> (index % 12)) % 360);
        const y = 118 + (((seed * (index + 3)) >>> 4) % 480);
        const color = colors[index % colors.length];
        return `<circle cx="${x}" cy="${y}" r="${8 + (index % 3) * 4}" fill="${color}" opacity=".55"/>`;
    }).join('\n  ');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(post.title)}</title>
  <desc id="desc">Arcade World editorial cover for ${escapeXml(post.category)}</desc>
  <rect width="1200" height="720" fill="#08090d"/>
  <path d="M0 120h1200M0 240h1200M0 360h1200M0 480h1200M0 600h1200M120 0v720M240 0v720M360 0v720M480 0v720M600 0v720M720 0v720M840 0v720M960 0v720M1080 0v720" stroke="#171a25" stroke-width="2"/>
  <rect x="48" y="48" width="1104" height="624" rx="28" fill="none" stroke="${colors[0]}" stroke-width="6"/>
  <rect x="80" y="82" width="520" height="54" rx="27" fill="${colors[0]}"/>
  <text x="108" y="120" fill="#08090d" font-family="monospace" font-size="25" font-weight="700">ARCADE WORLD // ${escapeXml(post.category.toUpperCase())}</text>
  ${dots}
  ${motif(seed, colors)}
  <rect x="80" y="184" width="86" height="12" fill="${colors[1]}"/>
  ${title}
  <text x="82" y="626" fill="#b8bed2" font-family="monospace" font-size="24">GUIDES · CULTURE · PRESERVATION</text>
</svg>
`;
}

fs.mkdirSync(outputDir, { recursive: true });
const posts = loadPosts().filter((post) => coverSlugs.has(post.slug));

if (posts.length !== coverSlugs.size) {
    const found = new Set(posts.map((post) => post.slug));
    const missing = [...coverSlugs].filter((slug) => !found.has(slug));
    throw new Error(`Missing article data for: ${missing.join(', ')}`);
}

for (const post of posts) {
    fs.writeFileSync(path.join(outputDir, `${post.slug}.svg`), render(post), 'utf8');
}

console.log(`Generated ${posts.length} blog covers in ${path.relative(root, outputDir)}.`);
