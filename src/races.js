import config from '~/config';

import './races.css';
import {flagUrl} from './racesFlags';
import {
    DISTANCE_LABEL_KEYS,
    DISTANCE_RANGES,
    HTML_LANG,
    LOCALES,
    TYPES,
    actualRangeStart,
    countryColor,
    detectLanguage,
    formatCount,
    formatDistances,
    groupDistanceLines,
    isPast,
    isoToUtcDate,
    linkTitle,
    matchesFilters,
    parseHash,
    safeHref,
    serializeHash,
    t,
} from './racesLogic';

// The competitions endpoint lives alongside the rest of the Balkan backend.
const API_URL = `${new URL(config.balkanServerUrl, window.location.origin).href}competitions`;
const LANG_STORAGE_KEY = 'runBalkanRacesLang';
const TIME_ZONE = 'Europe/Belgrade';
const LINK_ORDER = ['website', 'facebook', 'instagram', 'email'];

// 'actual': only upcoming and running races (fast first load); 'all': what the API returns by default,
// past races included. 'all' is requested when "Show past" is turned on.
const SCOPE_ACTUAL = 'actual';
const SCOPE_ALL = 'all';

// Constant icon markup; the only place where innerHTML is used (never for API data).
const SVG_OPEN = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">';
const STROKE_OPEN = '<g fill="none" stroke="currentColor" stroke-width="1.2">';
const ICONS = {
    website:
        `${SVG_OPEN}${STROKE_OPEN}<circle cx="8" cy="8" r="6.5"/>` +
        '<ellipse cx="8" cy="8" rx="3" ry="6.5"/><path d="M1.5 8h13"/></g></svg>',
    facebook:
        `${SVG_OPEN}<rect x="1" y="1" width="14" height="14" rx="3" fill="currentColor"/>` +
        '<path d="M9 15V9.2h1.8l.3-2.1H9V5.9c0-.6.2-1 1-1h1.2V3.1C11 3.1 10.4 3 9.7 3' +
        ' 8.2 3 7.2 3.9 7.2 5.6v1.5H5.4v2.1h1.8V15z" fill="#fff"/></svg>',
    instagram:
        `${SVG_OPEN}${STROKE_OPEN}<rect x="1.5" y="1.5" width="13" height="13" rx="4"/>` +
        '<circle cx="8" cy="8" r="3"/></g><circle cx="12" cy="4" r="0.9" fill="currentColor"/></svg>',
    email:
        `${SVG_OPEN}${STROKE_OPEN}<rect x="1.5" y="3" width="13" height="10" rx="1.5"/>` +
        '<path d="M2 4.2l6 5 6-5"/></g></svg>',
};

const els = {
    country: document.getElementById('filter-country'),
    countryToggle: document.getElementById('country-toggle'),
    countryMenu: document.getElementById('country-menu'),
    type: document.getElementById('filter-type'),
    typeToggle: document.getElementById('type-toggle'),
    typeMenu: document.getElementById('type-menu'),
    distance: document.getElementById('filter-distance'),
    search: document.getElementById('filter-search'),
    past: document.getElementById('filter-past'),
    reset: document.getElementById('filter-reset'),
    count: document.getElementById('races-count'),
    list: document.getElementById('races-list'),
    updated: document.getElementById('races-updated'),
    langSwitch: document.getElementById('lang-switch'),
};

let competitions = [];
let countryItems = []; // [{code, label}] sorted by label; the options of the country filter
let updatedAt = null;
let loaded = false;
let loadedScope = null; // scope of the data in `competitions`
let pendingScope = null; // scope of the request in flight
let requestId = 0;
let state = parseHash(window.location.hash.slice(1));
let lang = 'en';

function todayIso() {
    return new Date().toLocaleDateString('sv-SE', {timeZone: TIME_ZONE});
}

