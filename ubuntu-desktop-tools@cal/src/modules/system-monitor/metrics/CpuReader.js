import {ProcParser} from '../../../utils/ProcParser.js';

function parseCpuLine(line) {
    if (!line)
        return null;

    const values = line.trim()
        .split(/\s+/)
        .slice(1)
        .map(value => Number.parseInt(value, 10));

    if (values.length < 4 || values.some(value => !Number.isFinite(value)))
        return null;

    const idle = (values[3] ?? 0) + (values[4] ?? 0);
    const total = values.reduce((sum, value) => sum + value, 0);

    if (!Number.isFinite(total) || !Number.isFinite(idle) || total <= 0)
        return null;

    return {total, idle};
}

export class CpuReader {
    constructor() {
        this._last = null;
        this._lastGoodPercent = 0;
    }

    read() {
        const line = ProcParser.readLines('/proc/stat').find(row => row.startsWith('cpu '));
        const current = parseCpuLine(line);

        if (!current)
            return {percent: this._lastGoodPercent, status: 'unknown', ready: false, reason: 'PROC_STAT_UNAVAILABLE'};

        if (!this._last) {
            this._last = current;
            return {percent: 0, status: 'warming', ready: false, reason: 'CPU_WARMING'};
        }

        const deltaTotal = current.total - this._last.total;
        const deltaIdle = current.idle - this._last.idle;
        this._last = current;

        if (deltaTotal <= 0 || deltaIdle < 0)
            return {percent: this._lastGoodPercent, status: 'warming', ready: false, reason: 'CPU_COUNTER_RESET'};

        const rawPercent = (1 - deltaIdle / deltaTotal) * 100;
        if (!Number.isFinite(rawPercent))
            return {percent: this._lastGoodPercent, status: 'unknown', ready: false, reason: 'PROC_STAT_UNAVAILABLE'};

        const percent = Math.round(Math.max(0, Math.min(100, rawPercent)));
        this._lastGoodPercent = percent;

        return {percent, status: percent > 75 ? 'high' : 'normal', ready: true};
    }
}
