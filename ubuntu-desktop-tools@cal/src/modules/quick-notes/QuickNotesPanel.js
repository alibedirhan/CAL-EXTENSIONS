import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {boxLayout} from '../../compat/UiCompat.js';
import {setTextColor, setCursorColor} from '../../compat/UiCompat.js';
import {clearActor, createVerticalScrollBox} from '../../ui/ScrollableBox.js';
import {iconBin} from '../../ui/IconFactory.js';
import {panelHeader, fixedButton, wrappedLabel} from '../../ui/PanelWidgets.js';
import {NOTE_COLORS, inlineMarkup} from './NoteFormat.js';

const PREVIEW_LIMIT = 80;
// List view stays compact; compose (new/edit) and detail (read) use the larger
// original footprint so there is room to write and read comfortably.
const LIST_W = 340, LIST_H = 480, LIST_BODY_W = 320, LIST_SCROLL_H = 320;
const DETAIL_W = 460, DETAIL_H = 560, DETAIL_BODY_W = 440, DETAIL_SCROLL_H = 420, DETAIL_TEXT_W = 418;
const COMPOSE_W = 460, COMPOSE_H = 560, COMPOSE_BODY_W = 420, COMPOSE_ENTRY_H = 326;
const NOTE_INPUT_W = 230, NOTE_PREVIEW_W = 172, NOTE_ICON_W = 26, NOTE_ACTIONS_W = 82;
const DETAIL_LINES_PER_BLOCK = 40, DETAIL_CHARS_PER_BLOCK = 3200;
const MAX_NOTE_LINES = 1000;

function escapePreview(text) {
    const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
    return clean.length <= PREVIEW_LIMIT ? clean : `${clean.slice(0, PREVIEW_LIMIT - 1)}…`;
}

function formatDate(value) {
    if (!value) return '';
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString('tr-TR', {day: '2-digit', month: '2-digit'}) + ' ' +
            date.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'});
    } catch (_error) { return ''; }
}

function lineCount(text) { return text ? String(text).split('\n').length : 0; }

function splitDetailText(text) {
    const safeText = String(text || '(boş not)');
    const lines = safeText.split('\n');
    const chunks = [];
    let current = [], currentChars = 0;
    for (const line of lines) {
        const lineText = String(line ?? '');
        if ((current.length >= DETAIL_LINES_PER_BLOCK || currentChars + lineText.length > DETAIL_CHARS_PER_BLOCK) && current.length > 0) {
            chunks.push(current.join('\n'));
            current = [];
            currentChars = 0;
        }
        current.push(lineText);
        currentChars += lineText.length + 1;
    }
    if (current.length > 0) chunks.push(current.join('\n'));
    return chunks.length > 0 ? chunks : ['(boş not)'];
}

function isCommandLine(line) {
    const text = String(line ?? "").trim();
    return (text.startsWith("<") && text.endsWith(">") && text.length > 2) ||
        (text.startsWith("`") && text.endsWith("`") && text.length > 2);
}

function commandFromLine(line) {
    const text = String(line ?? "").trim();
    if ((text.startsWith("<") && text.endsWith(">")) || (text.startsWith("`") && text.endsWith("`")))
        return text.slice(1, -1).trim();
    return text;
}

function isListLine(line) {
    return /^\s*(•|-|\*)\s+/.test(String(line ?? ""));
}

function normalizeListMarkers(text) {
    return String(text ?? "").split("\n").map(line => {
        if (/^\s*\*($|\s+)/.test(line))
            return line.replace(/^(\s*)\*\s*/, "$1• ");
        return line;
    }).join("\n");
}

function configureClutterTextArea(textActor) {
    try {
        textActor.line_wrap = true;
        textActor.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        textActor.ellipsize = Pango.EllipsizeMode.NONE;
        textActor.single_line_mode = false;
        textActor.activatable = false;
        textActor.editable = true;
        textActor.selectable = true;
        textActor.reactive = true;
    } catch (_error) {}
    // Use compat layer instead of direct Clutter.Color.from_string()
    setTextColor(textActor, '#f6f2ee');
    setCursorColor(textActor, 'rgba(233, 84, 32, 0.95)');
    try { textActor.set_font_description(Pango.FontDescription.from_string('Ubuntu 12')); } catch (_error) {}
}

export class QuickNotesPanel {
    constructor({repository, logger}) {
        this._repository = repository;
        this._logger = logger;
        this._selectedNoteId = null;
        this._editingNoteId = null;
        this._composeScrollOffset = 0;
        this._closeCallback = null;
        this.actor = this._build();
        this.refresh();
    }

    setCloseCallback(cb) { this._closeCallback = cb; }

    _build() {
        this._root = boxLayout({vertical: true, style_class: 'udt-edge-panel udt-notes-panel', x_expand: false, y_expand: false});
        this._root._udtPreferredWidth = LIST_W;
        this._root._udtPreferredHeight = LIST_H;
        this._root.set_size(LIST_W, LIST_H);
        this._content = boxLayout({vertical: true, style_class: 'udt-notes-content', x_expand: false, y_expand: false});
        this._content.set_size(LIST_W, LIST_H);
        this._root.add_child(this._content);
        return this._root;
    }

