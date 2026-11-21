import {
    DISTANCE_RANGES,
    actualRangeStart,
    detectLanguage,
    formatCount,
    formatDistances,
    groupDistanceLines,
    inDistanceRange,
    matchesFilters,
    parseHash,
    safeHref,
    serializeHash,
} from '~/racesLogic';

const TODAY = '2026-11-15';

function race(overrides) {
    return {
        id: 1,
        name: 'Test race',
        type: 'Trail',
        startDate: '2026-12-01',
        distances: [],
        links: [],
        country: {code: 'RS', name: 'Serbia'},
        city: null,
        ...overrides,
    };
}

function emptyState(overrides) {
    return {lang: null, countries: [], types: [], distance: '', query: '', past: false, ...overrides};
}

function rangeByKey(key) {
    return DISTANCE_RANGES.find((range) => range.key === key);
}

suite('races - detectLanguage');
[
    [['ru-RU'], 'ru'],
    [['sr-Latn-RS'], 'sr'],
    [['hr'], 'sr'],
    [['bs-BA'], 'sr'],
    [['cnr'], 'sr'],
    [['mk'], 'sr'],
    [['de-DE', 'ru'], 'ru'],
    [['de-DE', 'en-US'], 'en'],
    [[], 'en'],
    [undefined, 'en'],
].forEach(([input, expected]) => {
    test(`${JSON.stringify(input)} -> ${expected}`, () => {
        assert.equal(detectLanguage(input), expected);
    });
});

suite('races - hash');
test('round trip', () => {
    const source = 'lang=sr&c=RS&t=Trail&d=21.1-42.2&q=zlatibor&past=1';
    const parsed = parseHash(source);
    assert.deepEqual(parsed, {
        lang: 'sr',
        countries: ['RS'],
        types: ['Trail'],
        distance: '21.1-42.2',
        query: 'zlatibor',
        past: true,
    });
    assert.equal(serializeHash(parsed), source);
});
test('invalid values fall back to defaults', () => {
    const parsed = parseHash('lang=de&c=serbia&t=Road&d=5-7&past=yes');
    assert.deepEqual(parsed, emptyState());
});
test('several countries round trip', () => {
    const parsed = parseHash('c=RS,ME,BA');
    assert.deepEqual(parsed.countries, ['RS', 'ME', 'BA']);
    assert.equal(serializeHash(parsed), 'c=RS,ME,BA');
});
test('invalid and duplicate country codes are dropped', () => {
    assert.deepEqual(parseHash('c=RS,serbia,,RS,me,BA').countries, ['RS', 'BA']);
});
test('several types round trip', () => {
    const parsed = parseHash('t=Trail,OCR');
    assert.deepEqual(parsed.types, ['Trail', 'OCR']);
    assert.equal(serializeHash(parsed), 't=Trail,OCR');
});
test('invalid and duplicate types are dropped', () => {
    assert.deepEqual(parseHash('t=Trail,Road,,Trail,ocr,OCR').types, ['Trail', 'OCR']);
});
test('empty state serializes to an empty string', () => {
    assert.equal(serializeHash(emptyState()), '');
});

suite('races - distance ranges');
[
    [10, '0-10'],
    [21.1, '10-21.1'],
    [42.2, '21.1-42.2'],
    [42.3, '42.2-'],
].forEach(([km, key]) => {
    test(`${km} km is in ${key}`, () => {
        assert.isTrue(inDistanceRange(km, rangeByKey(key)));
    });
});
test('race with distances 5 and 50', () => {
    const competition = race({distances: [{km: 5}, {km: 50}]});
    assert.isTrue(matchesFilters(competition, emptyState({distance: '0-10'}), TODAY));
    assert.isTrue(matchesFilters(competition, emptyState({distance: '42.2-'}), TODAY));
    assert.isFalse(matchesFilters(competition, emptyState({distance: '21.1-42.2'}), TODAY));
});
test('no distances fails a distance filter but passes without it', () => {
    const competition = race({distances: []});
    assert.isFalse(matchesFilters(competition, emptyState({distance: '0-10'}), TODAY));
    assert.isTrue(matchesFilters(competition, emptyState(), TODAY));
});

