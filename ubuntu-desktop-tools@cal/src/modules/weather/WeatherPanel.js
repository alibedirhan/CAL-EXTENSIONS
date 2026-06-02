import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import {boxLayout} from '../../compat/UiCompat.js';
import {iconBin} from '../../ui/IconFactory.js';
import {panelHeader, fixedButton} from '../../ui/PanelWidgets.js';
import {clearActor, createVerticalScrollBox} from '../../ui/ScrollableBox.js';

const PANEL_W = 340, PANEL_H = 520, BODY_W = 320, INNER_W = 300;

const WEATHER_ICONS = {
    '113': 'weather-clear-symbolic', '116': 'weather-few-clouds-symbolic',
    '119': 'weather-overcast-symbolic', '122': 'weather-overcast-symbolic',
    '143': 'weather-fog-symbolic', '176': 'weather-showers-scattered-symbolic',
    '179': 'weather-snow-symbolic', '182': 'weather-snow-symbolic',
    '200': 'weather-storm-symbolic', '227': 'weather-snow-symbolic',
    '248': 'weather-fog-symbolic', '260': 'weather-fog-symbolic',
    '263': 'weather-showers-scattered-symbolic', '266': 'weather-showers-scattered-symbolic',
    '293': 'weather-showers-scattered-symbolic', '296': 'weather-showers-symbolic',
    '299': 'weather-showers-symbolic', '302': 'weather-showers-symbolic',
    '305': 'weather-showers-symbolic', '308': 'weather-showers-symbolic',
    '311': 'weather-snow-symbolic', '323': 'weather-snow-symbolic',
    '332': 'weather-snow-symbolic', '338': 'weather-snow-symbolic',
    '353': 'weather-showers-scattered-symbolic', '356': 'weather-showers-symbolic',
    '386': 'weather-storm-symbolic', '389': 'weather-storm-symbolic',
    '395': 'weather-snow-symbolic',
};

function wIcon(code) { return WEATHER_ICONS[String(code)] ?? 'weather-few-clouds-symbolic'; }

function dayName(dateStr) {
    if (!dateStr) return '';
    try { return new Date(dateStr).toLocaleDateString('tr-TR', {weekday: 'short'}); }
    catch (_e) { return ''; }
}

function truncLabel(text, max = 20) {
    const s = String(text ?? '');
    return s.length > max ? `${s.slice(0, max)}…` : s;
}

export class WeatherPanel {
    constructor({settings, logger}) {
        this._settings = settings;
        this._logger = logger;
        this._closeCallback = null;
        this._onCityChanged = null;
        this._body = null;
        this.actor = this._build();
    }

    setCloseCallback(cb) { this._closeCallback = cb; }
    setOnCityChanged(cb) { this._onCityChanged = cb; }

    _build() {
        const root = boxLayout({vertical: true, style_class: 'udt-edge-panel udt-weather-panel', x_expand: false, y_expand: false});
        root._udtPreferredWidth = PANEL_W;
        root._udtPreferredHeight = PANEL_H;
        root.set_size(PANEL_W, PANEL_H);

        root.add_child(panelHeader({
            title: 'Hava Durumu', subtitle: 'Güncel hava bilgisi',
            width: PANEL_W, iconName: 'weather-few-clouds-symbolic',
            onClose: () => this._closeCallback?.(),
        }));

        const scrollBox = createVerticalScrollBox({
            scrollStyleClass: 'udt-panel-scroll udt-weather-scroll',
            contentStyleClass: 'udt-weather-body',
            width: BODY_W,
            height: PANEL_H - 70,
        });
        this._body = scrollBox.content;
        this._body.set_width(BODY_W);
        root.add_child(scrollBox.scroll);

        this._showLoading();
        return root;
    }

    _showLoading() {
        clearActor(this._body);
        this._body.add_child(new St.Label({
            text: 'Hava durumu yükleniyor…',
            style_class: 'udt-w-status', x_align: Clutter.ActorAlign.CENTER,
        }));
    }

    showError(msg) {
        clearActor(this._body);
        this._body.add_child(this._cityBar());
        this._body.add_child(this._messageLabel(msg || 'Hava durumu alınamadı', 'udt-w-error'));
    }

    showCached(data, msg) {
        if (!data) { this.showError(msg); return; }
        this.update(data);
        this._body.add_child(this._messageLabel(msg || 'Son alınan hava durumu gösteriliyor.', 'udt-w-status'));
    }

    _messageLabel(text, styleClass) {
        const lbl = new St.Label({text, style_class: styleClass, x_align: Clutter.ActorAlign.CENTER});
        lbl.set_width(INNER_W);
        try { lbl.clutter_text.line_wrap = true; lbl.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR; } catch (_e) {}
        return lbl;
    }

