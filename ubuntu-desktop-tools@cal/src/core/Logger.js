export class Logger {
    constructor(scope = 'CALExtensions') {
        this._scope = scope;
    }
    info(message) { console.log(`[${this._scope}] ${message}`); }
    warn(message) { console.warn(`[${this._scope}] ${message}`); }
    error(message) { console.error(`[${this._scope}] ${message}`); }
}
