import GLib from 'gi://GLib';

export class SchedulerService {
    constructor(cleanupBag, logger) {
        this._cleanup = cleanupBag;
        this._logger = logger;
    }

    everySeconds(seconds, callback) {
        let id = 0;
        const interval = Math.max(1, Number(seconds) || 1);
        const cancel = () => {
            if (!id)
                return;
            try { GLib.source_remove(id); } catch (_error) {}
            id = 0;
        };
        id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
            try { callback(); } catch (error) { this._logger.warn(`Scheduled callback failed: ${error}`); }
            return id ? GLib.SOURCE_CONTINUE : GLib.SOURCE_REMOVE;
        });
        this._cleanup.add(cancel);
        return cancel;
    }
}