    refresh() {
        if (this._selectedNoteId) {
            const note = this._repository.find(this._selectedNoteId);
            if (note) { this._showDetail(note); return; }
            this._selectedNoteId = null;
        }
        this._showList();
    }

    _setGeom(w, h) {
        this._closeComposeContextMenu();
        this._root._udtPreferredWidth = w;
        this._root._udtPreferredHeight = h;
        this._root.set_size(w, h);
        this._content.set_size(w, h);
        this._root._udtRequestRelayout?.();
    }

    // ── List View ──
    _showList() {
        this._editingNoteId = null;
        this._setGeom(LIST_W, LIST_H);
        clearActor(this._content);
        this._content.add_child(panelHeader({
            title: 'Notlar', subtitle: 'Hızlı fikir ve görevler', width: LIST_W,
            iconName: 'document-edit-symbolic', onClose: () => this._closeCallback?.(),
        }));

        const body = boxLayout({vertical: true, style_class: 'udt-panel-body udt-notes-list-body', x_expand: false, y_expand: false});
        body.set_width(LIST_W);

        const entryRow = boxLayout({vertical: false, x_expand: false, y_expand: false, style_class: 'udt-note-compose'});
        entryRow.set_width(LIST_BODY_W);

        this._entry = new St.Entry({hint_text: 'Not başlığı...', style_class: 'udt-note-input', x_expand: false, y_expand: false, can_focus: true});
        this._entry.set_size(NOTE_INPUT_W, 38);
        try { this._entry.clutter_text.connect('activate', () => this._addQuickTitle()); } catch (_error) {}
        entryRow.add_child(this._entry);

        const addBtn = fixedButton('+', 'udt-add-button', 38, 38);
        addBtn.connect('clicked', () => this._showCompose(this._entry.get_text?.() ?? ''));
        entryRow.add_child(addBtn);
        const helpBtn = fixedButton('?', 'udt-note-action-button', 30, 38);
        helpBtn.connect('clicked', () => this._showHelp());
        entryRow.add_child(helpBtn);
        body.add_child(entryRow);

        const sb = createVerticalScrollBox({scrollStyleClass: 'udt-panel-scroll udt-notes-scroll', contentStyleClass: 'udt-note-list', width: LIST_BODY_W, height: LIST_SCROLL_H});
        this._scroll = sb.scroll;
        this._list = sb.content;
        body.add_child(this._scroll);
        this._content.add_child(body);
        this._renderNotes();
    }

    _renderNotes() {
        clearActor(this._list);
        const notes = this._repository.list();
        if (notes.length === 0) {
            this._list.add_child(new St.Label({text: 'Henüz not yok.', style_class: 'udt-empty-label'}));
            return;
        }
        for (const note of notes) this._list.add_child(this._noteRow(note));
    }

    _noteRow(note) {
        const card = boxLayout({vertical: false, style_class: note.done ? 'udt-note-row udt-note-row-done' : 'udt-note-row', x_expand: false, y_expand: false});
        card.set_size(LIST_BODY_W, 64);
        card.add_child(iconBin(note.done ? 'emblem-ok-symbolic' : 'text-x-generic-symbolic', 'udt-note-row-icon-bin', 'udt-note-row-symbolic-icon', 14, NOTE_ICON_W, NOTE_ICON_W));

        const previewBtn = new St.Button({style_class: 'udt-note-preview-button', reactive: true, can_focus: true, track_hover: true, x_expand: false, y_expand: false});
        previewBtn.set_size(NOTE_PREVIEW_W, 44);
        const previewBox = boxLayout({vertical: true, x_expand: false, y_expand: false});
        previewBox.set_width(NOTE_PREVIEW_W);

        const titleLbl = new St.Label({text: escapePreview(note.title), style_class: 'udt-note-preview', x_align: Clutter.ActorAlign.START, x_expand: false, y_expand: false});
        titleLbl.set_size(NOTE_PREVIEW_W, 17);
        try { titleLbl.clutter_text.line_wrap = false; titleLbl.clutter_text.ellipsize = Pango.EllipsizeMode.END; } catch (_error) {}
        previewBox.add_child(titleLbl);

        if (note.body) {
            const firstLine = String(note.body).split('\n')[0].trim();
            if (firstLine) {
                const bodyLbl = new St.Label({text: escapePreview(firstLine), style_class: 'udt-note-body-preview', x_align: Clutter.ActorAlign.START});
                bodyLbl.set_size(NOTE_PREVIEW_W, 14);
                try { bodyLbl.clutter_text.line_wrap = false; bodyLbl.clutter_text.ellipsize = Pango.EllipsizeMode.END; } catch (_error) {}
                previewBox.add_child(bodyLbl);
            }
        }

        const lines = lineCount(note.body);
        const metaText = formatDate(note.createdAt) + (lines > 1 ? ` · ${lines} satır` : '');
        if (metaText) previewBox.add_child(new St.Label({text: metaText, style_class: 'udt-note-meta', x_align: Clutter.ActorAlign.START}));

        previewBtn.set_child(previewBox);
        previewBtn.connect('clicked', () => { this._selectedNoteId = note.id; this.refresh(); });
        card.add_child(previewBtn);

        const actions = boxLayout({vertical: false, style_class: 'udt-note-actions', x_expand: false, y_expand: false, x_align: Clutter.ActorAlign.END});
        actions.set_size(NOTE_ACTIONS_W, 26);
        const open = fixedButton('›', 'udt-note-open-button', 26, 26);
        open.connect('clicked', () => { this._selectedNoteId = note.id; this.refresh(); });
        const toggle = fixedButton(note.done ? '↺' : '✓', 'udt-note-action-button', 26, 26);
        toggle.connect('clicked', () => { this._repository.toggle(note.id); this.refresh(); });
        const remove = fixedButton('×', 'udt-note-action-button udt-note-delete-button', 26, 26);
        remove.connect('clicked', () => { this._repository.remove(note.id); this.refresh(); });
        actions.add_child(open);
        actions.add_child(toggle);
        actions.add_child(remove);
        card.add_child(actions);
        return card;
    }

