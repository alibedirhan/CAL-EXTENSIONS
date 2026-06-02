const BLOCKED_PATTERNS = [
    /\bmkfs\./i,
    /\bdd\s+.*\bof=\/dev\//i,
    /\b(curl|wget)\b.*\|\s*(bash|sh)\b/i,
    /\bchmod\s+-R\s+777\b/i,
    /\bchown\s+-R\b/i,
    /\b(shutdown|poweroff|halt|reboot)\b/i,
    /\b(init\s+0|systemctl\s+(reboot|poweroff|halt))\b/i,
    /:\s*\(\s*\)\s*\{/,
    />\s*\/dev\/(sd|vd|nvme)/i,
];

const SHELL_CONTROL_PATTERNS = [
    /[;&|`]/,
    /\$\(/,
    /\n/,
];

const SAFE_SUDO_PREFIXES = [
    /^sudo\s+(apt|dnf|pacman|zypper)\s+[-\w.]+(?:\s+[-\w./:=+@]+)*$/i,
    /^sudo\s+systemctl\s+(status|restart|reload|start|stop)\s+[-\w.@]+$/i,
];

function commandText(command) {
    return String(command ?? "").trim();
}

/**
 * Detects a forced recursive `rm` regardless of flag order.
 * Catches `rm -rf`, `rm -fr`, `rm -f -r`, `rm -R --force`, `rm --recursive --force`, …
 */
function isForcedRecursiveRm(command) {
    if (!/\brm\b/i.test(command))
        return false;
    const recursive = /(^|\s)-\w*[rR]\w*(\s|$)/.test(command) || /--recursive\b/i.test(command);
    const force = /(^|\s)-\w*f\w*(\s|$)/.test(command) || /--force\b/i.test(command);
    return recursive && force;
}

function hasBlockedPattern(command) {
    return isForcedRecursiveRm(command) || BLOCKED_PATTERNS.some(pattern => pattern.test(command));
}

function hasShellControl(command) {
    return SHELL_CONTROL_PATTERNS.some(pattern => pattern.test(command));
}

function isSafeSudo(command) {
    return SAFE_SUDO_PREFIXES.some(pattern => pattern.test(command));
}

export class CommandPolicy {
    constructor(settings) {
        this._settings = settings;
    }

    evaluate(command, item = {}) {
        const normalized = commandText(command);
        if (!normalized)
            return this._blocked("Boş komut çalıştırılamaz.");

        if (hasBlockedPattern(normalized))
            return this._blocked("Bu komut güvenlik politikası gereği engellendi.");

        if (item.custom) {
            if (normalized.length > 220)
                return this._blocked("Özel komut çok uzun.");
            if (hasShellControl(normalized))
                return this._blocked("Özel komutlarda zincirleme, pipe veya komut ikamesi kullanılamaz.");
            if (/^sudo\s+/.test(normalized) && !isSafeSudo(normalized))
                return this._blocked("Bu sudo komutu özel komut güvenlik listesinde değil.");
        }

        if (/^sudo\s+/.test(normalized))
            return {allowed: true, warning: "sudo komutu terminalde kullanıcı onayıyla çalıştırılmalı.", preferredAction: "terminal"};

        return {allowed: true, warning: "", preferredAction: this._settings.string("terminal-default-action", "copy")};
    }

    listDecision(item) {
        const commandDecision = this.evaluate(item.command, item);
        const policy = this._settings.string("terminal-command-policy", "safe-only");
        const risky = item.risk && item.risk !== "safe";

        if (!commandDecision.allowed)
            return policy === "show-risky-disabled"
                ? {...commandDecision, visible: true, disabled: true}
                : {...commandDecision, visible: false, disabled: true};

        if (policy === "safe-only" && risky && !item.builtIn)
            return {...commandDecision, visible: false, disabled: true};

        if (policy === "show-risky-disabled" && risky && !item.builtIn)
            return {...commandDecision, visible: true, disabled: true, reason: "Özel riskli komut pasif gösteriliyor."};

        return {...commandDecision, visible: true, disabled: false};
    }

    _blocked(reason) {
        return {allowed: false, reason, warning: "", preferredAction: "copy"};
    }
}
