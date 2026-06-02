import St from 'gi://St';
import {SafeSpawn} from '../../utils/SafeSpawn.js';
import {DistroDetector} from '../../utils/DistroDetector.js';

export class TerminalLauncher {
    constructor(settings, logger) {
        this._settings = settings;
        this._logger = logger;
    }

    copy(command) {
        const clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, command);
        this._logger.info(`Copied: ${command}`);
        return true;
    }

    openInTerminal(command) {
        const quoted = SafeSpawn.quote(`${command}; echo; read -p 'Devam etmek için Enter...'`);

        // Check user preference first
        const preferred = this._settings?.string?.('preferred-terminal', 'auto') ?? 'auto';
        if (preferred !== 'auto') {
            const terminals = DistroDetector.terminals();
            const match = terminals.find(t => t.bin === preferred);
            if (match) {
                const cmdLine = match.exec(quoted);
                if (SafeSpawn.spawnCommandLine(cmdLine, this._logger))
                    return true;
            }
        }

        // Auto-detect: try all available terminals
        const terminals = DistroDetector.terminals();
        for (const terminal of terminals) {
            const cmdLine = terminal.exec(quoted);
            if (SafeSpawn.spawnCommandLine(cmdLine, this._logger))
                return true;
        }

        this._logger.warn('No terminal emulator found');
        return false;
    }
}
