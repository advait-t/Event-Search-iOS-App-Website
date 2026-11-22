const express = require('express');
const axios = require('axios');
const cors = require('cors');
const geohash = require('ngeohash');
const path = require('path');
const SpotifyWebApi = require('spotify-web-api-node');

const app = express();
const port = process.env.PORT || 3000;
const frontend = process.env.FRONTEND_DIST || path.join(__dirname, '../frontend/dist/web-tech-hw9');
const http = axios.create({ timeout: 8000 });
app.use(cors());
const segments = new Map([
  ['music', 'KZFzniwnSyZfZ7v7nJ'],
  ['sports', 'KZFzniwnSyZfZ7v7nE'],
  ['art', 'KZFzniwnSyZfZ7v7na'],
  ['film', 'KZFzniwnSyZfZ7v7nn'],
  ['miscellaneous', 'KZFzniwnSyZfZ7v7n1']
]);

function route(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      // Axios errors can contain credentials in request configuration.
      console.error('Upstream request failed', req.route.path, error.response?.status);
      res.status(502).json({ message: 'An event data provider is temporarily unavailable.' });
    }
  };
}

async function ticketmaster(resource, params) {
  const apikey = process.env.TICKETMASTER_API_KEY;
  if (!apikey) throw new Error('Missing Ticketmaster configuration');
  const response = await http.get('https://app.ticketmaster.com/discovery/v2/' + resource, {
    params: { ...params, apikey }
  });
  return response.data;
}

function query(req, name) {
  return typeof req.query[name] === 'string' ? req.query[name].trim() : '';
}

function coordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

app.get('/autocomplete', route(async (req, res) => {
  const keyword = query(req, 'keyword');
  if (!keyword) return res.json([]);
  const data = await ticketmaster('suggest', { keyword });
  const suggestions = (data._embedded?.attractions ?? []).slice(0, 5);
  res.json(suggestions.map(artist => artist.name).filter(Boolean));
}));

app.get('/venue_details', route(async (req, res) => {
  const keyword = query(req, 'venue_name');
  if (!keyword) return res.status(400).json({ message: 'A venue name is required.' });
  const data = await ticketmaster('venues.json', { keyword });
  const venue = data._embedded?.venues?.[0];
  if (!venue) return res.status(404).json({ message: 'Venue details are unavailable.' });
  res.json({
    venue_name: venue.name,
    address: venue.address?.line1,
    city: venue.city?.name,
    state: venue.state?.name,
    postal_code: venue.postalCode,
    phone: venue.boxOfficeInfo?.phoneNumberDetail,
    open_hours: venue.boxOfficeInfo?.openHoursDetail,
    general_rule: venue.generalInfo?.generalRule,
    child_rule: venue.generalInfo?.childRule,
    latitude: parseFloat(venue.location?.latitude),
    longitude: parseFloat(venue.location?.longitude)
  });
}));

app.get('/spotify_artist_info', route(async (req, res) => {
  const artistName = query(req, 'artist_name');
  if (!artistName) return res.status(400).json({ message: 'An artist name is required.' });
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(503).json({ message: 'Artist details are unavailable.' });

  const spotify = new SpotifyWebApi({ clientId, clientSecret });
  const auth = await spotify.clientCredentialsGrant();
  spotify.setAccessToken(auth.body.access_token);

  const results = await spotify.searchArtists(artistName);
  const artist = results.body.artists.items[0];
  if (!artist) return res.status(404).json({ message: 'Artist details are unavailable.' });

  const albums = await spotify.getArtistAlbums(artist.id);
  res.json({
    name: artist.name,
    followers: artist.followers?.total?.toLocaleString(),
    popularity: artist.popularity,
    genres: artist.genres,
    artist_url: artist.external_urls?.spotify,
    icon: artist.images?.[0]?.url,
    artist_id: artist.id,
    album_covers: albums.body.items.map(album => album.images?.[0]?.url).filter(Boolean).slice(0, 3),
    artist_image: artist.images?.[0]?.url
  });
}));

app.get('/event_details', route(async (req, res) => {
  const eventId = query(req, 'event_id');
  if (!eventId) return res.status(400).json({ message: 'An event ID is required.' });

  const data = await ticketmaster('events/' + encodeURIComponent(eventId) + '.json');
  const artists = data._embedded?.attractions ?? [];
  const classification = data.classifications?.[0];
  const start = data.dates?.start;
  res.json({
    event_id: data.id ?? eventId,
    artist_list: artists.map(artist => artist.name).filter(Boolean),
    date: start?.localDate ?? '',
    time: start?.localTime ?? '',
    name1: data.name ?? '',
    artist: artists[0]?.name ?? '',
    artist_url: artists[0]?.url ?? '',
    venue: data._embedded?.venues?.[0]?.name ?? '',
    segment: classification?.segment?.name ?? '',
    subgenre: classification?.subGenre?.name ?? '',
    genre: classification?.genre?.name ?? '',
    subtype: classification?.subType?.name ?? '',
    type: classification?.type?.name ?? '',
    price_min: data.priceRanges?.[0]?.min ?? '',
    price_max: data.priceRanges?.[0]?.max ?? '',
    ticketstatus: data.dates?.status?.code ?? '',
    buy_ticket_at: data.url ?? '',
    seatmap: data.seatmap?.staticUrl ?? '',
    music_related: classification?.segment?.name ?? ''
  });
}));

app.get('/events', route(async (req, res) => {
  const keyword = query(req, 'keyword');
  const location = query(req, 'location');
  const category = query(req, 'category');
  const radius = Number(query(req, 'distance') || '10');
  if (!keyword || !location || !Number.isFinite(radius) || radius <= 0 ||
      (category && category !== 'default' && !segments.has(category)) ||
      ['distance', 'category'].some(name => req.query[name] !== undefined && typeof req.query[name] !== 'string')) {
    return res.status(400).json({ message: 'Enter a keyword, location, valid category, and positive distance.' });
  }

  let lat;
  let lng;
  const numericPair = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(location);
  if (numericPair) {
    lat = Number(numericPair[1]);
    lng = Number(numericPair[2]);
  } else {
    const key = process.env.GOOGLE_GEOCODING_API_KEY;
    if (!key) return res.status(503).json({ message: 'Location lookup is unavailable.' });
    const { data } = await http.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address: location, key }
    });
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return res.status(502).json({ message: 'Location lookup is temporarily unavailable.' });
    }
    lat = data.results?.[0]?.geometry?.location?.lat;
    lng = data.results?.[0]?.geometry?.location?.lng;
  }
  if (!coordinates(lat, lng)) {
    return res.status(400).json({ message: 'Location could not be resolved. Enter a city or ZIP code.' });
  }

  const data = await ticketmaster('events.json', {
    keyword,
    segmentId: segments.get(category),
    radius,
    unit: 'miles',
    geoPoint: geohash.encode(lat, lng)
  });
  res.json((data._embedded?.events ?? []).map(event => ({
    name: event.name,
    date: event.dates?.start?.localDate,
    time: event.dates?.start?.localTime,
    venue: event._embedded?.venues?.[0]?.name,
    icon: event.images?.[0]?.url,
    genre: event.classifications?.[0]?.segment?.name,
    event_id: event.id
  })));
}));

app.get('/maps-config', (req, res) => {
  // This key is public by design and must be restricted to the site's browser origins.
  res.json({ key: process.env.GOOGLE_MAPS_BROWSER_KEY || '' });
});

app.use(express.static(frontend));
app.get('/favourites', (req, res) => res.sendFile(path.resolve(frontend, 'index.html')));

app.listen(port, () => {
  console.log('Server listening on port ' + port);
});
