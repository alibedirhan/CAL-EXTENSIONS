import {CleanupBag} from './CleanupBag.js';
import {DiagnosticsService} from './DiagnosticsService.js';
import {Logger} from './Logger.js';
import {ModuleRegistry} from './ModuleRegistry.js';
import {SchedulerService} from './SchedulerService.js';
import {SettingsService} from './SettingsService.js';
import {PanelPlacementAdapter} from '../panel/PanelPlacementAdapter.js';
import {EdgeWidgetManager} from '../overlay/EdgeWidgetManager.js';
import {SystemMonitorModule} from '../modules/system-monitor/SystemMonitorModule.js';
import {TerminalShortcutsModule} from '../modules/terminal-shortcuts/TerminalShortcutsModule.js';
import {QuickNotesModule} from '../modules/quick-notes/QuickNotesModule.js';
import {SystemInfoModule} from '../modules/system-info/SystemInfoModule.js';
import {WeatherModule} from '../modules/weather/WeatherModule.js';

export class ExtensionController {
    constructor(extension) {
        this._extension = extension;
        this._logger = new Logger('CALExtensions');
        this._diagnostics = new DiagnosticsService(this._logger);
        this._cleanup = new CleanupBag(this._logger);
        this._settings = new SettingsService(extension, this._cleanup, this._logger);
        this._scheduler = new SchedulerService(this._cleanup, this._logger);
        this._registry = new ModuleRegistry(this._logger, this._diagnostics);
    }

    enable() {
        this._logger.info('Starting CAL Extensions v0.2.4-diagnostics-weather-cleanup / internal v2');
        this._diagnostics.info('startup', 'Extension enable requested', this._diagnostics.environment());

        const panelPlacement = new PanelPlacementAdapter(this._settings, this._logger);
        const edgeManager = new EdgeWidgetManager(this._settings, this._cleanup, this._logger);
        const context = {
            settings: this._settings,
            scheduler: this._scheduler,
            logger: this._logger,
            diagnostics: this._diagnostics,
            panelPlacement,
            edgeManager,
        };

        this._registry.register(new SystemMonitorModule(context));
        this._registry.register(new TerminalShortcutsModule(context));
        this._registry.register(new QuickNotesModule(context));
        this._registry.register(new SystemInfoModule(context));
        this._registry.register(new WeatherModule(context));

        this._registry.enableAll();
    }

    disable() {
        this._logger.info('Stopping CAL Extensions v0.2.4-diagnostics-weather-cleanup / internal v2');
        this._diagnostics.info('shutdown', 'Extension disable requested');
        this._registry?.disableAll();
        this._cleanup?.cleanup();
    }
}