    update(data) {
        if (!data) { this.showError('Veri yok'); return; }
        clearActor(this._body);

        // City bar
        this._body.add_child(this._cityBar());

        // ── Hero ──
        const hero = boxLayout({vertical: false, style_class: 'udt-w-hero', x_expand: false, y_expand: false});
        hero.set_width(INNER_W);

        const iconW = iconBin(wIcon(data.weather_code), 'udt-w-hero-icon-bin', 'udt-w-hero-icon', 36, 52, 52);
        hero.add_child(iconW);

        const info = boxLayout({vertical: true, x_expand: true, y_expand: false, style_class: 'udt-w-hero-info'});
        info.add_child(new St.Label({text: `${data.temp_c}°`, style_class: 'udt-w-temp'}));
        info.add_child(new St.Label({text: truncLabel(data.description, 28), style_class: 'udt-w-desc'}));
        hero.add_child(info);

        const hilo = boxLayout({vertical: true, x_expand: false, y_expand: false, x_align: Clutter.ActorAlign.END, style_class: 'udt-w-hilo'});
        hilo.add_child(new St.Label({text: `${data.max_temp}°`, style_class: 'udt-w-hi'}));
        hilo.add_child(new St.Label({text: `${data.min_temp}°`, style_class: 'udt-w-lo'}));
        hero.add_child(hilo);

        this._body.add_child(hero);

        // ── Detail rows (2-column, compact) ──
        const details = boxLayout({vertical: true, style_class: 'udt-w-details', x_expand: false, y_expand: false});
        details.set_width(INNER_W);

        details.add_child(this._detailRow(
            'Hissedilen', `${data.feels_like_c}°C`,
            'Nem', `%${data.humidity}`
        ));
        details.add_child(this._detailRow(
            'Rüzgâr', `${data.wind_kmph} km/s ${data.wind_dir}`,
            'Basınç', `${data.pressure_mb} mb`
        ));
        details.add_child(this._detailRow(
            'UV indeks', String(data.uv_index),
            'Görüş', `${data.visibility_km} km`
        ));
        if (data.sunrise || data.sunset) {
            details.add_child(this._detailRow(
                'Gün doğumu', data.sunrise || '--',
                'Gün batımı', data.sunset || '--'
            ));
        }
        this._body.add_child(details);

        // ── Forecast ──
        if (data.forecast?.length > 0) {
            this._body.add_child(new St.Label({text: 'TAHMİN', style_class: 'udt-w-section-title'}));

            const frow = boxLayout({vertical: false, style_class: 'udt-w-forecast-row', x_expand: false, y_expand: false});
            frow.set_width(INNER_W);

            for (const day of data.forecast) {
                const card = boxLayout({vertical: true, style_class: 'udt-w-fc-card', x_expand: true, y_expand: false});
                card.add_child(new St.Label({text: dayName(day.date), style_class: 'udt-w-fc-day', x_align: Clutter.ActorAlign.CENTER}));
                card.add_child(iconBin(wIcon(day.weather_code), 'udt-w-fc-icon-bin', 'udt-w-fc-icon', 18, 24, 24));
                card.add_child(new St.Label({
                    text: `${day.max_temp}°/${day.min_temp}°`,
                    style_class: 'udt-w-fc-temp', x_align: Clutter.ActorAlign.CENTER,
                }));
                frow.add_child(card);
            }
            this._body.add_child(frow);
        }
    }

    _cityBar() {
        const bar = boxLayout({vertical: false, style_class: 'udt-w-city-bar', x_expand: false, y_expand: false});
        bar.set_width(INNER_W);

        const currentCity = this._settings?.string('weather-city', 'Istanbul') ?? 'Istanbul';

        const entry = new St.Entry({
            hint_text: 'Şehir adı…',
            style_class: 'udt-w-city-input',
            can_focus: true, x_expand: true, y_expand: false,
        });
        entry.set_text(currentCity);
        entry.set_height(30);

        const btn = fixedButton('↻', 'udt-w-city-btn', 30, 30);
        btn.connect('clicked', () => this._submitCity(entry));

        try {
            entry.clutter_text.connect('activate', () => this._submitCity(entry));
        } catch (_e) {}

        bar.add_child(entry);
        bar.add_child(btn);
        return bar;
    }

    _submitCity(entry) {
        const city = entry.get_text()?.trim();
        if (city && city.length > 0) {
            try { this._settings?.raw?.set_string('weather-city', city); } catch (_e) {}
            this._onCityChanged?.(city);
        }
    }

    _detailRow(label1, value1, label2, value2) {
        const row = boxLayout({vertical: false, style_class: 'udt-w-detail-row', x_expand: false, y_expand: false});
        row.set_width(INNER_W);
        row.add_child(this._detailCell(label1, value1));
        row.add_child(this._detailCell(label2, value2));
        return row;
    }

    _detailCell(label, value) {
        const cell = boxLayout({vertical: true, style_class: 'udt-w-detail-cell', x_expand: true, y_expand: false});
        const lbl = new St.Label({text: label, style_class: 'udt-w-detail-label'});
        try { lbl.clutter_text.ellipsize = Pango.EllipsizeMode.END; } catch (_e) {}
        cell.add_child(lbl);
        const val = new St.Label({text: truncLabel(value, 18), style_class: 'udt-w-detail-value'});
        try { val.clutter_text.ellipsize = Pango.EllipsizeMode.END; } catch (_e) {}
        cell.add_child(val);
        return cell;
    }
}
