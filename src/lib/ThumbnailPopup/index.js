import './ThumbnailPopup.css';

class ThumbnailPopup {
    constructor(url) {
        this.url = url;
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
    }

    show(e, point) {
        if (this._container) {
            return;
        }

        this._container = document.createElement('div');
        document.body.appendChild(this._container);
        this._container.className = 'hover-image-popup';

        const popupImg = document.createElement('img');
        popupImg.src = this.url;
        this._container.appendChild(popupImg);
        this._container.style.display = 'block';

        window.addEventListener('keydown', this.onKeyDown, true);
        window.addEventListener('mousedown', this.onMouseDown, true);
        window.addEventListener('touchstart', this.onMouseDown, true);

        if (popupImg.complete) {
            // Position immediately in case image is cached
            this.setPosition(point.x, point.y);
        }
        else {
            // Wait for image to load before positioning so dimensions are correct
            popupImg.onload = () => {
            this.setPosition(point.x, point.y);
            };
        }
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

    onKeyDown(e) {
        if (e.keyCode === 27) {
            this.hide();
        }
    }

    onMouseDown(e) {
        // Only honandle left mouse button (button 0) or touch events (no button property)
        if (e.button !== undefined && e.button !== 0) {
            return;
        }

        this.hide();
    }

    setPosition(x, y) {
        if (!this._container) {
            return;
        }

        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const menuWidth = this._container.offsetWidth;
        const menuHeight = this._container.offsetHeight;
        let posX = x;
        let posY = y;

        if (posX + menuWidth >= windowWidth) {
            posX -= menuWidth;
            if (posX < 0) {
                posX = 0;
            }
        }
        if (posY + menuHeight >= windowHeight) {
            posY -= menuHeight;
            if (posY < 0) {
                posY = 0;
            }
        }
        this._container.style.left = `${posX}px`;
        this._container.style.top = `${posY}px`;
    }
}

export default ThumbnailPopup;
