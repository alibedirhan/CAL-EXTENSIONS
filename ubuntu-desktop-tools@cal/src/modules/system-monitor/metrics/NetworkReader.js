import GLib from 'gi://GLib';
import {ProcParser} from '../../../utils/ProcParser.js';

const EXCLUDED_PREFIXES = ['lo', 'docker', 'br-', 'veth', 'virbr', 'vmnet', 'tap', 'tun', 'zt', 'tailscale'];

function isExcludedInterface(name) {
    return EXCLUDED_PREFIXES.some(prefix => name === prefix || name.startsWith(prefix));
}

function isLikelyPhysicalInterface(name) {
    return /^(en|eth|wl|ww|usb|ib|sl|ppp)/.test(name);
}

function formatBps(bytesPerSecond) {
    if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0)
        return '0 KB/s';
    return `${Math.round(bytesPerSecond / 1024)} KB/s`;
}

export class NetworkReader {
    constructor() {
        this._lastRx = 0;
        this._lastTx = 0;
        this._lastTime = 0;
        this._lastGood = {downBps: 0, upBps: 0, downLabel: '0 KB/s', upLabel: '0 KB/s', interfaces: []};
    }

    read() {
        const counters = this._readCounters();
        if (!counters.ready)
            return {...this._lastGood, ready: false, reason: 'NET_DEV_UNAVAILABLE'};

        const now = GLib.get_monotonic_time();
        const elapsed = this._lastTime > 0 ? (now - this._lastTime) / 1_000_000 : 0;

        let downBps = 0;
        let upBps = 0;
        if (elapsed > 0) {
            downBps = Math.max(0, (counters.rx - this._lastRx) / elapsed);
            upBps = Math.max(0, (counters.tx - this._lastTx) / elapsed);
        }

        this._lastRx = counters.rx;
        this._lastTx = counters.tx;
        this._lastTime = now;

        this._lastGood = {
            downBps,
            upBps,
            downLabel: formatBps(downBps),
            upLabel: formatBps(upBps),
            interfaces: counters.interfaces,
            ready: elapsed > 0,
        };
        return this._lastGood;
    }

    _readCounters() {
        const rows = this._readInterfaceRows();
        if (rows.length === 0)
            return {ready: false, rx: 0, tx: 0, interfaces: []};

        const defaultIfaces = this._readDefaultInterfaces();
        let selected = rows.filter(row => defaultIfaces.has(row.name));

        if (selected.length === 0)
            selected = rows.filter(row => isLikelyPhysicalInterface(row.name));

        if (selected.length === 0)
            selected = rows;

        return {
            ready: true,
            rx: selected.reduce((sum, row) => sum + row.rx, 0),
            tx: selected.reduce((sum, row) => sum + row.tx, 0),
            interfaces: selected.map(row => row.name),
        };
    }

    _readInterfaceRows() {
        const lines = ProcParser.readLines('/proc/net/dev').slice(2);
        const rows = [];

        for (const line of lines) {
            const index = line.indexOf(':');
            if (index < 0)
                continue;

            const iface = line.slice(0, index).trim();
            if (!iface || isExcludedInterface(iface))
                continue;

            const values = line.slice(index + 1)
                .trim()
                .split(/\s+/)
                .map(value => Number.parseInt(value, 10));

            if (values.length < 16 || values.some(value => !Number.isFinite(value)))
                continue;

            rows.push({name: iface, rx: values[0], tx: values[8]});
        }

        return rows;
    }

    _readDefaultInterfaces() {
        const result = new Set();
        for (const line of ProcParser.readLines('/proc/net/route').slice(1)) {
            const values = line.trim().split(/\s+/);
            const iface = values[0];
            const destination = values[1];
            const flagsHex = values[3];
            const flags = Number.parseInt(flagsHex ?? '0', 16);

            if (iface && destination === '00000000' && !isExcludedInterface(iface) && (flags & 0x2))
                result.add(iface);
        }
        return result;
    }
}