function formatIsoDate(iso, options) {
    const date = isoToUtcDate(iso);
    return date ? date.toLocaleDateString(LOCALES[lang], {...options, timeZone: 'UTC'}) : iso;
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function readStoredLang() {
    try {
        const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
        return stored && LOCALES[stored] ? stored : null;
    } catch (e) {
        return null;
    }
}

function storeLang(value) {
    try {
        window.localStorage.setItem(LANG_STORAGE_KEY, value);
    } catch (e) {
        // Storage may be unavailable (private mode); the language still works for this page view.
    }
}

function countryLabel(code, fallbackName) {
    if (typeof Intl.DisplayNames === 'function') {
        try {
            const label = new Intl.DisplayNames([LOCALES[lang]], {type: 'region'}).of(code);
            if (label) {
                return label;
            }
        } catch (e) {
            // Unknown region code: fall through to the API name.
        }
    }
    return fallbackName || code;
}

function updateHash() {
    const serialized = serializeHash({...state, lang});
    const url = serialized ? `#${serialized}` : window.location.pathname + window.location.search;
    window.history.replaceState(null, '', url);
}

function readControls() {
    state = {
        ...state,
        distance: els.distance.value,
        query: els.search.value,
        past: els.past.checked,
    };
}

function setOptionText(select, value, text) {
    for (const option of select.options) {
        if (option.value === value) {
            option.textContent = text;
        }
    }
}

function createCountryOption(code, labelText, flagCode) {
    const label = document.createElement('label');
    label.className = 'country-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = code;
    label.appendChild(input);
    const url = flagCode ? flagUrl(flagCode) : null;
    if (url) {
        const flag = document.createElement('img');
        flag.className = 'race-flag';
        flag.src = url;
        flag.alt = '';
        label.appendChild(flag);
    }
    label.appendChild(document.createTextNode(labelText));
    return label;
}

// Shows the selected countries on the toggle button and keeps the checkboxes in step with the state.
function syncCountryControl() {
    for (const input of els.countryMenu.querySelectorAll('input')) {
        input.checked = input.value ? state.countries.includes(input.value) : state.countries.length === 0;
    }
    let text = t(lang, 'allCountries');
    if (state.countries.length === 1) {
        const item = countryItems.find((i) => i.code === state.countries[0]);
        text = item ? item.label : countryLabel(state.countries[0]);
    } else if (state.countries.length > 1) {
        text = `${t(lang, 'countries')}: ${state.countries.length}`;
    }
    els.countryToggle.textContent = text;
}

// Same dropdown with checkboxes as the country filter, over the fixed list of race types.
function syncTypeControl() {
    for (const input of els.typeMenu.querySelectorAll('input')) {
        input.checked = input.value ? state.types.includes(input.value) : state.types.length === 0;
    }
    let text = t(lang, 'allTypes');
    if (state.types.length === 1) {
        text = t(lang, `type${state.types[0]}`);
    } else if (state.types.length > 1) {
        text = `${t(lang, 'types')}: ${state.types.length}`;
    }
    els.typeToggle.textContent = text;
}

function buildTypeOptions() {
    els.typeMenu.textContent = '';
    els.typeMenu.appendChild(createCountryOption('', t(lang, 'allTypes'), null));
    for (const type of TYPES) {
        els.typeMenu.appendChild(createCountryOption(type, t(lang, `type${type}`), null));
    }
    syncTypeControl();
}

function buildCountryOptions() {
    const names = new Map();
    for (const competition of competitions) {
        if (competition.country && !names.has(competition.country.code)) {
            names.set(competition.country.code, competition.country.name);
        }
    }
    countryItems = [...names].map(([code, countryName]) => ({code, label: countryLabel(code, countryName)}));
    countryItems.sort((a, b) => a.label.localeCompare(b.label, LOCALES[lang]));

    els.countryMenu.textContent = '';
    els.countryMenu.appendChild(createCountryOption('', t(lang, 'allCountries'), null));
    for (const item of countryItems) {
        els.countryMenu.appendChild(createCountryOption(item.code, item.label, item.code));
    }
    if (loaded) {
        state.countries = state.countries.filter((code) => names.has(code));
    }
    syncCountryControl();
}

function writeControls() {
    syncCountryControl();
    syncTypeControl();
    els.distance.value = state.distance;
    els.search.value = state.query;
    els.past.checked = state.past;
}

function applyStaticTexts() {
    for (const el of document.querySelectorAll('[data-i18n]')) {
        el.textContent = t(lang, el.dataset.i18n);
    }
    for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
        el.placeholder = t(lang, el.dataset.i18nPlaceholder);
    }
    for (const el of document.querySelectorAll('[data-i18n-aria]')) {
        el.setAttribute('aria-label', t(lang, el.dataset.i18nAria));
    }
    buildTypeOptions();
    setOptionText(els.distance, '', t(lang, 'anyDistance'));
    for (const range of DISTANCE_RANGES) {
        setOptionText(els.distance, range.key, t(lang, DISTANCE_LABEL_KEYS[range.key]));
    }
}

