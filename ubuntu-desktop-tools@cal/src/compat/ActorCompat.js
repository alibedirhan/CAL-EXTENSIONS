export function actorIsAlive(actor) {
    try {
        return Boolean(actor) && !actor.is_destroyed?.();
    } catch (_error) {
        return Boolean(actor);
    }
}

export function safeDestroy(actor, logger = null, label = 'actor') {
    try {
        if (actorIsAlive(actor))
            actor.destroy?.();
        return true;
    } catch (error) {
        logger?.warn?.(`safeDestroy failed (${label}): ${error}`);
        return false;
    }
}

export function safeDisconnect(actor, signalId, logger = null, label = 'signal') {
    try {
        if (actorIsAlive(actor) && signalId)
            actor.disconnect(signalId);
        return true;
    } catch (error) {
        logger?.warn?.(`safeDisconnect failed (${label}): ${error}`);
        return false;
    }
}

export function safeSetVisible(actor, visible, logger = null) {
    try {
        if (!actorIsAlive(actor))
            return false;
        actor.visible = visible;
        if (visible)
            actor.show?.();
        else
            actor.hide?.();
        return true;
    } catch (error) {
        logger?.warn?.(`safeSetVisible failed: ${error}`);
        return false;
    }
}

export function safeRemoveAllChildren(actor, logger = null) {
    try {
        if (!actorIsAlive(actor))
            return false;
        if (actor.destroy_all_children) {
            actor.destroy_all_children();
            return true;
        }
        for (const child of actor.get_children?.() ?? [])
            safeDestroy(child, logger, 'child');
        return true;
    } catch (error) {
        logger?.warn?.(`safeRemoveAllChildren failed: ${error}`);
        return false;
    }
}
