/** @jsxImportSource preact */
// Live Vernal Status Bar — the thin conditions strip pinned under the nav.
//
// SCOPE (deliberately narrow): current weather for Vernal, Utah, from
// Open-Meteo. Temperature, condition, wind, sunrise, sunset. Nothing else.
// Road status, fire restrictions and closures are EXCLUDED by design — those
// require an authoritative source, and a stale or inferred safety claim is a
// liability in a way a stale temperature is not.
//
// Coordinates arrive as props from BaseLayout (sourced from data/business.ts)
// so business.ts is never pulled into the client bundle.
//
// Failure posture: if the fetch fails and no cached reading exists, the bar
// renders NOTHING. A missing strip is better than a broken one. The initial
// 'idle' state also renders null, so the server emits an empty island and
// visitors without JS never see a stuck "Loading…" row.
import { useEffect, useState } from 'preact/hooks';

interface Props {
  lat: number;
  lon: number;
  /** IANA zone used to resolve sunrise/sunset to LOCAL Vernal clock time. */
  timeZone?: string;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface Conditions {
  tempF: number;
  windMph: number;
  code: number;
  isDay: boolean;
  sunrise: string;
  sunset: string;
  /** Observation time as returned by the API (local Vernal time). */
  observedAt: string;
}

interface Cached {
  t: number;
  d: Conditions;
}

const CACHE_KEY = 'bwvi:conditions';
/** Refresh cadence and cache lifetime. */
const TTL_MS = 10 * 60 * 1000;
/** Give up on a hung request rather than sitting in the loading state. */
const FETCH_TIMEOUT_MS = 8000;

// WMO weather interpretation codes (Open-Meteo `weather_code`).
// Codes 0–2 differ day vs night, so those carry a second glyph.
const WMO: Record<number, { label: string; day: string; night?: string }> = {
  0: { label: 'Clear', day: '☀️', night: '🌙' },
  1: { label: 'Mainly Clear', day: '🌤️', night: '🌙' },
  2: { label: 'Partly Cloudy', day: '⛅', night: '☁️' },
  3: { label: 'Overcast', day: '☁️' },
  45: { label: 'Fog', day: '🌫️' },
  48: { label: 'Freezing Fog', day: '🌫️' },
  51: { label: 'Light Drizzle', day: '🌦️' },
  53: { label: 'Drizzle', day: '🌦️' },
  55: { label: 'Heavy Drizzle', day: '🌦️' },
  56: { label: 'Freezing Drizzle', day: '🌧️' },
  57: { label: 'Freezing Drizzle', day: '🌧️' },
  61: { label: 'Light Rain', day: '🌦️' },
  63: { label: 'Rain', day: '🌧️' },
  65: { label: 'Heavy Rain', day: '🌧️' },
  66: { label: 'Freezing Rain', day: '🌧️' },
  67: { label: 'Freezing Rain', day: '🌧️' },
  71: { label: 'Light Snow', day: '🌨️' },
  73: { label: 'Snow', day: '🌨️' },
  75: { label: 'Heavy Snow', day: '❄️' },
  77: { label: 'Snow Grains', day: '🌨️' },
  80: { label: 'Rain Showers', day: '🌦️' },
  81: { label: 'Rain Showers', day: '🌧️' },
  82: { label: 'Heavy Rain Showers', day: '🌧️' },
  85: { label: 'Snow Showers', day: '🌨️' },
  86: { label: 'Heavy Snow Showers', day: '❄️' },
  95: { label: 'Thunderstorm', day: '⛈️' },
  96: { label: 'Thunderstorm, Hail', day: '⛈️' },
  99: { label: 'Thunderstorm, Hail', day: '⛈️' },
};

function describe(code: number, isDay: boolean) {
  const w = WMO[code];
  if (!w) return { label: 'Current Conditions', icon: isDay ? '☀️' : '🌙' };
  return { label: w.label, icon: !isDay && w.night ? w.night : w.day };
}

// Open-Meteo returns naive local ISO strings ("2026-08-04T06:18") when a
// timezone is requested. Parse the clock face directly: handing that to
// `new Date()` would re-interpret it in the VISITOR's timezone, so a guest
// booking from New York would see Vernal's sunrise shifted two hours.
function fmtTime(iso: string): string {
  const clock = iso.split('T')[1];
  if (!clock) return '';
  const [h, m] = clock.split(':');
  const hour = Number(h);
  if (!Number.isFinite(hour) || !m) return '';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${suffix}`;
}

function readCache(): Cached | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    // Private mode / storage disabled — caching is an optimisation, not a
    // requirement. Fall through to a live fetch.
    return null;
  }
}

function writeCache(d: Conditions) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d }));
  } catch {
    /* non-fatal */
  }
}

export default function LiveStatusBar({ lat, lon, timeZone = 'America/Denver' }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<Conditions | null>(null);

  useEffect(() => {
    let alive = true;

    const url =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,weather_code,wind_speed_10m,is_day' +
      '&daily=sunrise,sunset' +
      '&temperature_unit=fahrenheit&wind_speed_unit=mph' +
      `&timezone=${encodeURIComponent(timeZone)}&forecast_days=1`;

    async function load(force = false) {
      const cached = readCache();
      if (!force && cached && Date.now() - cached.t < TTL_MS) {
        if (alive) {
          setData(cached.d);
          setStatus('ready');
        }
        return;
      }

      // Only show the loading row when there is nothing at all to display;
      // a background refresh should never blank out a good reading.
      if (alive && !cached) setStatus('loading');

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const next: Conditions = {
          tempF: Math.round(json.current.temperature_2m),
          windMph: Math.round(json.current.wind_speed_10m),
          code: json.current.weather_code,
          isDay: json.current.is_day === 1,
          sunrise: fmtTime(json.daily.sunrise[0]),
          sunset: fmtTime(json.daily.sunset[0]),
          observedAt: fmtTime(json.current.time),
        };
        if (!Number.isFinite(next.tempF)) throw new Error('malformed payload');
        writeCache(next);
        if (alive) {
          setData(next);
          setStatus('ready');
        }
      } catch {
        // Fall back to the last good reading if we have one, however stale —
        // an old temperature still beats an empty strip. Otherwise stand down.
        if (!alive) return;
        if (cached) {
          setData(cached.d);
          setStatus('ready');
        } else {
          setStatus('error');
        }
      } finally {
        clearTimeout(timer);
      }
    }

    void load();
    const interval = setInterval(() => void load(true), TTL_MS);

    // A tab left open overnight would otherwise show yesterday's reading
    // until the next tick; refresh on return if the cache has expired.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const cached = readCache();
      if (!cached || Date.now() - cached.t >= TTL_MS) void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [lat, lon, timeZone]);

  // Nothing rendered before hydration, and nothing rendered if the API is
  // unreachable with no cached reading to fall back on.
  if (status === 'idle' || status === 'error') return null;

  if (status === 'loading' || !data) {
    return (
      <div class="lsb" aria-hidden="true">
        <div class="lsb-inner lsb-loading">
          <span class="lsb-item">Loading Vernal conditions…</span>
        </div>
      </div>
    );
  }

  const { label, icon } = describe(data.code, data.isDay);

  return (
    <div
      class="lsb"
      aria-label={`Current conditions in Vernal, Utah — observed ${data.observedAt} local time`}
      title={`Observed ${data.observedAt} local time · Source: Open-Meteo`}
    >
      {/* Every word lives in its own span so the phone breakpoint can drop the
          descriptors ("Wind", "Sunrise", …) from the visual row while leaving
          them in the accessibility tree — the emoji carries the meaning for
          sighted visitors, the label still carries it for screen readers. */}
      <div class="lsb-inner">
        <span class="lsb-item lsb-lead">
          <span class="lsb-icon" aria-hidden="true">
            {icon}
          </span>
          <span class="lsb-text">
            <span class="lsb-label">Vernal</span>
            <strong>{data.tempF}°F</strong>
            <span class="lsb-cond">{label}</span>
          </span>
        </span>
        <span class="lsb-item">
          <span class="lsb-icon" aria-hidden="true">
            💨
          </span>
          <span class="lsb-text">
            <span class="lsb-label">Wind</span>
            <span>{data.windMph} mph</span>
          </span>
        </span>
        <span class="lsb-item">
          <span class="lsb-icon" aria-hidden="true">
            🌅
          </span>
          <span class="lsb-text">
            <span class="lsb-label">Sunrise</span>
            <span>{data.sunrise}</span>
          </span>
        </span>
        <span class="lsb-item">
          <span class="lsb-icon" aria-hidden="true">
            🌇
          </span>
          <span class="lsb-text">
            <span class="lsb-label">Sunset</span>
            <span>{data.sunset}</span>
          </span>
        </span>
      </div>
    </div>
  );
}