function applyLangButtons() {
    for (const button of els.langSwitch.querySelectorAll('button[data-lang]')) {
        const active = button.dataset.lang === lang;
        button.setAttribute('aria-pressed', String(active));
        button.classList.toggle('is-active', active);
    }
}

function applyUpdated() {
    if (!updatedAt) {
        els.updated.textContent = '';
        return;
    }
    const date = new Date(updatedAt).toLocaleDateString(LOCALES[lang], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    els.updated.textContent = t(lang, 'updated', {date});
}

function createMessage(key) {
    const p = document.createElement('p');
    p.className = 'races-message';
    p.textContent = t(lang, key);
    return p;
}

function createDateCell(competition) {
    const cell = document.createElement('div');
    cell.className = 'race-date';
    cell.textContent = formatIsoDate(competition.startDate, {weekday: 'short', day: 'numeric', month: 'short'});
    if (competition.registrationDeadline) {
        const reg = document.createElement('div');
        reg.className = 'race-reg';
        const date = formatIsoDate(competition.registrationDeadline, {day: 'numeric', month: 'short'});
        reg.textContent = t(lang, 'regTill', {date});
        cell.appendChild(reg);
    }
    return cell;
}

function createNameCell(competition) {
    const cell = document.createElement('div');
    cell.className = 'race-name';
    // Name links to the website; without one, fall back to Facebook, then Instagram.
    let href = null;
    for (const type of ['website', 'facebook', 'instagram']) {
        for (const link of competition.links.filter((l) => l.type === type)) {
            href = href || safeHref(link);
        }
    }
    let el;
    if (href) {
        el = document.createElement('a');
        el.href = href;
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
    } else {
        el = document.createElement('span');
    }
    el.textContent = competition.name;
    el.title = competition.description ? `${competition.name}\n\n${competition.description}` : competition.name;
    // The badge goes first so that the ellipsis of a long name never hides it.
    if (competition.cancelled) {
        const badge = document.createElement('span');
        badge.className = 'race-cancelled';
        badge.textContent = t(lang, 'cancelled');
        cell.appendChild(badge);
    }
    cell.appendChild(el);
    return cell;
}

function createPlaceCell(competition) {
    const cell = document.createElement('div');
    cell.className = 'race-place';
    if (competition.country) {
        const {code, name: countryName} = competition.country;
        const label = countryLabel(code, countryName);
        const url = flagUrl(code);
        if (url) {
            const flag = document.createElement('img');
            flag.className = 'race-flag';
            flag.src = url;
            flag.alt = code;
            flag.title = label;
            cell.appendChild(flag);
        } else {
            const badge = document.createElement('span');
            badge.className = 'race-country';
            badge.textContent = code;
            badge.style.backgroundColor = countryColor(code);
            badge.title = label;
            cell.appendChild(badge);
        }
    }
    if (competition.city) {
        cell.appendChild(document.createTextNode(competition.city));
    }
    return cell;
}

function createTypeCell(competition) {
    const cell = document.createElement('div');
    cell.className = 'race-type';
    const badge = document.createElement('span');
    const known = TYPES.includes(competition.type);
    badge.className = `race-badge race-badge--${known ? competition.type.toLowerCase() : 'other'}`;
    badge.textContent = known ? t(lang, `type${competition.type}`) : competition.type;
    cell.appendChild(badge);
    return cell;
}

function createDistancesCell(competition) {
    const cell = document.createElement('div');
    cell.className = 'race-distances';
    for (const line of groupDistanceLines(formatDistances(competition.distances))) {
        const lineEl = document.createElement('div');
        lineEl.className = 'race-distance-line';
        lineEl.textContent = `${line.kms.join(', ')} ${t(lang, 'km')}`;
        if (line.gain) {
            const gain = document.createElement('small');
            gain.className = 'race-gain';
            gain.textContent = ` ${line.gain}`;
            lineEl.appendChild(gain);
        }
        cell.appendChild(lineEl);
    }
    return cell;
}

function createLinkEl(link) {
    const href = safeHref(link);
    if (!href) {
        return null;
    }
    const a = document.createElement('a');
    a.className = 'race-link';
    a.href = href;
    const title = linkTitle(lang, link);
    a.title = title;
    a.setAttribute('aria-label', title);
    if (link.type !== 'email') {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
    }
    a.innerHTML = ICONS[link.type];
    return a;
}

function createLinksCell(competition) {
    const cell = document.createElement('div');
    cell.className = 'race-links';
    for (const type of LINK_ORDER) {
        for (const link of competition.links.filter((l) => l.type === type)) {
            const el = createLinkEl(link);
            if (el) {
                cell.appendChild(el);
            }
        }
    }
    return cell;
}

function createRow(competition, today) {
    const row = document.createElement('div');
    const classes = ['race'];
    if (isPast(competition, today)) {
        classes.push('race--past');
    }
    if (competition.cancelled) {
        classes.push('race--cancelled');
    }
    row.className = classes.join(' ');
    row.appendChild(createDateCell(competition));
    row.appendChild(createNameCell(competition));
    row.appendChild(createPlaceCell(competition));
    row.appendChild(createTypeCell(competition));
    row.appendChild(createDistancesCell(competition));
    row.appendChild(createLinksCell(competition));
    return row;
}

function createMonthHeader(competition) {
    const header = document.createElement('div');
    header.className = 'races-month';
    header.textContent = capitalize(formatIsoDate(competition.startDate, {month: 'long', year: 'numeric'}));
    return header;
}

function hasActiveFilters() {
    return Boolean(state.countries.length || state.types.length || state.distance || state.query || state.past);
}

function render() {
    els.reset.disabled = !hasActiveFilters();
    if (!loaded) {
        return;
    }
    const today = todayIso();
    const shown = competitions.filter((competition) => matchesFilters(competition, state, today));
    const fragment = document.createDocumentFragment();
    let currentMonth = '';
    for (const competition of shown) {
        const month = competition.startDate.slice(0, 7);
        if (month !== currentMonth) {
            currentMonth = month;
            fragment.appendChild(createMonthHeader(competition));
        }
        fragment.appendChild(createRow(competition, today));
    }
    if (shown.length === 0) {
        fragment.appendChild(createMessage('noMatch'));
    }
    els.list.textContent = '';
    els.list.appendChild(fragment);
    els.count.textContent = t(lang, 'total', {count: formatCount(lang, shown.length)});
}

function applyLanguage() {
    document.documentElement.lang = HTML_LANG[lang];
    document.title = t(lang, 'pageTitle');
    applyStaticTexts();
    applyLangButtons();
    buildCountryOptions();
    applyUpdated();
    render();
}

function setLanguage(newLang) {
    lang = newLang;
    storeLang(newLang);
    updateHash();
    applyLanguage();
}

function showError() {
    els.list.textContent = '';
    els.list.appendChild(createMessage('loadError'));
}

function onDataLoaded(data, scope) {
    competitions = Array.isArray(data.competitions) ? data.competitions : [];
    updatedAt = data.updatedAt || null;
    loaded = true;
    loadedScope = scope;
    pendingScope = null;
    buildCountryOptions();
    applyUpdated();
    writeControls();
    render();
}

function competitionsUrl(scope) {
    const url = new URL(API_URL);
    if (scope === SCOPE_ACTUAL) {
        const from = actualRangeStart(todayIso());
        if (from) {
            url.searchParams.set('from', from);
        }
    }
    return url.href;
}

function showLoading() {
    els.list.textContent = '';
    els.list.appendChild(createMessage('loading'));
    els.count.textContent = '';
}

function loadCompetitions(scope) {
    requestId += 1;
    const id = requestId;
    loaded = false;
    loadedScope = null;
    pendingScope = scope;
    showLoading();
    fetch(competitionsUrl(scope))
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            // A newer request has been started since: its answer is the one to show.
            if (id === requestId) {
                onDataLoaded(data, scope);
            }
        })
        .catch(() => {
            if (id === requestId) {
                pendingScope = null;
                showError();
            }
        });
}

