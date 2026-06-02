import {ModuleState, moduleStatus} from '../../core/ModuleStatus.js';
import {SystemInfoPanel} from './SystemInfoPanel.js';

export class SystemInfoModule {
    constructor({logger, edgeManager}) {
        this.name = 'SystemInfo';
        this._logger = logger;
        this._edgeManager = edgeManager;
        this._tab = null;
        this._panel = null;
        this._lastStatus = moduleStatus(ModuleState.DISABLED, 'not enabled');
    }

    init() {}

    enable() {
        if (this._tab)
            return;
        try {
            this._panel = new SystemInfoPanel({logger: this._logger});
            this._tab = this._edgeManager.register({
                id: 'system-info',
                iconName: 'computer-symbolic',
                title: 'Sistem Bilgisi',
                panel: this._panel.actor,
            });
            this._panel.setCloseCallback(() => this._tab?.setOpen(false));
            this._lastStatus = moduleStatus(ModuleState.READY, 'panel registered');
        } catch (error) {
            this._lastStatus = moduleStatus(ModuleState.FAILED, 'panel registration failed', {error: String(error)});
            this._logger?.warn?.(`System info panel failed: ${error}`);
        }
    }

    disable() {
        this._edgeManager.unregister('system-info');
        this._tab = null;
        this._panel = null;
        this._lastStatus = moduleStatus(ModuleState.DISABLED, 'disabled');
    }

    destroy() {}
    getStatus() { return this._lastStatus; }
    healthCheck() { return this._lastStatus; }
}
