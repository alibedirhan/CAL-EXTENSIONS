import {CpuReader} from './metrics/CpuReader.js';
import {MemoryReader} from './metrics/MemoryReader.js';
import {NetworkReader} from './metrics/NetworkReader.js';
import {DiskReader} from './metrics/DiskReader.js';

const FALLBACKS = {
    cpu: {percent: 0, status: 'unknown', ready: false, reason: 'CPU_UNAVAILABLE'},
    memory: {percent: 0, usedGb: 0, totalGb: 0, status: 'unknown', ready: false, reason: 'MEMORY_UNAVAILABLE'},
    network: {downBps: 0, upBps: 0, downLabel: '0 KB/s', upLabel: '0 KB/s', interfaces: [], ready: false, reason: 'NETWORK_UNAVAILABLE'},
    disk: {devices: 0, percent: 0, usedGb: 0, totalGb: 0, freeGb: 0, status: 'unknown', ready: false, reason: 'DISK_UNAVAILABLE'},
};

export class SystemMetricsService {
    constructor(logger, diagnostics = null) {
        this._logger = logger;
        this._diagnostics = diagnostics;
        this._cpu = new CpuReader();
        this._memory = new MemoryReader();
        this._network = new NetworkReader();
        this._disk = new DiskReader();
    }

    sample() {
        const reasons = [];
        const cpu = this._readMetric('cpu', this._cpu, reasons);
        const memory = this._readMetric('memory', this._memory, reasons);
        const network = this._readMetric('network', this._network, reasons);
        const disk = this._readMetric('disk', this._disk, reasons);

        return {
            cpu,
            memory,
            network,
            disk,
            sampledAt: Date.now(),
            status: reasons.length > 0 ? 'degraded' : 'ready',
            reasons,
        };
    }

    _readMetric(name, reader, reasons) {
        try {
            const result = reader.read();
            if (!result?.ready)
                reasons.push(result?.reason ?? `${name.toUpperCase()}_NOT_READY`);
            return {...FALLBACKS[name], ...result};
        } catch (error) {
            const reason = `${name.toUpperCase()}_READ_FAILED`;
            reasons.push(reason);
            this._logger?.warn?.(`Metric reader failed (${name}): ${error}`);
            this._diagnostics?.warn?.('metrics', `Metric reader failed (${name})`, {error: String(error)});
            return {...FALLBACKS[name], reason, error: String(error)};
        }
    }
}
