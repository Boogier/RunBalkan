import L from 'leaflet';
import {NakarteUrlLoader} from './lib/services/nakarte';
import {loadingModal} from '~/lib/loadingModal';

L.Control.TrackList.include({
        hashParams: function() {
            return new NakarteUrlLoader().paramNames();
        },

        loadTrackFromParam: async function(paramName, values) {
            if (!values || !values.length) {
                return;
            }

            //this.readingFiles(this.readingFiles() + 1);
            loadingModal.show('Loading...');

            try {
                const geodata = await new NakarteUrlLoader().geoData(paramName, values);
                const notEmpty = this.addTracksFromGeodataArray(geodata);
                if (notEmpty) {
                    this.fire('loadedTracksFromParam');
                }
            } finally {
                //this.readingFiles(this.readingFiles() - 1);
                loadingModal.hide();
            }
        },
    }
);

