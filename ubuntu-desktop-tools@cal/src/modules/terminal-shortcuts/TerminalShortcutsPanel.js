import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {boxLayout} from '../../compat/UiCompat.js';
import {COMMAND_CATALOG} from './CommandCatalog.js';
import {autoCategoryForCommand} from './TerminalCommandStorage.js';
import {clearActor, createVerticalScrollBox} from '../../ui/ScrollableBox.js';
import {iconBin} from '../../ui/IconFactory.js';
import {panelHeader, fixedButton} from '../../ui/PanelWidgets.js';

const PANEL_WIDTH = 336, PANEL_HEIGHT = 560, PANEL_BODY_WIDTH = 316, SCROLL_HEIGHT = 374;
const CMD_ROW_W = 316, CMD_ROW_H = 50, CMD_INNER_W = 296, CMD_ICON_W = 28;
const CUSTOM_RUN_W = 256, CUSTOM_TEXT_W = 184, CUSTOM_DELETE_W = 34, MANAGE_TEXT_W = 190, MANAGE_DELETE_W = 44;

function normalize(text) { return String(text ?? '').toLocaleLowerCase('tr-TR'); }

function commandIconName(item) {
    const cat = normalize(item?.category), title = normalize(item?.title), cmd = normalize(item?.command);
    if (cat.includes('gnome')) return 'preferences-desktop-symbolic';
    if (cat.includes('ağ') || title.includes('ağ') || cmd.includes('ip ')) return 'network-workgroup-symbolic';
    if (title.includes('disk') || cmd.includes('df')) return 'drive-harddisk-symbolic';
    if (title.includes('servis') || cmd.includes('systemctl')) return 'emblem-system-symbolic';
    if (title.includes('paket') || cmd.includes('apt')) return 'system-software-install-symbolic';
    return 'utilities-terminal-symbolic';
}

function fixedLabel(text, styleClass, width = -1, height = -1) {
    const label = new St.Label({text, style_class: styleClass, x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.CENTER, x_expand: false, y_expand: false});
    if (width > -1) label.set_width(width);
    if (height > -1) label.set_height(height);
    try { label.clutter_text.ellipsize = Pango.EllipsizeMode.END; } catch (_error) {}
    return label;
}

export class TerminalShortcutsPanel {
    constructor({settings, policy, launcher, repository, logger}) {
        this._settings = settings;
        this._policy = policy;
        this._launcher = launcher;
        this._repository = repository;
        this._logger = logger;
        this._query = '';
        this._closeCallback = null;
        this.actor = this._build();
    }

    setCloseCallback(cb) { this._closeCallback = cb; }

    _build() {
        this._root = boxLayout({vertical: true, style_class: 'udt-edge-panel udt-terminal-panel', x_expand: false, y_expand: false});
        this._root._udtPreferredWidth = PANEL_WIDTH;
        this._root._udtPreferredHeight = PANEL_HEIGHT;
        this._root.set_size(PANEL_WIDTH, PANEL_HEIGHT);
        this._showList();
        return this._root;
    }

    _showList() {
        clearActor(this._root);
        this._root.add_child(panelHeader({
            title: 'Terminal', subtitle: 'Sık kullanılan güvenli komutlar', width: PANEL_WIDTH,
            iconName: 'utilities-terminal-symbolic', onClose: () => this._closeCallback?.(),
        }));

        const body = boxLayout({vertical: true, style_class: 'udt-panel-body', x_expand: false, y_expand: false});
        body.set_width(PANEL_WIDTH);

        this._search = new St.Entry({hint_text: 'Komut ara...', style_class: 'udt-search-entry', x_expand: false, y_expand: false, can_focus: true});
        try {
            this._search.clutter_text.connect('text-changed', () => {
                this._query = normalize(this._search.get_text());
                this._renderCommands();
            });
        } catch (_error) {}
        this._search.set_size(PANEL_BODY_WIDTH, 38);
        body.add_child(this._search);

        const addBtn = fixedButton('Komutlar', 'udt-primary-button udt-terminal-manage-button', 104, 32);
        addBtn.connect('clicked', () => this._showManage());
        body.add_child(addBtn);

        const sb = createVerticalScrollBox({scrollStyleClass: 'udt-panel-scroll udt-terminal-scroll', contentStyleClass: 'udt-command-list', width: PANEL_BODY_WIDTH, height: SCROLL_HEIGHT});
        this._scroll = sb.scroll;
        this._list = sb.content;
        body.add_child(this._scroll);
        this._root.add_child(body);
        this._renderCommands();
    }

