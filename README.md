# SIXWORLD v3

Professionelle GTA VI Fan-Website im Stil deiner Referenz.

## Highlights

- Startseite im SIXWORLD / GTA VI Stil
- Hero/Header als automatische Slideshow
- Seiten für Home, Leaks, Screenshots, News und Map
- Video-Einbindung per Streamable, Google Drive, YouTube oder direktem MP4/WebM-Link
- Screenshot-Galerie aus lokalen Assets und externen URLs
- News-Bereich mit manuellen Einträgen plus Live-Feeds für Reddit und X
- Interaktive Map mit Zoom, Drag, Filter-Chips, Legende und Blip-Detailbox
- Versteckter Admin-Zugang auf der Map-Seite
- Vollwertiges Admin Panel zum Verwalten von Hero, Videos, Screenshots, News, Map, Settings und Access
- Live-Feed-Import direkt im Admin Panel
- Cloudflare Pages + Functions + D1 vorbereitet

## Lokaler Demo-Zugang

Map-Seite öffnen und unten den kleinen Trigger anklicken:

- Trigger: `sw_6.0.22`
- Benutzer: `admin`
- Passwort: `sixworld`

## D1 / Deployment

1. D1-Datenbank anlegen
2. `wrangler.toml.example` mit deiner Datenbank-ID ausfüllen
3. Schema ausführen
4. Seed-Daten importieren
5. Environment-Variablen setzen

### Schema importieren

```bash
npx wrangler d1 execute sixworld-db --remote --file=schema.sql
```

### Seed-Daten importieren

```bash
npx wrangler d1 execute sixworld-db --remote --file=seed.sql
```

### Benötigte Environment Variablen

- `ADMIN_SESSION_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH` oder alternativ `ADMIN_PASSWORD`
- `X_BEARER_TOKEN` (optional, nur für X Feed)

Wenn `X_BEARER_TOKEN` nicht gesetzt ist, laufen die Reddit-Feeds trotzdem weiter und die manuell gepflegten News bleiben sichtbar.

## v8 Admin edit/save fix

The content editor was rebuilt so Hero Slides, Leaks/Videos, Screenshots and News all use the same delegated update handler. UPDATE CONTENT now writes the edited record to D1 immediately, uses the persisted D1 response as the source of truth, and shows a visible publish status. Cache-busting is v8.
