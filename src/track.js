import wellknown from 'wellknown';

import config from '~/config';

// The track-info endpoint lives on the same host as the Balkan backend (data only);
// this page is hosted on the run-balkan site and renders that data for search engines and users.
const API_URL = `${new URL(config.balkanServerUrl, window.location.origin).origin}/runbalkan/track-info`;
const START_ZOOM = 13;

// Static, non-interactive picture of the track shown in place of the "View this route on the
// map" text link; clicking it still goes to the full interactive map.
const TRACK_MAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TRACK_MAP_TILE_SIZE = 256;
// Canvas width tracks the width of the surrounding text column instead of a fixed size,
// so the picture lines up with the description text instead of looking like a small stamp.
const TRACK_MAP_ASPECT = 0.6;
const TRACK_MAP_DEFAULT_WIDTH = 600;
const TRACK_MAP_MIN_WIDTH = 280;
const TRACK_MAP_MAX_WIDTH = 900;
const TRACK_MAP_PADDING = 20;
const TRACK_MAP_MIN_ZOOM = 2;
const TRACK_MAP_MAX_ZOOM = 16;

// trackId comes either from /track/{id} (rewritten to ?trackId=) or directly as ?trackId=.
function getTrackId() {
    const fromQuery = new URLSearchParams(window.location.search).get('trackId');
    if (fromQuery) {
        return fromQuery;
    }
    const m = window.location.pathname.match(/\/track\/(\d+)/u);
    return m ? m[1] : null;
}

const trackId = getTrackId();

function setMeta(metaName, content) {
    const el = document.querySelector(`meta[name="${metaName}"]`);
    if (el) {
        el.setAttribute('content', content);
    }
}

function buildMapUrl(track) {
    const nf = encodeURIComponent(track.name);
    const hasStart =
        track.startLat !== null &&
        track.startLat !== undefined &&
        track.startLon !== null &&
        track.startLon !== undefined;
    if (hasStart) {
        return `/#m=${START_ZOOM}/${track.startLat.toFixed(5)}/${track.startLon.toFixed(5)}&l=O&nf=${nf}`;
    }
    return `/#l=O&nf=${nf}`;
}

function lngLatToWorldPixel(lng, lat, zoom) {
    const scale = TRACK_MAP_TILE_SIZE * 2 ** zoom;
    const x = ((lng + 180) / 360) * scale;
    const sinLat = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
    return {x, y};
}

function extractTrackSegments(wkt) {
    const geometry = wellknown.parse(wkt);
    const segments = [];
    function visit(geom) {
        if (!geom) {
            return;
        }
        if (geom.type === 'GeometryCollection') {
            geom.geometries.forEach(visit);
        } else if (geom.type === 'LineString') {
            segments.push(geom.coordinates.map(([lng, lat]) => ({lat, lng})));
        } else if (geom.type === 'MultiLineString') {
            geom.coordinates.forEach((line) => segments.push(line.map(([lng, lat]) => ({lat, lng}))));
        }
    }
    visit(geometry);
    return segments;
}

