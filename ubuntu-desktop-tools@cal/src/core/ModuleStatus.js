export const ModuleState = Object.freeze({
    READY: 'ready',
    DEGRADED: 'degraded',
    FAILED: 'failed',
    DISABLED: 'disabled',
});

export function moduleStatus(state = ModuleState.READY, detail = '', extra = {}) {
    return {state, detail, ...extra};
}

export function statusFromError(error, detail = 'Module operation failed') {
    return moduleStatus(ModuleState.FAILED, detail, {error: String(error)});
}
