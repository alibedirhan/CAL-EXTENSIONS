import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {boxLayout} from '../compat/UiCompat.js';
import {actorIsAlive, safeDestroy, safeDisconnect, safeSetVisible} from '../compat/ActorCompat.js';
import {iconBin} from '../ui/IconFactory.js';
import {RailDragHandler} from './RailDragHandler.js';
import {RAIL_WIDTH, RAIL_BUTTON, RAIL_GAP, RAIL_RIGHT_MARGIN, RAIL_MIN_HEIGHT,
    RAIL_CONTROL_HEIGHT, DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT, DEFAULT_TOP_OFFSET} from '../ui/LayoutConstants.js';

const EXTENSION_UUID = 'ubuntu-desktop-tools@cal';

// Auto-hide behaviour for the right rail (modes: off | dim | slide).
const RAIL_FULL_OPACITY = 255;
const RAIL_FADE_DURATION = 220;   // ms ease for dim mode
const RAIL_HIDE_DELAY = 480;      // ms after pointer leaves before hiding
const RAIL_SLIVER = 6;            // px left on-screen when slid away (hover target)

export class EdgeWidgetManager {
    constructor(settings, cleanup, logger) {
        this._settings = settings;
        this._cleanup = cleanup;
        this._logger = logger;
        this._items = [];
        this._activeId = null;
        this._root = null;
        this._panelHost = null;
        this._rail = null;
        this._moduleBox = null;
        this._controlBox = null;
        this._settingsButton = null;
        this._dragHandle = null;
        this._controlSignals = [];
        this._cleanupRegistered = false;
        this._idleId = 0;
        this._attachedByChrome = false;
        this._lastPrefsSpawn = 0;
        this._railHovered = false;
        this._railShown = false;   // slide mode: is the rail currently revealed?
        this._hideTimerId = 0;
        this._dragHandler = new RailDragHandler(settings, logger);
    }

    ensureRoot() {
        if (actorIsAlive(this._root)) return this._root;

        this._root = new St.Widget({
            layout_manager: new Clutter.FixedLayout(),
            style_class: 'udt-edge-shell',
            reactive: true, track_hover: true, visible: true,
            x_expand: false, y_expand: false,
            x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.START,
        });
        this._root.set_size(RAIL_WIDTH, RAIL_MIN_HEIGHT);
        this._root.set_clip_to_allocation(false);
        this._root.opacity = 255;

        this._panelHost = boxLayout({
            vertical: true, style_class: 'udt-edge-panel-host',
            reactive: true, visible: false,
            x_expand: false, y_expand: false,
            x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.START,
        });
        this._panelHost.set_size(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT);
        this._panelHost.set_position(0, 0);

        this._rail = boxLayout({
            vertical: true, style_class: 'udt-edge-rail',
            reactive: true, track_hover: true, visible: true,
            x_expand: false, y_expand: false,
            x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.START,
        });
        this._rail.set_size(RAIL_WIDTH, RAIL_MIN_HEIGHT);
        this._rail.set_position(0, 0);

        this._moduleBox = boxLayout({
            vertical: true, style_class: 'udt-edge-rail-modules',
            reactive: true, visible: true,
            x_expand: false, y_expand: false,
        });
        this._controlBox = boxLayout({
            vertical: true, style_class: 'udt-edge-rail-controls',
            reactive: true, visible: true,
            x_expand: false, y_expand: false,
        });

        this._rail.add_child(this._moduleBox);
        this._rail.add_child(this._createRailSeparator());
        this._rail.add_child(this._controlBox);
        this._createRailControls();

        this._cleanup.add(() => this._dragHandler.detach());

        this._root.add_child(this._panelHost);
        this._root.add_child(this._rail);
        this._attachRoot();

        if (!this._cleanupRegistered) {
            this._cleanup.add(() => this.destroy());
            this._cleanupRegistered = true;
        }

        const monSig = Main.layoutManager.connect('monitors-changed', () => this.reposition());
        this._cleanup.addSignal(Main.layoutManager, monSig);
        const stageSig = global.stage.connect('notify::allocation', () => this.reposition());
        this._cleanup.addSignal(global.stage, stageSig);

        // Auto-hide: restore the rail on hover, hide (dim/slide) when idle. Uses
        // the rail's track_hover state so crossing into child buttons doesn't flicker.
        const hoverSig = this._rail.connect('notify::hover', () => {
            if (this._rail.hover) {
                this._railHovered = true;
                this._railShown = true;
                this._cancelHideTimer();
                this._applyHideState(true);
            } else {
                this._railHovered = false;
                this._scheduleHide();
            }
        });
        this._cleanup.addSignal(this._rail, hoverSig);
        this._settings.onChanged('rail-hide-mode', () => { this.reposition(); this._applyRailFade(false); });
        this._settings.onChanged('rail-idle-opacity', () => this._applyRailFade(false));
        this._settings.onChanged('module-order', () => { this._applyModuleOrder(); this.reposition(); });

        this.reposition();
        this._applyRailFade(false);
        this._schedulePostAttachSync();
        this._logger?.info?.('Right rail root attached to Shell chrome');
        return this._root;
    }

