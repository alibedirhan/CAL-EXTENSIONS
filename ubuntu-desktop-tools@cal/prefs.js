import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

/* ── helpers to read distro info in prefs context ── */
function readOsRelease() {
    try {
        const [ok, bytes] = GLib.file_get_contents('/etc/os-release');
        if (!ok) return {};
        const text = new TextDecoder().decode(bytes);
        const map = {};
        for (const line of text.split('\n')) {
            const eq = line.indexOf('=');
            if (eq < 0) continue;
            map[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/"/g, '');
        }
        return map;
    } catch (_e) { return {}; }
}

function detectTerminals() {
    const bins = ['gnome-terminal', 'ptyxis', 'kgx', 'konsole', 'xfce4-terminal', 'tilix', 'alacritty', 'kitty'];
    return bins.filter(b => GLib.find_program_in_path(b) !== null);
}

function detectPkgManager() {
    for (const [bin, label] of [['apt', 'APT'], ['dnf', 'DNF'], ['pacman', 'Pacman'], ['zypper', 'Zypper']]) {
        if (GLib.find_program_in_path(bin)) return label;
    }
    return 'Bilinmiyor';
}

export default class UbuntuDesktopToolsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings;
        window.set_title(_('CAL Extensions'));
        window.set_default_size(780, 680);

        window.add(this._modulesPage(settings));
        window.add(this._monitorPage(settings));
        window.add(this._terminalPage(settings));
        window.add(this._notesPage(settings));
        window.add(this._weatherPage(settings));
        window.add(this._aboutPage(settings));
    }

    /* ═══════════════════════════════════════════
     *  1. MODÜLLER VE GENEL AYARLAR
     * ═══════════════════════════════════════════ */
    _modulesPage(s) {
        const page = new Adw.PreferencesPage({title: _('Modüller'), icon_name: 'preferences-system-symbolic'});

        // ── Module toggles ──
        const mods = new Adw.PreferencesGroup({
            title: _('Aktif Modüller'),
            description: _('Her modülü bağımsız olarak açıp kapatabilirsin. Kapalı modüller sistem kaynağı kullanmaz.'),
        });
        page.add(mods);
        mods.add(this._switchRow(s, 'show-system-monitor', '🖥  System Monitor', 'Üst barda CPU, RAM, Disk ve ağ metrikleri gösterir.'));
        mods.add(this._switchRow(s, 'show-terminal-shortcuts', '⌨  Terminal Kısayolları', 'Sağ kenarda güvenli Linux komut paneli.'));
        mods.add(this._switchRow(s, 'show-quick-notes', '📝  Hızlı Not', 'Sağ kenarda hızlı not alma paneli.'));
        mods.add(this._switchRow(s, 'show-weather', '🌤  Hava Durumu', 'Sağ kenarda anlık hava durumu ve tahmin.'));

        // ── Module order ──
        page.add(this._reorderGroup(s, 'module-order', [
            ['terminal-shortcuts', '⌨  Terminal'],
            ['quick-notes', '📝  Notlar'],
            ['system-info', '🖥  Sistem Bilgisi'],
            ['weather', '🌤  Hava Durumu'],
        ]));

        // ── Edge behavior ──
        const edge = new Adw.PreferencesGroup({
            title: _('Sağ Kenar Paneli'),
            description: _('Terminal, Not, Sistem Bilgisi ve Hava Durumu panellerinin ortak davranış ayarları.'),
        });
        page.add(edge);
        edge.add(this._spinRow(s, 'edge-offset-y', 'Dikey konum (px)', 'Panelin ekranın üstünden uzaklığı. Sürükleyerek de ayarlanabilir.', 48, 2000, 10));
        edge.add(this._switchRow(s, 'hide-edge-in-fullscreen', 'Tam ekranda gizle', 'Video izlerken veya oyun oynarken panel otomatik gizlenir.'));
        edge.add(this._comboRow(s, 'rail-hide-mode', 'Kenar çubuğu otomatik gizleme', 'Boştayken kenar çubuğunun davranışı. Fare yaklaşınca veya panel açıkken her zaman geri gelir.', [
            ['off', 'Kapalı (hep görünür)'],
            ['dim', 'Soluklaştır'],
            ['slide', 'Kenara kaydır'],
        ]));
        edge.add(this._spinRow(s, 'rail-idle-opacity', 'Soluk opaklık (%)', 'Yalnızca "Soluklaştır" modunda: boştayken kenar çubuğunun saydamlığı.', 10, 100, 5));
        edge.add(this._switchRow(s, 'low-power-mode', 'Düşük güç modu', 'Yenileme aralıklarını artırarak pil tüketimini azaltır.'));

        return page;
    }

    /* ═══════════════════════════════════════════
     *  2. SYSTEM MONITOR
     * ═══════════════════════════════════════════ */
    _monitorPage(s) {
        const page = new Adw.PreferencesPage({title: _('Monitor'), icon_name: 'utilities-system-monitor-symbolic'});

        const display = new Adw.PreferencesGroup({
            title: _('Görünüm'),
            description: _('Üst bardaki sistem monitörünün görünümünü özelleştir.'),
        });
        page.add(display);
        display.add(this._switchRow(s, 'monitor-compact-mode', 'Kompakt mod', 'CPU/RAM etiketlerini kaldırarak daha dar gösterim.'));
        display.add(this._comboRow(s, 'monitor-position', 'Panel konumu', 'Gösterge üst barda nereye yerleşsin.', [
            ['auto', 'Otomatik (saat yanı → sağ üst)'],
            ['clock-adjacent', 'Saatin sağında'],
            ['right', 'Sağ üst köşe'],
        ]));

        const perf = new Adw.PreferencesGroup({
            title: _('Performans'),
            description: _('Yenileme sıklığını düşürmek CPU ve pil tasarrufu sağlar.'),
        });
        page.add(perf);
        perf.add(this._spinRow(s, 'monitor-refresh-interval', 'Yenileme aralığı (sn)', 'Sistem metriklerinin kaç saniyede bir okunacağı.', 1, 15, 1));

        return page;
    }

    /* ═══════════════════════════════════════════
     *  3. TERMINAL KISAYOLLARI
     * ═══════════════════════════════════════════ */
    _terminalPage(s) {
        const page = new Adw.PreferencesPage({title: _('Terminal'), icon_name: 'utilities-terminal-symbolic'});

        const behavior = new Adw.PreferencesGroup({
            title: _('Komut Davranışı'),
            description: _('Komut kartına tıklandığında ne olacağını ve güvenlik politikasını belirle.'),
        });
        page.add(behavior);
        behavior.add(this._comboRow(s, 'terminal-default-action', 'Varsayılan aksiyon', 'Güvenli komutlara tıklanınca yapılacak işlem.', [
            ['copy', 'Panoya kopyala'],
            ['terminal', 'Terminalde çalıştır'],
        ]));
        behavior.add(this._comboRow(s, 'terminal-command-policy', 'Komut görünürlüğü', 'Riskli komutların panelde nasıl ele alınacağı.', [
            ['safe-only', 'Sadece güvenli komutlar'],
            ['show-risky-disabled', 'Riskliyi pasif göster'],
        ]));

        // Terminal emulator selection
        const terminals = detectTerminals();
        const termOptions = [['auto', `Otomatik (${terminals[0] ?? 'gnome-terminal'})`]];
        for (const t of terminals) termOptions.push([t, t]);

        const emulator = new Adw.PreferencesGroup({
            title: _('Terminal Emülatörü'),
            description: _(`Sisteminde ${terminals.length} terminal bulundu. Komutlar tercih ettiğin terminalde açılır.`),
        });
        page.add(emulator);
        emulator.add(this._comboRow(s, 'preferred-terminal', 'Tercih edilen terminal', 'Komut çalıştırmak için kullanılacak terminal uygulaması.', termOptions));

        return page;
    }

    /* ═══════════════════════════════════════════
     *  4. HIZLI NOT
     * ═══════════════════════════════════════════ */
    _notesPage(s) {
        const page = new Adw.PreferencesPage({title: _('Notlar'), icon_name: 'accessories-text-editor-symbolic'});

        const storage = new Adw.PreferencesGroup({
            title: _('Depolama'),
            description: _('Notlar teknik uyumluluk için ~/.local/share/ubuntu-desktop-tools/notes.json dosyasında saklanır. Buluta gönderilmez.'),
        });
        page.add(storage);
        storage.add(this._spinRow(s, 'notes-max-count', 'Maksimum not sayısı', 'Bu sayıya ulaşınca en eski notlar silinir.', 5, 200, 5));
        storage.add(this._switchRow(s, 'notes-hide-completed', 'Tamamlananları gizle', 'Tamamlanan notları listeden saklar ama silmez.'));

        return page;
    }

    /* ═══════════════════════════════════════════
     *  5. HAVA DURUMU
     * ═══════════════════════════════════════════ */
    _weatherPage(s) {
        const page = new Adw.PreferencesPage({title: _('Hava Durumu'), icon_name: 'weather-few-clouds-symbolic'});

        const location = new Adw.PreferencesGroup({
            title: _('Konum'),
            description: _('Hava verisi wttr.in API\'sinden alınır. Kayıt veya API anahtarı gerekmez. Paneldeki arama kutusundan da değiştirebilirsin.\nÖrnek: Izmir, Ankara, Istanbul, London, Berlin, Tokyo'),
        });
        page.add(location);
        location.add(this._entryRow(s, 'weather-city', 'Şehir'));

        const refresh = new Adw.PreferencesGroup({
            title: _('Yenileme'),
        });
        page.add(refresh);
        refresh.add(this._spinRow(s, 'weather-refresh-interval', 'Yenileme aralığı (dk)', 'Hava durumu verisinin kaç dakikada bir güncelleneceği.', 5, 120, 5));

        return page;
    }

    /* ═══════════════════════════════════════════
     *  6. HAKKINDA & SİSTEM BİLGİSİ
     * ═══════════════════════════════════════════ */
    _aboutPage(s) {
        const page = new Adw.PreferencesPage({title: _('Hakkında'), icon_name: 'help-about-symbolic'});

        const about = new Adw.PreferencesGroup({
            title: _('CAL Extensions'),
            description: _('Modüler GNOME Shell masaüstü araç seti.\ngithub.com/alibedirhan/CAL-EXTENSIONS'),
        });
        page.add(about);
        about.add(this._infoRow('Sürüm', 'v0.2.4'));
        about.add(this._infoRow('Lisans', 'GPL-3.0'));
        about.add(this._infoRow('GNOME Desteği', '46, 47, 48'));

        // System info
        const osInfo = readOsRelease();
        const sys = new Adw.PreferencesGroup({
            title: _('Sistem Bilgisi'),
            description: _('Eklentinin çalıştığı ortam hakkında bilgiler.'),
        });
        page.add(sys);
        sys.add(this._infoRow('Dağıtım', osInfo.PRETTY_NAME ?? 'Linux'));
        sys.add(this._infoRow('Paket yöneticisi', detectPkgManager()));
        sys.add(this._infoRow('Terminaller', detectTerminals().join(', ') || 'Bulunamadı'));
        sys.add(this._infoRow('Oturum tipi', GLib.getenv('XDG_SESSION_TYPE') ?? 'Bilinmiyor'));
        sys.add(this._infoRow('Masaüstü', GLib.getenv('XDG_CURRENT_DESKTOP') ?? 'Bilinmiyor'));

        // Reset
        const actions = new Adw.PreferencesGroup({title: _('Bakım')});
        page.add(actions);
        const resetRow = new Adw.ActionRow({
            title: _('Tüm ayarları sıfırla'),
            subtitle: _('Tüm eklenti ayarlarını varsayılan değerlerine döndürür.'),
        });
        const resetBtn = new Gtk.Button({label: 'Sıfırla', valign: Gtk.Align.CENTER, css_classes: ['destructive-action']});
        resetBtn.connect('clicked', () => {
            const schema = s.list_keys();
            for (const key of schema) s.reset(key);
        });
        resetRow.add_suffix(resetBtn);
        actions.add(resetRow);

        return page;
    }

    /* ═══════════════════════════════════════════
     *  Widget factories
     * ═══════════════════════════════════════════ */
    _switchRow(settings, key, title, subtitle) {
        const row = new Adw.SwitchRow({title: _(title), subtitle: _(subtitle)});
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    _spinRow(settings, key, title, subtitle, lower, upper, step) {
        const adj = new Gtk.Adjustment({lower, upper, step_increment: step, page_increment: step * 5, value: settings.get_int(key)});
        const row = new Adw.SpinRow({title: _(title), subtitle: _(subtitle), adjustment: adj});
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    _comboRow(settings, key, title, subtitle, options) {
        const model = new Gtk.StringList();
        for (const [, label] of options) model.append(_(label));
        const row = new Adw.ComboRow({title: _(title), subtitle: _(subtitle), model});
        const current = settings.get_string(key);
        row.set_selected(Math.max(0, options.findIndex(([v]) => v === current)));
        row.connect('notify::selected', () => settings.set_string(key, options[row.get_selected()]?.[0] ?? options[0][0]));
        return row;
    }

    _reorderGroup(settings, key, modules) {
        const group = new Adw.PreferencesGroup({
            title: _('Modül sırası'),
            description: _('Kenar çubuğundaki panellerin sırası. Yukarı/aşağı oklarıyla taşı.'),
        });
        const labelFor = new Map(modules);
        const knownIds = modules.map(([id]) => id);
        group._rows = [];

        const render = () => {
            for (const row of group._rows) group.remove(row);
            group._rows = [];

            // Sanitize: keep known ids in saved order, append any missing.
            let order = settings.get_strv(key).filter(id => knownIds.includes(id));
            for (const id of knownIds) if (!order.includes(id)) order.push(id);

            order.forEach((id, idx) => {
                const row = new Adw.ActionRow({title: _(labelFor.get(id) ?? id)});
                const up = new Gtk.Button({icon_name: 'go-up-symbolic', valign: Gtk.Align.CENTER, sensitive: idx > 0});
                up.add_css_class('flat');
                up.connect('clicked', () => {
                    const o = [...order];
                    [o[idx - 1], o[idx]] = [o[idx], o[idx - 1]];
                    settings.set_strv(key, o);
                    render();
                });
                const down = new Gtk.Button({icon_name: 'go-down-symbolic', valign: Gtk.Align.CENTER, sensitive: idx < order.length - 1});
                down.add_css_class('flat');
                down.connect('clicked', () => {
                    const o = [...order];
                    [o[idx + 1], o[idx]] = [o[idx], o[idx + 1]];
                    settings.set_strv(key, o);
                    render();
                });
                row.add_suffix(up);
                row.add_suffix(down);
                group.add(row);
                group._rows.push(row);
            });
        };

        render();
        return group;
    }

    _entryRow(settings, key, title) {
        const row = new Adw.EntryRow({title: _(title), show_apply_button: true});
        row.set_text(settings.get_string(key));
        row.connect('apply', () => settings.set_string(key, row.get_text()));
        settings.connect(`changed::${key}`, () => {
            const v = settings.get_string(key);
            if (row.get_text() !== v) row.set_text(v);
        });
        return row;
    }

    _infoRow(title, value) {
        const row = new Adw.ActionRow({title: _(title), subtitle: value});
        row.set_activatable(false);
        return row;
    }
}
