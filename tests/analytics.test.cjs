const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const source = readFileSync('analytics.js', 'utf8');

function browser({
    origin = 'https://arcade-world.web.app',
    path = '/games.html',
    query = '',
    stored = null,
    storageFails = false,
    desktop = false
} = {}) {
    const listeners = new Map();
    const documentListeners = new Map();
    const tagRequests = [];
    const cookieWrites = [];
    const storage = new Map(stored ? [[
        'arcade-world-analytics-consent-v1',
        JSON.stringify(stored)
    ]] : []);
    const location = new URL(`${path}${query}`, origin);
    const element = (tagName = 'div') => ({
        tagName: tagName.toUpperCase(),
        dataset: {},
        hidden: false,
        append() {},
        addEventListener() {},
        setAttribute() {},
        getAttribute() { return null; },
        hasAttribute() { return false; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        closest() { return null; },
        focus() {}
    });
    const document = {
        currentScript: { src: `${origin}/analytics.js` },
        referrer: 'https://search.example/private/person@example.com?email=person@example.com',
        title: 'Game Room | Arcade World',
        readyState: 'loading',
        visibilityState: 'visible',
        documentElement: { lang: 'en', scrollHeight: 3000 },
        body: { dataset: {}, append() {} },
        head: { append: (item) => tagRequests.push(item) },
        hasFocus: () => true,
        createElement: (tagName) => element(tagName),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener(name, callback) {
            const handlers = documentListeners.get(name) || [];
            handlers.push(callback);
            documentListeners.set(name, handlers);
        }
    };
    Object.defineProperty(document, 'cookie', {
        get: () => '_ga=123; _ga_ARCADE=456; arcadeWorldFavorites=keep',
        set: (value) => cookieWrites.push(value)
    });
    const localStorage = {
        getItem(key) {
            if (storageFails) throw Error('blocked');
            return storage.get(key) || null;
        },
        setItem(key, value) {
            if (storageFails) throw Error('blocked');
            storage.set(key, value);
        },
        removeItem(key) {
            if (storageFails) throw Error('blocked');
            storage.delete(key);
        }
    };
    const window = {
        ARCADE_ANALYTICS_CONFIG: {
            measurementId: 'G-WYM8XXKMED',
            productionOrigin: 'https://arcade-world.web.app',
            productionHosts: ['arcade-world.web.app', 'arcade-world.firebaseapp.com']
        },
        ...(desktop ? { arcadeWorldDesktop: { isDesktop: true } } : {}),
        location,
        localStorage,
        innerHeight: 800,
        scrollY: 0,
        addEventListener(name, callback) {
            const handlers = listeners.get(name) || [];
            handlers.push(callback);
            listeners.set(name, handlers);
        },
        dispatchEvent(event) {
            (listeners.get(event.type) || []).forEach((callback) => callback(event));
        },
        setInterval: () => 1
    };

    vm.runInNewContext(source, {
        window,
        document,
        location,
        localStorage,
        URL,
        URLSearchParams,
        Date,
        CustomEvent: class {
            constructor(type) {
                this.type = type;
            }
        }
    });

    const calls = () => (window.dataLayer || []).map((args) => Array.from(args));
    const scripts = () => tagRequests.filter((item) => item.tagName === 'SCRIPT');
    return { window, calls, scripts, cookieWrites, storage };
}

const events = (environment) => environment.calls().filter((call) => call[0] === 'event');

test('a new production visitor starts one privacy-safe GA4 page view', () => {
    const environment = browser();
    assert.equal(environment.window.ArcadeAnalytics.isEnabled(), true);
    assert.equal(environment.window.ArcadeAnalytics.isMeasuring(), true);
    assert.equal(environment.scripts().length, 1);
    assert.equal(events(environment).filter((call) => call[1] === 'page_view').length, 1);

    const consent = environment.calls()[0];
    assert.equal(consent[0], 'consent');
    assert.equal(consent[1], 'default');
    assert.equal(consent[2].analytics_storage, 'granted');
    assert.equal(consent[2].ad_storage, 'denied');
    assert.equal(consent[2].ad_user_data, 'denied');
    assert.equal(consent[2].ad_personalization, 'denied');

    const configuration = environment.calls().find((call) => call[0] === 'config');
    assert.equal(configuration[2].send_page_view, false);
    assert.equal(configuration[2].allow_google_signals, false);
    assert.equal(configuration[2].allow_ad_personalization_signals, false);
    assert.equal(configuration[2].page_location, 'https://arcade-world.web.app/games.html');
    assert.equal(configuration[2].page_referrer, 'https://search.example/');
});

test('campaign and ad click attribution reach GA4 without unrelated query data', () => {
    const environment = browser({ query: '?utm_source=newsletter&utm_medium=email&utm_campaign=launch&gclid=abc.123&email=private%40example.com' });
    const pageView = events(environment).find((call) => call[1] === 'page_view')[2];
    assert.match(pageView.page_location, /utm_source=newsletter/);
    assert.match(pageView.page_location, /utm_medium=email/);
    assert.match(pageView.page_location, /gclid=abc.123/);
    assert.doesNotMatch(pageView.page_location, /private|email=/);
    const untagged = browser({ query: '?email=private%40example.com' });
    assert.equal(events(untagged)[0][2].page_location, 'https://arcade-world.web.app/games.html');
});

test('preview traffic stays isolated while local debug queues calls without collection', () => {
    const preview = browser({ origin: 'http://127.0.0.1:8000' });
    assert.equal(preview.window.ArcadeAnalytics.isMeasuring(), false);
    assert.equal(preview.scripts().length, 0);
    assert.equal(preview.calls().length, 0);

    const debug = browser({ origin: 'http://127.0.0.1:8000', query: '?analytics_debug=1' });
    assert.equal(debug.window.ArcadeAnalytics.isMeasuring(), true);
    assert.equal(debug.window.ArcadeAnalytics.collect, false);
    assert.equal(debug.scripts().length, 0);
    assert.equal(events(debug).filter((call) => call[1] === 'page_view').length, 1);
    assert.equal(debug.calls().find((call) => call[0] === 'config')[2].debug_mode, true);
});

test('the trusted Electron localhost runtime collects desktop events against canonical URLs', () => {
    const environment = browser({
        origin: 'http://127.0.0.1:43127',
        desktop: true
    });
    assert.equal(environment.window.ArcadeAnalytics.desktop, true);
    assert.equal(environment.window.ArcadeAnalytics.collect, true);
    assert.equal(environment.scripts().length, 1);
    assert.equal(environment.window.awTrack('desktop_game_launch', {
        game_title: 'Mercenaries 2',
        emulator: 'pcsx2',
        status: 'launched'
    }), true);

    const configuration = environment.calls().find((call) => call[0] === 'config');
    assert.equal(configuration[2].page_location, 'https://arcade-world.web.app/games.html');
    assert.equal(configuration[2].page_referrer, '');
    const pageView = events(environment).find((call) => call[1] === 'page_view');
    assert.equal(pageView[2].app_surface, 'desktop');
});

test('ordinary localhost pages cannot impersonate the desktop runtime', () => {
    const environment = browser({ origin: 'http://127.0.0.1:43127' });
    assert.equal(environment.window.ArcadeAnalytics.desktop, false);
    assert.equal(environment.window.ArcadeAnalytics.collect, false);
    assert.equal(environment.window.awTrack('desktop_game_launch', {}), false);
    assert.equal(environment.scripts().length, 0);
});

test('cookieless mode measures events and strips sensitive or unknown parameters', () => {
    const environment = browser({
        stored: { choice: 'denied', version: 1, savedAt: Date.now() }
    });
    assert.equal(environment.window.ArcadeAnalytics.isEnabled(), false);
    assert.equal(environment.window.ArcadeAnalytics.isMeasuring(), true);
    assert.equal(environment.calls()[0][2].analytics_storage, 'denied');

    const accepted = environment.window.awTrack('game_play', {
        game_title: 'person@example.com',
        game_year: 1981,
        game_category: 'maze',
        link_url: 'https://example.com/private?id=123',
        unexpected: 'drop me'
    });
    assert.equal(accepted, true);
    const payload = events(environment).at(-1)[2];
    assert.equal(payload.game_title, undefined);
    assert.equal(payload.game_year, 1981);
    assert.equal(payload.game_category, 'maze');
    assert.equal(payload.link_url, undefined);
    assert.equal(payload.unexpected, undefined);
});

test('full opt-out stops collection and can be reversed without duplicate page views', () => {
    const environment = browser({
        stored: { choice: 'disabled', version: 1, savedAt: Date.now() }
    });
    assert.equal(environment.window.ArcadeAnalytics.isMeasuring(), false);
    assert.equal(environment.scripts().length, 0);
    assert.equal(environment.window.awTrack('game_search', { search_term: 'galaga' }), false);

    assert.equal(environment.window.ArcadeAnalytics.setConsent('granted'), true);
    assert.equal(environment.window.ArcadeAnalytics.isMeasuring(), true);
    assert.equal(environment.scripts().length, 1);
    assert.equal(events(environment).filter((call) => call[1] === 'page_view').length, 1);
    assert.equal(
        JSON.parse(environment.storage.get('arcade-world-analytics-consent-v1')).choice,
        'granted'
    );
});

test('revoking analytics storage clears GA cookies but preserves product storage', () => {
    const environment = browser();
    environment.storage.set('arcadeWorldFavorites', '["galaga"]');
    environment.window.ArcadeAnalytics.setConsent('denied');

    assert.equal(environment.storage.get('arcadeWorldFavorites'), '["galaga"]');
    assert.ok(environment.cookieWrites.some((value) => value.startsWith('_ga=;')));
    assert.ok(environment.cookieWrites.some((value) => value.startsWith('_ga_ARCADE=;')));
    assert.ok(environment.cookieWrites.every((value) => !value.startsWith('arcadeWorldFavorites=')));
});

test('only allowlisted events and safe outbound domains are accepted', () => {
    const environment = browser();
    assert.equal(environment.window.awTrack('made_up_event', {}), false);
    assert.equal(environment.window.awTrack('outbound_link_click', {
        link_domain: 'creator.example',
        link_text: 'Official page'
    }), true);
    const payload = events(environment).at(-1)[2];
    assert.equal(payload.link_domain, 'creator.example');
    assert.equal(payload.link_text, 'Official page');
});

test('every product event currently emitted by Arcade World is allowlisted', () => {
    const environment = browser();
    const files = ['main.js', 'home-games.js', 'library.js', 'legal-games.js', 'player.js'];
    const emitted = new Set(['favorite_add', 'favorite_remove']);
    const pattern = /awTrack\?\.\('([^']+)'/g;

    files.forEach((file) => {
        const content = readFileSync(file, 'utf8');
        for (const match of content.matchAll(pattern)) emitted.add(match[1]);
    });

    emitted.forEach((eventName) => {
        assert.equal(
            environment.window.awTrack(eventName, {}),
            true,
            `${eventName} must be present in the analytics event allowlist`
        );
    });
});
