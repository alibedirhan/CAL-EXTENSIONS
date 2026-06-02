import {PanelCompat} from '../compat/PanelCompat.js';

export class PanelPlacementAdapter {
    constructor(settings, logger) {
        this._settings = settings;
        this._logger = logger;
        this._indicator = null;
        this._role = 'ubuntu-desktop-tools-system-monitor';
        this._panel = new PanelCompat(logger);
    }

    add(indicator) {
        this.remove();
        this._indicator = indicator;
        const requested = this._settings.string('monitor-position', 'auto');
        if (requested === 'right')
            return this._addToRight(indicator);
        if (requested === 'clock-adjacent')
            return this._tryClockAdjacent(indicator) || this._addToRight(indicator);
        return this._tryClockAdjacent(indicator) || this._addToRight(indicator);
    }

    remove() {
        if (!this._indicator)
            return;
        this._panel.destroyIndicator(this._indicator);
        this._indicator = null;
    }

    _tryClockAdjacent(indicator) {
        const result = this._panel.addToStatusArea(this._role, indicator, 1, 'center');
        if (result.ok) {
            this._logger.info('System Monitor placed near the clock area');
            return true;
        }
        return false;
    }

    _addToRight(indicator) {
        const result = this._panel.addToStatusArea(this._role, indicator, 0, 'right');
        if (result.ok) {
            this._logger.info('System Monitor placed in right status area');
            return true;
        }
        this._logger.error(`Right status placement failed: ${result.error}`);
        return false;
    }
}
