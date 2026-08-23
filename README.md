# SIXWORLD v13

Compact desktop map update.

- Shorter interactive map viewport on desktop
- Side panels no longer force full viewport height
- Compact filter/info boxes
- Smaller Recently Discovered strip
- Map remains draggable and zoomable inside the shorter viewport

# SIXWORLD v11

## Änderungen in v11

- Map-Seite auf Desktop breiter und randfüllender: linkes Filterpanel und rechtes Detailpanel wurden vergrößert, die mittlere Karte nutzt den verfügbaren Platz.
- Website-Hintergrund jetzt mit 90% dunkel-navy Overlay; das Hintergrundbild bleibt nur noch dezent sichtbar.
- Komplett eigenes SVG-Icon-System für Districts, Landmarks, Activities, Shops, Safehouses, Secrets und Transport.
- Eigene Icons werden in Filtern, Blips, Legende, Recently Discovered und im Admin-Map-Editor verwendet.
- Map-Toolbar repariert: Plus/Minus zoomen per Klick, Layers blendet Marker ein/aus, Fullscreen schaltet die Karte in Vollbild.
- Map-Tool-Klicks starten nicht mehr versehentlich den Drag-Modus.
- Cache-Buster auf v11 erhöht.

Diese Version baut auf dem funktionierenden v8 Admin-Editor auf und enthält das neue Map-Layout sowie die neuen Assets.

## Neu in v9

- dunklerer Website-Hintergrund
- dünne weiß/silberne Rahmen um Hero, Panels, Cards und Map-Elemente
- Datums-/Meta-Untertexte in Pink/Hell-Lila
- Footer Counter: `VISITORS: X (Y HITS)`
  - Visitors = neue Browser-Besucher (Cookie-basiert)
  - Hits = Klicks auf Website-Links, Buttons, Navigation, Map-Locations usw.
- neue Interactive-Map-Seite im Referenz-Aufbau:
  - links Map Filters
  - Mitte große Leonida Map
  - Leonida Logo oben links in der Map
  - Marker mit Kategorien
  - Recently Discovered unter der Map
  - rechts Location-Detailkarte mit Bild, Beschreibung, Tags und Fakten
  - Map Legend
- Admin Panel für neue Map erweitert:
  - Location Image
  - Region
  - District
  - Points of Interest
  - Discovered Date
  - Tags
  - Featured
  - Kategorie
  - Position X/Y
  - Map Logo / Map Updated Date
- alte Asset-Pfade aus D1 werden automatisch auf die neuen kürzeren Dateinamen migriert.

## Bestehende Cloudflare/D1 Installation

Du musst deine bestehende `site_content` Tabelle nicht neu erstellen.

Der neue `/api/stats` Endpoint legt die `site_stats` Tabelle beim ersten Aufruf automatisch an.

Optional kannst du `migration_v9.sql` einmal in der D1 Console ausführen.

## Deployment

Den kompletten Inhalt dieser Version in dein vorhandenes GitHub Repo hochladen und vorhandene Dateien ersetzen. Cloudflare Pages deployed danach automatisch.

Anschließend im Browser einmal `Strg + F5` ausführen.

## Wichtig zu D1

Deine bereits vorhandenen Inhalte bleiben erhalten. Beim Laden werden alte Asset-Namen clientseitig auf die neuen Dateinamen angepasst. Sobald du danach im Admin Panel speicherst, werden die normalisierten Daten auch wieder in D1 gespeichert.

## v10 – Map desktop + mobile layout fix

- Desktop map center column now follows the actual 2048×1402 map aspect ratio, so the map panel no longer has large unused side gutters.
- Left filter panel and right location panel sit closer to the reference composition.
- Mobile map page rebuilt to match the supplied mobile reference:
  - logo + search + profile + burger in the top bar
  - Map / Explore Leonida heading
  - compact horizontal filter chips
  - tall, centered map viewport that crops only the empty dark margins of the landscape source map
  - Selected Location card directly below the map
  - Map Legend card below the selected location
  - desktop Recently Discovered carousel hidden on mobile for a cleaner reference-style layout
- Mobile Filters button expands/collapses the full filter set.
## v12 changes

- Admin Interactive Map now supports wheel zoom and + / - / reset controls.
- Admin map can be panned while zoomed; a short click on an empty map position creates a new location.
- Map markers live inside the transformed map stage, so marker size and position scale together with the map in public and admin views.
- Browser-native dragging of the public map image is disabled so map panning no longer drags the image file.
- Public right-click/context menu and casual media dragging are disabled as a deterrent against simple asset saving. This is not DRM and cannot technically prevent a determined visitor from saving browser-delivered assets.

## v15 Reddit Live Feeds

