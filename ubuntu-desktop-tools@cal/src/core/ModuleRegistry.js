import {ModuleState, moduleStatus, statusFromError} from './ModuleStatus.js';

function moduleName(module) {
    return module?.name ?? module?.id ?? module?.constructor?.name ?? 'UnknownModule';
}

export class ModuleRegistry {
    constructor(logger, diagnostics = null) {
        this._logger = logger;
        this._diagnostics = diagnostics;
        this._modules = [];
        this._states = new Map();
    }

    register(module) {
        if (!module)
            return module;
        this._modules.push(module);
        this._states.set(moduleName(module), moduleStatus(ModuleState.DISABLED, 'registered'));
        return module;
    }

    enableAll() {
        for (const module of this._modules) {
            const name = moduleName(module);
            try {
                module.init?.();
                module.enable?.();
                const health = this._safeHealthCheck(module);
                this._states.set(name, health);
                this._logger.info(`Enabled module: ${name} (${health.state})`);
            } catch (error) {
                const status = statusFromError(error, 'enable failed');
                this._states.set(name, status);
                this._diagnostics?.error?.('module', `Module enable failed (${name})`, {error: String(error)});
                this._logger.error(`Module enable failed (${name}): ${error}`);
            }
        }
    }

    disableAll() {
        for (const module of [...this._modules].reverse()) {
            const name = moduleName(module);
            try {
                module.disable?.();
                module.destroy?.();
                this._states.set(name, moduleStatus(ModuleState.DISABLED, 'disabled'));
                this._logger.info(`Disabled module: ${name}`);
            } catch (error) {
                const status = statusFromError(error, 'disable failed');
                this._states.set(name, status);
                this._diagnostics?.error?.('module', `Module disable failed (${name})`, {error: String(error)});
                this._logger.error(`Module disable failed (${name}): ${error}`);
            }
        }
        this._modules = [];
    }

    statuses() {
        return Object.fromEntries(this._states.entries());
    }

    healthCheckAll() {
        for (const module of this._modules)
            this._states.set(moduleName(module), this._safeHealthCheck(module));
        return this.statuses();
    }

    _safeHealthCheck(module) {
        try {
            if (typeof module.healthCheck === 'function')
                return module.healthCheck();
            if (typeof module.getStatus === 'function')
                return module.getStatus();
            return moduleStatus(ModuleState.READY, 'no explicit health check');
        } catch (error) {
            return statusFromError(error, 'health check failed');
        }
    }
}
