import './ImagePopup.css';

class ImagePopup {
    constructor(url) {
        this.url = url;
    }

    show(e) {
        if (this._container) {
            return;
        }
        if (e.originalEvent) {
            e = e.originalEvent;
        }
        if (e.preventDefault && !e.defaultPrevented) {
            e.preventDefault();
        } else {
            e.returnValue = false;
        }

        const {clientX: x, clientY: y} = e;

        const container = this._container = document.createElement('div');
        document.body.appendChild(container);
        container.className = 'image-popup';

        const popupImg = document.createElement("img");
        popupImg.src = this.url;
        container.appendChild(popupImg);
        container.classList.add('show');
        
        window.addEventListener('keydown', this.onKeyDown, true);
        window.addEventListener('mousedown', this.onMouseDown, true);
        window.addEventListener('touchstart', this.onMouseDown, true);
    }

    hide() {
        if (!this._container) {
            return;
        }
        document.body.removeChild(this._container);
        this._container = null;

        window.removeEventListener('keydown', this.onKeyDown, true);
        window.removeEventListener('mousedown', this.onMouseDown, true);
        window.removeEventListener('touchstart', this.onMouseDown, true);
    }

    onKeyDown = (e) => {
        if (e.keyCode === 27) {
            this.hide();
        }
    };

    onMouseDown = (e) => {
        // Only honandle left mouse button (button 0) or touch events (no button property)
        if (e.button !== undefined && e.button !== 0) {
            return;
        }

        this.hide();
    };
}

export default ImagePopup;