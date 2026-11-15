// Pure logic of the races page (no DOM): dates, filters, hash state, language and the i18n dictionary.

const LANGUAGES = ['en', 'sr', 'ru'];
const LOCALES = {en: 'en-GB', sr: 'sr-Latn-RS', ru: 'ru-RU'};
const HTML_LANG = {en: 'en', sr: 'sr-Latn', ru: 'ru'};

const TYPES = ['Trail', 'Asphalt', 'OCR', 'Other'];

const DISTANCE_RANGES = [
    {key: '0-10', min: 0, max: 10},
    {key: '10-21.1', min: 10, max: 21.1},
    {key: '21.1-42.2', min: 21.1, max: 42.2},
    {key: '42.2-', min: 42.2, max: Infinity},
];

const DISTANCE_LABEL_KEYS = {
    '0-10': 'distUpTo10',
    '10-21.1': 'dist10to21',
    '21.1-42.2': 'dist21to42',
    '42.2-': 'dist42',
};

const COUNTRY_COLORS = {
    RS: '#c6363c',
    ME: '#a87b00',
    BA: '#1f4e9c',
    MK: '#e0601a',
    AL: '#7a1f1f',
    GE: '#8e44ad',
    TR: '#d81b60',
    HR: '#2a7ab0',
    SI: '#00897b',
    BG: '#558b2f',
    RO: '#6d4c41',
    HU: '#3949ab',
    GR: '#0097a7',
};

const UNKNOWN_COUNTRY_COLOR = '#888';

function countryColor(code) {
    return COUNTRY_COLORS[code] || UNKNOWN_COUNTRY_COLOR;
}

const STRINGS = {
    pageTitle: {
        en: 'Running events in the Balkans — Run-Balkan',
        sr: 'Trke na Balkanu — Run-Balkan',
        ru: 'Беговые соревнования на Балканах — Run-Balkan',
    },
    heading: {
        en: 'Running events in the Balkans and near',
        sr: 'Trke na Balkanu i u okolini',
        ru: 'Беговые соревнования на Балканах и рядом',
    },
    backToMap: {en: '← Back to map', sr: '← Nazad na mapu', ru: '← Назад к карте'},
    language: {en: 'Language', sr: 'Jezik', ru: 'Язык'},
    updated: {en: 'Updated {date}', sr: 'Ažurirano {date}', ru: 'Обновлено {date}'},
    allCountries: {en: 'All countries', sr: 'Sve zemlje', ru: 'Все страны'},
    allTypes: {en: 'All types', sr: 'Svi tipovi', ru: 'Все типы'},
    anyDistance: {en: 'Any distance', sr: 'Sve distance', ru: 'Любая дистанция'},
    distUpTo10: {en: 'Up to 10 km', sr: 'Do 10 km', ru: 'До 10 км'},
    dist10to21: {en: '10–21 km', sr: '10–21 km', ru: '10–21 км'},
    dist21to42: {en: '21–42 km', sr: '21–42 km', ru: '21–42 км'},
    dist42: {en: 'Ultra 42+ km', sr: 'Ultra 42+ km', ru: 'Ультра 42+ км'},
    country: {en: 'Country', sr: 'Zemlja', ru: 'Страна'},
    type: {en: 'Type', sr: 'Tip', ru: 'Тип'},
    distance: {en: 'Distance', sr: 'Distanca', ru: 'Дистанция'},
    search: {en: 'Search by name or city', sr: 'Pretraga po nazivu ili gradu', ru: 'Поиск по названию или городу'},
    showPast: {en: 'Show past', sr: 'Prikaži prošle', ru: 'Показать прошедшие'},
    noMatch: {
        en: 'No races match these filters.',
        sr: 'Nema trka za izabrane filtere.',
        ru: 'Нет соревнований по этим фильтрам.',
    },
    loading: {en: 'Loading…', sr: 'Učitavanje…', ru: 'Загрузка…'},
    loadError: {
        en: 'Could not load races. Please try again later.',
        sr: 'Nije moguće učitati trke. Pokušajte ponovo kasnije.',
        ru: 'Не удалось загрузить соревнования. Попробуйте позже.',
    },
    regTill: {en: 'reg. till {date}', sr: 'prijave do {date}', ru: 'рег. до {date}'},
    km: {en: 'km', sr: 'km', ru: 'км'},
    sources: {en: 'Sources:', sr: 'Izvori:', ru: 'Источники:'},
    website: {en: 'Website', sr: 'Sajt', ru: 'Сайт'},
    facebook: {en: 'Facebook', sr: 'Facebook', ru: 'Facebook'},
    instagram: {en: 'Instagram', sr: 'Instagram', ru: 'Instagram'},
    email: {en: 'Email', sr: 'Email', ru: 'Почта'},
    typeTrail: {en: 'Trail', sr: 'Trail', ru: 'Трейл'},
    typeAsphalt: {en: 'Asphalt', sr: 'Asfalt', ru: 'Асфальт'},
    typeOCR: {en: 'OCR', sr: 'OCR', ru: 'OCR'},
    typeOther: {en: 'Other', sr: 'Ostalo', ru: 'Другое'},
};

const COUNT_FORMS = {
    en: {one: '{n} race', other: '{n} races'},
    sr: {one: '{n} trka', few: '{n} trke', other: '{n} trka'},
    ru: {one: '{n} соревнование', few: '{n} соревнования', many: '{n} соревнований', other: '{n} соревнования'},
};

function fillPlaceholders(template, params) {
    return template.replace(/\{(\w+)\}/gu, (match, paramName) => {
        const known = params && paramName in params;
        return known ? String(params[paramName]) : match;
    });
}