    // ── Compose View ──
    _showCompose(initialTitle = '', initialBody = '', editId = null) {
        this._editingNoteId = editId;
        this._composeScrollOffset = 0;
        this._composePreviewMode = false;
        this._composePreviewScroll = null;
        this._composePreviewContent = null;
        this._setGeom(COMPOSE_W, COMPOSE_H);
        clearActor(this._content);
        this._content.add_child(this._composeHeader(editId ? 'Notu Düzenle' : 'Yeni Not'));

        const body = boxLayout({vertical: true, style_class: 'udt-panel-body udt-note-compose-body', x_expand: false, y_expand: false});
        body.set_width(COMPOSE_W);

        this._composeTitle = new St.Entry({hint_text: 'Başlık...', style_class: 'udt-note-title-entry', can_focus: true, x_expand: false, y_expand: false});
        this._composeTitle.set_size(COMPOSE_BODY_W, 40);
        this._composeTitle.set_text(String(initialTitle || '').trim());
        try { this._composeTitle.clutter_text.connect('activate', () => this._focusComposeBody()); } catch (_error) {}
        body.add_child(this._composeTitle);

        body.add_child(this._createComposeToolbar());

        this._composeHolder = boxLayout({vertical: true, x_expand: false, y_expand: false});
        this._composeHolder.set_size(COMPOSE_BODY_W, COMPOSE_ENTRY_H);
        this._composeHolder.add_child(this._createComposeBodyEditor(String(initialBody || '')));
        body.add_child(this._composeHolder);

        const footer = boxLayout({vertical: false, style_class: 'udt-note-compose-footer', x_expand: false, y_expand: false});
        footer.set_width(COMPOSE_BODY_W);
        this._lineCounter = new St.Label({text: `0 / ${MAX_NOTE_LINES} satır`, style_class: 'udt-note-line-counter', x_expand: true});
        footer.add_child(this._lineCounter);
        const cancel = fixedButton('İptal', 'udt-detail-secondary-button', 62, 34);
        cancel.connect('clicked', () => this._showList());
        const save = fixedButton('Kaydet', 'udt-primary-button', 82, 34);
        save.connect('clicked', () => this._saveCompose());
        footer.add_child(cancel);
        footer.add_child(save);
        body.add_child(footer);
        this._content.add_child(body);
        try { this._composeTitle.grab_key_focus(); } catch (_error) {}
        this._updateLineCounter();
    }

    _createComposeBodyEditor(initialText = '') {
        this._composeBodyFrame = new St.Widget({
            style_class: 'udt-note-body-entry udt-note-body-frame',
            reactive: true, can_focus: true, x_expand: false, y_expand: false,
            layout_manager: new Clutter.FixedLayout(),
        });
        this._composeBodyFrame.set_size(COMPOSE_BODY_W, COMPOSE_ENTRY_H);
        // Clip the editable text to the frame so long content never paints over
        // the footer below it.
        this._composeBodyFrame.set_clip_to_allocation(true);

        this._composeBodyHint = new St.Label({text: `Not içeriği... (en fazla ${MAX_NOTE_LINES} satır)`, style_class: 'udt-note-body-placeholder', x_expand: false, y_expand: false});
        this._composeBodyHint.set_position(12, 14);
        this._composeBodyHint.set_width(COMPOSE_BODY_W - 24);
        this._composeBodyFrame.add_child(this._composeBodyHint);

        // Width is fixed; height is left to grow naturally so all lines lay out.
        // We then translate the actor vertically (scroll) to keep the cursor in view.
        this._composeBodyText = new Clutter.Text({text: String(initialText || ''), editable: true, selectable: true, reactive: true, activatable: false});
        this._composeBodyText.set_position(12, 12);
        this._composeBodyText.set_width(COMPOSE_BODY_W - 24);
        configureClutterTextArea(this._composeBodyText);
        this._composeBodyText.connect('text-changed', () => this._handleComposeTextChanged());
        this._composeBodyText.connect('cursor-changed', () => this._scrollComposeToCursor());
        this._composeBodyText.connect('key-press-event', (actor, event) => this._onComposeKeyPress(actor, event));
        this._composeBodyFrame.add_child(this._composeBodyText);

        this._composeBodyFrame.connect('button-press-event', (_actor, event) => {
            let button = 1;
            try { button = event.get_button(); } catch (_error) {}
            if (button === Clutter.BUTTON_SECONDARY) {
                let x = 0, y = 0;
                try { [x, y] = event.get_coords(); } catch (_error) {}
                this._showComposeContextMenu(x, y);
                return Clutter.EVENT_STOP;
            }
            this._closeComposeContextMenu();
            this._focusComposeBody();
            return Clutter.EVENT_STOP;
        });
        this._composeBodyFrame.connect('key-focus-in', () => { this._focusComposeBody(); return Clutter.EVENT_PROPAGATE; });
        this._composeBodyFrame.connect('scroll-event', (_actor, event) => this._handleComposeScroll(event));
        this._syncComposeBodyHint();
        return this._composeBodyFrame;
    }

