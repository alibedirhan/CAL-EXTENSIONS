/**
 * UI Compatibility Helpers
 *
 * GNOME 48 deprecates `vertical: true` → use `orientation`.
 * GNOME 47 removes `Clutter.Color` → use `Cogl.Color`.
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import {ShellVersion} from './ShellVersion.js';

/**
 * Returns orientation property for BoxLayout construction.
 * Pre-48: {vertical: bool}   48+: {orientation: Clutter.Orientation.*}
 */
export function orientationProp(vertical) {
    if (ShellVersion.isAtLeast48()) {
        return {
            orientation: vertical
                ? Clutter.Orientation.VERTICAL
                : Clutter.Orientation.HORIZONTAL,
        };
    }
    return {vertical};
}

/** Create St.BoxLayout with correct orientation API. */
export function boxLayout(props = {}) {
    const vertical = props.vertical ?? false;
    const cleanProps = {...props};
    delete cleanProps.vertical;
    return new St.BoxLayout({...cleanProps, ...orientationProp(vertical)});
}

/** Parse color string across GNOME versions. Returns color or null. */
export function parseColor(colorString) {
    if (ShellVersion.isAtLeast47()) {
        try {
            const color = new Cogl.Color();
            color.init_from_string?.(colorString);
            return color;
        } catch (_error) {}
        return null;
    }

    try {
        const [ok, color] = Clutter.Color.from_string(colorString);
        return ok ? color : null;
    } catch (_error) {
        return null;
    }
}

/** Apply text color to Clutter.Text, version-safe. */
export function setTextColor(clutterText, colorString) {
    const color = parseColor(colorString);
    if (color) {
        try { clutterText.set_color(color); } catch (_error) {}
    }
}

/** Apply cursor color to Clutter.Text, version-safe. */
export function setCursorColor(clutterText, colorString) {
    const color = parseColor(colorString);
    if (color) {
        try { clutterText.set_cursor_color(color); } catch (_error) {}
    }
}
