/* First-party GA4 boundary adapted from Pi: safe fields, production isolation and user controls. */
(() => {
    'use strict';

    const script = document.currentScript;
    const config = window.ARCADE_ANALYTICS_CONFIG || {};
    const measurementId = config.measurementId || window.ARCADE_ANALYTICS_ID || '';

    if (!/^G-[A-Z0-9]+$/i.test(measurementId)) {
        window.awTrack = () => false;
        return;
    }

    let productionOrigin;
    try {
        productionOrigin = new URL(config.productionOrigin || 'https://arcade-world.web.app');
    } catch (_) {
        window.awTrack = () => false;
        return;
    }

    const allowedHosts = new Set([
        productionOrigin.hostname,
        ...(Array.isArray(config.productionHosts) ? config.productionHosts : [])
    ].map((host) => String(host).trim().toLowerCase()).filter(Boolean));
    const debug = new URLSearchParams(window.location.search).get('analytics_debug') === '1';
    const productionRuntime = window.location.protocol === 'https:'
        && allowedHosts.has(window.location.hostname.toLowerCase());
    const desktopRuntime = window.arcadeWorldDesktop?.isDesktop === true
        && window.location.protocol === 'http:'
        && window.location.hostname === '127.0.0.1';
    const available = productionRuntime || desktopRuntime || debug;
    const collect = productionRuntime || desktopRuntime;
    const consentKey = 'arcade-world-analytics-consent-v1';
    const deniedConsent = {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
    };
    const grantedConsent = { ...deniedConsent, analytics_storage: 'granted' };
    const events = new Set([
        'advanced_filter_select',
        'article_cta_click',
        'article_engaged_time',
        'article_read_progress',
        'article_related_open',
        'article_source_open',
        'article_view',
        'blog_category_select',
        'blog_load_more',
        'blog_post_open',
        'blog_search',
        'control_click',
        'desktop_game_launch',
        'desktop_game_setup_required',
        'details_open',
        'favorite_add',
        'favorite_remove',
        'file_download',
        'filter_select',
        'form_error',
        'form_start',
        'form_submit',
        'game_detail_view',
        'game_play',
        'game_search',
        'game_search_no_results',
        'home_category_select',
        'home_game_rotation',
        'legal_platform_filter',
        'legal_source_click',
        'library_view',
        'local_import_open',
        'local_rom_loaded',
        'navigation_click',
        'outbound_link_click',
        'page_engaged_time',
        'page_read_progress',
        'pwa_install',
        'pwa_install_prompt',
        'section_view',
        'video_complete',
        'video_progress',
        'video_start',
        'web_vital'
    ]);
    const fields = new Set([
        'article_slug',
        'category',
        'content_type',
        'control_location',
        'control_name',
        'core',
        'cta_name',
        'decade',
        'destination_path',
        'details_id',
        'direction',
        'emulator',
        'error_type',
        'favorites',
        'file_extension',
        'file_name',
        'filter_id',
        'filter_name',
        'filter_value',
        'form_name',
        'game_category',
        'game_key',
        'game_mode',
        'game_publisher',
        'game_title',
        'game_year',
        'imports',
        'link_domain',
        'link_location',
        'link_text',
        'metric_delta',
        'metric_id',
        'metric_name',
        'metric_rating',
        'metric_value',
        'milestone_seconds',
        'mode',
        'navigation_type',
        'platform',
        'post_title',
        'read_percent',
        'recent',
        'related_slug',
        'search_term',
        'section_id',
        'source_name',
        'source_page',
        'status',
        'video_percent',
        'video_provider',
        'video_title',
        'visible_count'
    ]);
    const pathFields = new Set(['destination_path', 'source_page']);
    let consent = 'unknown';
    let configured = false;
    let tagLoaded = false;
    let observersStarted = false;
    let preferencesPanel = null;
    let settingsButton = null;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
        window.dataLayer.push(arguments);
    };

    function safeText(value) {
        if (typeof value !== 'string') return '';
        const text = value.trim().replace(/\s+/g, ' ').slice(0, 100);
        if (/@|mailto:|tel:|https?:\/\/|(?:\+?\d[\s().-]*){7,}/i.test(text)) return '';
        return text;
    }

    function safePath(value) {
        let path = String(value || '/').split(/[?#]/, 1)[0] || '/';
        try {
            path = decodeURIComponent(path);
        } catch (_) {
            return '/';
        }
        if (!path.startsWith('/')) path = `/${path}`;
        if (path !== '/' && !safeText(path)) return '/';
        return path.slice(0, 100);
    }

    function safeDomain(value) {
        const domain = String(value || '').trim().toLowerCase();
        return /^(?:[a-z0-9](?:[a-z0-9-]{0,62})\.)+[a-z]{2,63}$/i.test(domain)
            ? domain.slice(0, 100)
            : '';
    }

    function pageType() {
        const path = safePath(window.location.pathname).replace(/\/+$/, '') || '/';
        if (path === '/' || /\/index\.html$/i.test(path)) return 'home';
        if (/\/games\/[^/]+\.html$/i.test(path)) return 'game_detail';
        if (/\/blog\/[^/]+\.html$/i.test(path)) return 'article';
        if (/\/games\.html$/i.test(path)) return 'game_catalog';
        if (/\/blog\.html$/i.test(path)) return 'blog_hub';
        if (/\/player\.html$/i.test(path)) return 'player';
        if (/\/library\.html$/i.test(path)) return 'library';
        if (/\/404\.html$/i.test(path)) return 'not_found';
        return safeText(path.split('/').pop().replace(/\.html$/i, '').replace(/[^a-z0-9]+/gi, '_')) || 'page';
    }

    const pagePath = safePath(window.location.pathname);
    const articleSlug = safeText(document.body?.dataset.articleSlug || '');
    const articleType = safeText(document.body?.dataset.contentType || '');
    const gameSlug = /^\/games\/([^/]+)\.html$/i.exec(pagePath)?.[1] || '';
    const context = {
        page_path: pagePath,
        page_type: pageType(),
        content_language: safeText(document.documentElement.lang) || 'en',
        app_surface: desktopRuntime ? 'desktop' : 'web'
    };
    const page = {
        page_location: `${desktopRuntime ? productionOrigin.origin : window.location.origin}${pagePath}`,
        page_referrer: desktopRuntime ? '' : safeReferrer(),
        page_title: safeText(document.title) || 'Arcade World'
    };

    function safeReferrer() {
        try {
            const previous = new URL(document.referrer);
            return previous.origin + (previous.origin === window.location.origin ? safePath(previous.pathname) : '/');
        } catch (_) {
            return '';
        }
    }

    function enabled() {
        return available && consent === 'granted';
    }

    function measuring() {
        return available && configured && consent !== 'disabled';
    }

    function track(name, parameters = {}) {
        if (!measuring() || !events.has(name)) return false;
        const clean = {};

        Object.entries(parameters).forEach(([key, value]) => {
            if (!fields.has(key)) return;
            if (typeof value === 'number' && Number.isFinite(value)) {
                clean[key] = value;
                return;
            }
            if (key === 'link_domain') {
                const domain = safeDomain(value);
                if (domain) clean[key] = domain;
                return;
            }
            if (pathFields.has(key)) {
                clean[key] = safePath(value);
                return;
            }
            if (key === 'metric_id' && /^[a-z0-9-]{1,100}$/i.test(String(value))) {
                clean[key] = String(value);
                return;
            }
            const text = safeText(value);
            if (text) clean[key] = text;
        });

        window.gtag('event', name, { ...clean, ...context, transport_type: 'beacon' });
        return true;
    }

    function readChoice() {
        try {
            const stored = JSON.parse(window.localStorage.getItem(consentKey) || 'null');
            const fresh = stored?.version === 1
                && Date.now() - stored.savedAt < 180 * 86400000;
            if (fresh && ['granted', 'denied', 'disabled'].includes(stored.choice)) return stored.choice;
        } catch (_) {
            // Analytics still works when storage is blocked.
        }
        return 'unknown';
    }

    function clearMeasurementStorage() {
        try {
            window.localStorage.removeItem('arcade-world-article-origin-v1');
            window.localStorage.removeItem('arcade-world-reader-v1');
        } catch (_) {
            // Optional storage can be unavailable in private browsing.
        }

        const domains = window.location.hostname.split('.');
        document.cookie.split(';')
            .map((item) => item.split('=')[0].trim())
            .filter((name) => /^_ga(?:_|$)/.test(name))
            .forEach((name) => {
                document.cookie = `${name}=; Max-Age=0; path=/`;
                for (let index = 0; index < domains.length - 1; index += 1) {
                    document.cookie = `${name}=; Max-Age=0; path=/; domain=.${domains.slice(index).join('.')}`;
                }
            });
    }

    function campaignParameters() {
        const campaign = {};
        const query = new URLSearchParams(window.location.search);
        const mapping = {
            source: 'source',
            medium: 'medium',
            campaign: 'name',
            id: 'id',
            content: 'content',
            term: 'term'
        };

        Object.entries(mapping).forEach(([utm, field]) => {
            const value = safeText(query.get(`utm_${utm}`) || '');
            if (value) campaign[`campaign_${field}`] = value;
        });
        return campaign;
    }

    function start() {
        if (configured || consent === 'disabled') return;
        configured = true;
        window.gtag('set', { ...page, ...context });
        window.gtag('js', new Date());
        window.gtag('config', measurementId, {
            ...page,
            ...campaignParameters(),
            send_page_view: false,
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
            ...(debug ? { debug_mode: true } : {})
        });
        window.gtag('event', 'page_view', { ...page, ...context });

        if (collect && !tagLoaded) {
            tagLoaded = true;
            const tag = document.createElement('script');
            tag.async = true;
            tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
            document.head.append(tag);
        }
    }

    function syncPreferences() {
        if (!preferencesPanel) return;
        preferencesPanel.querySelectorAll('[data-analytics-consent]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.analyticsConsent === consent));
        });
        const status = preferencesPanel.querySelector('[data-analytics-status]');
        const labels = {
            granted: 'Full analytics is active.',
            denied: 'Cookieless analytics is active.',
            disabled: 'Analytics measurement is off.'
        };
        if (status) status.textContent = labels[consent] || labels.granted;
    }

    function setConsent(choice, persist = true) {
        if (!available || !['granted', 'denied', 'disabled'].includes(choice)) return false;
        const wasMeasuring = measuring();
        consent = choice;

        if (persist) {
            try {
                window.localStorage.setItem(consentKey, JSON.stringify({
                    choice,
                    version: 1,
                    savedAt: Date.now()
                }));
            } catch (_) {
                // The current choice still applies for this page view.
            }
        }

        window.gtag('consent', 'update', {
            ...deniedConsent,
            analytics_storage: choice === 'granted' ? 'granted' : 'denied'
        });
        window[`ga-disable-${measurementId}`] = choice === 'disabled';
        if (choice !== 'disabled') start();
        if (choice !== 'granted') clearMeasurementStorage();
        syncPreferences();

        if (!wasMeasuring && measuring()) {
            window.dispatchEvent(new CustomEvent('arcade:analyticsready'));
        }
        return true;
    }

    function analyticsStyles() {
        if (document.querySelector('link[data-arcade-analytics-styles]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.dataset.arcadeAnalyticsStyles = 'true';
        link.href = new URL('./css/analytics.css', script?.src || window.location.href).href;
        document.head.append(link);
    }

    function closePreferences() {
        if (!preferencesPanel) return;
        preferencesPanel.hidden = true;
        preferencesPanel.setAttribute('aria-hidden', 'true');
        settingsButton?.focus();
    }

    function openPreferences() {
        if (!available) return;
        mountPreferences();
        preferencesPanel.hidden = false;
        preferencesPanel.setAttribute('aria-hidden', 'false');
        preferencesPanel.querySelector('[data-analytics-consent]')?.focus();
    }

    function mountPreferences() {
        if (!available || preferencesPanel || !document.body) return;
        analyticsStyles();

        settingsButton = document.createElement('button');
        settingsButton.type = 'button';
        settingsButton.className = 'analytics-settings-button';
        settingsButton.textContent = 'Analytics & privacy';
        settingsButton.addEventListener('click', openPreferences);
        (document.querySelector('footer') || document.body).append(settingsButton);

        preferencesPanel = document.createElement('section');
        preferencesPanel.className = 'analytics-preferences-panel';
        preferencesPanel.setAttribute('role', 'dialog');
        preferencesPanel.setAttribute('aria-label', 'Analytics preferences');
        preferencesPanel.setAttribute('aria-hidden', 'true');
        preferencesPanel.hidden = true;
        preferencesPanel.innerHTML = `
            <div class="analytics-preferences-heading">
                <strong>Analytics preferences</strong>
                <button type="button" class="analytics-preferences-close" data-analytics-close aria-label="Close analytics preferences">&times;</button>
            </div>
            <p>Measurement is on by default without an interrupting banner. Advertising storage, Google Signals and ad personalization stay off.</p>
            <div class="analytics-preferences-actions">
                <button type="button" data-analytics-consent="granted">Keep full analytics on</button>
                <button type="button" data-analytics-consent="denied">Use cookieless measurement</button>
                <button type="button" data-analytics-consent="disabled">Turn measurement off</button>
            </div>
            <small data-analytics-status aria-live="polite"></small>
            <a href="/analytics.html">How Arcade World uses analytics</a>`;
        document.body.append(preferencesPanel);

        preferencesPanel.querySelector('[data-analytics-close]').addEventListener('click', closePreferences);
        preferencesPanel.querySelectorAll('[data-analytics-consent]').forEach((button) => {
            button.addEventListener('click', () => {
                setConsent(button.dataset.analyticsConsent);
                closePreferences();
            });
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !preferencesPanel.hidden) closePreferences();
        });
        syncPreferences();
    }

    function controlLocation(control) {
        if (control.closest('nav')) return 'navigation';
        if (control.closest('footer')) return 'footer';
        if (control.closest('form')) return 'form';
        return 'content';
    }

    function observePage() {
        if (observersStarted || !measuring()) return;
        observersStarted = true;

        if (articleSlug) {
            track('article_view', { article_slug: articleSlug, content_type: articleType || 'article' });
        } else if (gameSlug) {
            track('game_detail_view', { game_key: gameSlug });
        }

        if ('IntersectionObserver' in window) {
            const seen = new WeakSet();
            const observer = new window.IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!measuring() || !entry.isIntersecting || seen.has(entry.target)) return;
                    if (entry.intersectionRect.height < Math.min(100, entry.target.offsetHeight * 0.3)) return;
                    seen.add(entry.target);
                    const heading = entry.target.querySelector('h1, h2, h3');
                    track('section_view', {
                        section_id: entry.target.dataset.analyticsSection
                            || entry.target.getAttribute('aria-labelledby')
                            || entry.target.id
                            || heading?.textContent
                            || 'section'
                    });
                });
            }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
            document.querySelectorAll('main > section, main > article, article > section').forEach((section) => observer.observe(section));
        }

        const reached = new Set();
        const reportDepth = () => {
            if (!measuring()) return;
            const height = document.documentElement.scrollHeight - window.innerHeight;
            if (height <= 0) return;
            const percent = Math.min(100, window.scrollY / height * 100);
            [25, 50, 75, 90].forEach((value) => {
                if (percent < value || reached.has(value)) return;
                reached.add(value);
                track('page_read_progress', { read_percent: value });
                if (articleSlug) track('article_read_progress', { article_slug: articleSlug, read_percent: value });
            });
        };
        window.addEventListener('scroll', reportDepth, { passive: true });

        let engagedSeconds = 0;
        window.setInterval(() => {
            if (!measuring() || document.visibilityState !== 'visible' || !document.hasFocus()) return;
            engagedSeconds += 5;
            if (![30, 60, 120, 300].includes(engagedSeconds)) return;
            track('page_engaged_time', { milestone_seconds: engagedSeconds });
            if (articleSlug) {
                track('article_engaged_time', {
                    article_slug: articleSlug,
                    milestone_seconds: engagedSeconds
                });
            }
        }, 5000);

        document.addEventListener('click', (event) => {
            const control = event.target.closest('button, [role="button"]');
            if (control && !control.closest('.analytics-preferences-panel') && control !== settingsButton) {
                track('control_click', {
                    control_name: control.dataset.analyticsLabel
                        || control.getAttribute('aria-label')
                        || control.textContent
                        || 'button',
                    control_location: controlLocation(control)
                });
            }

            const link = event.target.closest('a[href]');
            if (!link || !measuring()) return;
            let destination;
            try {
                destination = new URL(link.href, window.location.href);
            } catch (_) {
                return;
            }

            const locationName = controlLocation(link);
            if (destination.origin !== window.location.origin) {
                track('outbound_link_click', {
                    link_domain: destination.hostname,
                    link_text: link.textContent || link.getAttribute('aria-label') || 'external link',
                    link_location: locationName
                });
                return;
            }

            if (link.closest('nav')) {
                track('navigation_click', {
                    destination_path: destination.pathname,
                    link_location: 'navigation',
                    link_text: link.textContent || link.getAttribute('aria-label') || 'navigation link'
                });
            }

            const download = destination.pathname.match(/\/([^/]+)\.([a-z0-9]{1,8})$/i);
            if (download && (link.hasAttribute('download') || /^(pdf|csv|json|zip|docx?|xlsx?|pptx?)$/i.test(download[2]))) {
                track('file_download', {
                    file_name: download[1],
                    file_extension: download[2].toLowerCase(),
                    link_location: locationName
                });
            }
        });

        const startedForms = new WeakSet();
        document.addEventListener('focusin', (event) => {
            const form = event.target.closest('form');
            if (!form || startedForms.has(form) || !measuring()) return;
            startedForms.add(form);
            track('form_start', { form_name: form.dataset.analyticsName || form.name || form.id || 'form' });
        });
        document.addEventListener('submit', (event) => {
            const form = event.target.closest('form');
            if (form) track('form_submit', { form_name: form.dataset.analyticsName || form.name || form.id || 'form' });
        });
        document.addEventListener('invalid', (event) => {
            const form = event.target.closest('form');
            if (!form) return;
            track('form_error', {
                form_name: form.dataset.analyticsName || form.name || form.id || 'form',
                error_type: event.target.getAttribute('type') || 'invalid_field'
            });
        }, true);
        document.addEventListener('toggle', (event) => {
            const details = event.target.closest('details');
            if (details?.open) {
                track('details_open', {
                    details_id: details.id || details.querySelector('summary')?.textContent || 'details'
                });
            }
        }, true);

        document.querySelectorAll('video:not([autoplay])').forEach((video) => {
            if (video.closest('[aria-hidden="true"]')) return;
            const videoTitle = video.dataset.analyticsTitle || 'arcade_video';
            const reported = new Set();
            const report = (name, percent) => {
                const key = `${name}-${percent}`;
                if (reported.has(key)) return;
                reported.add(key);
                track(name, { video_title: videoTitle, video_provider: 'html5', video_percent: percent });
            };
            video.addEventListener('play', () => report('video_start', 0));
            video.addEventListener('timeupdate', () => {
                if (!video.duration) return;
                [10, 25, 50, 75].forEach((percent) => {
                    if (video.currentTime / video.duration * 100 >= percent) report('video_progress', percent);
                });
            });
            video.addEventListener('ended', () => report('video_complete', 100));
        });

        window.addEventListener('appinstalled', () => track('pwa_install', { source_page: pagePath }));

        if ('PerformanceObserver' in window && script?.src) {
            const vitalsUrl = new URL('./vendor/web-vitals.js', script.src).href;
            import(vitalsUrl).then((vitals) => {
                const report = (metric) => track('web_vital', {
                    metric_name: metric.name,
                    metric_value: Math.round(metric.value * (metric.name === 'CLS' ? 1000 : 1)),
                    metric_delta: Math.round(metric.delta * (metric.name === 'CLS' ? 1000 : 1)),
                    metric_rating: metric.rating,
                    metric_id: metric.id,
                    navigation_type: metric.navigationType
                });
                [vitals.onLCP, vitals.onINP, vitals.onCLS, vitals.onFCP, vitals.onTTFB]
                    .filter(Boolean)
                    .forEach((register) => register(report));
            }).catch(() => {
                // Performance measurement must never interrupt site interactions.
            });
        }
    }

    window.ArcadeAnalytics = {
        track,
        isEnabled: enabled,
        isMeasuring: measuring,
        setConsent,
        openSettings: openPreferences,
        debug,
        collect,
        desktop: desktopRuntime
    };
    window.awTrack = track;

    if (!available) return;

    const storedChoice = readChoice();
    consent = storedChoice === 'unknown' ? 'granted' : storedChoice;
    window.gtag('consent', 'default', consent === 'granted' ? grantedConsent : deniedConsent);
    window[`ga-disable-${measurementId}`] = consent === 'disabled';
    if (consent !== 'disabled') start();

    const ready = (callback) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback, { once: true });
        } else {
            callback();
        }
    };
    ready(mountPreferences);
    ready(observePage);
    window.addEventListener('arcade:analyticsready', observePage);
})();
