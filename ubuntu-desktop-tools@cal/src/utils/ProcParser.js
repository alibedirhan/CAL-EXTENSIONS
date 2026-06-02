import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';

// Loading GioUnix prevents GNOME 46 from warning about platform-specific UnixInputStream.
void GioUnix;

function decodeBytes(bytes) {
    if (!bytes)
        return '';

    try {
        if (typeof TextDecoder !== 'undefined')
            return new TextDecoder('utf-8').decode(bytes);
    } catch (_error) {}

    try {
        let text = '';
        for (const byte of bytes)
            text += String.fromCharCode(Number(byte) || 0);
        return text;
    } catch (_error) {
        return '';
    }
}

export class ProcParser {
    static readText(path) {
        const lines = this.readLines(path);
        return lines.length > 0 ? `${lines.join('\n')}\n` : '';
    }

    static readLines(path) {
        const streamLines = this._readLinesWithDataInputStream(path);
        if (streamLines.length > 0)
            return streamLines;

        const fallbackText = this._readTextWithGLib(path);
        return fallbackText
            .replace(/\u0000/g, '')
            .split(/\r?\n/)
            .map(line => line.trimEnd())
            .filter(line => line.trim().length > 0);
    }

    static _readLinesWithDataInputStream(path) {
        const lines = [];
        let fileStream = null;
        let dataStream = null;

        try {
            const file = Gio.File.new_for_path(path);
            fileStream = file.read(null);
            dataStream = new Gio.DataInputStream({base_stream: fileStream});

            while (true) {
                const [line] = dataStream.read_line_utf8(null);
                if (line === null || line === undefined)
                    break;
                const clean = String(line).trimEnd();
                if (clean.trim().length > 0)
                    lines.push(clean);
            }
        } catch (_error) {
            return [];
        } finally {
            try { dataStream?.close(null); } catch (_error) {}
            try { fileStream?.close(null); } catch (_error) {}
        }

        return lines;
    }

    static _readTextWithGLib(path) {
        try {
            const [ok, bytes] = GLib.file_get_contents(path);
            if (!ok)
                return '';
            return decodeBytes(bytes);
        } catch (_error) {
            return '';
        }
    }

    static parseKeyValueFile(path) {
        const result = new Map();
        for (const line of this.readLines(path)) {
            // Support both ':' (/proc/cpuinfo, /proc/meminfo) and '=' (/etc/os-release) separators
            let index = line.indexOf(':');
            const eqIndex = line.indexOf('=');
            if (index < 0 || (eqIndex >= 0 && eqIndex < index))
                index = eqIndex;
            if (index < 0)
                continue;
            const key = line.slice(0, index).trim();
            const value = line.slice(index + 1).trim();
            if (key.length > 0)
                result.set(key, value);
        }
        return result;
    }
}
