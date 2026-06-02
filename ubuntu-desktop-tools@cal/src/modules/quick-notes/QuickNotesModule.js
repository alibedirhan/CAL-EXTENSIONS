import {ModuleState, moduleStatus} from '../../core/ModuleStatus.js';
import {NotesRepository} from './NotesRepository.js';
import {QuickNotesPanel} from './QuickNotesPanel.js';

export class QuickNotesModule {
    constructor({settings, logger, edgeManager}) {
        this.name = 'QuickNotes';
        this._settings = settings;
        this._logger = logger;
        this._edgeManager = edgeManager;
        this._tab = null;
        this._lastStatus = moduleStatus(ModuleState.DISABLED, 'not enabled');
    }

    init() {}

    enable() {
        this._settings.onChanged('show-quick-notes', () => this._sync());
        this._settings.onChanged('notes-hide-completed', () => this._rebuild());
        this._sync();
    }

    disable() {
        this._edgeManager.unregister('quick-notes');
        this._tab = null;
        this._lastStatus = moduleStatus(ModuleState.DISABLED, 'disabled');
    }

    destroy() {}
    getStatus() { return this._lastStatus; }
    healthCheck() { return this._lastStatus; }

    _rebuild() {
        this._edgeManager.unregister('quick-notes');
        this._tab = null;
        this._sync();
    }

    _sync() {
        if (!this._settings.boolean('show-quick-notes', true)) {
            this._edgeManager.unregister('quick-notes');
            this._tab = null;
            this._lastStatus = moduleStatus(ModuleState.DISABLED, 'hidden by setting');
            return;
        }
        if (this._tab)
            return;
        try {
            const panel = new QuickNotesPanel({repository: new NotesRepository(this._settings, this._logger), logger: this._logger});
            this._tab = this._edgeManager.register({id: 'quick-notes', iconName: 'document-edit-symbolic', title: 'Notlar', panel: panel.actor});
            panel.setCloseCallback(() => this._tab?.setOpen(false));
            this._lastStatus = moduleStatus(ModuleState.READY, 'panel registered');
        } catch (error) {
            this._lastStatus = moduleStatus(ModuleState.FAILED, 'panel registration failed', {error: String(error)});
            this._logger?.warn?.(`Quick notes panel failed: ${error}`);
        }
    }
}