suite('races - matchesFilters');
test('past races are hidden unless requested', () => {
    const competition = race({startDate: '2026-11-01'});
    assert.isFalse(matchesFilters(competition, emptyState(), TODAY));
    assert.isTrue(matchesFilters(competition, emptyState({past: true}), TODAY));
});
test('multi-day race whose distance starts today is not past', () => {
    const competition = race({startDate: '2026-11-14', distances: [{km: 10, startDate: TODAY}]});
    assert.isTrue(matchesFilters(competition, emptyState(), TODAY));
});
test('country and type filters', () => {
    const competition = race();
    assert.isTrue(matchesFilters(competition, emptyState({countries: ['RS'], types: ['Trail']}), TODAY));
    assert.isFalse(matchesFilters(competition, emptyState({countries: ['ME']}), TODAY));
    assert.isFalse(matchesFilters(competition, emptyState({types: ['OCR']}), TODAY));
    assert.isFalse(matchesFilters(race({country: null}), emptyState({countries: ['RS']}), TODAY));
});
test('several countries match any of them', () => {
    const competition = race();
    assert.isTrue(matchesFilters(competition, emptyState({countries: ['ME', 'RS']}), TODAY));
    assert.isFalse(matchesFilters(competition, emptyState({countries: ['ME', 'BA']}), TODAY));
});
test('several types match any of them', () => {
    const competition = race();
    assert.isTrue(matchesFilters(competition, emptyState({types: ['OCR', 'Trail']}), TODAY));
    assert.isFalse(matchesFilters(competition, emptyState({types: ['OCR', 'Asphalt']}), TODAY));
});
test('query is diacritic-insensitive', () => {
    assert.isTrue(matchesFilters(race({city: 'Čačak'}), emptyState({query: 'cacak'}), TODAY));
    assert.isTrue(matchesFilters(race({city: 'Đerdap'}), emptyState({query: 'djerdap'}), TODAY));
    assert.isFalse(matchesFilters(race({city: 'Niš'}), emptyState({query: 'cacak'}), TODAY));
});

suite('races - actualRangeStart');
test('goes back by the lookback window', () => {
    assert.equal(actualRangeStart('2026-11-21', 14), '2026-11-07');
    assert.equal(actualRangeStart('2026-11-21', 0), '2026-11-21');
});
test('crosses month and year boundaries', () => {
    assert.equal(actualRangeStart('2026-01-05', 14), '2025-12-22');
    assert.equal(actualRangeStart('2026-03-05', 14), '2026-02-19');
});
test('by default the range starts today', () => {
    assert.equal(actualRangeStart('2026-11-21'), '2026-11-21');
});
test('invalid date gives null', () => {
    assert.isNull(actualRangeStart('garbage'));
    assert.isNull(actualRangeStart(undefined));
});

suite('races - formatDistances');
test('km without trailing zeros, gain with a plus sign', () => {
    const parts = formatDistances([
        {km: 12, elevationGainM: 400},
        {km: 42.2, elevationGainM: null},
    ]);
    assert.deepEqual(parts, [
        {km: '12', gain: '+400'},
        {km: '42.2', gain: ''},
    ]);
});

suite('races - groupDistanceLines');
test('empty input', () => {
    assert.deepEqual(groupDistanceLines([]), []);
});
test('no gains share one line', () => {
    assert.deepEqual(
        groupDistanceLines([
            {km: '5', gain: ''},
            {km: '10', gain: ''},
        ]),
        [{kms: ['5', '10'], gain: ''}]
    );
});
test('all gains: one line per distance', () => {
    assert.deepEqual(
        groupDistanceLines([
            {km: '25', gain: '+900'},
            {km: '50', gain: '+1900'},
        ]),
        [
            {kms: ['25'], gain: '+900'},
            {kms: ['50'], gain: '+1900'},
        ]
    );
});
test('mixed distances keep the order', () => {
    assert.deepEqual(
        groupDistanceLines([
            {km: '5', gain: ''},
            {km: '10', gain: ''},
            {km: '25', gain: '+900'},
            {km: '30', gain: ''},
            {km: '50', gain: '+1900'},
        ]),
        [
            {kms: ['5', '10'], gain: ''},
            {kms: ['25'], gain: '+900'},
            {kms: ['30'], gain: ''},
            {kms: ['50'], gain: '+1900'},
        ]
    );
});

suite('races - safeHref');
test('rejects unsafe schemes', () => {
    assert.isNull(safeHref({type: 'website', url: ['javascript', 'alert(1)'].join(':')}));
    assert.isNull(safeHref({type: 'website', url: 'ftp://x'}));
});
test('accepts https and mailto', () => {
    assert.equal(safeHref({type: 'website', url: 'https://x'}), 'https://x');
    assert.equal(safeHref({type: 'email', url: 'mailto:a@b.rs'}), 'mailto:a@b.rs');
    assert.isNull(safeHref({type: 'email', url: 'a@b.rs'}));
    assert.isNull(safeHref({type: 'unknown', url: 'https://x'}));
});

suite('races - formatCount');
[
    ['ru', 1, '1 соревнование'],
    ['ru', 3, '3 соревнования'],
    ['ru', 5, '5 соревнований'],
    ['ru', 21, '21 соревнование'],
    ['sr', 1, '1 trka'],
    ['sr', 3, '3 trke'],
    ['sr', 5, '5 trka'],
    ['en', 1, '1 race'],
    ['en', 2, '2 races'],
].forEach(([lang, n, expected]) => {
    test(`${lang} ${n}`, () => {
        assert.equal(formatCount(lang, n), expected);
    });
});
