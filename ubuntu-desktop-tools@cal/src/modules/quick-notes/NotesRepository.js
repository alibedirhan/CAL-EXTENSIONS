import GLib from 'gi://GLib';
import {NotesStorage} from './NotesStorage.js';

const MAX_LINES = 1000;

export class NotesRepository {
    constructor(settings, logger) {
        this._settings = settings;
        this._storage = new NotesStorage(logger);
        this._notes = this._migrate(this._storage.load());
    }

    /** Migrate old {text} format to new {title, body} format. */
    _migrate(rawNotes) {
        return rawNotes.map(note => {
            if (note.title !== undefined)
                return note;
            // Old format: single text field → title = first line, body = rest
            const text = String(note.text ?? '');
            const firstNewline = text.indexOf('\n');
            if (firstNewline === -1)
                return {...note, title: text, body: ''};
            return {...note, title: text.slice(0, firstNewline).trim(), body: text.slice(firstNewline + 1)};
        });
    }

    list() {
        const hide = this._settings.boolean('notes-hide-completed', false);
        return hide ? this._notes.filter(note => !note.done) : [...this._notes];
    }

    find(id) {
        return this._notes.find(item => item.id === id) ?? null;
    }

    add(title, body = '') {
        const cleanTitle = String(title).trim();
        if (!cleanTitle)
            return;
        const cleanBody = this._enforceLineLimit(String(body));
        this._notes.unshift({
            id: String(GLib.get_real_time()),
            title: cleanTitle,
            body: cleanBody,
            done: false,
            createdAt: new Date().toISOString(),
        });
        this._trim();
        this._persist();
    }

    update(id, title, body) {
        const note = this._notes.find(item => item.id === id);
        if (!note)
            return;
        note.title = String(title).trim() || note.title;
        note.body = this._enforceLineLimit(String(body ?? ''));
        this._persist();
    }

    toggle(id) {
        const note = this._notes.find(item => item.id === id);
        if (!note)
            return;
        note.done = !note.done;
        this._persist();
    }

    remove(id) {
        this._notes = this._notes.filter(item => item.id !== id);
        this._persist();
    }

    _enforceLineLimit(text) {
        const lines = text.split('\n');
        if (lines.length <= MAX_LINES)
            return text;
        return lines.slice(0, MAX_LINES).join('\n');
    }

    _trim() {
        this._notes = this._notes.slice(0, this._settings.int('notes-max-count', 30));
    }

    _persist() {
        this._storage.save(this._notes);
    }
}
