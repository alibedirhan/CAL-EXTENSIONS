import GLib from 'gi://GLib';

// Import Soup — try 3.0 first (GNOME 46+), no fallback needed for target versions
import Soup from 'gi://Soup?version=3.0';

const TIMEOUT_SEC = 10;

/**
 * Weather data fetcher using wttr.in (no API key).
 */
export class WeatherService {
    constructor(logger) {
        this._logger = logger;
        this._session = null;
        this._lastData = null;
    }

    get lastData() { return this._lastData; }

    fetch(city, callback) {
        if (!city) { callback(null, 'Şehir belirtilmedi'); return; }

        const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=tr`;

        try {
            if (!this._session)
                this._session = new Soup.Session({timeout: TIMEOUT_SEC});

            const message = Soup.Message.new('GET', url);
            if (!message) { callback(null, 'URL oluşturulamadı'); return; }

            this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    if (!bytes) { callback(null, 'Boş yanıt'); return; }

                    const statusCode = message.get_status();
                    if (statusCode !== 200) { callback(null, `HTTP ${statusCode}`); return; }

                    const text = new TextDecoder('utf-8').decode(bytes.get_data());
                    const data = this._parseResponse(JSON.parse(text), city);
                    this._lastData = data;
                    callback(data, null);
                } catch (error) {
                    this._logger?.warn?.(`Weather parse: ${error}`);
                    callback(null, String(error));
                }
            });
        } catch (error) {
            this._logger?.warn?.(`Weather fetch: ${error}`);
            callback(null, String(error));
        }
    }

    _parseResponse(json, city) {
        const cur = json?.current_condition?.[0] ?? {};
        const today = json?.weather?.[0] ?? {};
        const forecast = (json?.weather ?? []).slice(0, 3);

        return {
            city,
            temp_c: cur.temp_C ?? '--',
            feels_like_c: cur.FeelsLikeC ?? '--',
            humidity: cur.humidity ?? '--',
            wind_kmph: cur.windspeedKmph ?? '--',
            wind_dir: cur.winddir16Point ?? '',
            pressure_mb: cur.pressure ?? '--',
            uv_index: cur.uvIndex ?? '--',
            visibility_km: cur.visibility ?? '--',
            description: cur.lang_tr?.[0]?.value ?? cur.weatherDesc?.[0]?.value ?? '',
            weather_code: cur.weatherCode ?? '113',
            max_temp: today.maxtempC ?? '--',
            min_temp: today.mintempC ?? '--',
            sunrise: today.astronomy?.[0]?.sunrise ?? '',
            sunset: today.astronomy?.[0]?.sunset ?? '',
            forecast: forecast.map(day => ({
                date: day.date ?? '',
                max_temp: day.maxtempC ?? '--',
                min_temp: day.mintempC ?? '--',
                description: day.hourly?.[4]?.lang_tr?.[0]?.value ?? day.hourly?.[4]?.weatherDesc?.[0]?.value ?? '',
                weather_code: day.hourly?.[4]?.weatherCode ?? '113',
            })),
            fetched_at: Date.now(),
        };
    }

    destroy() { this._session = null; this._lastData = null; }
}
