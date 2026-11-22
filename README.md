# Event Search

## Run locally

Install the locked dependencies with `npm ci` in both `backend` and `frontend`. Set the following environment variables in the shell that starts the backend.

| Variable | Used for |
| --- | --- |
| `TICKETMASTER_API_KEY` | Event search, autocomplete, and event and venue details |
| `GOOGLE_GEOCODING_API_KEY` | Server-side lookups for city names and ZIP codes |
| `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` | Optional artist details |

Run `npm start` from `backend`, then run `npm start` from `frontend` and open `http://localhost:4200`. The Angular development server proxies API requests to Express on port 3000. Automatic location uses browser geolocation and requires permission. Outside localhost, serve the site over HTTPS to use it.

To serve a production build from Express, run `npm run build` in `frontend` and start the backend. Keep both folders together or set `FRONTEND_DIST` to the absolute path of the built Angular app when packaging the backend independently.

## App Engine deployment

The GitHub Actions workflow builds PRs and pushes targeting `recovered-web-baseline`. Once deployment is enabled, each merge deploys the resulting commit to the existing App Engine default service.

- Configure Google Workload Identity Federation for the GitHub repository and restrict the provider to this repository ID and `refs/heads/recovered-web-baseline`. Grant the deploy service account App Engine deployment and traffic promotion permissions, Cloud Build and staging bucket access, and Service Account User on the runtime identity.
- Set repository variables `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, and `GCP_DEPLOY_SERVICE_ACCOUNT`. Restrict the `app-engine-production` GitHub environment to the deployment branch.
- Set `TICKETMASTER_API_KEY` and `GOOGLE_GEOCODING_API_KEY` as environment secrets. Spotify credentials are optional environment secrets. Venue links open Google Maps without an API key. The deploy action passes these values to App Engine as runtime environment variables.
- Set repository variable `APP_ENGINE_DEPLOY_ENABLED` to `true` when the project and credentials are ready. The next merge will send production traffic to the new version.

## Location suggestions

The bundled city list is adapted from [GeoNames](https://www.geonames.org/export/)
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It includes U.S.
entries from the cities15000 extract, international cities with at least 100,000
residents, and national capitals. Suggestions are ranked by population.