    _commands() {
        const hidden = new Set(this._repository.hiddenIds());
        const catalog = COMMAND_CATALOG.filter(item => !hidden.has(item.id));
        return [...catalog, ...this._repository.list()];
    }

    _renderCommands() {
        clearActor(this._list);
        const grouped = new Map();
        for (const item of this._commands()) {
            const decision = this._policy.listDecision(item);
            if (!decision.visible) continue;
            const haystack = normalize(`${item.category} ${item.title} ${item.command} ${item.description}`);
            if (this._query && !haystack.includes(this._query)) continue;
            const category = item.category || 'Özel';
            if (!grouped.has(category)) grouped.set(category, []);
            grouped.get(category).push({...item, _decision: decision});
        }
        if (grouped.size === 0) {
            this._list.add_child(new St.Label({text: 'Komut bulunamadı.', style_class: 'udt-empty-label'}));
            return;
        }
        for (const [category, items] of grouped.entries()) {
            const section = boxLayout({vertical: true, style_class: 'udt-command-section', x_expand: false, y_expand: false});
            section.set_width(PANEL_BODY_WIDTH);
            const titleRow = boxLayout({vertical: false, style_class: 'udt-section-title-row', x_expand: false, y_expand: false});
            titleRow.set_width(PANEL_BODY_WIDTH);
            titleRow.add_child(iconBin(category.toLocaleLowerCase('tr-TR').includes('gnome') ? 'preferences-desktop-symbolic' : 'emblem-system-symbolic', 'udt-section-icon-bin', 'udt-section-symbolic-icon', 12, 16, 16));
            const title = fixedLabel(category.toLocaleUpperCase('tr-TR'), 'udt-section-title', 270, 18);
            try { title.clutter_text.ellipsize = Pango.EllipsizeMode.NONE; } catch (_error) {}
            titleRow.add_child(title);
            section.add_child(titleRow);
            for (const item of items) section.add_child(this._row(item));
            this._list.add_child(section);
        }
    }

    // Every list row pairs a run button with a trailing × button. For custom
    // commands the × deletes permanently; for built-in catalog commands it hides
    // the entry from the list (restorable from the manage screen).
    _row(item) {
        const disabled = item._decision?.disabled;
        const isCustom = !!item.custom;
        const rowClass = disabled
            ? 'udt-command-row udt-command-row-disabled'
            : (isCustom ? 'udt-command-row udt-command-custom-row' : 'udt-command-row');
        const row = boxLayout({vertical: false, style_class: rowClass, x_expand: false, y_expand: false});
        row.set_size(CMD_ROW_W, CMD_ROW_H);

        const inner = boxLayout({vertical: false, x_expand: false, y_expand: false, style_class: 'udt-command-custom-row-inner'});
        inner.set_width(CMD_INNER_W);

        const run = new St.Button({style_class: 'udt-command-custom-run', reactive: !disabled, can_focus: !disabled, track_hover: !disabled, x_expand: false, y_expand: false});
        run.set_size(CUSTOM_RUN_W, 36);
        const runRow = boxLayout({vertical: false, x_expand: false, y_expand: false, style_class: 'udt-command-custom-run-inner'});
        runRow.set_width(CUSTOM_RUN_W);
        runRow.add_child(iconBin(commandIconName(item), 'udt-command-icon-bin', 'udt-command-symbolic-icon', 14, CMD_ICON_W, CMD_ICON_W));
        const textBox = boxLayout({vertical: true, x_expand: false, y_expand: false, style_class: 'udt-command-text-box udt-command-custom-text-box'});
        textBox.set_width(CUSTOM_TEXT_W);
        textBox.add_child(fixedLabel(isCustom ? `${item.title} *` : item.title, 'udt-command-title', CUSTOM_TEXT_W, 17));
        const command = fixedLabel(disabled ? (item._decision?.reason ?? item.command) : item.command, 'udt-command-code', CUSTOM_TEXT_W, 17);
        try { command.clutter_text.line_wrap = false; command.clutter_text.ellipsize = Pango.EllipsizeMode.END; } catch (_error) {}
        textBox.add_child(command);
        const action = new St.Label({text: disabled ? '!' : '›', style_class: 'udt-command-action', y_align: Clutter.ActorAlign.CENTER, x_align: Clutter.ActorAlign.CENTER, x_expand: false, y_expand: false});
        action.set_size(28, 28);
        runRow.add_child(textBox);
        runRow.add_child(action);
        run.set_child(runRow);
        if (!disabled)
            run.connect('clicked', () => this._handleCommand(item));
        inner.add_child(run);

        const remove = fixedButton('×', 'udt-command-delete-button', CUSTOM_DELETE_W, 34);
        if (isCustom) {
            remove.connect('clicked', () => {
                this._repository.remove(item.id);
                this._notifyOsd('Özel komut silindi', 'edit-delete-symbolic');
                this._showList();
            });
        } else {
            remove.connect('clicked', () => {
                this._repository.hide(item.id);
                this._notifyOsd('Komut listeden gizlendi', 'edit-clear-symbolic');
                this._showList();
            });
        }
        inner.add_child(remove);

        row.add_child(inner);
        return row;
    }

