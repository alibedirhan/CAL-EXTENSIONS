import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {boxLayout} from '../../compat/UiCompat.js';

function metricStatusClass(metric) {
    if (!metric?.ready || !Number.isFinite(metric.percent)) return 'udt-chip-neutral';
    if (metric.percent >= 85) return 'udt-chip-danger';
    if (metric.percent >= 70) return 'udt-chip-warn';
    return 'udt-chip-good';
}

function percentLabel(metric) {
    return metric?.ready && Number.isFinite(metric.percent) ? `${metric.percent}%` : '--';
}

export const SystemMonitorIndicator = GObject.registerClass(
class SystemMonitorIndicator extends PanelMenu.Button {
    _init(settings) {
        super._init(0.0, 'CAL Extensions System Monitor', false);
        this._settings = settings;
        this._metrics = null;
        this.add_style_class_name('udt-panel-indicator');

        this._panelBox = boxLayout({vertical: false, style_class: 'udt-panel-box', y_align: Clutter.ActorAlign.CENTER});
        this._cpuChip = this._createChip('●', 'CPU --', 'udt-chip udt-chip-cpu');
        this._ramChip = this._createChip('●', 'RAM --', 'udt-chip udt-chip-ram');
        this._diskChip = this._createChip('●', 'DISK --', 'udt-chip udt-chip-disk');
        this._upChip = this._createChip('▲', '0 KB/s', 'udt-chip udt-chip-up');
        this._downChip = this._createChip('▼', '0 KB/s', 'udt-chip udt-chip-down');

        this._panelBox.add_child(this._cpuChip.container);
        this._panelBox.add_child(this._separator());
        this._panelBox.add_child(this._ramChip.container);
        this._panelBox.add_child(this._separator());
        this._panelBox.add_child(this._diskChip.container);
        this._panelBox.add_child(this._separator());
        this._panelBox.add_child(this._upChip.container);
        this._panelBox.add_child(this._separator());
        this._panelBox.add_child(this._downChip.container);
        this.add_child(this._panelBox);
        this._buildMenu();
    }

    _separator() {
        return new St.Widget({style_class: 'udt-chip-separator', y_align: Clutter.ActorAlign.CENTER});
    }

    _createChip(icon, text, styleClass) {
        const container = boxLayout({vertical: false, style_class: styleClass, y_align: Clutter.ActorAlign.CENTER});
        const iconLabel = new St.Label({text: icon, y_align: Clutter.ActorAlign.CENTER, style_class: 'udt-chip-icon'});
        const valueLabel = new St.Label({text, y_align: Clutter.ActorAlign.CENTER, style_class: 'udt-chip-value'});
        container.add_child(iconLabel);
        container.add_child(valueLabel);
        return {container, iconLabel, valueLabel};
    }

    update(metrics) {
        this._metrics = metrics;
        const compact = this._settings.boolean('monitor-compact-mode', false);
        const cpu = percentLabel(metrics.cpu), ram = percentLabel(metrics.memory), disk = percentLabel(metrics.disk);
        const up = metrics.network?.upLabel ?? '0 KB/s', down = metrics.network?.downLabel ?? '0 KB/s';

        this._cpuChip.valueLabel.text = compact ? cpu : `CPU ${cpu}`;
        this._ramChip.valueLabel.text = compact ? ram : `RAM ${ram}`;
        this._diskChip.valueLabel.text = compact ? disk : `Disk ${disk}`;
        this._upChip.valueLabel.text = up;
        this._downChip.valueLabel.text = down;

        this._applyStatus(this._cpuChip.container, metrics.cpu);
        this._applyStatus(this._ramChip.container, metrics.memory);
        this._applyStatus(this._diskChip.container, metrics.disk);
        this._updateMenu();
    }

    _applyStatus(actor, metric) {
        for (const c of ['udt-chip-good', 'udt-chip-warn', 'udt-chip-danger', 'udt-chip-neutral'])
            actor.remove_style_class_name(c);
        actor.add_style_class_name(metricStatusClass(metric));
    }

    _buildMenu() {
        this.menu.removeAll();
        const panelItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        this._metricBox = boxLayout({vertical: true, style_class: 'udt-system-popup'});
        panelItem.add_child(this._metricBox);
        this.menu.addMenuItem(panelItem);
        this._updateMenu();
    }

    _updateMenu() {
        if (!this._metricBox) return;
        this._metricBox.destroy_all_children();
        const m = this._metrics;

        const header = boxLayout({vertical: true, style_class: 'udt-system-popup-header'});
        header.add_child(new St.Label({text: 'SYSTEM MONITOR', style_class: 'udt-system-popup-title'}));
        header.add_child(new St.Label({text: 'Canlı sistem özeti', style_class: 'udt-system-popup-subtitle'}));
        this._metricBox.add_child(header);

        if (!m) { this._metricBox.add_child(new St.Label({text: 'Veriler hazırlanıyor...', style_class: 'udt-system-popup-subtitle'})); return; }

        this._metricBox.add_child(this._percentRow('CPU', m.cpu, m.cpu?.status ?? 'normal'));
        this._metricBox.add_child(this._percentRow('RAM', m.memory, m.memory?.ready ? `${m.memory.usedGb.toFixed(1)} / ${m.memory.totalGb.toFixed(1)} GB` : 'hazırlanıyor'));
        this._metricBox.add_child(this._percentRow('Disk', m.disk, m.disk?.ready ? `${m.disk.freeGb.toFixed(0)} GB boş` : 'hazırlanıyor'));

        const netBox = boxLayout({vertical: false, style_class: 'udt-net-card-row'});
        netBox.add_child(this._netCard('UPLOAD', m.network?.upLabel ?? '0 KB/s', m.network?.interfaces?.[0] ?? 'aktif ağ'));
        netBox.add_child(this._netCard('DOWNLOAD', m.network?.downLabel ?? '0 KB/s', m.network?.interfaces?.[0] ?? 'aktif ağ'));
        this._metricBox.add_child(netBox);
    }

    _percentRow(name, metric, detail) {
        const percent = metric?.ready && Number.isFinite(metric.percent) ? Math.max(0, Math.min(100, metric.percent)) : 0;
        const row = boxLayout({vertical: false, style_class: 'udt-progress-row'});
        row.add_child(new St.Label({text: name, style_class: 'udt-progress-name', x_expand: false, y_align: Clutter.ActorAlign.CENTER}));
        const barOuter = boxLayout({vertical: false, style_class: 'udt-progress-track', y_align: Clutter.ActorAlign.CENTER});
        barOuter.set_width(112);
        const fill = new St.Widget({style_class: 'udt-progress-fill'});
        fill.set_width(Math.max(4, Math.round(112 * percent / 100)));
        barOuter.add_child(fill);
        row.add_child(barOuter);
        const rightBox = boxLayout({vertical: true, style_class: 'udt-progress-right', x_expand: true});
        rightBox.add_child(new St.Label({text: metric?.ready ? `${percent}%` : '--', style_class: 'udt-progress-value'}));
        rightBox.add_child(new St.Label({text: detail, style_class: 'udt-progress-detail'}));
        row.add_child(rightBox);
        return row;
    }

    _netCard(title, value, detail) {
        const card = boxLayout({vertical: true, style_class: 'udt-net-card', x_expand: true});
        card.add_child(new St.Label({text: title, style_class: 'udt-net-card-title'}));
        card.add_child(new St.Label({text: value, style_class: 'udt-net-card-value'}));
        card.add_child(new St.Label({text: detail, style_class: 'udt-net-card-detail'}));
        return card;
    }
});
