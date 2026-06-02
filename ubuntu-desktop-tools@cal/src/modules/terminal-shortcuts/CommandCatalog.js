import {DistroDetector, binaryExists} from '../../utils/DistroDetector.js';

/**
 * Base commands. `pkgCmd` keys are auto-adapted to detected package manager.
 * `requires` hides the command if the binary is missing.
 */
const BASE_CATALOG = [
    {id: 'pkg-update',  category: 'Sistem', title: 'Paket listesini güncelle', pkgCmd: 'update',  description: 'Paket listelerini yeniler.',           risk: 'medium', action: 'terminal'},
    {id: 'pkg-upgrade', category: 'Sistem', title: 'Tam yükseltme',            pkgCmd: 'upgrade', description: 'Tüm paketleri yükseltir.',              risk: 'medium', action: 'terminal'},
    {id: 'pkg-clean',   category: 'Sistem', title: 'Paket önbelleğini temizle', pkgCmd: 'clean',  description: 'Önbelleği temizler, disk kazandırır.',   risk: 'medium', action: 'terminal'},
    {id: 'disk-usage',  category: 'Sistem', title: 'Disk kullanımını göster',  command: 'df -h',                  description: 'Disk bölümlerinin doluluk oranı.',       risk: 'safe', action: 'copy'},
    {id: 'failed-svc',  category: 'Sistem', title: 'Hatalı servisleri listele', command: 'systemctl --failed',    description: 'Başarısız sistem servislerini listeler.', risk: 'safe', action: 'copy'},
    {id: 'free-mem',    category: 'Sistem', title: 'Bellek detayı',             command: 'free -h',               description: 'RAM ve swap kullanımını gösterir.',      risk: 'safe', action: 'copy'},
    {id: 'open-ports',  category: 'Sistem', title: 'Açık portları göster',      command: 'ss -tuln',              description: 'Dinleyen TCP/UDP portlarını listeler.',  risk: 'safe', action: 'copy'},
    {id: 'journal-50',  category: 'Sistem', title: 'Sistem logları (son 50)',   command: 'journalctl -n 50 --no-pager', description: 'Son 50 sistem log satırı.',        risk: 'safe', action: 'copy'},
    {id: 'sensors',     category: 'Sistem', title: 'CPU sıcaklığı',            command: 'sensors',               description: 'Donanım sıcaklık sensörleri.',           risk: 'safe', action: 'copy', requires: 'sensors'},
    {id: 'gnome-ver',   category: 'GNOME',  title: 'GNOME sürümünü göster',    command: 'gnome-shell --version', description: 'GNOME Shell sürümü.',                    risk: 'safe', action: 'copy'},
    {id: 'ext-list',    category: 'GNOME',  title: 'Extension listesi',         command: 'gnome-extensions list', description: 'Kurulu GNOME extension listesi.',        risk: 'safe', action: 'copy'},
    {id: 'ext-prefs',   category: 'GNOME',  title: 'Bu eklenti ayarlarını aç',  command: 'gnome-extensions prefs ubuntu-desktop-tools@cal', description: 'CAL Extensions ayar penceresi.', risk: 'safe', action: 'terminal'},
    {id: 'shell-logs',  category: 'GNOME',  title: 'Shell loglarını izle',      command: 'journalctl /usr/bin/gnome-shell -f', description: 'GNOME Shell loglarını canlı.', risk: 'safe', action: 'terminal'},
    {id: 'ip-addr',     category: 'Ağ',     title: 'IP adresini göster',        command: 'ip addr show',          description: 'Ağ arayüzleri ve IP adresleri.',         risk: 'safe', action: 'copy'},
    {id: 'dns-status',  category: 'Ağ',     title: 'DNS çözümle',               command: 'resolvectl status',     description: 'DNS yapılandırması.',                    risk: 'safe', action: 'copy'},
    {id: 'ping-test',   category: 'Ağ',     title: 'Ping testi',                command: 'ping -c 4 1.1.1.1',    description: 'Cloudflare DNS sunucusuna ping.',         risk: 'safe', action: 'terminal'},
    {id: 'big-files',   category: 'Dosya',  title: 'En büyük 10 dosya',         command: 'du -ah ~ | sort -rh | head -10', description: 'Home klasöründeki en büyük dosyalar.', risk: 'safe', action: 'copy'},
];

export function buildCommandCatalog() {
    const pkg = DistroDetector.packageManager();
    const result = [];
    for (const item of BASE_CATALOG) {
        if (item.requires && !binaryExists(item.requires)) continue;
        if (item.pkgCmd) {
            const cmd = pkg[item.pkgCmd];
            if (!cmd) continue;
            result.push({...item, command: cmd, title: item.title + " (" + pkg.label + ")", builtIn: true});
        } else {
            result.push({...item, builtIn: true});
        }
    }
    return result;
}

export const COMMAND_CATALOG = buildCommandCatalog();
