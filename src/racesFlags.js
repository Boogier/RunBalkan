import AL from './images/flags/AL.svg';
import BA from './images/flags/BA.svg';
import BG from './images/flags/BG.svg';
import GE from './images/flags/GE.svg';
import GR from './images/flags/GR.svg';
import HR from './images/flags/HR.svg';
import HU from './images/flags/HU.svg';
import ME from './images/flags/ME.svg';
import MK from './images/flags/MK.svg';
import RO from './images/flags/RO.svg';
import RS from './images/flags/RS.svg';
import SI from './images/flags/SI.svg';
import TR from './images/flags/TR.svg';

const FLAGS = {AL, BA, BG, GE, GR, HR, HU, ME, MK, RO, RS, SI, TR};

function flagUrl(code) {
    return FLAGS[code] || null;
}

export {flagUrl};
