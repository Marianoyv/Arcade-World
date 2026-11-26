const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function argumentsToObject(values) {
    const result = {};
    const positionals = [];

    for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        if (!value.startsWith('--')) {
            positionals.push(value);
            continue;
        }

        const [rawKey, inlineValue] = value.slice(2).split(/=(.*)/s, 2);
        result[rawKey] = inlineValue === undefined ? values[++index] : inlineValue;
    }

    result.title ||= positionals[0];
    result.category ||= positionals[1];
    return result;
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const args = argumentsToObject(process.argv.slice(2));
const title = String(args.title || '').trim();

if (!title) {
    console.error('Usage: npm run news:new -- "Article title" "Industry"');
    process.exit(1);
}

const slug = slugify(args.slug || title);
const articlesDir = path.join(root, 'content', 'articles');
const destination = path.join(articlesDir, `${slug}.json`);

if (!slug || !destination.startsWith(articlesDir + path.sep)) {
    console.error('The article slug is not valid.');
    process.exit(1);
}

if (fs.existsSync(destination)) {
    console.error(`Article already exists: content/articles/${slug}.json`);
    process.exit(1);
}

const now = new Date().toISOString();
const article = {
    status: 'draft',
    type: 'news',
    slug,
    title,
    shortTitle: title,
    category: args.category || 'Industry',
    publishedAt: now,
    modifiedAt: now,
    author: {
        name: 'Arcade World Editorial',
        type: 'Organization',
        url: 'https://arcade-world.web.app/about.html'
    },
    excerpt: 'TODO: Summarize the confirmed news and its relevance in one clear sentence.',
    quickTake: 'TODO: What happened, without hype or speculation.',
    whyCare: 'TODO: Explain the real impact for players.',
    playerMove: 'TODO: State what the reader should watch, do or avoid next.',
    image: `img/blog/${slug}.jpg`,
    imageAlt: 'TODO: Describe the article image for readers who cannot see it.',
    imageCredit: 'TODO: Image credit and usage permission',
    showImageCredit: true,
    keywords: [],
    sections: [
        {
            title: 'What happened',
            paragraphs: ['TODO: Lead with confirmed facts, names, dates and scope.']
        },
        {
            title: 'Why it matters',
            paragraphs: ['TODO: Add context and explain the consequence for gamers.']
        },
        {
            title: 'The Arcade World take',
            paragraphs: ['TODO: Add original analysis instead of repeating the sources.']
        },
        {
            title: 'What happens next',
            paragraphs: ['TODO: Separate confirmed next steps from open questions.']
        }
    ],
    sources: []
};

fs.mkdirSync(articlesDir, { recursive: true });
fs.writeFileSync(destination, `${JSON.stringify(article, null, 4)}\n`, 'utf8');
console.log(`Draft created: content/articles/${slug}.json`);
console.log('Complete the TODO fields, add at least two sources and an image, then change status to "published".');
