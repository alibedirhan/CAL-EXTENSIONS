import {ModuleState, moduleStatus} from '../../core/ModuleStatus.js';
import {SystemMetricsService} from './SystemMetricsService.js';
import {SystemMonitorIndicator} from './SystemMonitorIndicator.js';

export class SystemMonitorModule {
    constructor({settings, scheduler, logger, panelPlacement, diagnostics = null}) {
        this.name = 'SystemMonitor';
        this._settings = settings;
        this._scheduler = scheduler;
        this._logger = logger;
        this._diagnostics = diagnostics;
        this._panelPlacement = panelPlacement;
        this._metrics = new SystemMetricsService(logger, diagnostics);
        this._indicator = null;
        this._timerCancel = null;
        this._active = false;
        this._lastStatus = moduleStatus(ModuleState.DISABLED, 'not enabled');
    }

    init() {}

    enable() {
        this._active = true;
        this._settings.onChanged('show-system-monitor', () => this._syncVisibility());
        this._settings.onChanged('monitor-position', () => this._rebuildIndicator());
        this._settings.onChanged('monitor-refresh-interval', () => this._restartTimer());
        this._settings.onChanged('low-power-mode', () => this._restartTimer());
        this._syncVisibility();
    }

    disable() {
        this._active = false;
        this._removeIndicator();
        this._lastStatus = moduleStatus(ModuleState.DISABLED, 'disabled');
    }

    destroy() {}

    getStatus() { return this._lastStatus; }
    healthCheck() { return this._lastStatus; }

    _syncVisibility() {
        if (!this._active)
            return;
        if (this._settings.boolean('show-system-monitor', true))
            this._rebuildIndicator();
        else {
            this._removeIndicator();
            this._lastStatus = moduleStatus(ModuleState.DISABLED, 'hidden by setting');
        }
    }

    _rebuildIndicator() {
        if (!this._active || !this._settings.boolean('show-system-monitor', true))
            return;
        this._removeIndicator();
        try {
            this._indicator = new SystemMonitorIndicator(this._settings);
            this._panelPlacement.add(this._indicator);
            this._sampleAndRender();
            this._restartTimer();
            this._lastStatus = moduleStatus(ModuleState.READY, 'indicator active');
        } catch (error) {
            this._lastStatus = moduleStatus(ModuleState.FAILED, 'indicator build failed', {error: String(error)});
            this._diagnostics?.error?.('system-monitor', 'Indicator build failed', {error: String(error)});
            this._logger?.warn?.(`System monitor indicator build failed: ${error}`);
            this._removeIndicator();
        }
    }

    _removeIndicator() {
        this._stopTimer();
        this._panelPlacement.remove();
        this._indicator = null;
    }

    _restartTimer() {
        this._stopTimer();
        if (!this._indicator)
            return;
        const lowPower = this._settings.boolean('low-power-mode', false);
        const base = this._settings.int('monitor-refresh-interval', 2);
        const interval = lowPower ? Math.max(5, base) : base;
        this._timerCancel = this._scheduler.everySeconds(interval, () => this._sampleAndRender());
    }

    _stopTimer() {
        this._timerCancel?.();
        this._timerCancel = null;
    }

    _sampleAndRender() {
        const metrics = this._metrics.sample();
        if (metrics.status === 'degraded')
            this._lastStatus = moduleStatus(ModuleState.DEGRADED, 'some metrics unavailable', {reasons: metrics.reasons ?? []});
        else
            this._lastStatus = moduleStatus(ModuleState.READY, 'metrics active');
        this._indicator?.update(metrics);
    }
}
