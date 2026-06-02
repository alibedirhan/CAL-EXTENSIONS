/**
 * GNOME Shell Version Detection & Compatibility
 *
 * Compatibility matrix:
 *   GNOME 46 — Ubuntu 24.04 LTS (baseline)
 *   GNOME 47 — Ubuntu 24.10 (Clutter.Color → Cogl.Color, accent-color)
 *   GNOME 48 — Ubuntu 25.04 (vertical deprecated → orientation)
 *   GNOME 49 — Ubuntu 25.10 (Meta.Rectangle removed)
 */

let _shellMajor = 0;

function detectVersion() {
    if (_shellMajor > 0)
        return _shellMajor;

    try {
        const Config = globalThis.imports?.misc?.config;
        const parts = String(Config?.PACKAGE_VERSION ?? "46").split(".");
        _shellMajor = Number.parseInt(parts[0], 10) || 46;
    } catch (_error) {
        _shellMajor = 46;
    }

    return _shellMajor;
}

export const ShellVersion = {
    major() { return detectVersion(); },
    isAtLeast47() { return detectVersion() >= 47; },
    isAtLeast48() { return detectVersion() >= 48; },
    isAtLeast49() { return detectVersion() >= 49; },
};
