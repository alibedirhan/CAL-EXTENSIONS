import Clutter from 'gi://Clutter';

const DRAG_THRESHOLD_PX = 6;
const MIN_OFFSET_Y = 48;
const BOTTOM_SAFE_MARGIN = 24;
const FALLBACK_RAIL_HEIGHT = 180;

function safeDisconnect(actor, signalId) {
    try {
        if (actor && signalId)
            actor.disconnect(signalId);
    } catch (_error) {}
}

function pointerY() {
    try {
        const [, y] = global.get_pointer();
        return y;
    } catch (_error) {
        return 0;
    }
}

/**
 * Handles vertical dragging of the edge rail.
 *
 * Dragging is intentionally bound to a dedicated handle instead of the whole
 * rail. A small movement threshold prevents normal clicks from being treated
 * as drag operations. During pointer motion we only preview the position in
 * the UI. The GSettings value is written once on release. This keeps the drag
 * feeling smooth and avoids small stalls caused by repeated settings writes.
 */
export class RailDragHandler {
    constructor(settings, logger) {
        this._settings = settings;
        this._logger = logger;
        this._pressed = false;
        this._dragging = false;
        this._dragStartY = 0;
        this._dragStartOffset = 0;
        this._currentOffset = 0;
        this._signals = [];
        this._handle = null;
        this._visualActor = null;
        this._onPreview = null;
        this._onCommit = null;
        this._getBounds = null;
    }

    get isDragging() { return this._dragging; }

    attach(handle, onPreview, visualActor = null, options = {}) {
        this.detach();
        this._handle = handle;
        this._visualActor = visualActor ?? handle;
        this._onPreview = onPreview;
        this._onCommit = options.onCommit ?? onPreview;
        this._getBounds = options.getBounds ?? null;
        if (!handle) return;

        const pressId = handle.connect('button-press-event', (_actor, event) => {
            if (event.get_button() !== 1) return Clutter.EVENT_PROPAGATE;

            this._pressed = true;
            this._dragging = false;
            this._dragStartY = pointerY();
            this._dragStartOffset = this._settings.int('edge-offset-y', 800);
            this._currentOffset = this._dragStartOffset;
            try { handle.add_style_class_name?.('udt-rail-drag-handle-pressed'); } catch (_error) {}
            return Clutter.EVENT_STOP;
        });
        this._signals.push({actor: handle, id: pressId});

        const capturedId = global.stage.connect('captured-event', (_actor, event) => {
            if (!this._pressed) return Clutter.EVENT_PROPAGATE;

            const type = event.type();
            if (type === Clutter.EventType.MOTION) {
                const y = pointerY();
                const delta = y - this._dragStartY;

                if (!this._dragging) {
                    if (Math.abs(delta) < DRAG_THRESHOLD_PX)
                        return Clutter.EVENT_STOP;
                    this._startDrag();
                }

                this._currentOffset = this._boundedOffset(this._dragStartOffset + delta);
                this._onPreview?.(this._currentOffset);
                return Clutter.EVENT_STOP;
            }

            if (type === Clutter.EventType.BUTTON_RELEASE) {
                this._finishInteraction(true);
                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        });
        this._signals.push({actor: global.stage, id: capturedId});
    }

    _startDrag() {
        this._dragging = true;
        try { this._visualActor?.add_style_class_name?.('udt-rail-dragging'); } catch (_error) {}
        try { this._handle?.add_style_class_name?.('udt-rail-drag-handle-active'); } catch (_error) {}
    }

    _bounds() {
        try {
            const bounds = this._getBounds?.();
            if (bounds && Number.isFinite(bounds.min) && Number.isFinite(bounds.max))
                return bounds;
        } catch (_error) {}

        const stageHeight = global.stage?.height ?? 1080;
        return {
            min: MIN_OFFSET_Y,
            max: Math.max(200, stageHeight - FALLBACK_RAIL_HEIGHT - BOTTOM_SAFE_MARGIN),
        };
    }

    _boundedOffset(offset) {
        const bounds = this._bounds();
        const min = bounds.min;
        const max = Math.max(min, bounds.max);
        return Math.max(min, Math.min(Math.round(offset), max));
    }

    _finishInteraction(commit) {
        const wasDragging = this._dragging;
        this._pressed = false;
        this._dragging = false;

        try { this._visualActor?.remove_style_class_name?.('udt-rail-dragging'); } catch (_error) {}
        try { this._handle?.remove_style_class_name?.('udt-rail-drag-handle-active'); } catch (_error) {}
        try { this._handle?.remove_style_class_name?.('udt-rail-drag-handle-pressed'); } catch (_error) {}

        if (commit && wasDragging) {
            const finalOffset = this._boundedOffset(this._currentOffset);
            try { this._settings.raw.set_int('edge-offset-y', finalOffset); } catch (_error) {}
            this._onCommit?.();
            this._logger?.info?.(`Rail dragged to offset ${finalOffset}`);
        }
    }

    detach() {
        this._finishInteraction(false);
        for (const {actor, id} of this._signals)
            safeDisconnect(actor, id);
        this._signals = [];
        this._handle = null;
        this._visualActor = null;
        this._onPreview = null;
        this._onCommit = null;
        this._getBounds = null;
    }
}