    // ── Formatting toolbar ──
    _createComposeToolbar() {
        const bar = boxLayout({vertical: false, style_class: 'udt-note-toolbar', x_expand: false, y_expand: false});
        bar.set_width(COMPOSE_BODY_W);
        const toolBtn = (label, styleClass, width, fn) => {
            const btn = fixedButton(label, `udt-note-tool-button ${styleClass}`, width, 30);
            btn.connect('clicked', fn);
            return btn;
        };
        bar.add_child(toolBtn('B', 'udt-note-tool-bold', 32, () => this._wrapSelection('**', '**')));
        bar.add_child(toolBtn('•', '', 32, () => this._toggleListLine()));
        bar.add_child(toolBtn('<>', '', 38, () => this._makeCommandLine()));
        for (const color of NOTE_COLORS) {
            const swatch = fixedButton(' ', 'udt-note-color-swatch', 20, 26);
            try { swatch.set_style(`background-color: ${color.hex};`); } catch (_error) {}
            swatch.connect('clicked', () => this._applyColor(color.name));
            bar.add_child(swatch);
        }
        bar.add_child(new St.Widget({x_expand: true}));
        this._previewToggle = toolBtn('Önizle', 'udt-note-preview-toggle', 62, () => this._toggleComposePreview());
        bar.add_child(this._previewToggle);
        return bar;
    }

    // ── Selection helpers ──
    _composeSelectionBounds() {
        const text = this._getComposeBodyText();
        const len = text.length;
        let a = -1, b = -1;
        try { a = this._composeBodyText.get_cursor_position(); } catch (_error) {}
        try { b = this._composeBodyText.get_selection_bound(); } catch (_error) {}
        if (a < 0 || a > len) a = len;
        if (b < 0 || b > len) b = a;
        return {text, start: Math.min(a, b), end: Math.max(a, b)};
    }

    _setComposeText(next, caret) {
        try { this._composeBodyText.set_text(next); } catch (_error) {}
        if (typeof caret === 'number') {
            try { this._composeBodyText.set_cursor_position(Math.max(0, Math.min(caret, next.length))); } catch (_error) {}
        }
        this._focusComposeBody();
    }

    _wrapSelection(prefix, suffix) {
        if (this._composePreviewMode) return;
        const {text, start, end} = this._composeSelectionBounds();
        const sel = text.slice(start, end);
        const replacement = `${prefix}${sel}${suffix}`;
        const next = text.slice(0, start) + replacement + text.slice(end);
        const caret = sel.length ? start + replacement.length : start + prefix.length;
        this._setComposeText(next, caret);
    }

    _applyColor(name) {
        this._wrapSelection(`{${name}}`, '{/}');
    }

    _toggleListLine() {
        if (this._composePreviewMode) return;
        const {text, start} = this._composeSelectionBounds();
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        if (/^(\s*)(•|-|\*)\s+/.test(text.slice(lineStart))) return;
        const next = `${text.slice(0, lineStart)}• ${text.slice(lineStart)}`;
        this._setComposeText(next, start + 2);
    }

    _makeCommandLine() {
        if (this._composePreviewMode) return;
        const {text, start} = this._composeSelectionBounds();
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        let lineEnd = text.indexOf('\n', start);
        if (lineEnd === -1) lineEnd = text.length;
        const line = text.slice(lineStart, lineEnd).trim();
        if (!line) {
            const next = `${text.slice(0, lineStart)}< komut >${text.slice(lineEnd)}`;
            this._setComposeText(next, lineStart + 2);
            return;
        }
        if (isCommandLine(line)) return;
        const wrapped = `< ${line} >`;
        const next = text.slice(0, lineStart) + wrapped + text.slice(lineEnd);
        this._setComposeText(next, lineStart + wrapped.length);
    }

