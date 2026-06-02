import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {ProcParser} from '../../utils/ProcParser.js';

const STORAGE_VERSION = 1;
const MAX_BACKUPS = 10;

export class NotesStorage {
    constructor(logger) {
        this._logger = logger;
        // Keep the existing storage path for backwards compatibility.
        this._dir = `${GLib.get_user_data_dir()}/ubuntu-desktop-tools`;
        this._backupDir = `${this._dir}/backups`;
        this._path = `${this._dir}/notes.json`;
    }

    load() {
        try {
            const text = ProcParser.readText(this._path);
            if (!text.trim())
                return [];
            const data = JSON.parse(text);
            if (Array.isArray(data.notes))
                return data.notes;
            if (Array.isArray(data))
                return data;
            this._logger?.warn?.('Notes file has unsupported format; starting with empty notes.');
            return [];
        } catch (error) {
            this._logger?.warn?.(`Notes load failed: ${error}`);
            this._backupCorruptFile();
            return [];
        }
    }

    save(notes) {
        try {
            GLib.mkdir_with_parents(this._dir, 0o700);
            GLib.mkdir_with_parents(this._backupDir, 0o700);
            this._backupExistingFile();

            const payload = JSON.stringify({version: STORAGE_VERSION, notes}, null, 2);
            const tmpPath = `${this._path}.tmp-${GLib.get_real_time()}`;
            GLib.file_set_contents(tmpPath, payload);
            GLib.rename(tmpPath, this._path);
            return true;
        } catch (error) {
            this._logger?.warn?.(`Notes save failed: ${error}`);
            return false;
        }
    }

    _backupExistingFile() {
        if (!GLib.file_test(this._path, GLib.FileTest.EXISTS))
            return;
        const backupPath = `${this._backupDir}/notes-${this._timestamp()}.json`;
        try {
            const text = ProcParser.readText(this._path);
            if (text.trim()) {
                GLib.file_set_contents(backupPath, text);
                this._pruneBackups();
            }
        } catch (error) {
            this._logger?.warn?.(`Notes backup failed: ${error}`);
        }
    }

    _pruneBackups(keep = MAX_BACKUPS) {
        try {
            const dir = Gio.File.new_for_path(this._backupDir);
            const enumerator = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
            const names = [];
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                const name = info.get_name();
                if (name.startsWith('notes-') && name.endsWith('.json'))
                    names.push(name);
            }
            enumerator.close(null);

            // Timestamped names sort chronologically; drop everything but the newest `keep`.
            names.sort();
            for (let i = 0; i < names.length - keep; i++)
                GLib.unlink(`${this._backupDir}/${names[i]}`);
        } catch (error) {
            this._logger?.warn?.(`Notes backup prune failed: ${error}`);
        }
    }

    _backupCorruptFile() {
        if (!GLib.file_test(this._path, GLib.FileTest.EXISTS))
            return;
        try {
            GLib.mkdir_with_parents(this._backupDir, 0o700);
            const text = ProcParser.readText(this._path);
            if (text.trim())
                GLib.file_set_contents(`${this._backupDir}/notes-corrupt-${this._timestamp()}.json`, text);
        } catch (error) {
            this._logger?.warn?.(`Corrupt notes backup failed: ${error}`);
        }
    }

    _timestamp() {
        return String(GLib.get_real_time()).replace(/[^0-9]/g, '');
    }
}
