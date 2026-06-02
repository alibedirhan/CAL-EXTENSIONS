import GLib from 'gi://GLib';
import {ShellVersion} from '../compat/ShellVersion.js';
import {DistroDetector} from '../utils/DistroDetector.js';

export class DiagnosticsService {
    constructor(logger) {
        this._logger = logger;
        this._events = [];
        this._limit = 80;
    }

    record(level, area, message, detail = {}) {
        const item = {
            at: new Date().toISOString(),
            level,
            area,
            message: String(message),
            detail,
        };
        this._events.unshift(item);
        this._events = this._events.slice(0, this._limit);

        const text = `${area}: ${message}`;
        if (level === 'error')
            this._logger?.error?.(text);
        else if (level === 'warn')
            this._logger?.warn?.(text);
        else
            this._logger?.info?.(text);
    }

    info(area, message, detail = {}) { this.record('info', area, message, detail); }
    warn(area, message, detail = {}) { this.record('warn', area, message, detail); }
    error(area, message, detail = {}) { this.record('error', area, message, detail); }

    recentEvents() { return [...this._events]; }

    environment() {
        const distro = DistroDetector.detect();
        return {
            extension: 'CAL Extensions',
            shellMajor: ShellVersion.major(),
            sessionType: GLib.getenv('XDG_SESSION_TYPE') ?? 'unknown',
            desktop: GLib.getenv('XDG_CURRENT_DESKTOP') ?? 'unknown',
            distro: distro.prettyName,
            distroFamily: distro.family,
            packageManager: distro.packageManager?.id ?? 'unknown',
            terminals: distro.terminals.map(item => item.bin),
        };
    }
}
