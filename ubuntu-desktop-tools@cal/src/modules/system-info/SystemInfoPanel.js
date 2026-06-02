import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import {boxLayout} from '../../compat/UiCompat.js';
import {ProcParser} from '../../utils/ProcParser.js';
import {iconBin} from '../../ui/IconFactory.js';
import {panelHeader} from '../../ui/PanelWidgets.js';

const PANEL_W = 380, PANEL_H = 560, BODY_W = 360;

function infoCard(label, value, detail, width = -1, iconName = 'info-symbolic') {
    const card = boxLayout({vertical: true, style_class: 'udt-sysinfo-card', x_expand: width === -1, y_expand: false});
    if (width > -1) card.set_width(width);
    const innerW = width > -1 ? width - 24 : -1;
    const labelRow = boxLayout({vertical: false, style_class: 'udt-sysinfo-label-row', x_expand: true, y_expand: false});
    if (innerW > -1) labelRow.set_width(innerW);
    labelRow.add_child(iconBin(iconName, 'udt-sysinfo-icon-bin', 'udt-sysinfo-symbolic-icon', 13, 18, 18));
    const labelWidget = new St.Label({text: label, style_class: 'udt-sysinfo-label', x_expand: true});
    if (innerW > -1) labelWidget.set_width(innerW - 24);
    try { labelWidget.clutter_text.ellipsize = Pango.EllipsizeMode.NONE; } catch (_e) {}
    labelRow.add_child(labelWidget);
    card.add_child(labelRow);
    const valLabel = new St.Label({text: value, style_class: 'udt-sysinfo-value', x_expand: true});
    if (innerW > -1) valLabel.set_width(innerW);
    try { valLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END; } catch (_e) {}
    card.add_child(valLabel);
    if (detail) card.add_child(new St.Label({text: detail, style_class: 'udt-sysinfo-detail'}));
    return {card, valLabel};
}

function readOsRelease() { try { const kv = ProcParser.parseKeyValueFile('/etc/os-release'); return (kv.get('PRETTY_NAME') ?? 'Linux').replace(/"/g, ''); } catch (_e) { return 'Linux'; } }
function readKernel() { try { const m = ProcParser.readText('/proc/version').match(/Linux version ([\d.]+[^\s]*)/); return m ? m[1] : 'bilinmiyor'; } catch (_e) { return 'bilinmiyor'; } }
function readUptime() {
    try {
        const seconds = parseFloat(ProcParser.readText('/proc/uptime').trim().split(/\s+/)[0]);
        if (!Number.isFinite(seconds)) return 'bilinmiyor';
        const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
        const parts = [];
        if (d > 0) parts.push(`${d}g`);
        if (h > 0) parts.push(`${h}s`);
        parts.push(`${m}dk`);
        return parts.join(' ');
    } catch (_e) { return 'bilinmiyor'; }
}
function readCpuModel() {
    try {
        const kv = ProcParser.parseKeyValueFile('/proc/cpuinfo');
        const name = kv.get('model name') ?? 'bilinmiyor';
        const cores = (ProcParser.readText('/proc/cpuinfo').match(/^processor\s/gm) ?? []).length;
        return {name, cores};
    } catch (_e) { return {name: 'bilinmiyor', cores: 0}; }
}
function readMemTotal() {
    try { const kv = ProcParser.parseKeyValueFile('/proc/meminfo'); return `${(parseInt(kv.get('MemTotal') ?? '0', 10) / 1048576).toFixed(1)} GB`; }
    catch (_e) { return 'bilinmiyor'; }
}

export class SystemInfoPanel {
    constructor({logger}) {
        this._logger = logger;
        this._uptimeLabel = null;
        this._closeCallback = null;
        this.actor = this._build();
    }

    setCloseCallback(cb) { this._closeCallback = cb; }

    _build() {
        const root = boxLayout({vertical: true, style_class: 'udt-edge-panel udt-sysinfo-panel', x_expand: false, y_expand: false});
        root._udtPreferredWidth = PANEL_W;
        root._udtPreferredHeight = PANEL_H;
        root.set_size(PANEL_W, PANEL_H);

        root.add_child(panelHeader({
            title: 'Sistem Bilgisi', subtitle: 'Anlık donanım durumu', width: PANEL_W,
            iconName: 'computer-symbolic', onClose: () => this._closeCallback?.(),
        }));

        const body = boxLayout({vertical: true, style_class: 'udt-panel-body', x_expand: false, y_expand: false});
        body.set_width(PANEL_W);
        const grid = boxLayout({vertical: true, style_class: 'udt-sysinfo-grid', x_expand: false, y_expand: false});
        grid.set_width(BODY_W);

        const osName = readOsRelease(), kernel = readKernel(), uptime = readUptime(), cpuInfo = readCpuModel(), memTotal = readMemTotal();
        const half = BODY_W / 2 - 4;

        const row1 = boxLayout({vertical: false, x_expand: false, y_expand: false, style_class: 'udt-sysinfo-row'});
        row1.set_width(BODY_W);
        row1.add_child(infoCard('İŞLETİM SİSTEMİ', osName, 'GNOME Shell', half, 'computer-symbolic').card);
        row1.add_child(infoCard('KERNEL', kernel, 'linux', half, 'applications-system-symbolic').card);
        grid.add_child(row1);

        const row2 = boxLayout({vertical: false, x_expand: false, y_expand: false, style_class: 'udt-sysinfo-row'});
        row2.set_width(BODY_W);
        const uptimeW = infoCard('UPTIME', uptime, 'son yeniden başlatma', half, 'appointment-soon-symbolic');
        this._uptimeLabel = uptimeW.valLabel;
        row2.add_child(uptimeW.card);
        row2.add_child(infoCard('CPU', cpuInfo.name, `${cpuInfo.cores} çekirdek`, half, 'processor-symbolic').card);
        grid.add_child(row2);

        const row3 = boxLayout({vertical: false, x_expand: false, y_expand: false, style_class: 'udt-sysinfo-row'});
        row3.set_width(BODY_W);
        row3.add_child(infoCard('RAM', memTotal, 'toplam bellek', half, 'media-flash-symbolic').card);
        row3.add_child(infoCard('OTURUM', GLib.getenv('XDG_SESSION_TYPE') ?? 'bilinmiyor', GLib.getenv('DESKTOP_SESSION') ?? '', half, 'video-display-symbolic').card);
        grid.add_child(row3);

        body.add_child(grid);
        root.add_child(body);
        return root;
    }

    refreshUptime() {
        if (this._uptimeLabel) try { this._uptimeLabel.text = readUptime(); } catch (_error) {}
    }
}
