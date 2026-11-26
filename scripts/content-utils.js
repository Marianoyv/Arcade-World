const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DEFAULT_AUTHOR = {
    name: 'Arcade World Editorial',
    type: 'Organization',
    url: 'https://arcade-world.web.app/about.html'
};

function loadBrowserData(root, file, key) {
    const sandbox = { window: {} };
    const code = fs.readFileSync(path.join(root, file), 'utf8');
    vm.runInNewContext(code, sandbox, { filename: file });
    return sandbox.window[key] || [];
}

function normalizePost(post, sourceFile, legacy = false) {
    const publishedAt = post.publishedAt || (post.date ? `${post.date}T12:00:00-03:00` : '');
    const modifiedAt = post.modifiedAt || post.updatedAt || publishedAt;
    const fallbackSections = [
        {
            title: 'What players should know',
            body: `${post.excerpt || ''} The useful version of this topic is practical: what to click, what to avoid and how it improves the Arcade World library.`
        },
        {
            title: 'How it fits Arcade World',
            body: 'This topic connects discovery, local play and reliable catalog pages. It helps players understand the difference between browsing a game page and running a personal file in the emulator.'
        },
        {
            title: 'Practical checklist',
            body: 'Use clear game names, stable pages, creator source notes and local-only file handling. That combination is stronger for trust and long-term platform growth.'
        }
    ];

    return {
        ...post,
        status: post.status || 'published',
        type: post.type || (legacy ? 'guide' : 'news'),
        publishedAt,
        modifiedAt,
        date: post.date || publishedAt.slice(0, 10),
        author: { ...DEFAULT_AUTHOR, ...(post.author || {}) },
        quickTake: post.quickTake || post.excerpt,
        whyCare: post.whyCare || 'This matters because players want less friction, clearer choices and faster ways to get into a good session.',
        playerMove: post.playerMove || 'Use the catalog to explore the topic and choose the play setup that fits your library.',
        imageAlt: post.imageAlt || `${post.title} article illustration`,
        sections: post.sections || fallbackSections,
        sourceFile
    };
}

function loadJsonArticles(root) {
    const articlesDir = path.join(root, 'content', 'articles');

    if (!fs.existsSync(articlesDir)) {
        return [];
    }

    return fs.readdirSync(articlesDir)
        .filter((file) => file.endsWith('.json') && !file.startsWith('_'))
        .sort()
        .map((file) => {
            const sourceFile = path.join('content', 'articles', file).replace(/\\/g, '/');
            const content = fs.readFileSync(path.join(articlesDir, file), 'utf8');

            try {
                return normalizePost(JSON.parse(content), sourceFile);
            } catch (error) {
                throw new Error(`${sourceFile}: invalid JSON (${error.message})`);
            }
        });
}

function sortPosts(posts) {
    return posts
        .map((post, index) => ({ post, index }))
        .sort((a, b) => {
            const dateDifference = Date.parse(b.post.publishedAt || b.post.date) - Date.parse(a.post.publishedAt || a.post.date);
            return dateDifference || a.index - b.index;
        })
        .map(({ post }) => post);
}

function loadAllPosts(root) {
    const legacyPosts = loadBrowserData(root, 'data/blog-data.js', 'ARCADE_POSTS')
        .map((post) => normalizePost(post, 'data/blog-data.js', true));
    return sortPosts([...legacyPosts, ...loadJsonArticles(root)]);
}

function publishedPosts(posts) {
    const now = Date.now();
    return posts.filter((post) => post.status === 'published' && Date.parse(post.publishedAt || post.date) <= now);
}

function publicPost(post) {
    return {
        slug: post.slug,
        title: post.title,
        shortTitle: post.shortTitle,
        category: post.category,
        type: post.type,
        publishedAt: post.publishedAt,
        modifiedAt: post.modifiedAt,
        date: post.date,
        excerpt: post.excerpt,
        image: post.image,
        imageAlt: post.imageAlt || `${post.title} visual`,
        author: post.author,
        url: post.url
    };
}

module.exports = {
    DEFAULT_AUTHOR,
    loadAllPosts,
    loadBrowserData,
    loadJsonArticles,
    normalizePost,
    publicPost,
    publishedPosts,
    sortPosts
};
