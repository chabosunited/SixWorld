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