function scopeCovers(available, needed) {
    return available === SCOPE_ALL || available === needed;
}

// Loads data only when the current "Show past" state needs more than is loaded or already requested.
// Turning "Show past" off needs no request: the loaded data is filtered on the client.
function ensureData() {
    const needed = state.past ? SCOPE_ALL : SCOPE_ACTUAL;
    if (!scopeCovers(loadedScope, needed) && !scopeCovers(pendingScope, needed)) {
        loadCompetitions(needed);
    }
}

function onFiltersChanged() {
    const wasPast = state.past;
    readControls();
    updateHash();
    if (state.past !== wasPast) {
        ensureData();
    }
    render();
}

function onResetClick() {
    state = {...state, countries: [], types: [], distance: '', query: '', past: false};
    writeControls();
    updateHash();
    render();
}

function setMenuOpen(menu, toggle, isOpen) {
    menu.hidden = !isOpen;
    toggle.setAttribute('aria-expanded', String(isOpen));
}

function setCountryMenuOpen(isOpen) {
    setMenuOpen(els.countryMenu, els.countryToggle, isOpen);
}

function setTypeMenuOpen(isOpen) {
    setMenuOpen(els.typeMenu, els.typeToggle, isOpen);
}

// Only one dropdown is open at a time.
function onCountryToggleClick() {
    setTypeMenuOpen(false);
    setCountryMenuOpen(els.countryMenu.hidden);
}

