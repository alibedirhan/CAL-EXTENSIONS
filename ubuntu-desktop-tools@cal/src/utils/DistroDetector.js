/**
 * Distribution & Environment Detection
 *
 * Reads /etc/os-release once and provides:
 *   - Distro family (ubuntu, fedora, arch, opensuse, debian, generic)
 *   - Package manager commands (install, update, upgrade, clean)
 *   - Available terminal emulators (ordered by preference)
 *   - Whether a given binary exists on PATH
 */

import GLib from 'gi://GLib';
import {ProcParser} from './ProcParser.js';

let _cached = null;

const PKG_MANAGERS = {
    apt:    {id: 'apt',    label: 'APT',    install: 'sudo apt install -y', update: 'sudo apt update', upgrade: 'sudo apt full-upgrade -y', clean: 'sudo apt clean && sudo apt autoclean', remove: 'sudo apt remove'},
    dnf:    {id: 'dnf',    label: 'DNF',    install: 'sudo dnf install -y', update: 'sudo dnf check-update', upgrade: 'sudo dnf upgrade -y', clean: 'sudo dnf clean all', remove: 'sudo dnf remove'},
    pacman: {id: 'pacman', label: 'Pacman', install: 'sudo pacman -S --noconfirm', update: 'sudo pacman -Sy', upgrade: 'sudo pacman -Syu --noconfirm', clean: 'sudo pacman -Sc --noconfirm', remove: 'sudo pacman -R'},
    zypper: {id: 'zypper', label: 'Zypper', install: 'sudo zypper install -y', update: 'sudo zypper refresh', upgrade: 'sudo zypper update -y', clean: 'sudo zypper clean', remove: 'sudo zypper remove'},
};

const DISTRO_FAMILIES = {
    ubuntu: 'apt', pop: 'apt', linuxmint: 'apt', elementary: 'apt', zorin: 'apt', debian: 'apt',
    fedora: 'dnf', rhel: 'dnf', centos: 'dnf', rocky: 'dnf', alma: 'dnf', nobara: 'dnf',
    arch: 'pacman', manjaro: 'pacman', endeavouros: 'pacman', garuda: 'pacman',
    opensuse: 'zypper', suse: 'zypper',
};

const TERMINAL_CANDIDATES = [
    {bin: 'gnome-terminal', exec: (cmd) => `gnome-terminal -- bash -lc ${cmd}`},
    {bin: 'ptyxis',         exec: (cmd) => `ptyxis -- bash -lc ${cmd}`},
    {bin: 'kgx',            exec: (cmd) => `kgx -- bash -lc ${cmd}`},
    {bin: 'konsole',        exec: (cmd) => `konsole -e bash -lc ${cmd}`},
    {bin: 'xfce4-terminal', exec: (cmd) => `xfce4-terminal -e "bash -lc ${cmd}"`},
    {bin: 'tilix',          exec: (cmd) => `tilix -e "bash -lc ${cmd}"`},
    {bin: 'alacritty',      exec: (cmd) => `alacritty -e bash -lc ${cmd}`},
    {bin: 'kitty',          exec: (cmd) => `kitty bash -lc ${cmd}`},
    {bin: 'x-terminal-emulator', exec: (cmd) => `x-terminal-emulator -e bash -lc ${cmd}`},
];

function detect() {
    if (_cached) return _cached;

    const osRelease = ProcParser.parseKeyValueFile('/etc/os-release');
    const id = (osRelease.get('ID') ?? '').replace(/"/g, '').toLowerCase();
    const idLike = (osRelease.get('ID_LIKE') ?? '').replace(/"/g, '').toLowerCase();
    const prettyName = (osRelease.get('PRETTY_NAME') ?? 'Linux').replace(/"/g, '');
    const versionId = (osRelease.get('VERSION_ID') ?? '').replace(/"/g, '');

    // Detect family
    let family = 'generic';
    let pkgId = null;
    for (const [key, mgr] of Object.entries(DISTRO_FAMILIES)) {
        if (id.includes(key) || idLike.includes(key)) {
            family = key;
            pkgId = mgr;
            break;
        }
    }

    // Fallback: check which binary exists
    if (!pkgId) {
        for (const candidate of ['apt', 'dnf', 'pacman', 'zypper']) {
            if (binaryExists(candidate)) { pkgId = candidate; break; }
        }
    }

    const pkg = PKG_MANAGERS[pkgId] ?? PKG_MANAGERS.apt;

    // Detect available terminals
    const terminals = TERMINAL_CANDIDATES.filter(t => binaryExists(t.bin));

    _cached = {
        id,
        idLike,
        prettyName,
        versionId,
        family,
        packageManager: pkg,
        terminals,
        defaultTerminal: terminals[0] ?? TERMINAL_CANDIDATES[0],
    };

    return _cached;
}

export function binaryExists(name) {
    try {
        return GLib.find_program_in_path(name) !== null;
    } catch (_error) {
        return false;
    }
}

export const DistroDetector = {
    /** Full detection result (cached after first call) */
    detect,

    /** @returns {string} Distro pretty name */
    prettyName() { return detect().prettyName; },

    /** @returns {object} Package manager info */
    packageManager() { return detect().packageManager; },

    /** @returns {Array} Available terminal emulators */
    terminals() { return detect().terminals; },

    /** @returns {object} First available terminal */
    defaultTerminal() { return detect().defaultTerminal; },

    /** @returns {string} Distro family id */
    family() { return detect().family; },

    /** Clear cache (for testing) */
    reset() { _cached = null; },
};