    _showManage() {
        clearActor(this._root);
        this._root.add_child(panelHeader({
            title: 'Komutlar', subtitle: 'Komut ekle, sil ve gizlenenleri geri al', width: PANEL_WIDTH,
            iconName: 'utilities-terminal-symbolic', onClose: () => this._showList(),
        }));

        const body = boxLayout({vertical: true, style_class: 'udt-panel-body', x_expand: false, y_expand: false});
        body.set_width(PANEL_WIDTH);

        this._titleEntry = new St.Entry({hint_text: 'Başlık', style_class: 'udt-search-entry', can_focus: true});
        this._titleEntry.set_size(PANEL_BODY_WIDTH, 38);
        body.add_child(this._titleEntry);

        this._commandEntry = new St.Entry({hint_text: 'Komut', style_class: 'udt-search-entry', can_focus: true});
        this._commandEntry.set_size(PANEL_BODY_WIDTH, 38);
        body.add_child(this._commandEntry);

        this._categoryPreview = fixedLabel('Kategori: Özel', 'udt-command-code', PANEL_BODY_WIDTH, 20);
        body.add_child(this._categoryPreview);

        const syncPreview = () => {
            const category = autoCategoryForCommand(this._commandEntry.get_text?.() ?? '', this._titleEntry.get_text?.() ?? '');
            this._categoryPreview.text = `Kategori: ${category}`;
        };
        try { this._titleEntry.clutter_text.connect('text-changed', syncPreview); } catch (_error) {}
        try { this._commandEntry.clutter_text.connect('text-changed', syncPreview); } catch (_error) {}

        const actionRow = boxLayout({vertical: false, style_class: 'udt-note-detail-actions', x_expand: false, y_expand: false});
        actionRow.set_width(PANEL_BODY_WIDTH);
        const back = fixedButton('Geri', 'udt-detail-secondary-button', 76, 30);
        back.connect('clicked', () => this._showList());
        const save = fixedButton('Kaydet', 'udt-primary-button', 86, 30);
        save.connect('clicked', () => this._saveCustomCommand());
        actionRow.add_child(back);
        actionRow.add_child(save);
        body.add_child(actionRow);

        body.add_child(new St.Label({text: 'KOMUTLARIM', style_class: 'udt-section-title'}));
        const sb = createVerticalScrollBox({scrollStyleClass: 'udt-panel-scroll udt-terminal-custom-scroll', contentStyleClass: 'udt-command-list', width: PANEL_BODY_WIDTH, height: 226});
        this._customList = sb.content;
        body.add_child(sb.scroll);
        this._root.add_child(body);
        this._renderManageList();
    }