function onTypeToggleClick() {
    setCountryMenuOpen(false);
    setTypeMenuOpen(els.typeMenu.hidden);
}

function onTypeMenuChange(changeEvent) {
    const input = changeEvent.target;
    const selected = new Set(state.types);
    if (input.checked) {
        selected.add(input.value);
    } else {
        selected.delete(input.value);
    }
    // "All types" (empty value) clears the selection; it cannot be unchecked on its own.
    state.types = input.value ? TYPES.filter((type) => selected.has(type)) : [];
    syncTypeControl();
    updateHash();
    render();
}

function onCountryMenuChange(changeEvent) {
    const input = changeEvent.target;
    const selected = new Set(state.countries);
    if (input.checked) {
        selected.add(input.value);
    } else {
        selected.delete(input.value);
    }
    // "All countries" (empty value) clears the selection; it cannot be unchecked on its own.
    state.countries = input.value ? countryItems.map((i) => i.code).filter((code) => selected.has(code)) : [];
    syncCountryControl();
    updateHash();
    render();
}

function onDocumentClick(clickEvent) {
    if (!els.countryMenu.hidden && !els.country.contains(clickEvent.target)) {
        setCountryMenuOpen(false);
    }
    if (!els.typeMenu.hidden && !els.type.contains(clickEvent.target)) {
        setTypeMenuOpen(false);
    }
}

function onDocumentKeydown(keyEvent) {
    if (keyEvent.key !== 'Escape') {
        return;
    }
    if (!els.countryMenu.hidden) {
        setCountryMenuOpen(false);
        els.countryToggle.focus();
    }
    if (!els.typeMenu.hidden) {
        setTypeMenuOpen(false);
        els.typeToggle.focus();
    }
}

function onHashChange() {
    const parsed = parseHash(window.location.hash.slice(1));
    const newLang = parsed.lang || lang;
    const langChanged = newLang !== lang;
    lang = newLang;
    state = parsed;
    ensureData();
    if (langChanged) {
        applyLanguage();
    } else {
        buildCountryOptions();
        render();
    }
    writeControls();
}

function onLangClick(clickEvent) {
    const button = clickEvent.target.closest('button[data-lang]');
    if (button) {
        setLanguage(button.dataset.lang);
    }
}

function start() {
    lang = state.lang || readStoredLang() || detectLanguage(window.navigator.languages);
    applyLanguage();
    writeControls();

    for (const control of [els.distance, els.past]) {
        control.addEventListener('change', onFiltersChanged);
    }
    els.countryToggle.addEventListener('click', onCountryToggleClick);
    els.countryMenu.addEventListener('change', onCountryMenuChange);
    els.typeToggle.addEventListener('click', onTypeToggleClick);
    els.typeMenu.addEventListener('change', onTypeMenuChange);
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeydown);
    els.search.addEventListener('input', onFiltersChanged);
    els.reset.addEventListener('click', onResetClick);
    els.langSwitch.addEventListener('click', onLangClick);
    window.addEventListener('hashchange', onHashChange);

    ensureData();
}

start();
