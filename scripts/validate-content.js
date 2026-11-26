const fs = require('fs');
const path = require('path');
const { loadAllPosts } = require('./content-utils');

const root = path.join(__dirname, '..');
const errors = [];
const warnings = [];

function issue(collection, post, message) {
    collection.push(`${post.sourceFile || post.slug}: ${message}`);
}

function validDate(value) {
    return value && !Number.isNaN(Date.parse(value));
}

function wordCount(post) {
    const sections = (post.sections || []).flatMap((section) => [
        section.body,
        ...(section.paragraphs || []),
        ...(section.bullets || [])
    ]);
    return [post.excerpt, post.quickTake, post.whyCare, post.playerMove, ...sections]
        .filter(Boolean)
        .join(' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
}

let posts;
try {
    posts = loadAllPosts(root);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

const seenSlugs = new Map();

posts.forEach((post) => {
    if (!post.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) {
        issue(errors, post, 'slug must contain lowercase letters, numbers and hyphens only');
    } else if (seenSlugs.has(post.slug)) {
        issue(errors, post, `duplicate slug (also in ${seenSlugs.get(post.slug)})`);
    } else {
        seenSlugs.set(post.slug, post.sourceFile);
    }

    if (!['draft', 'published'].includes(post.status)) {
        issue(errors, post, 'status must be "draft" or "published"');
    }

    if (post.status !== 'published') {
        if (JSON.stringify(post).includes('TODO:')) issue(warnings, post, 'draft still contains TODO fields');
        return;
    }

    ['title', 'category', 'excerpt', 'quickTake', 'whyCare', 'playerMove', 'image', 'imageAlt'].forEach((field) => {
        if (!String(post[field] || '').trim()) issue(errors, post, `missing ${field}`);
        if (String(post[field] || '').includes('TODO:')) issue(errors, post, `${field} still contains TODO text`);
    });

    if (!['news', 'guide', 'analysis', 'review'].includes(post.type)) {
        issue(errors, post, 'type must be news, guide, analysis or review');
    }
    if (!validDate(post.publishedAt)) issue(errors, post, 'publishedAt must be a valid date with time zone');
    if (!validDate(post.modifiedAt)) issue(errors, post, 'modifiedAt must be a valid date with time zone');
    if (validDate(post.publishedAt) && validDate(post.modifiedAt) && Date.parse(post.modifiedAt) < Date.parse(post.publishedAt)) {
        issue(errors, post, 'modifiedAt cannot be earlier than publishedAt');
    }
    if (!post.author?.name || !post.author?.url) issue(errors, post, 'author name and URL are required');
    if (!Array.isArray(post.sections) || post.sections.length < 3) issue(errors, post, 'add at least three useful sections');
    if (['news', 'analysis'].includes(post.type) && (!Array.isArray(post.sources) || post.sources.length < 2)) {
        issue(errors, post, 'news and analysis require at least two sources');
    }
    (post.sources || []).forEach((source, index) => {
        if (!source.label || !/^https:\/\//i.test(source.url || '')) issue(errors, post, `source ${index + 1} needs a label and HTTPS URL`);
    });

    const imagePath = path.join(root, post.image || '');
    if (post.image && !fs.existsSync(imagePath)) issue(errors, post, `image does not exist: ${post.image}`);
    if ((post.excerpt || '').length > 180) issue(warnings, post, 'excerpt is longer than 180 characters');
    if ((post.title || '').length > 110) issue(warnings, post, 'title is longer than 110 characters');
    if (post.sourceFile !== 'data/blog-data.js' && wordCount(post) < 250) {
        issue(warnings, post, 'article is short; confirm it fully answers the reader\'s question');
    }
});

warnings.forEach((warning) => console.warn(`WARN: ${warning}`));
errors.forEach((error) => console.error(`ERROR: ${error}`));

if (errors.length) {
    console.error(`Content validation failed with ${errors.length} error(s).`);
    process.exit(1);
}

console.log(`Content validation passed: ${posts.filter((post) => post.status === 'published').length} published, ${posts.filter((post) => post.status === 'draft').length} draft.`);
