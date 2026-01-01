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

        this.setPosition(point.x, point.y);
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
        const window_width = window.innerWidth;
        const window_height = window.innerHeight;
        const menu_width = this._container.offsetWidth;
        const menu_height = this._container.offsetHeight;

        if (x + menu_width >= window_width) {
            x -= menu_width;
            if (x < 0) {
                x = 0;
            }
        }
        if (y + menu_height >= window_height) {
            y -= menu_height;
            if (y < 0) {
                y = 0;
            }
        }
        this._container.style.left = `${x}px`;
        this._container.style.top = `${y}px`;
    }
}

export default ThumbnailPopup;
