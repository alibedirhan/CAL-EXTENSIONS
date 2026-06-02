import {ModuleState, moduleStatus} from '../../core/ModuleStatus.js';
import {WeatherService} from './WeatherService.js';
import {WeatherPanel} from './WeatherPanel.js';

const DEFAULT_REFRESH_MINUTES = 30;

export class WeatherModule {
    constructor({settings, scheduler, logger, edgeManager, diagnostics = null}) {
        this.name = 'Weather';
        this._settings = settings;
        this._scheduler = scheduler;
        this._logger = logger;
        this._diagnostics = diagnostics;
        this._edgeManager = edgeManager;
        this._service = new WeatherService(logger);
        this._panel = null;
        this._tab = null;
        this._timerCancel = null;
        this._lastStatus = moduleStatus(ModuleState.DISABLED, 'not enabled');
    }

    init() {}

    enable() {
        this._settings.onChanged('show-weather', () => this._sync());
        this._settings.onChanged('weather-city', () => this._fetchAndUpdate());
        this._settings.onChanged('weather-refresh-interval', () => this._restartTimer());
        this._sync();
    }

    disable() {
        this._stopTimer();
        this._edgeManager.unregister('weather');
        this._tab = null;
        this._panel = null;
        this._service.destroy();
        this._lastStatus = moduleStatus(ModuleState.DISABLED, 'disabled');
    }

    destroy() {}
    getStatus() { return this._lastStatus; }
    healthCheck() { return this._lastStatus; }

    _sync() {
        if (!this._settings.boolean('show-weather', true)) {
            this._stopTimer();
            this._edgeManager.unregister('weather');
            this._tab = null;
            this._panel = null;
            this._lastStatus = moduleStatus(ModuleState.DISABLED, 'hidden by setting');
            return;
        }
        if (this._tab)
            return;

        try {
            this._panel = new WeatherPanel({settings: this._settings, logger: this._logger});
            this._tab = this._edgeManager.register({
                id: 'weather',
                iconName: 'weather-clear-symbolic',
                title: 'Hava Durumu',
                panel: this._panel.actor,
                defaultActive: true,
            });
            this._panel.setCloseCallback(() => this._tab?.setOpen(false));
            this._panel.setOnCityChanged((city) => {
                this._logger?.info?.(`City changed to: ${city}`);
            });
            this._lastStatus = moduleStatus(ModuleState.READY, 'weather panel active; loading data');
            this._fetchAndUpdate();
            this._restartTimer();
        } catch (error) {
            this._lastStatus = moduleStatus(ModuleState.FAILED, 'panel registration failed', {error: String(error)});
            this._logger?.warn?.(`Weather panel failed: ${error}`);
        }
    }

    _fetchAndUpdate() {
        const city = this._settings.string('weather-city', 'Istanbul').trim();
        if (!city) {
            this._panel?.showError('Hava durumu için Ayarlar > Hava Durumu bölümünden şehir belirleyin.');
            this._lastStatus = moduleStatus(ModuleState.DEGRADED, 'city not configured');
            return;
        }
        this._service.fetch(city, (data, error) => {
            if (error) {
                const userMessage = this._friendlyError(error, city);
                const cached = this._service.lastData;
                this._logger?.warn?.(`Weather fetch failed (${city}): ${error}`);
                this._diagnostics?.warn?.('weather', 'Weather fetch failed', {reason: String(error), city});

                if (cached) {
                    this._panel?.showCached(cached, `${userMessage} Son alınan veri gösteriliyor.`);
                    this._lastStatus = moduleStatus(ModuleState.DEGRADED, 'weather fetch failed; cached data shown', {reason: String(error)});
                } else {
                    this._panel?.showError(userMessage);
                    this._lastStatus = moduleStatus(ModuleState.DEGRADED, 'weather fetch failed; no cached data', {reason: String(error)});
                }
                return;
            }
            this._panel?.update(data);
            this._lastStatus = moduleStatus(ModuleState.READY, 'weather data active');
        });
    }


    _friendlyError(error, city) {
        const raw = String(error ?? '').trim();
        const lower = raw.toLowerCase();
        if (lower.includes('network') || lower.includes('could not resolve') || lower.includes('failed to connect') || lower.includes('connection'))
            return 'Hava durumu servisine ulaşılamadı. İnternet bağlantısını kontrol edin.';
        if (lower.includes('timeout') || lower.includes('timed out'))
            return 'Hava durumu servisi zamanında yanıt vermedi. Biraz sonra tekrar deneyin.';
        if (lower.includes('http 404'))
            return `“${city}” için hava durumu bulunamadı. Şehir adını sade yazmayı deneyin.`;
        if (lower.includes('http'))
            return 'Hava durumu servisi geçici olarak yanıt veremiyor.';
        if (lower.includes('json') || lower.includes('parse'))
            return 'Hava durumu yanıtı okunamadı. Biraz sonra tekrar deneyin.';
        return 'Hava durumu şu anda alınamadı. Biraz sonra tekrar deneyin.';
    }

    _restartTimer() {
        this._stopTimer();
        if (!this._settings.boolean('show-weather', true))
            return;
        const minutes = this._settings.int('weather-refresh-interval', DEFAULT_REFRESH_MINUTES);
        const seconds = Math.max(60, minutes * 60);
        this._timerCancel = this._scheduler.everySeconds(seconds, () => this._fetchAndUpdate());
    }

    _stopTimer() {
        this._timerCancel?.();
        this._timerCancel = null;
    }
}