The News page now pulls new posts automatically from:
- r/GTA6unmoderated
- r/GTA6_NEW

The Cloudflare Pages Function `functions/api/feed/reddit.js` uses the public Atom/RSS feeds and combines both subreddits into one newest-first stream. The Admin Panel now supports multiple subreddit names under Settings → Feed Configuration. Enter one subreddit per line or separate them by commas.


## v16 fixes
- Deleting all map locations in the Admin Panel now stays deleted; demo blips are no longer silently recreated.
- Recently Discovered is generated only from the currently saved map locations.
- Home shows up to 5 Leak items and up to 5 Latest News items instead of 3.


## v17 — Community Mapping Locations

SIXWORLD now includes an approximate community-map layer with around 60 editable locations researched from the GTA VI Mapping Community / State of Leonida and public GTA VI location research.

Included types:
- districts / cities
- landmarks
- shops / businesses
- activities
- safehouses / properties
- transport
- secrets

The positions are approximate fan placements on SIXWORLD's own supplied map and are not official Rockstar coordinates.

The layer is automatically merged into the public map. In **Admin Panel → Interactive Map** you can:
- edit every imported location
- drag markers to improve their placement
- delete individual community locations permanently
- restore the full community set
- disable the automatic community-map layer

Deleting an imported community marker adds it to an exclusion list so it does not reappear on the next reload.


## v18 — Slider Media, Background & Language

- Website background can be changed in **Admin Panel → Settings** using an asset path or image URL.
- Every Hero Slide now has its own duration in seconds.
- Hero Slides can be either an image or a muted autoplay video. Supported inputs include YouTube, Streamable, Vimeo, direct MP4/WebM and embeddable URLs.
- The Home-page Interactive Map card is larger on wide desktop layouts.
- Main cards use a stronger silver/metallic border treatment.
- Public interface text is English by default.
- Header language selector switches between English and German without an external translation API. Static interface text is translated locally for speed and reliability; external feed/post titles remain in their source language.

## v19 — Guest Comments, Replies & Video Views

- Video cards now show view counts.
- For Streamable links, SIXWORLD attempts to read the public Streamable view count. If that is unavailable, the SIXWORLD D1 counter is used as a fallback.
- Opening videos/screenshots also increments SIXWORLD's own media counter.
- Videos and screenshots now have guest comment threads.
- Visitors only choose a nickname; no registration, email or password is required.
- The nickname is stored locally in the browser (`localStorage`). Clearing browser/site data removes it, and the visitor may choose the same nickname again later.
- Replies to other comments are supported.
- Reserved identity-like nicknames such as Admin, Administrator, SixWorld, Moderator, Staff, Support and similar variants are blocked server-side and client-side.
- Admin Panel → Comments lets administrators review and delete comments. Deleting a parent comment also removes its replies.
- Public commenting is rate-limited server-side to reduce simple spam.

### D1
The required tables are created automatically by the Cloudflare Functions on first use. `migration_v19.sql` is also included if you prefer to create them manually:

```bash
npx wrangler d1 execute sixworld-db --remote --file=migration_v19.sql
```


## v20 — Ordering, Home Map & Persistent Views

- Hero Slides, Videos/Leaks and Screenshots can be reordered by drag-and-drop in the Admin Panel.
- The Home map now uses the actual saved map blips and the same category icons as the full Interactive Map.
- Profile buttons were removed from desktop and mobile navigation.
- Video and screenshot views are backed by D1 website views. For Streamable videos the highest successfully observed Streamable count is cached permanently in D1, so the visible count cannot fall back to zero when Streamable is temporarily unavailable.
- Screenshot cards now also show their SIXWORLD view count.
- The grain/noise overlay has been removed from the website background.

Existing v19 D1 installs do not need a manual migration; the API attempts to add the new column automatically. `migration_v20.sql` is included for optional manual use.


## v21 — Mobile Layout Hotfix

v20 introduced late desktop CSS rules that overrode the existing mobile Home layout. v21 restores a strict responsive mobile layout:

- logo, language, search and burger stay on one header row;
- Home dashboard cards are stacked vertically at <= 920px;
- no horizontal page scrolling / card overlap;
- Hero stays inside the viewport;
- mobile Interactive Map preview has a fixed, sensible height and uses `object-fit: contain`;
- screenshots remain a two-column mobile gallery;
- leak/news rows use compact mobile dimensions.


## v22 — Screenshot Download Button

Added a dedicated **Download** button for screenshots only (not videos).

- Screenshot lightbox now shows a `DOWNLOAD` button.
- The button downloads the currently opened screenshot using its title as the filename when possible.
- Videos remain view-only and do not show a download action.
- Includes EN/DE label support (`DOWNLOAD` / `HERUNTERLADEN`).
