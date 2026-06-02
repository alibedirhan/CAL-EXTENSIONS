# Changelog

## v0.2.4-diagnostics-weather-cleanup — Unreleased

- Hava Durumu modülünün ilk açılış durumu daha doğru raporlanır; veri yüklenirken modül gereksiz yere `degraded` görünmez.
- Hava durumu servisi geçici olarak yanıt vermezse kullanıcıya daha sade mesaj gösterilir; son başarılı veri varsa panel tamamen boşaltılmaz, son veri gösterilir.
- `status_extension.sh` ve `diagnose_install.sh` yerel GNOME extension schema durumunu daha doğru yorumlar; sistem listesinde görünmeyen yerel schema artık otomatik hata gibi sunulmaz.
- Safe-mode marker uyarısı extension aktifse daha sakin bilgi mesajı olarak gösterilir.
- Log çıktıları CAL Extensions odaklı filtrelenir; ilgisiz pencere yöneticisi uyarıları daha az görünür.
- `scripts/collect_drag_logs.sh` eklendi; 60 saniyelik rail/drag test loglarını proje içindeki `logs/` klasörüne toplar.

## v0.2.3-rail-drag-stability — Unreleased

- Sağ rail taşıma tutacağına küçük hareket eşiği eklendi; kısa tıklamalar artık sürükleme gibi davranmaz.
- Rail sürükleme durumu `press / drag / release` olarak ayrıldı; aktif sürükleme görseli sadece gerçek hareket başladığında görünür.
- Sürükleme sınırları mevcut monitör ve rail yüksekliğine göre hesaplanır; bırakma anında zıplama/takılma hissi azaltıldı.
- Konum yine yalnızca bırakma anında kaydedilir; mevcut Terminal, Notlar, Sistem Bilgisi ve Hava Durumu davranışı korunur.

## v0.2.2-rail-grip-polish

- Sağ rail taşıma tutacağı daha sade iki kolonlu nokta tasarımına çevrildi.
- Rail sürükleme hissi iyileştirildi: konum artık sürüklerken görsel olarak önizlenir, GSettings değeri bırakınca tek sefer yazılır. Bu küçük takılmaları azaltır.

## v0.2.1-control-rail-polish

### Added

- Right rail settings button for opening CAL Extensions preferences directly from the rail.
- Dedicated drag handle under the settings button so the rail can be moved without accidentally dragging module buttons.

### Changed

- Rail dragging is now bound to the drag handle instead of the full rail surface.
- README now mentions the rail settings and drag controls.

### Notes

- This is a small UX polish release. Existing module behavior is intentionally kept unchanged.

## v0.2.0-architecture-hardening — Unreleased

### Added

- Module lifecycle health status contract (`ready`, `degraded`, `failed`, `disabled`).
- Diagnostics service foundation for future health UI and issue triage.
- Actor/Panel/Popup compatibility helpers for safer GNOME Shell API isolation.
- Per-metric graceful degradation in System Monitor sampling.
- README screenshot asset checker.
- GitHub Actions static check workflow.
- Release package checksum generation.
- Compatibility matrix and GNOME Store readiness checklist docs.

### Changed

- System Monitor setting toggle no longer disables the entire module lifecycle; it removes/rebuilds only the indicator.
- Release packaging now runs static checks before creating a ZIP.
- Diagnose/status scripts now produce clearer support-oriented output.

### Hardened

- Quick Notes storage now keeps the existing path but adds backup-before-write and corrupt-file backup.
- Metric readers return safe fallback results instead of allowing a single reader failure to break the monitor.
- Panel and rail cleanup now use centralized safe actor helpers.

### Notes

- This is not a new-feature release. The goal is to raise sustainability, maintainability and compatibility confidence without changing the working product behavior.

## v0.1.0-local-preview — Unreleased

### Added

- Top-bar system monitor.
- Right-edge rail panel.
- Terminal shortcuts panel.
- Quick notes panel.
- System information panel.
- Weather panel.
- GNOME preferences window.
- Local install/uninstall/status scripts.
- Initial GitHub documentation set.

### Notes

- Public product name: CAL Extensions.
- Technical UUID is intentionally kept as `ubuntu-desktop-tools@cal` to avoid breaking local installs and existing settings.
- GNOME 46/47/48 support claims should be validated with real tests before stable release.
