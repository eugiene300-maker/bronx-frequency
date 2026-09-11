'use strict';
// Search remains entirely on the reader's device. All stories are visible without JS.
const search = document.querySelector('#story-search');
const category = document.querySelector('#story-category');
if (search && category) {
  const stories = [...document.querySelectorAll('[data-story]')];
  const filter = () => {
    const words = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let count = 0;
    stories.forEach(story => {
      const match = (!category.value || story.dataset.category === category.value) && words.every(word => story.dataset.search.includes(word));
      story.hidden = !match;
      if (match) count++;
    });
    document.querySelector('#result-count').textContent = `${count} ${count === 1 ? 'story' : 'stories'}`;
    document.querySelector('#no-results').hidden = count > 0;
  };
  search.addEventListener('input', filter);
  category.addEventListener('change', filter);
}
// Preview confirmation only. No submission, storage or external request.
const feedback = document.querySelector('#feedback-form');
if (feedback) feedback.addEventListener('submit', event => {
  event.preventDefault();
  if (!feedback.reportValidity()) return;
  document.querySelector('#feedback-status').textContent = 'Thank you for your note. This preview does not send messages.';
});
// A fixed-location clock and forecast. No geolocation, account or API key required.
const localStatus = document.querySelector('[data-local-config]');
if (localStatus) {
  const config = JSON.parse(localStatus.dataset.localConfig);
  const dateEl = document.querySelector('#local-date');
  const timeEl = document.querySelector('#local-clock');
  const weatherEl = document.querySelector('#local-weather');
  const dateFormat = new Intl.DateTimeFormat('en-US', {timeZone: config.timezone, weekday:'long', month:'long', day:'numeric', year:'numeric'});
  const timeFormat = new Intl.DateTimeFormat('en-US', {timeZone: config.timezone, hour:'numeric', minute:'2-digit', timeZoneName:'short'});
  function tick() {
    const now = new Date();
    dateEl.textContent = dateFormat.format(now);
    dateEl.dateTime = now.toISOString();
    timeEl.textContent = timeFormat.format(now);
    timeEl.dateTime = now.toISOString();
    document.querySelectorAll('[data-current-year]').forEach(el => { el.textContent = new Intl.DateTimeFormat('en-US', {timeZone:config.timezone, year:'numeric'}).format(now); });
  }
  tick();
  setInterval(tick, 1000 * 30);
  let weatherBusy = false;
  let lastAttempt = 0;
  let forecastUrl = '';
  async function getJson(endpoint) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, {signal:controller.signal, headers:{Accept:'application/geo+json'}});
      if (!response.ok) throw new Error('Weather service unavailable');
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  async function updateWeather() {
    if (weatherBusy || document.hidden) return;
    weatherBusy = true;
    lastAttempt = Date.now();
    try {
      if (!forecastUrl) {
        const point = await getJson(`https://api.weather.gov/points/${config.latitude},${config.longitude}`);
        forecastUrl = point.properties?.forecastHourly || '';
        if (!forecastUrl.startsWith('https://api.weather.gov/')) throw new Error('Invalid forecast source');
      }
      const data = await getJson(forecastUrl);
      const now = Date.now();
      const periods = data.properties?.periods || [];
      const period = periods.find(p => new Date(p.startTime).getTime() <= now && new Date(p.endTime).getTime() > now);
      if (!period || typeof period.temperature !== 'number') throw new Error('Current forecast unavailable');
      const generated = Date.parse(data.properties.updateTime || data.properties.generatedAt || '');
      if (!Number.isFinite(generated) || now - generated > 24 * 60 * 60 * 1000) throw new Error('Forecast is stale');
      weatherEl.textContent = `${Math.round(period.temperature)}°${period.temperatureUnit} · ${period.shortForecast} · Forecast`;
      weatherEl.title = `National Weather Service hourly forecast for ${config.location}. Forecast updated ${timeFormat.format(new Date(generated))}. Refreshes every 15 minutes.`;
      weatherEl.dataset.weatherState = 'ready';
    } catch {
      weatherEl.textContent = 'Weather unavailable · NWS ↗';
      weatherEl.title = 'Open the National Weather Service forecast. Automatic refresh will try again.';
      weatherEl.dataset.weatherState = 'unavailable';
    } finally { weatherBusy = false; }
  }
  weatherEl.textContent = 'Loading weather…';
  updateWeather();
  setInterval(updateWeather, 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { tick(); if (Date.now() - lastAttempt > 15 * 60 * 1000) updateWeather(); }
  });
}
// A searchable 30-place directory. Policy labels are not experience ratings.
const placeSearch = document.querySelector('#place-search');
if (placeSearch) {
  const category = document.querySelector('#place-category');
  const neighborhood = document.querySelector('#place-neighborhood');
  const policy = document.querySelector('#place-policy');
  const places = [...document.querySelectorAll('[data-place]')];
  const filter = () => {
    const words = placeSearch.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let count = 0;
    places.forEach(place => {
      const show = words.every(word => place.dataset.search.includes(word)) && (!category.value || category.value === place.dataset.category) && (!neighborhood.value || neighborhood.value === place.dataset.neighborhood) && (!policy.value || policy.value === place.dataset.policy);
      place.hidden = !show;
      if (show) count++;
    });
    document.querySelector('#place-count').textContent = `${count} ${count === 1 ? 'attraction' : 'attractions'}`;
    document.querySelector('#place-empty').hidden = count !== 0;
  };
  placeSearch.addEventListener('input', filter);
  [category, neighborhood, policy].forEach(el => el.addEventListener('change', filter));
  document.querySelector('#reset-guide').addEventListener('click', () => { placeSearch.value=''; category.value=''; neighborhood.value=''; policy.value=''; filter(); placeSearch.focus(); });
}