function fetchTrackSegments(id) {
    return fetch(`${config.balkanTracksUrl}&trackId=${encodeURIComponent(id)}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
            const trackData = data && data.tracks && data.tracks[0];
            if (!trackData || !trackData.trackPoints) {
                return null;
            }
            return extractTrackSegments(trackData.trackPoints);
        })
        .catch(() => null);
}

function loadTileImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

function getTrackMapWidth() {
    const container = document.getElementById('track-links');
    const measured = (container && container.clientWidth) || TRACK_MAP_DEFAULT_WIDTH;
    return Math.round(Math.min(TRACK_MAP_MAX_WIDTH, Math.max(TRACK_MAP_MIN_WIDTH, measured)));
}

function chooseZoom(minLat, maxLat, minLng, maxLng, width, height) {
    const availableWidth = width - 2 * TRACK_MAP_PADDING;
    const availableHeight = height - 2 * TRACK_MAP_PADDING;
    let zoom = TRACK_MAP_MAX_ZOOM;
    while (zoom > TRACK_MAP_MIN_ZOOM) {
        const nw = lngLatToWorldPixel(minLng, maxLat, zoom);
        const se = lngLatToWorldPixel(maxLng, minLat, zoom);
        if (se.x - nw.x <= availableWidth && se.y - nw.y <= availableHeight) {
            break;
        }
        zoom -= 1;
    }
    return zoom;
}

function getTrackMapBounds(segments) {
    const points = segments.flat();
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const {lat, lng} of points) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
    }
    return {minLat, maxLat, minLng, maxLng};
}

function paintBackground(canvas, width, height) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, width, height);
}

async function paintTiles(canvas, originX, originY, zoom, width, height) {
    const tilesPerAxis = 2 ** zoom;
    const tileMinX = Math.floor(originX / TRACK_MAP_TILE_SIZE);
    const tileMaxX = Math.floor((originX + width) / TRACK_MAP_TILE_SIZE);
    const tileMinY = Math.max(0, Math.floor(originY / TRACK_MAP_TILE_SIZE));
    const tileMaxY = Math.min(tilesPerAxis - 1, Math.floor((originY + height) / TRACK_MAP_TILE_SIZE));

    const ctx = canvas.getContext('2d');
    const tileLoads = [];
    for (let tx = tileMinX; tx <= tileMaxX; tx += 1) {
        const wrappedX = ((tx % tilesPerAxis) + tilesPerAxis) % tilesPerAxis;
        for (let ty = tileMinY; ty <= tileMaxY; ty += 1) {
            const url = TRACK_MAP_TILE_URL.replace('{z}', zoom).replace('{x}', wrappedX).replace('{y}', ty);
            tileLoads.push(
                loadTileImage(url).then((img) => {
                    if (img) {
                        ctx.drawImage(img, tx * TRACK_MAP_TILE_SIZE - originX, ty * TRACK_MAP_TILE_SIZE - originY);
                    }
                })
            );
        }
    }
    await Promise.all(tileLoads);
}

function paintTrackLines(canvas, segments, originX, originY, zoom) {
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#e6332a';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const segment of segments) {
        if (segment.length < 2) {
            continue;
        }
        ctx.beginPath();
        segment.forEach(({lat, lng}, i) => {
            const p = lngLatToWorldPixel(lng, lat, zoom);
            const x = p.x - originX;
            const y = p.y - originY;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    }
}

async function drawTrackMap(canvas, segments) {
    const width = getTrackMapWidth();
    const height = Math.round(width * TRACK_MAP_ASPECT);
    const {minLat, maxLat, minLng, maxLng} = getTrackMapBounds(segments);
    const zoom = chooseZoom(minLat, maxLat, minLng, maxLng, width, height);
    const center = lngLatToWorldPixel((minLng + maxLng) / 2, (minLat + maxLat) / 2, zoom);
    const originX = center.x - width / 2;
    const originY = center.y - height / 2;

    canvas.width = width;
    canvas.height = height;
    paintBackground(canvas, width, height);
    await paintTiles(canvas, originX, originY, zoom, width, height);
    paintTrackLines(canvas, segments, originX, originY, zoom);
}

function renderTrackMapPicture(id, mapLink) {
    fetchTrackSegments(id).then((segments) => {
        if (!segments || segments.length === 0) {
            return;
        }
        const canvas = document.createElement('canvas');
        drawTrackMap(canvas, segments).then(() => {
            mapLink.textContent = '';
            mapLink.appendChild(canvas);
            document.getElementById('track-map-attribution').hidden = false;
        });
    });
}

function openLightbox(url) {
    document.getElementById('track-lightbox-img').setAttribute('src', url);
    document.getElementById('track-lightbox').hidden = false;
}

function closeLightbox() {
    document.getElementById('track-lightbox').hidden = true;
    document.getElementById('track-lightbox-img').setAttribute('src', '');
}

document.getElementById('track-lightbox').addEventListener('click', closeLightbox);
document.getElementById('track-lightbox-close').addEventListener('click', closeLightbox);

function renderPhotos(thumbnails) {
    if (!thumbnails || thumbnails.length === 0) {
        return;
    }
    const grid = document.getElementById('track-photos');
    thumbnails.forEach((url) => {
        const img = document.createElement('img');
        img.className = 'track-photo';
        img.src = url;
        img.alt = '';
        img.loading = 'lazy';
        img.addEventListener('click', () => openLightbox(url));
        grid.appendChild(img);
    });
    document.getElementById('track-photos-section').hidden = false;
}

function showNotFound() {
    document.title = 'Track not found — Run-Balkan';
    document.getElementById('track-name').textContent = 'Track not found';
    document.getElementById('track-description').textContent =
        'This route could not be found. It may have been removed.';
}

function render(track) {
    document.title = `${track.name} — Run-Balkan`;
    if (track.description) {
        setMeta('description', track.description.replace(/\s+/gu, ' ').trim().slice(0, 160));
    }
    document.getElementById('track-name').textContent = track.name;
    document.getElementById('track-description').textContent = track.description || '';
    const mapLink = document.getElementById('map-link');
    const mapUrl = buildMapUrl(track);
    mapLink.setAttribute('href', mapUrl);
    document.getElementById('track-map-caption-link').setAttribute('href', mapUrl);
    document.getElementById('track-links').hidden = false;
    document.getElementById('track-map-caption').hidden = false;
    renderTrackMapPicture(trackId, mapLink);
    renderPhotos(track.thumbnails);
}

if (trackId) {
    fetch(`${API_URL}?trackId=${encodeURIComponent(trackId)}`)
        .then((response) => {
            if (!response.ok) {
                throw new Error('not found');
            }
            return response.json();
        })
        .then(render)
        .catch(showNotFound);
} else {
    showNotFound();
}
