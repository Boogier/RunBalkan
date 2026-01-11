import './style.css';

class LoadingModal {
    constructor() {
        this._container = null;
    }

    show(title = 'Loading...') {
        if (this._container) {
            return;
        }

        this._container = document.createElement('div');
        this._container.className = 'loading-modal-overlay';
        document.body.appendChild(this._container);

        const modalContent = document.createElement('div');
        modalContent.className = 'loading-modal-content';
        this._container.appendChild(modalContent);

        const titleElement = document.createElement('div');
        titleElement.className = 'loading-modal-title';
        titleElement.textContent = title;
        modalContent.appendChild(titleElement);

        const spinner = document.createElement('div');
        spinner.className = 'loading-modal-spinner';
        modalContent.appendChild(spinner);

        // Prevent clicks from propagating through the modal
        this._container.addEventListener('click', (e) => e.stopPropagation());
    }

    hide() {
        if (this._container) {
            document.body.removeChild(this._container);
            this._container = null;
        }
    }
}

// Export a singleton instance
const loadingModal = new LoadingModal();

export {loadingModal};
