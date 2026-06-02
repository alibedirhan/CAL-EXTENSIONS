import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {safeDestroy} from './ActorCompat.js';

export class PanelCompat {
    constructor(logger) {
        this._logger = logger;
    }

    addToStatusArea(role, indicator, position = 0, box = 'right') {
        try {
            Main.panel.addToStatusArea(role, indicator, position, box);
            return {ok: true};
        } catch (error) {
            this._logger?.warn?.(`Panel placement failed (${box}/${position}): ${error}`);
            return {ok: false, error};
        }
    }

    destroyIndicator(indicator) {
        return safeDestroy(indicator, this._logger, 'panel indicator');
    }
}
