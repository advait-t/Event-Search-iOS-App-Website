# Event Search

## Run locally

Install the locked dependencies with `npm ci` in both `backend` and `frontend`. Set the following environment variables in the shell that starts the backend.

| Variable | Used for |
| --- | --- |
| `TICKETMASTER_API_KEY` | Event search, autocomplete, and event and venue details |
| `GOOGLE_GEOCODING_API_KEY` | Server-side lookups for city names and ZIP codes |
| `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` | Optional artist details |
| `GOOGLE_MAPS_BROWSER_KEY` | Optional venue maps. Use a separate browser key with HTTP referrer and Maps JavaScript API restrictions. |

Run `npm start` from `backend`, then run `npm start` from `frontend` and open `http://localhost:4200`. The Angular development server proxies API requests to Express on port 3000. Automatic location uses browser geolocation and requires permission. Outside localhost, serve the site over HTTPS to use it.

To serve a production build from Express, run `npm run build` in `frontend` and start the backend. Keep both folders together or set `FRONTEND_DIST` to the absolute path of the built Angular app when packaging the backend independently.
