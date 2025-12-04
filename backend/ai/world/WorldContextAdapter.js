// WorldContextAdapter - lightweight integrations for meteo/news/festivities.
// Meteo: open-meteo (no key). News: public Reddit feed.

const fetch = require('node-fetch');

const DEFAULT_LAT = parseFloat(process.env.METEO_LAT || '41.9028'); // Rome
const DEFAULT_LON = parseFloat(process.env.METEO_LON || '12.4964');
const DEFAULT_CITY = process.env.METEO_CITY || 'Rome';

async function getWeather(user) {
  const lat = user?.lat || user?.latitude || DEFAULT_LAT;
  const lon = user?.lon || user?.longitude || DEFAULT_LON;
  const city = user?.city || DEFAULT_CITY;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const res = await fetch(url, { timeout: 2000 });
    const data = await res.json();
    if (!data?.current_weather) return null;
    const cw = data.current_weather;
    return {
      city,
      condition: cw.weathercode !== undefined ? `code_${cw.weathercode}` : 'unknown',
      temperature_c: cw.temperature,
      wind_kph: cw.windspeed,
    };
  } catch (_) {
    return null;
  }
}

async function getNews() {
  try {
    const url = 'https://www.reddit.com/r/news/top.json?limit=5&t=day';
    const res = await fetch(url, { timeout: 2000, headers: { 'User-Agent': 'thrillme-bot/1.0' } });
    const data = await res.json();
    const children = data?.data?.children || [];
    return children
      .map((c) => ({
        title: c?.data?.title,
        url: c?.data?.url,
        source: 'reddit/r/news',
      }))
      .filter((n) => n.title);
  } catch (_) {
    return [];
  }
}

async function getFestivities(date = new Date()) {
  // Return simple local festivities list based on calendar; stubbed for now.
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const formatted = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const map = {
    '12-25': 'natale',
    '12-31': 'capodanno',
    '02-14': 'san_valentino',
    '08-15': 'ferragosto',
  };
  return map[formatted] ? [map[formatted]] : [];
}

module.exports = {
  getWeather,
  getNews,
  getFestivities,
};
