import GLib from 'gi://GLib';
import {ProcParser} from '../../utils/ProcParser.js';

const STORAGE_VERSION = 1;
const MAX_CUSTOM_COMMANDS = 60;

function cleanText(value, maxLength = 160) {
    return String(value ?? '')
        .replace(/[\u0000\r\n]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function categoryFor(command, title = '') {
    const text = `${title} ${command}`.toLocaleLowerCase('tr-TR');
    if (/\b(gnome-shell|gnome-extensions|gsettings|dconf)\b/.test(text))
        return 'GNOME';
    if (/\b(ip|ss|ping|resolvectl|nmcli|networkctl|traceroute|dig|host)\b/.test(text))
        return 'Ağ';
    if (/\b(df|du|ls|find|stat|cat|tail|head|grep|sed|awk)\b/.test(text))
        return 'Dosya';
    if (/\b(apt|dnf|pacman|zypper|snap|flatpak|systemctl|journalctl|free|top|htop|sensors)\b/.test(text))
        return 'Sistem';
    return 'Özel';
}

function normalizeCommand(item) {
    const title = cleanText(item?.title, 80);
    const command = cleanText(item?.command, 220);
    if (!title || !command)
        return null;

    return {
        id: cleanText(item?.id, 40) || String(GLib.get_real_time()),
        category: categoryFor(command, title),
        title,
        command,
        description: cleanText(item?.description, 120) || 'Kullanıcı komutu',
        risk: 'safe',
        action: 'copy',
        custom: true,
        createdAt: cleanText(item?.createdAt, 40) || new Date().toISOString(),
    };
}

export class TerminalCommandStorage {
    constructor(logger) {
        this._logger = logger;
        this._dir = `${GLib.get_user_data_dir()}/ubuntu-desktop-tools`;
        this._path = `${this._dir}/terminal-commands.json`;
    }

    load() {
        try {
            const text = ProcParser.readText(this._path);
            if (!text.trim())
                return {commands: [], hidden: []};
            const data = JSON.parse(text);
            const raw = Array.isArray(data?.commands) ? data.commands : Array.isArray(data) ? data : [];
            const commands = raw.map(normalizeCommand).filter(Boolean).slice(0, MAX_CUSTOM_COMMANDS);
            const hidden = Array.isArray(data?.hidden)
                ? [...new Set(data.hidden.map(id => cleanText(id, 40)).filter(Boolean))].slice(0, 100)
                : [];
            return {commands, hidden};
        } catch (error) {
            this._logger?.warn?.(`Custom terminal commands load failed: ${error}`);
            return {commands: [], hidden: []};
        }
    }

    save(commands, hidden = []) {
        try {
            GLib.mkdir_with_parents(this._dir, 0o700);
            const normalized = commands.map(normalizeCommand).filter(Boolean).slice(0, MAX_CUSTOM_COMMANDS);
            const hiddenIds = [...new Set((Array.isArray(hidden) ? hidden : []).map(id => cleanText(id, 40)).filter(Boolean))].slice(0, 100);
            const payload = JSON.stringify({version: STORAGE_VERSION, commands: normalized, hidden: hiddenIds}, null, 2);
            const tmpPath = `${this._path}.tmp-${GLib.get_real_time()}`;
            GLib.file_set_contents(tmpPath, payload);
            GLib.rename(tmpPath, this._path);
            return true;
        } catch (error) {
            this._logger?.warn?.(`Custom terminal commands save failed: ${error}`);
            return false;
        }
    }
}

export class TerminalCommandRepository {
    constructor(logger) {
        this._storage = new TerminalCommandStorage(logger);
        const data = this._storage.load();
        this._commands = data.commands;
        this._hidden = data.hidden;
    }

    list() {
        return [...this._commands];
    }

    hiddenIds() {
        return [...this._hidden];
    }

    isHidden(id) {
        return this._hidden.includes(String(id ?? '').trim());
    }

    _persist() {
        this._storage.save(this._commands, this._hidden);
    }

    add(title, command) {
        const item = normalizeCommand({
            id: String(GLib.get_real_time()),
            title,
            command,
            createdAt: new Date().toISOString(),
        });
        if (!item)
            return null;
        this._commands = [item, ...this._commands.filter(existing => existing.command !== item.command)]
            .slice(0, MAX_CUSTOM_COMMANDS);
        this._persist();
        return item;
    }

    remove(id) {
        this._commands = this._commands.filter(item => item.id !== id);
        this._persist();
    }

    // Built-in catalog commands cannot be deleted, but the user can hide them
    // from the list; the hidden id set is persisted alongside custom commands.
    hide(id) {
        const clean = String(id ?? '').trim();
        if (clean && !this._hidden.includes(clean))
            this._hidden.push(clean);
        this._persist();
    }

    restore(id) {
        const clean = String(id ?? '').trim();
        this._hidden = this._hidden.filter(hiddenId => hiddenId !== clean);
        this._persist();
    }
}

export function autoCategoryForCommand(command, title = '') {
    return categoryFor(command, title);
}
