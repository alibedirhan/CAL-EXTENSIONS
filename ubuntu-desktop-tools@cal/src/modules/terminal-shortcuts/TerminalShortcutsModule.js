import {ModuleState, moduleStatus} from '../../core/ModuleStatus.js';
import {TerminalShortcutsPanel} from './TerminalShortcutsPanel.js';
import {CommandPolicy} from './CommandPolicy.js';
import {TerminalLauncher} from './TerminalLauncher.js';
import {TerminalCommandRepository} from './TerminalCommandStorage.js';

export class TerminalShortcutsModule {
    constructor({settings, logger, edgeManager}) {
        this.name = 'TerminalShortcuts';
        this._settings = settings;
        this._logger = logger;
        this._edgeManager = edgeManager;
        this._tab = null;
        this._lastStatus = moduleStatus(ModuleState.DISABLED, 'not enabled');
    }

    init() {}

    enable() {
        this._settings.onChanged('show-terminal-shortcuts', () => this._sync());
        this._sync();
    }

    disable() {
        this._edgeManager.unregister('terminal-shortcuts');
        this._tab = null;
        this._lastStatus = moduleStatus(ModuleState.DISABLED, 'disabled');
    }

    destroy() {}
    getStatus() { return this._lastStatus; }
    healthCheck() { return this._lastStatus; }

    _sync() {
        if (!this._settings.boolean('show-terminal-shortcuts', true)) {
            this._edgeManager.unregister('terminal-shortcuts');
            this._tab = null;
            this._lastStatus = moduleStatus(ModuleState.DISABLED, 'hidden by setting');
            return;
        }
        if (this._tab)
            return;
        try {
            const policy = new CommandPolicy(this._settings);
            const launcher = new TerminalLauncher(this._settings, this._logger);
            const repository = new TerminalCommandRepository(this._logger);
            const panel = new TerminalShortcutsPanel({settings: this._settings, policy, launcher, repository, logger: this._logger});
            this._tab = this._edgeManager.register({id: 'terminal-shortcuts', iconName: 'utilities-terminal-symbolic', title: 'Terminal', panel: panel.actor});
            panel.setCloseCallback(() => this._tab?.setOpen(false));
            this._lastStatus = moduleStatus(ModuleState.READY, 'panel registered');
        } catch (error) {
            this._lastStatus = moduleStatus(ModuleState.FAILED, 'panel registration failed', {error: String(error)});
            this._logger?.warn?.(`Terminal shortcuts panel failed: ${error}`);
        }
    }
}
