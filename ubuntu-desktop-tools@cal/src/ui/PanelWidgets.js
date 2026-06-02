import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import {boxLayout} from '../compat/UiCompat.js';
import {iconBin} from './IconFactory.js';

/**
 * Creates a standard panel header with icon, title, subtitle, and close button.
 * Shared across Terminal, Notes, SystemInfo, and Weather panels.
 */
export function panelHeader({title, subtitle, width, iconName = null, onClose = null}) {
    const head = boxLayout({vertical: true, style_class: 'udt-panel-head', x_expand: false, y_expand: false});
    head.set_width(width);

    const titleRow = boxLayout({vertical: false, x_expand: false, y_expand: false, style_class: 'udt-panel-title-row'});
    titleRow.set_width(width - 30);

    if (iconName)
        titleRow.add_child(iconBin(iconName, 'udt-panel-header-icon', 'udt-panel-header-symbolic-icon', 16, 24, 24));

    titleRow.add_child(new St.Label({text: title, style_class: 'udt-edge-panel-title', x_expand: true}));

    const close = new St.Button({style_class: 'udt-panel-close-button', can_focus: true, reactive: true, track_hover: true});
    close.set_size(30, 30);
    close.set_child(new St.Label({text: '×', style_class: 'udt-button-text', x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER}));
    if (onClose) close.connect('clicked', onClose);
    titleRow.add_child(close);

    head.add_child(titleRow);
    head.add_child(new St.Label({text: subtitle, style_class: 'udt-edge-panel-subtitle'}));
    return head;
}

/** Compact fixed-size button with label. */
export function fixedButton(label, styleClass, width = 26, height = 26) {
    const button = new St.Button({
        style_class: styleClass,
        can_focus: true,
        reactive: true,
        track_hover: true,
        x_expand: false,
        y_expand: false,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.START,
    });
    button.set_size(width, height);
    const buttonLabel = new St.Label({
        text: label,
        style_class: 'udt-button-text',
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
    });
    try { buttonLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE; } catch (_error) {}
    button.set_child(buttonLabel);
    return button;
}

/** Label with word wrapping. */
export function wrappedLabel(text, styleClass, width, height = -1) {
    const label = new St.Label({
        text,
        style_class: styleClass,
        x_align: Clutter.ActorAlign.START,
        y_align: Clutter.ActorAlign.START,
        x_expand: false,
        y_expand: false,
    });
    label.set_width(width);
    if (height > -1) label.set_height(height);
    try {
        label.clutter_text.line_wrap = true;
        label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        label.clutter_text.single_line_mode = false;
    } catch (_error) {}
    return label;
}