    // ── Smart typing ──
    _onComposeKeyPress(_actor, event) {
        let sym = 0;
        try { sym = event.get_key_symbol(); } catch (_error) { return Clutter.EVENT_PROPAGATE; }
        if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter || sym === Clutter.KEY_ISO_Enter)
            return this._handleComposeEnter();
        if (sym === Clutter.KEY_less) { this._autoPair('<', '>'); return Clutter.EVENT_STOP; }
        if (sym === Clutter.KEY_greater)
            return this._typeOver('>') ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
        if (sym === Clutter.KEY_grave || sym === Clutter.KEY_dead_grave) {
            if (this._typeOver('`')) return Clutter.EVENT_STOP;
            this._autoPair('`', '`');
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _autoPair(open, close) {
        const {text, start, end} = this._composeSelectionBounds();
        const sel = text.slice(start, end);
        const replacement = `${open}${sel}${close}`;
        const next = text.slice(0, start) + replacement + text.slice(end);
        this._setComposeText(next, start + open.length + sel.length);
    }

    _typeOver(ch) {
        const {text, start, end} = this._composeSelectionBounds();
        if (start === end && text[start] === ch) {
            this._setComposeText(text, start + 1);
            return true;
        }
        return false;
    }

    _handleComposeEnter() {
        const {text, start, end} = this._composeSelectionBounds();
        if (start !== end) return Clutter.EVENT_PROPAGATE;
        const pos = start;
        const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
        let lineEnd = text.indexOf('\n', pos);
        if (lineEnd === -1) lineEnd = text.length;
        const line = text.slice(lineStart, lineEnd);
        const marker = line.match(/^(\s*)(•|-|\*)\s+/);
        if (!marker) return Clutter.EVENT_PROPAGATE;
        const afterMarker = line.slice(marker[0].length);
        if (afterMarker.trim().length === 0) {
            // Empty bullet → leave the list: drop the marker, stay on the line.
            const next = text.slice(0, lineStart) + text.slice(lineStart + marker[0].length);
            this._setComposeText(next, lineStart);
            return Clutter.EVENT_STOP;
        }
        const insert = `\n${marker[1] || ''}• `;
        const next = text.slice(0, pos) + insert + text.slice(pos);
        this._setComposeText(next, pos + insert.length);
        return Clutter.EVENT_STOP;
    }

    // ── Edit / Preview toggle ──
    _toggleComposePreview() {
        this._composePreviewMode = !this._composePreviewMode;
        this._closeComposeContextMenu();
        if (this._composePreviewMode) {
            if (!this._composePreviewScroll) {
                const sb = createVerticalScrollBox({
                    scrollStyleClass: 'udt-panel-scroll udt-note-compose-preview-scroll',
                    contentStyleClass: 'udt-note-compose-preview-box',
                    width: COMPOSE_BODY_W, height: COMPOSE_ENTRY_H,
                });
                this._composePreviewScroll = sb.scroll;
                this._composePreviewContent = sb.content;
                this._composePreviewContent.set_width(DETAIL_TEXT_W);
            }
            this._renderComposePreviewInline();
            this._setHolderChild(this._composePreviewScroll);
            try { this._previewToggle.get_child().set_text('Düzenle'); } catch (_error) {}
        } else {
            this._setHolderChild(this._composeBodyFrame);
            try { this._previewToggle.get_child().set_text('Önizle'); } catch (_error) {}
            this._focusComposeBody();
        }
    }

    _setHolderChild(child) {
        if (!this._composeHolder) return;
        for (const existing of this._composeHolder.get_children())
            this._composeHolder.remove_child(existing);
        this._composeHolder.add_child(child);
    }

    _renderComposePreviewInline() {
        if (!this._composePreviewContent) return;
        clearActor(this._composePreviewContent);
        const text = normalizeListMarkers(this._getComposeBodyText()).trim();
        if (!text) {
            this._composePreviewContent.add_child(new St.Label({text: '(boş not)', style_class: 'udt-empty-label'}));
            return;
        }
        this._addFormattedDetailText(this._composePreviewContent, text);
    }

    // ── Right-click context menu ──
    _showComposeContextMenu(x, y) {
        if (this._composePreviewMode) return;
        this._closeComposeContextMenu();
        const menu = boxLayout({vertical: true, style_class: 'udt-note-context-menu', x_expand: false, y_expand: false});
        const item = (label, fn) => {
            const btn = fixedButton(label, 'udt-note-context-item', 160, 28);
            btn.connect('clicked', () => { this._closeComposeContextMenu(); fn(); });
            menu.add_child(btn);
        };
        item('Kalın', () => this._wrapSelection('**', '**'));
        item('Liste maddesi', () => this._toggleListLine());
        item('Komut yap', () => this._makeCommandLine());
        for (const color of NOTE_COLORS)
            item(`Renk: ${color.label}`, () => this._applyColor(color.name));

        Main.layoutManager.uiGroup.add_child(menu);
        menu.set_position(Math.round(x), Math.round(y));
        this._composeContextMenu = menu;

        this._composeMenuCaptureId = global.stage.connect('button-press-event', (_stage, event) => {
            let ex = -1, ey = -1;
            try { [ex, ey] = event.get_coords(); } catch (_error) {}
            const [mx, my] = menu.get_transformed_position();
            const w = menu.get_width(), h = menu.get_height();
            if (ex >= mx && ex <= mx + w && ey >= my && ey <= my + h)
                return Clutter.EVENT_PROPAGATE;
            this._closeComposeContextMenu();
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _closeComposeContextMenu() {
        if (this._composeMenuCaptureId) {
            try { global.stage.disconnect(this._composeMenuCaptureId); } catch (_error) {}
            this._composeMenuCaptureId = 0;
        }
        if (this._composeContextMenu) {
            try { this._composeContextMenu.destroy(); } catch (_error) {}
            this._composeContextMenu = null;
        }
    }

    _focusComposeBody() {
        if (!this._composeBodyText) return;
        try { this._composeBodyText.grab_key_focus(); } catch (_error) {}
        try { global.stage?.set_key_focus?.(this._composeBodyText); } catch (_error) {}
        this._scrollComposeToCursor();
    }

    _composeViewportHeight() { return COMPOSE_ENTRY_H - 24; }

    _composeContentHeight() {
        try {
            const [, natural] = this._composeBodyText.get_preferred_height(COMPOSE_BODY_W - 24);
            return Math.max(natural, this._composeViewportHeight());
        } catch (_error) { return this._composeViewportHeight(); }
    }

    _applyComposeScroll() {
        if (!this._composeBodyText) return;
        const maxOffset = Math.max(0, this._composeContentHeight() - this._composeViewportHeight());
        this._composeScrollOffset = Math.max(0, Math.min(this._composeScrollOffset, maxOffset));
        try { this._composeBodyText.set_position(12, 12 - Math.round(this._composeScrollOffset)); } catch (_error) {}
    }

    _scrollComposeToCursor() {
        if (!this._composeBodyText) return;
        const viewportH = this._composeViewportHeight();
        const text = this._getComposeBodyText();
        const total = Math.max(1, lineCount(text));
        const lineH = this._composeContentHeight() / total;
        let pos = -1;
        try { pos = this._composeBodyText.get_cursor_position(); } catch (_error) {}
        if (pos < 0 || pos > text.length) pos = text.length;
        const cursorLine = (text.slice(0, pos).match(/\n/g) || []).length;
        const cursorTop = cursorLine * lineH;
        const cursorBottom = cursorTop + lineH;
        let offset = this._composeScrollOffset;
        if (cursorBottom > offset + viewportH) offset = cursorBottom - viewportH;
        if (cursorTop < offset) offset = cursorTop;
        this._composeScrollOffset = offset;
        this._applyComposeScroll();
    }

    _handleComposeScroll(event) {
        let direction;
        try { direction = event.get_scroll_direction(); } catch (_error) { return Clutter.EVENT_PROPAGATE; }
        if (direction === Clutter.ScrollDirection.UP) this._composeScrollOffset -= 40;
        else if (direction === Clutter.ScrollDirection.DOWN) this._composeScrollOffset += 40;
        else return Clutter.EVENT_PROPAGATE;
        this._applyComposeScroll();
        return Clutter.EVENT_STOP;
    }

    _getComposeBodyText() {
        try { return this._composeBodyText?.get_text?.() ?? this._composeBodyText?.text ?? ''; }
        catch (_error) { return ''; }
    }

    _handleComposeTextChanged() {
        if (!this._normalizingComposeText) {
            const current = this._getComposeBodyText();
            const normalized = normalizeListMarkers(current);
            if (normalized !== current) {
                this._normalizingComposeText = true;
                try {
                    this._composeBodyText?.set_text?.(normalized);
                    this._composeBodyText?.set_cursor_position?.(normalized.length);
                } catch (_error) {}
                this._normalizingComposeText = false;
            }
        }
        this._syncComposeBodyHint();
        this._updateLineCounter();
        this._scrollComposeToCursor();
    }

    _syncComposeBodyHint() {
        if (!this._composeBodyHint) return;
        if (String(this._getComposeBodyText() || '').length === 0) this._composeBodyHint.show();
        else this._composeBodyHint.hide();
    }

    _composeHeader(title = 'Yeni Not') {
        const head = boxLayout({vertical: false, style_class: 'udt-note-detail-head', x_expand: false, y_expand: false});
        head.set_width(COMPOSE_W);
        const back = fixedButton('‹', 'udt-detail-back-button', 30, 30);
        back.connect('clicked', () => this._showList());
        head.add_child(back);
        head.add_child(iconBin('document-new-symbolic', 'udt-panel-header-icon', 'udt-panel-header-symbolic-icon', 16, 24, 24));
        const titleBox = boxLayout({vertical: true, x_expand: true, y_expand: false});
        titleBox.add_child(new St.Label({text: title, style_class: 'udt-edge-panel-title'}));
        titleBox.add_child(new St.Label({text: 'Başlık + uzun içerik', style_class: 'udt-edge-panel-subtitle'}));
        head.add_child(titleBox);
        const close = fixedButton('×', 'udt-panel-close-button', 30, 30);
        close.connect('clicked', () => this._closeCallback?.());
        head.add_child(close);
        return head;
    }

    _saveCompose() {
        const rawTitle = (this._composeTitle?.get_text?.() ?? '').trim();
        const body = normalizeListMarkers(this._getComposeBodyText());
        let title = rawTitle;
        if (!title) {
            // Fall back to the first non-empty content line so typed text is never lost.
            const firstLine = body.split('\n').map(line => line.trim()).find(line => line.length > 0) ?? '';
            title = firstLine.slice(0, 80);
        }
        if (!title) {
            this._showComposeError('Boş not kaydedilemez — başlık veya içerik gir.');
            return;
        }
        const editId = this._editingNoteId;
        if (editId)
            this._repository.update(editId, title, body);
        else
            this._repository.add(title, body);
        this._editingNoteId = null;
        this._selectedNoteId = editId; // edit → return to detail; new → list
        this.refresh();
    }

    _showComposeError(message) {
        if (!this._lineCounter) return;
        this._lineCounter.text = message;
        try { this._lineCounter.add_style_class_name('udt-note-line-counter-error'); } catch (_error) {}
    }

    _updateLineCounter() {
        if (!this._lineCounter) return;
        try { this._lineCounter.remove_style_class_name('udt-note-line-counter-error'); } catch (_error) {}
        this._lineCounter.text = `${lineCount(this._getComposeBodyText())} / ${MAX_NOTE_LINES} satır`;
    }

    _addFormattedDetailText(textBox, text) {
        for (const line of String(text ?? "").split("\n")) {
            if (isCommandLine(line)) {
                textBox.add_child(wrappedLabel(commandFromLine(line), "udt-note-command-block", DETAIL_TEXT_W));
            } else if (isListLine(line)) {
                textBox.add_child(this._markupLabel(line.replace(/^(\s*)[-*•]\s+/, "$1• "), "udt-note-list-line"));
            } else {
                textBox.add_child(this._markupLabel(line || " ", "udt-note-detail-text"));
            }
        }
    }

    // A wrapped label whose text is rendered through Pango markup so bold
    // (**…**) and colour ({renk}…{/}) markers display as styled text.
    _markupLabel(line, styleClass) {
        const label = wrappedLabel("", styleClass, DETAIL_TEXT_W);
        try {
            label.clutter_text.use_markup = true;
            label.clutter_text.set_markup(inlineMarkup(line));
        } catch (_error) {
            label.set_text(String(line ?? ""));
        }
        return label;
    }

    _showHelp() {
        this._setGeom(DETAIL_W, DETAIL_H);
        clearActor(this._content);

        const head = boxLayout({vertical: false, x_expand: false, y_expand: false, style_class: "udt-note-detail-head"});
        head.set_width(DETAIL_W);
        const back = fixedButton("‹", "udt-detail-back-button", 30, 30);
        back.connect("clicked", () => this._showList());
        head.add_child(back);
        head.add_child(iconBin("help-about-symbolic", "udt-panel-header-icon", "udt-panel-header-symbolic-icon", 16, 24, 24));
        const titleBox = boxLayout({vertical: true, x_expand: true, y_expand: false});
        titleBox.add_child(new St.Label({text: "Not Yardımı", style_class: "udt-edge-panel-title"}));
        titleBox.add_child(new St.Label({text: "Kullanılabilir yazım özellikleri", style_class: "udt-edge-panel-subtitle"}));
        head.add_child(titleBox);
        const close = fixedButton("×", "udt-panel-close-button", 30, 30);
        close.connect("clicked", () => this._closeCallback?.());
        head.add_child(close);
        this._content.add_child(head);

        const body = boxLayout({vertical: true, style_class: "udt-panel-body udt-note-detail-body", x_expand: false, y_expand: false});
        body.set_width(DETAIL_W);
        const dsb = createVerticalScrollBox({scrollStyleClass: "udt-panel-scroll udt-note-detail-scroll", contentStyleClass: "udt-note-detail-text-box", width: DETAIL_BODY_W, height: DETAIL_SCROLL_H});
        const textBox = dsb.content;
        textBox.set_width(DETAIL_TEXT_W);
        this._addFormattedDetailText(textBox, [
            "Notları biçimlendirmek için işaret yazabilir ya da üstteki araç çubuğunu / sağ tık menüsünü kullanabilirsin. Aşağıdaki örnekler nasıl göründüğünü gösterir.",
            "",
            "▍ KALIN YAZI",
            "Metni iki yıldız (* *) işaretiyle sar.",
            "Örnek sonuç:  **bu kısım kalın görünür**",
            "",
            "▍ RENKLİ YAZI",
            "Söz dizimi:  {renk}metin{/}",
            "Örnek sonuç:  {kırmızı}acil{/}",
            "Renkler: {kırmızı}kırmızı{/}, {turuncu}turuncu{/}, {sarı}sarı{/}, {yeşil}yeşil{/}, {mavi}mavi{/}, {mor}mor{/}.",
            "",
            "▍ LİSTE",
            "Satır başına * ya da - koy; otomatik • maddesine döner.",
            "* Madde sonunda Enter yeni madde açar.",
            "* Boş maddede Enter listeden çıkarır.",
            "",
            "▍ KOMUT",
            "Bir satırı < > ya da backtick (`) ile sar; kod bloğu olur:",
            "< sudo apt update >",
            "`df -h`",
            "",
            "▍ ARAÇ ÇUBUĞU (yazarken üstte)",
            "* B  →  seçili metni kalın yapar",
            "* •  →  bulunduğun satırı listeye çevirir",
            "* <>  →  bulunduğun satırı komuta çevirir",
            "* Renk kutucukları  →  seçili metni renklendirir",
            "* Önizle  →  biçimli halini gösterir (tekrar bas: Düzenle)",
            "",
            "▍ KISAYOLLAR",
            "* < yazınca kapanış > otomatik gelir (backtick de öyle).",
            "* Açtığın işaretin üzerine tekrar yazarsan üzerinden geçer.",
            "* Sağ tık: seçili metne hızlı biçim menüsü.",
            "",
            "İpucu: renk ve kalın yazarken ham işaret olarak görünür; Önizle'ye basınca veya notu kaydedip açınca {yeşil}biçimli{/} görünür.",
        ].join("\n"));
        body.add_child(dsb.scroll);
        this._content.add_child(body);
    }

    // ── Detail View ──
    _showDetail(note) {
        this._setGeom(DETAIL_W, DETAIL_H);
        clearActor(this._content);

        const head = boxLayout({vertical: false, x_expand: false, y_expand: false, style_class: 'udt-note-detail-head'});
        head.set_width(DETAIL_W);
        const back = fixedButton('‹', 'udt-detail-back-button', 30, 30);
        back.connect('clicked', () => { this._selectedNoteId = null; this.refresh(); });
        head.add_child(back);
        head.add_child(iconBin('text-x-generic-symbolic', 'udt-panel-header-icon', 'udt-panel-header-symbolic-icon', 16, 24, 24));
        const titleBox = boxLayout({vertical: true, x_expand: true, y_expand: false});
        titleBox.add_child(new St.Label({text: note.title || 'Not Detayı', style_class: 'udt-edge-panel-title'}));
        const lines = lineCount(note.body);
        const subtitle = formatDate(note.createdAt) + (lines > 0 ? ` · ${lines} satır` : '');
        titleBox.add_child(new St.Label({text: subtitle || 'Kayıtlı not', style_class: 'udt-edge-panel-subtitle'}));
        head.add_child(titleBox);
        const close = fixedButton('×', 'udt-panel-close-button', 30, 30);
        close.connect('clicked', () => this._closeCallback?.());
        head.add_child(close);
        this._content.add_child(head);

        const body = boxLayout({vertical: true, style_class: 'udt-panel-body udt-note-detail-body', x_expand: false, y_expand: false});
        body.set_width(DETAIL_W);
        const dsb = createVerticalScrollBox({scrollStyleClass: 'udt-panel-scroll udt-note-detail-scroll', contentStyleClass: 'udt-note-detail-text-box', width: DETAIL_BODY_W, height: DETAIL_SCROLL_H});
        const textBox = dsb.content;
        textBox.set_width(DETAIL_TEXT_W);

        const chunks = splitDetailText(note.body || '(boş not)');
        for (let i = 0; i < chunks.length; i++) {
            if (chunks.length > 1) {
                const marker = new St.Label({text: `${i + 1}/${chunks.length}`, style_class: 'udt-note-detail-block-marker', x_align: Clutter.ActorAlign.START});
                marker.set_width(DETAIL_TEXT_W);
                textBox.add_child(marker);
            }
            this._addFormattedDetailText(textBox, chunks[i]);
        }
        body.add_child(dsb.scroll);

        const actions = boxLayout({vertical: false, style_class: 'udt-note-detail-actions', x_expand: false, y_expand: false});
        actions.set_width(DETAIL_BODY_W);
        const editBtn = fixedButton('✎ Düzenle', 'udt-detail-secondary-button', 96, 30);
        editBtn.connect('clicked', () => this._showCompose(note.title, note.body, note.id));
        const toggleBtn = fixedButton(note.done ? '↺ Aç' : '✓ Tamamla', 'udt-detail-secondary-button', 100, 30);
        toggleBtn.connect('clicked', () => { this._repository.toggle(note.id); this.refresh(); });
        const removeBtn = fixedButton('✗ Sil', 'udt-detail-danger-button', 60, 30);
        removeBtn.connect('clicked', () => { this._repository.remove(note.id); this._selectedNoteId = null; this.refresh(); });
        actions.add_child(editBtn);
        actions.add_child(toggleBtn);
        actions.add_child(removeBtn);
        body.add_child(actions);
        this._content.add_child(body);
    }

    _addQuickTitle() {
        const title = this._entry.get_text();
        this._repository.add(title, '');
        this._entry.set_text('');
        this._selectedNoteId = null;
        this.refresh();
    }
}