    _renderManageList() {
        clearActor(this._customList);
        const customs = this._repository.list();
        const hiddenIds = this._repository.hiddenIds();
        const hiddenItems = COMMAND_CATALOG.filter(item => hiddenIds.includes(item.id));

        if (customs.length === 0 && hiddenItems.length === 0) {
            this._customList.add_child(new St.Label({text: 'Henüz özel komut yok, gizlenen komut yok.', style_class: 'udt-empty-label'}));
            return;
        }

        for (const item of customs)
            this._customList.add_child(this._manageRow(item, 'custom'));

        if (hiddenItems.length > 0) {
            this._customList.add_child(new St.Label({text: 'GİZLENEN KOMUTLAR', style_class: 'udt-section-title'}));
            for (const item of hiddenItems)
                this._customList.add_child(this._manageRow(item, 'hidden'));
        }
    }

    _manageRow(item, mode) {
        const row = boxLayout({vertical: false, style_class: 'udt-command-row', x_expand: false, y_expand: false});
        row.set_size(CMD_ROW_W, CMD_ROW_H);
        row.add_child(iconBin(commandIconName(item), 'udt-command-icon-bin', 'udt-command-symbolic-icon', 14, CMD_ICON_W, CMD_ICON_W));
        const textBox = boxLayout({vertical: true, style_class: 'udt-command-text-box udt-command-manage-text-box', x_expand: false, y_expand: false});
        textBox.set_width(MANAGE_TEXT_W);
        textBox.add_child(fixedLabel(item.title, 'udt-command-title', MANAGE_TEXT_W, 17));
        textBox.add_child(fixedLabel(item.command, 'udt-command-code', MANAGE_TEXT_W, 17));
        row.add_child(textBox);
        if (mode === 'hidden') {
            const restore = fixedButton('Geri al', 'udt-detail-secondary-button', 64, 30);
            restore.connect('clicked', () => { this._repository.restore(item.id); this._renderManageList(); });
            row.add_child(restore);
        } else {
            const remove = fixedButton('Sil', 'udt-command-delete-button udt-command-delete-button-wide', MANAGE_DELETE_W, 30);
            remove.connect('clicked', () => { this._repository.remove(item.id); this._renderManageList(); });
            row.add_child(remove);
        }
        return row;
    }

    _saveCustomCommand() {
        const title = this._titleEntry?.get_text?.() ?? '';
        const command = this._commandEntry?.get_text?.() ?? '';
        const preview = {title, command, custom: true, risk: 'safe'};
        const decision = this._policy.evaluate(command, preview);
        if (!decision.allowed) {
            this._categoryPreview.text = decision.reason;
            this._logger?.warn?.(decision.reason);
            return;
        }
        const saved = this._repository.add(title, command);
        if (!saved) {
            this._categoryPreview.text = 'Başlık ve komut zorunlu.';
            return;
        }
        this._titleEntry.set_text('');
        this._commandEntry.set_text('');
        this._categoryPreview.text = `Kategori: ${saved.category}`;
        this._notifyOsd('Özel komut eklendi', 'list-add-symbolic');
        this._renderManageList();
    }

    _handleCommand(item) {
        const decision = this._policy.evaluate(item.command, item);
        if (!decision.allowed) {
            this._logger.warn(decision.reason);
            this._notifyOsd(decision.reason, 'dialog-warning-symbolic');
            return;
        }
        // A command opens a terminal when the policy demands it (sudo) or when the
        // catalog explicitly marks it as terminal-bound (interactive / streaming).
        // Otherwise it follows the user's global default action.
        const configuredAction = this._settings.string('terminal-default-action', 'copy');
        const wantsTerminal = decision.preferredAction === 'terminal' || item.action === 'terminal';
        const action = wantsTerminal ? 'terminal' : configuredAction;
        if (action === 'terminal') {
            if (this._launcher.openInTerminal(item.command)) {
                this._notifyOsd('Terminalde açılıyor', 'utilities-terminal-symbolic');
            } else {
                this._launcher.copy(item.command);
                this._notifyOsd('Terminal bulunamadı — komut panoya kopyalandı', 'dialog-warning-symbolic');
            }
        } else {
            this._launcher.copy(item.command);
            this._notifyOsd('Komut panoya kopyalandı', 'edit-copy-symbolic');
        }
    }

    _notifyOsd(label, iconName) {
        try {
            const icon = new Gio.ThemedIcon({name: iconName});
            Main.osdWindowManager.show(-1, icon, label, null, null);
        } catch (error) {
            this._logger?.warn?.(`OSD bildirimi gösterilemedi: ${error}`);
        }
    }
}
