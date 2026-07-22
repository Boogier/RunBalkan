import config from '~/config';

// The track-info endpoint lives on the same host as the Balkan backend (data only);
// this page is hosted on the run-balkan site and renders that data for search engines and users.
const API_URL = `${new URL(config.balkanServerUrl, window.location.origin).origin}/runbalkan/track-info`;
const START_ZOOM = 13;

// trackId comes either from /track/{id} (rewritten to ?trackId=) or directly as ?trackId=.
function getTrackId() {
    const fromQuery = new URLSearchParams(window.location.search).get('trackId');
    if (fromQuery) {
        return fromQuery;
    }
    const m = window.location.pathname.match(/\/track\/(\d+)/u);
    return m ? m[1] : null;
}

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
    document.getElementById('map-link').setAttribute('href', buildMapUrl(track));
    document.getElementById('track-links').hidden = false;
}

const trackId = getTrackId();
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
