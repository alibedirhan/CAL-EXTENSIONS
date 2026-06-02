import GLib from 'gi://GLib';

export class SafeSpawn {
    static quote(value) { return GLib.shell_quote(String(value)); }
    static spawnCommandLine(commandLine, logger = null) {
        try { GLib.spawn_command_line_async(commandLine); return true; }
        catch (error) { logger?.warn(`Spawn failed: ${error}`); return false; }
    }
}
