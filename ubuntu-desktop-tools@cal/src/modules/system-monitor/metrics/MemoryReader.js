import {ProcParser} from '../../../utils/ProcParser.js';

function parseKb(value) {
    const match = String(value ?? '').match(/(\d+)/);
    return match ? Number.parseInt(match[1], 10) : 0;
}

export class MemoryReader {
    constructor() {
        this._lastGood = {percent: 0, usedGb: 0, totalGb: 0, status: 'warming', ready: false};
    }

    read() {
        const data = ProcParser.parseKeyValueFile('/proc/meminfo');
        const totalKb = parseKb(data.get('MemTotal'));
        const availableDirectKb = parseKb(data.get('MemAvailable'));

        let availableKb = availableDirectKb;
        if (availableKb <= 0) {
            const memFree = parseKb(data.get('MemFree'));
            const buffers = parseKb(data.get('Buffers'));
            const cached = parseKb(data.get('Cached'));
            const reclaimable = parseKb(data.get('SReclaimable'));
            const shmem = parseKb(data.get('Shmem'));
            const fallbackAvailable = memFree + buffers + cached + reclaimable - shmem;
            availableKb = fallbackAvailable > 0 ? fallbackAvailable : 0;
        }

        if (totalKb <= 0 || availableKb <= 0 || availableKb > totalKb) {
            return {...this._lastGood, ready: false, status: 'unknown', reason: 'MEMINFO_UNAVAILABLE'};
        }

        const usedKb = Math.max(0, totalKb - availableKb);
        const percent = Math.round((usedKb / totalKb) * 100);
        const result = {
            percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0,
            usedGb: usedKb / 1024 / 1024,
            totalGb: totalKb / 1024 / 1024,
            status: percent > 82 ? 'high' : 'normal',
            ready: true,
        };
        this._lastGood = result;
        return result;
    }
}
