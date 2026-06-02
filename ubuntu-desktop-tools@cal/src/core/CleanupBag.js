import GLib from 'gi://GLib';
import {safeDestroy, safeDisconnect} from '../compat/ActorCompat.js';

export class CleanupBag {
    constructor(logger = null) {
        this._items = [];
        this._logger = logger;
    }

    add(callback) {
        if (typeof callback === 'function')
            this._items.push(callback);
        return callback;
    }

    addSignal(object, signalId) {
        return this.add(() => safeDisconnect(object, signalId, this._logger));
    }

    addTimeout(timeoutId) {
        return this.add(() => {
            try {
                if (timeoutId)
                    GLib.source_remove(timeoutId);
            } catch (error) {
                this._logger?.warn(`Timeout cleanup failed: ${error}`);
            }
        });
    }

    addDestroyable(actor) {
        return this.add(() => safeDestroy(actor, this._logger));
    }

    cleanup() {
        const items = this._items.splice(0).reverse();
        for (const item of items) {
            try {
                item();
            } catch (error) {
                this._logger?.warn(`Cleanup item failed: ${error}`);
            }
        }
    }
}
