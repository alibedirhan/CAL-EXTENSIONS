# Contributing to CAL Extensions

Katkılar memnuniyetle kabul edilir. Bu proje GNOME Shell üzerinde çalıştığı için küçük bir hata masaüstü oturumunu etkileyebilir. Bu yüzden katkı standardı bilinçli olarak sıkıdır.

## Geliştirme akışı

1. Fork oluştur.
2. Feature branch aç.
3. Değişikliği küçük tut.
4. Statik kontrolleri çalıştır.
5. Wayland veya X11 test notunu PR açıklamasına yaz.

```bash
bash scripts/check_static.sh
bash scripts/install_local.sh
bash scripts/status_extension.sh
```

## PR açıklamasında olmalı

- Ne değişti?
- Neden değişti?
- Hangi GNOME sürümünde test edildi?
- Wayland/X11 test edildi mi?
- GSettings schema değişti mi?
- Kullanıcı verisi/gizlilik etkisi var mı?
- Ekran görüntüsü gerekiyorsa eklendi mi?

## Kod standardı

- Entry point küçük kalmalı.
- Modüller lifecycle sözleşmesine uymalı.
- Actor/signal/timeout temizliği eksiksiz olmalı.
- GNOME sürüm farkları `src/compat/` içinde tutulmalı.
- CSS sınıfları tutarlı prefix kullanmalı.
- Kullanıcının kişisel verisini etkileyen değişiklikler dokümante edilmeli.
