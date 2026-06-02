import Gio from 'gi://Gio';

export class SettingsService {
    constructor(extension, cleanupBag, logger) {
        this._settings = extension.getSettings();
        this._cleanup = cleanupBag;
        this._logger = logger;
    }
    get raw() { return this._settings; }
    boolean(key, fallback = false) { try { return this._settings.get_boolean(key); } catch (e) { this._logger.warn(`Boolean setting fallback ${key}: ${e}`); return fallback; } }
    int(key, fallback = 0) { try { return this._settings.get_int(key); } catch (e) { this._logger.warn(`Int setting fallback ${key}: ${e}`); return fallback; } }
    double(key, fallback = 0) { try { return this._settings.get_double(key); } catch (e) { this._logger.warn(`Double setting fallback ${key}: ${e}`); return fallback; } }
    string(key, fallback = '') { try { return this._settings.get_string(key); } catch (e) { this._logger.warn(`String setting fallback ${key}: ${e}`); return fallback; } }
    strv(key, fallback = []) { try { return this._settings.get_strv(key); } catch (e) { this._logger.warn(`Strv setting fallback ${key}: ${e}`); return fallback; } }
    bind(key, object, property, flags = Gio.SettingsBindFlags.DEFAULT) { this._settings.bind(key, object, property, flags); }
    onChanged(key, callback) {
        const signalId = this._settings.connect(`changed::${key}`, () => callback(this));
        this._cleanup.addSignal(this._settings, signalId);
        return signalId;
    }
}
