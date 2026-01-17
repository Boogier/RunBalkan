import secrets from './secrets';

const config = {
    caption: `
        <a href="about.html" target="_self">About</a> |
        <a href="https://docs.google.com/spreadsheets/d/1o3LivaIhBS0M1_bG9H8Pq_9K57AVFo0H40h0MzCOICs/edit?usp=sharing" target="_blank">Running events in Balkans and near</a> |
        <a href="https://t.me/boogier">Contact</a> |
        <a href="donate.html" target="_self">Donate</a>`,
    defaultLocation: [44.50, 20.31],
    defaultZoom: 9,
    googleApiUrl: `https://maps.googleapis.com/maps/api/js?v=3&key=${secrets.google}`,
    westraDataBaseUrl: 'https://nakarte.me/westraPasses/',
    //CORSProxyUrl: 'https://boogier-001-site1.rtempurl.com/api/proxy?url=',
    CORSProxyUrl: 'http://localhost/api/proxy/',
    elevationsServer: 'https://elevation.nakarte.me/',
    wikimediaCommonsCoverageUrl: 'https://tiles.nakarte.me/wikimedia_commons_images/{z}/{x}/{y}',
    geocachingSuUrl: 'https://nakarte.me/geocachingSu/geocaching_su2.json',
    tracksStorageServer: 'https://tracks.nakarte.me',
    wikimapiaTilesBaseUrl: 'https://proxy.nakarte.me/wikimapia/',
    mapillaryRasterTilesUrl: 'https://mapillary.nakarte.me/{z}/{x}/{y}',
    urlsBypassCORSProxy: [new RegExp('^https://pkk\\.rosreestr\\.ru/', 'u')],
    elevationTileUrl: 'https://tiles.nakarte.me/elevation/{z}/{x}/{y}',
    balkanTracksUrl: 'https://iorient.ru/runbalkan/GetTracks.aspx',
    balkanPhotosUrl: 'https://iorient.ru/runbalkan/GetPhotos.aspx',
    ...secrets,
};

export default config;