    _attachRoot() {
        try {
            Main.layoutManager.addChrome(this._root, {
                affectsStruts: false, affectsInputRegion: true, trackFullscreen: true,
            });
            this._attachedByChrome = true;
            return;
        } catch (error) {
            this._logger?.warn?.(`addChrome failed, falling back: ${error}`);
        }
        try {
            Main.uiGroup.add_child(this._root);
            this._attachedByChrome = false;
        } catch (error) {
            this._logger?.warn?.(`Fallback attach failed: ${error}`);
        }
    }

    _schedulePostAttachSync() {
        if (this._idleId) return;
        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idleId = 0;
            this._sync();
            this.reposition();
            return GLib.SOURCE_REMOVE;
        });
        this._cleanup.add(() => {
            if (this._idleId) {
                try { GLib.source_remove(this._idleId); } catch (_error) {}
                this._idleId = 0;
            }
        });
    }

    _createRailSeparator() {
        const separator = new St.Widget({
            style_class: 'udt-rail-separator',
            reactive: false, visible: true,
            x_expand: false, y_expand: false,
        });
        separator.set_size(RAIL_BUTTON.width, 1);
        return separator;
    }

    _createControlButton(iconName, title, styleClass = 'udt-rail-button udt-rail-control-button') {
        const child = iconBin(iconName, 'udt-rail-button-child', 'udt-rail-symbolic-icon', 17, RAIL_BUTTON.width, RAIL_BUTTON.height);
        const button = new St.Button({
            style_class: styleClass,
            can_focus: true, reactive: true, track_hover: true,
            child, x_expand: false, y_expand: false,
        });
        button.set_size(RAIL_BUTTON.width, RAIL_BUTTON.height);
        try { button.set_accessible_name?.(title); } catch (_error) {}
        return button;
    }

    _createDragHandle() {
        const grip = boxLayout({
            vertical: false,
            style_class: 'udt-rail-drag-grip',
            reactive: false,
            visible: true,
            x_expand: false,
            y_expand: false,
        });

        for (let column = 0; column < 2; column++) {
            const columnBox = boxLayout({
                vertical: true,
                style_class: 'udt-rail-drag-grip-column',
                reactive: false,
                visible: true,
                x_expand: false,
                y_expand: false,
            });

            for (let row = 0; row < 3; row++) {
                const dot = new St.Widget({
                    style_class: 'udt-rail-drag-grip-dot',
                    reactive: false,
                    visible: true,
                    x_expand: false,
                    y_expand: false,
                });
                dot.set_size(3, 3);
                columnBox.add_child(dot);
            }
            grip.add_child(columnBox);
        }

        const handle = new St.Button({
            style_class: 'udt-rail-drag-handle',
            can_focus: true,
            reactive: true,
            track_hover: true,
            child: grip,
            x_expand: false,
            y_expand: false,
        });
        handle.set_size(RAIL_BUTTON.width, RAIL_BUTTON.height);
        try { handle.set_accessible_name?.('Sağ paneli taşı'); } catch (_error) {}
        return handle;
    }

    _createRailControls() {
        if (!actorIsAlive(this._controlBox)) return;

        this._settingsButton = this._createControlButton('preferences-system-symbolic', 'CAL Extensions ayarları');
        const settingsSig = this._settingsButton.connect('clicked', () => this._openPreferences());
        this._controlSignals.push({actor: this._settingsButton, id: settingsSig});
        this._controlBox.add_child(this._settingsButton);

        this._dragHandle = this._createDragHandle();
        this._controlBox.add_child(this._dragHandle);
        this._dragHandler.attach(
            this._dragHandle,
            offsetY => this.reposition(offsetY),
            this._rail,
            {
                onCommit: () => this.reposition(),
                getBounds: () => this._railDragBounds(),
            }
        );
    }

    _openPreferences() {
        // Debounce rapid re-clicks so we don't spawn a second prefs process
        // (gnome-shell rejects it with "Already showing a prefs dialog").
        const now = GLib.get_monotonic_time();
        if (now - this._lastPrefsSpawn < 1_500_000)
            return;
        this._lastPrefsSpawn = now;

        const command = `gnome-extensions prefs ${EXTENSION_UUID}`;
        try {
            GLib.spawn_command_line_async(command);
            this._logger?.info?.('Preferences opened from rail control');
        } catch (error) {
            this._logger?.warn?.(`Preferences could not be opened: ${error}`);
            try {
                GLib.spawn_command_line_async(`sh -c 'gnome-extensions prefs ${EXTENSION_UUID} || gnome-shell-extension-prefs ${EXTENSION_UUID}'`);
            } catch (fallbackError) {
                this._logger?.warn?.(`Preferences fallback failed: ${fallbackError}`);
            }
        }
    }

    register({id, icon = '', iconName = '', title, panel, defaultActive = false}) {
        this.ensureRoot();
        const existing = this._items.find(item => item.id === id);
        if (existing) return this._createHandle(existing);

        const preferredWidth = panel._udtPreferredWidth ?? DEFAULT_PANEL_WIDTH;
        const preferredHeight = panel._udtPreferredHeight ?? DEFAULT_PANEL_HEIGHT;
        panel.visible = false;
        panel._udtRequestRelayout = () => {
            try { this._sync(); this.reposition(); } catch (_error) {}
        };
        panel.add_style_class_name('udt-edge-panel-modern');
        panel.set_size(preferredWidth, preferredHeight);

        const child = iconName
            ? iconBin(iconName, 'udt-rail-button-child', 'udt-rail-symbolic-icon', 17, RAIL_BUTTON.width, RAIL_BUTTON.height)
            : new St.Label({
                text: icon || '•', style_class: 'udt-rail-button-label',
                x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER,
            });
        child.set_size(RAIL_BUTTON.width, RAIL_BUTTON.height);

        const button = new St.Button({
            style_class: 'udt-rail-button',
            can_focus: true, reactive: true, track_hover: true,
            child, x_expand: false, y_expand: false,
        });
        button.set_size(RAIL_BUTTON.width, RAIL_BUTTON.height);
        try { button.set_accessible_name?.(title); } catch (_error) {}

        const item = {id, title, panel, button, signalId: 0, preferredWidth, preferredHeight};
        item.signalId = button.connect('clicked', () => this.toggle(id));
        this._items.push(item);

        this._panelHost.add_child(panel);
        this._moduleBox.add_child(button);
        this._applyModuleOrder();

        if (defaultActive && !this._activeId) {
            this._activeId = id;
            this._logger?.info?.(`Default rail panel opened: ${id}`);
        }

        this._sync();
        this.reposition();
        this._schedulePostAttachSync();
        this._logger?.info?.(`Rail item registered: ${id}`);
        return this._createHandle(item);
    }

    // Reorders rail buttons (and this._items) to match the saved module-order.
    // Unknown / unlisted ids keep their current relative order at the end.
    _applyModuleOrder() {
        if (!actorIsAlive(this._moduleBox)) return;
        const order = this._settings.strv('module-order', []);
        const rank = new Map(order.map((id, index) => [id, index]));
        const rankOf = item => (rank.has(item.id) ? rank.get(item.id) : Number.MAX_SAFE_INTEGER);
        const sorted = [...this._items].sort((a, b) => rankOf(a) - rankOf(b));
        this._items = sorted;
        for (const item of sorted) {
            if (actorIsAlive(item.button) && item.button.get_parent() === this._moduleBox)
                this._moduleBox.remove_child(item.button);
        }
        for (const item of sorted) {
            if (actorIsAlive(item.button))
                this._moduleBox.add_child(item.button);
        }
    }

    unregister(id) {
        const item = this._items.find(c => c.id === id);
        if (!item) return;
        safeDisconnect(item.button, item.signalId);
        safeDestroy(item.panel);
        safeDestroy(item.button);
        this._items = this._items.filter(c => c.id !== id);
        if (this._activeId === id) this._activeId = this._items[0]?.id ?? null;
        this._sync();
        this.reposition();
    }

    toggle(id) { if (this._activeId === id) this.close(); else this.open(id); }
    open(id) { if (!this._items.some(i => i.id === id)) return; this._activeId = id; this._sync(); this.reposition(); }
    close() { this._activeId = null; this._sync(); this.reposition(); }

    _railHeight() {
        return Math.max(RAIL_MIN_HEIGHT, this._items.length * 50 + RAIL_CONTROL_HEIGHT);
    }

    // ── Auto-hide (off | dim | slide) ──
    _hideMode() {
        return this._settings.string('rail-hide-mode', 'off');
    }

    _idleOpacity() {
        const percent = Math.max(10, Math.min(100, this._settings.int('rail-idle-opacity', 36)));
        return Math.round(percent / 100 * 255);
    }

    // True when the rail should occupy its full on-screen position (slide mode
    // only ever slips away while idle; dim/off keep the full position).
    _railIsShown() {
        if (this._activeId) return true;
        if (this._hideMode() !== 'slide') return true;
        return this._railShown;
    }

    _railTargetOpacity() {
        if (this._hideMode() !== 'dim') return RAIL_FULL_OPACITY;  // off/slide → solid
        if (this._activeId || this._railHovered) return RAIL_FULL_OPACITY;
        return this._idleOpacity();                                // dim idle → faded
    }

    _applyRailFade(animate = true) {
        if (!actorIsAlive(this._rail)) return;
        const target = this._railTargetOpacity();
        if (animate) {
            try {
                this._rail.ease({opacity: target, duration: RAIL_FADE_DURATION, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
                return;
            } catch (_error) {}
        }
        try { this._rail.opacity = target; } catch (_error) {}
    }

    // Applies the current hide state: dim mode fades opacity, slide mode
    // repositions the rail (off-screen sliver when hidden).
    _applyHideState(animate = true) {
        if (this._hideMode() === 'slide') this.reposition();
        else this._applyRailFade(animate);
    }

    _scheduleHide() {
        this._cancelHideTimer();
        if (this._hideMode() === 'off') return;
        this._hideTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, RAIL_HIDE_DELAY, () => {
            this._hideTimerId = 0;
            if (!this._railHovered && !this._activeId) {
                this._railShown = false;
                this._applyHideState(true);
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelHideTimer() {
        if (this._hideTimerId) {
            try { GLib.source_remove(this._hideTimerId); } catch (_error) {}
            this._hideTimerId = 0;
        }
    }

    _railDragBounds() {
        const monitor = this._targetMonitor();
        const railHeight = this._railHeight();
        return {
            min: 48,
            max: Math.max(48, monitor.height - railHeight - 24),
        };
    }

    _targetMonitor() {
        const fallback = Main.layoutManager.primaryMonitor ?? {
            x: 0, y: 0, width: global.stage?.width ?? 1920, height: global.stage?.height ?? 1080,
        };
        try {
            const [pointerX, pointerY] = global.get_pointer();
            for (const monitor of Main.layoutManager.monitors ?? []) {
                if (pointerX >= monitor.x && pointerX < monitor.x + monitor.width &&
                    pointerY >= monitor.y && pointerY < monitor.y + monitor.height)
                    return monitor;
            }
        } catch (_error) {}
        return fallback;
    }

    reposition(previewOffsetY = null) {
        if (!actorIsAlive(this._root)) return;
        const monitor = this._targetMonitor();
        if (!monitor) return;

        const anyOpen = Boolean(this._activeId);
        const activeItem = this._items.find(i => i.id === this._activeId);
        const pw = activeItem?.panel?._udtPreferredWidth ?? activeItem?.preferredWidth ?? DEFAULT_PANEL_WIDTH;
        const ph = activeItem?.panel?._udtPreferredHeight ?? activeItem?.preferredHeight ?? DEFAULT_PANEL_HEIGHT;
        const railHeight = this._railHeight();
        const offsetY = previewOffsetY ?? this._settings.int('edge-offset-y', DEFAULT_TOP_OFFSET);
        const availH = Math.max(240, monitor.height - 100);
        const panelHeight = Math.min(ph, availH);

        const railScreenY = Math.round(monitor.y + Math.max(48, Math.min(offsetY, monitor.height - railHeight - 24)));

        if (anyOpen) {
            const panelScreenY = Math.round(monitor.y + Math.max(48, Math.min(offsetY, monitor.height - panelHeight - 24)));
            const rootY = Math.min(railScreenY, panelScreenY);
            const rootBottom = Math.max(railScreenY + railHeight, panelScreenY + panelHeight);
            const totalWidth = pw + RAIL_GAP + RAIL_WIDTH;
            const x = Math.round(monitor.x + monitor.width - totalWidth - RAIL_RIGHT_MARGIN);
            this._root.set_size(totalWidth, rootBottom - rootY);
            this._root.set_position(x, rootY);
            this._panelHost.set_size(pw, panelHeight);
            this._panelHost.set_position(0, Math.round(panelScreenY - rootY));
            this._rail.set_size(RAIL_WIDTH, railHeight);
            this._rail.set_position(pw + RAIL_GAP, Math.round(railScreenY - rootY));
        } else {
            // Slide mode hides the rail off the right edge, leaving a thin sliver
            // as the hover target; every other case sits at the full position.
            // When sliding, the revealed rail sits flush to the edge (no margin)
            // so the pointer that triggered the reveal stays over it (no flicker).
            const isSlide = this._hideMode() === 'slide';
            const margin = isSlide ? 0 : RAIL_RIGHT_MARGIN;
            const fullX = Math.round(monitor.x + monitor.width - RAIL_WIDTH - margin);
            const hiddenX = Math.round(monitor.x + monitor.width - RAIL_SLIVER);
            const x = this._railIsShown() ? fullX : hiddenX;
            this._root.set_size(RAIL_WIDTH, railHeight);
            this._root.set_position(x, railScreenY);
            this._rail.set_size(RAIL_WIDTH, railHeight);
            this._rail.set_position(0, 0);
        }

        this._root.opacity = 255;
        this._root.show?.();
        this._applyRailFade(false);

        for (const item of this._items) {
            const iw = item.panel?._udtPreferredWidth ?? item.preferredWidth ?? DEFAULT_PANEL_WIDTH;
            const ih = Math.min(item.panel?._udtPreferredHeight ?? item.preferredHeight ?? DEFAULT_PANEL_HEIGHT, availH);
            item.panel?.set_size?.(iw, ih);
        }
        try { this._root.raise_top(); } catch (_error) {}
    }

    _sync() {
        if (!actorIsAlive(this._panelHost) || !actorIsAlive(this._rail)) return;
        const anyOpen = Boolean(this._activeId);
        safeSetVisible(this._panelHost, anyOpen, this._logger);
        safeSetVisible(this._rail, true, this._logger);

        for (const item of this._items) {
            const isActive = item.id === this._activeId;
            try { item.button.remove_style_class_name('active'); } catch (_error) {}
            if (isActive) try { item.button.add_style_class_name('active'); } catch (_error) {}
            safeSetVisible(item.panel, isActive, this._logger);
            if (actorIsAlive(item.panel)) {
                item.panel.set_size(
                    item.panel._udtPreferredWidth ?? item.preferredWidth ?? DEFAULT_PANEL_WIDTH,
                    item.panel._udtPreferredHeight ?? item.preferredHeight ?? DEFAULT_PANEL_HEIGHT
                );
            }
        }
    }

    _createHandle(item) {
        return {
            id: item.id,
            isOpen: () => this._activeId === item.id,
            close: () => { if (this._activeId === item.id) this.close(); },
            setOpen: open => { if (open) this.open(item.id); else if (this._activeId === item.id) this.close(); },
            destroy: () => this.unregister(item.id),
        };
    }

    destroy() {
        this._dragHandler.detach();
        this._cancelHideTimer();
        if (this._idleId) {
            try { GLib.source_remove(this._idleId); } catch (_error) {}
            this._idleId = 0;
        }
        for (const item of [...this._items]) {
            safeDisconnect(item.button, item.signalId);
            safeDestroy(item.panel);
            safeDestroy(item.button);
        }
        for (const {actor, id} of this._controlSignals)
            safeDisconnect(actor, id, this._logger, 'rail-control');
        this._controlSignals = [];
        this._items = [];
        this._activeId = null;
        if (actorIsAlive(this._root)) {
            try { if (this._attachedByChrome) Main.layoutManager.removeChrome(this._root); } catch (_error) {}
            safeDestroy(this._root);
        }
        this._root = null;
        this._panelHost = null;
        this._rail = null;
        this._moduleBox = null;
        this._controlBox = null;
        this._settingsButton = null;
        this._dragHandle = null;
        this._attachedByChrome = false;
    }
}