function t(lang, key, params) {
    const entry = STRINGS[key];
    if (!entry) {
        return key;
    }
    return fillPlaceholders(entry[lang] || entry.en || key, params);
}

function formatCount(lang, n) {
    const forms = COUNT_FORMS[lang] || COUNT_FORMS.en;
    const category = new Intl.PluralRules(LOCALES[lang] || LOCALES.en).select(n);
    return fillPlaceholders(forms[category] || forms.other, {n});
}

const SERBIAN_LIKE = ['sr', 'hr', 'bs', 'cnr', 'mk'];

// The first browser language that maps to ru or sr wins; otherwise en.
function detectLanguage(navigatorLanguages) {
    for (const tag of navigatorLanguages || []) {
        const primary = String(tag).toLowerCase().split('-')[0];
        if (primary === 'ru') {
            return 'ru';
        }
        if (SERBIAN_LIKE.includes(primary)) {
            return 'sr';
        }
    }
    return 'en';
}

function parseHash(hashString) {
    const params = new URLSearchParams((hashString || '').replace(/^#/u, ''));
    const lang = params.get('lang');
    const country = params.get('c') || '';
    const type = params.get('t') || '';
    const distance = params.get('d') || '';
    return {
        lang: LANGUAGES.includes(lang) ? lang : null,
        country: /^[A-Z]{2}$/u.test(country) ? country : '',
        type: TYPES.includes(type) ? type : '',
        distance: DISTANCE_RANGES.some((range) => range.key === distance) ? distance : '',
        query: params.get('q') || '',
        past: params.get('past') === '1',
    };
}

function serializeHash(state) {
    const params = new URLSearchParams();
    if (state.lang) {
        params.set('lang', state.lang);
    }
    if (state.country) {
        params.set('c', state.country);
    }
    if (state.type) {
        params.set('t', state.type);
    }
    if (state.distance) {
        params.set('d', state.distance);
    }
    if (state.query) {
        params.set('q', state.query);
    }
    if (state.past) {
        params.set('past', '1');
    }
    return params.toString();
}

function parseIsoDate(s) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(s || '');
    return match ? {y: Number(match[1]), m: Number(match[2]), d: Number(match[3])} : null;
}

function isoToUtcDate(s) {
    const parts = parseIsoDate(s);
    return parts ? new Date(Date.UTC(parts.y, parts.m - 1, parts.d)) : null;
}

// The last day of a race: the latest of its start date and the start dates of its distances.
function lastDay(competition) {
    let last = competition.startDate;
    for (const distance of competition.distances || []) {
        if (distance.startDate && distance.startDate > last) {
            last = distance.startDate;
        }
    }
    return last;
}

function isPast(competition, todayIso) {
    return lastDay(competition) < todayIso;
}

function normalizeText(s) {
    return (s || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/đ/gu, 'dj');
}

function inDistanceRange(km, range) {
    if (range.key === DISTANCE_RANGES[0].key) {
        return km >= range.min && km <= range.max;
    }
    return km > range.min && km <= range.max;
}

function matchesDistance(competition, distanceKey) {
    const range = DISTANCE_RANGES.find((r) => r.key === distanceKey);
    if (!range) {
        return true;
    }
    return (competition.distances || []).some((d) => inDistanceRange(Number(d.km), range));
}

function matchesFilters(competition, state, todayIso) {
    if (!state.past && isPast(competition, todayIso)) {
        return false;
    }
    if (state.country && !(competition.country && competition.country.code === state.country)) {
        return false;
    }
    if (state.type && competition.type !== state.type) {
        return false;
    }
    if (state.distance && !matchesDistance(competition, state.distance)) {
        return false;
    }
    if (state.query) {
        const haystack = normalizeText(`${competition.name} ${competition.city || ''}`);
        if (!haystack.includes(normalizeText(state.query.trim()))) {
            return false;
        }
    }
    return true;
}

function formatKm(km) {
    return String(Number(Math.round(Number(km) * 100) / 100));
}

// Parts like {km: '12', gain: '+400'}; the view joins them and appends the unit once at the end.
function formatGain(elevationGainM) {
    return elevationGainM === null || elevationGainM === undefined ? '' : `+${elevationGainM}`;
}

function formatDistances(distances) {
    return (distances || []).map((distance) => ({
        km: formatKm(distance.km),
        gain: formatGain(distance.elevationGainM),
    }));
}

// Each distance with a gain gets its own line; consecutive distances without a gain share one line.
function groupDistanceLines(parts) {
    const lines = [];
    for (const part of parts) {
        const last = lines[lines.length - 1];
        if (!part.gain && last && !last.gain) {
            last.kms.push(part.km);
        } else {
            lines.push({kms: [part.km], gain: part.gain});
        }
    }
    return lines;
}

// Re-check of the API data on the client: only http(s) web links and mailto: emails are allowed.
function safeHref(link) {
    const url = link && link.url ? String(link.url) : '';
    if (link && ['website', 'facebook', 'instagram'].includes(link.type)) {
        return /^https?:\/\//iu.test(url) ? url : null;
    }
    if (link && link.type === 'email') {
        return /^mailto:/iu.test(url) ? url : null;
    }
    return null;
}

export {
    DISTANCE_LABEL_KEYS,
    DISTANCE_RANGES,
    HTML_LANG,
    LOCALES,
    TYPES,
    countryColor,
    detectLanguage,
    formatCount,
    formatDistances,
    groupDistanceLines,
    inDistanceRange,
    isPast,
    isoToUtcDate,
    matchesFilters,
    parseHash,
    safeHref,
    serializeHash,
    t,
};
