import Gio from 'gi://Gio';
import {ProcParser} from '../../../utils/ProcParser.js';

export class DiskReader {
    read() {
        const root = this._readFilesystemUsage('/');
        const devices = this._countVisibleDevices();

        if (!root.ready)
            return {ready: false, percent: 0, usedGb: 0, totalGb: 0, freeGb: 0, devices, status: 'okuma bekleniyor', reason: 'ROOT_FILESYSTEM_UNAVAILABLE'};

        return {
            ready: true,
            percent: root.percent,
            usedGb: root.usedGb,
            totalGb: root.totalGb,
            freeGb: root.freeGb,
            devices,
            status: `${root.freeGb.toFixed(0)} GB boş`,
            mount: '/',
        };
    }

    _readFilesystemUsage(path) {
        try {
            const file = Gio.File.new_for_path(path);
            const info = file.query_filesystem_info('filesystem::size,filesystem::free', null);
            const totalBytes = Number(info.get_attribute_uint64('filesystem::size'));
            const freeBytes = Number(info.get_attribute_uint64('filesystem::free'));

            if (!Number.isFinite(totalBytes) || totalBytes <= 0 || !Number.isFinite(freeBytes))
                return {ready: false, reason: 'FILESYSTEM_INFO_INVALID'};

            const usedBytes = Math.max(0, totalBytes - freeBytes);
            const percent = Math.round(Math.max(0, Math.min(100, (usedBytes / totalBytes) * 100)));
            const gb = 1024 * 1024 * 1024;
            return {
                ready: true,
                percent,
                usedGb: usedBytes / gb,
                totalGb: totalBytes / gb,
                freeGb: freeBytes / gb,
            };
        } catch (_error) {
            return {ready: false, reason: 'FILESYSTEM_INFO_INVALID'};
        }
    }

    _countVisibleDevices() {
        const lines = ProcParser.readLines('/proc/diskstats');
        return lines.filter(line => /\s(nvme\d+n\d+|sd[a-z]|vd[a-z])\s/.test(line)).length;
    }
}
