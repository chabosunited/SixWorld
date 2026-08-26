# SIXWORLD Cloudflare Deployment Guide

## 1) Was du brauchst

- ein Cloudflare Konto
- dein GitHub Repo oder den lokalen Projektordner
- Node.js auf deinem PC
- optional: Wrangler CLI

Du kannst die Seite entweder:

1. über **GitHub + Cloudflare Pages** deployen
2. oder per **Wrangler Pages Deploy** hochladen

Für dich ist **GitHub + Cloudflare Pages** am einfachsten.

---

## 2) D1 Datenbank erstellen

### Im Cloudflare Dashboard

1. Öffne Cloudflare
2. Gehe zu **Workers & Pages**
3. Gehe zu **D1 SQL Database**
4. Klicke auf **Create**
5. Name z. B.:
   - `sixworld-db`
6. Notiere dir die **Database ID**

---

## 3) wrangler.toml vorbereiten

1. Kopiere `wrangler.toml.example` zu `wrangler.toml`
2. Trage deine echte Database ID ein

Beispiel:

```toml
name = "sixworld"
compatibility_date = "2026-08-01"
pages_build_output_dir = "."

[[d1_databases]]
binding = "DB"
database_name = "sixworld-db"
database_id = "DEINE_ECHTE_D1_ID"
```

---

## 4) Datenbank initialisieren

Im Projektordner ausführen:

```bash
npx wrangler d1 execute sixworld-db --remote --file=schema.sql
npx wrangler d1 execute sixworld-db --remote --file=seed.sql
```

Damit werden:

- die Tabelle angelegt
- die Startdaten importiert

---

## 5) Admin Passwort Hash erzeugen

Im Projekt ist ein Helfer enthalten:

```bash
node tools/generate-admin-password-hash.mjs "DEIN_PASSWORT"
```

Der ausgegebene Wert ist dein `ADMIN_PASSWORD_HASH`.

---

## 6) Cloudflare Pages Projekt erstellen

### Variante A – GitHub empfohlen

1. Öffne **Workers & Pages**
2. Klicke **Create application**
3. **Pages** auswählen
4. **Connect to Git**
5. GitHub Repo auswählen
6. Build-Konfiguration:
   - Framework preset: **None**
   - Build command: **leer lassen**
   - Build output directory: `.`

Dann Projekt erstellen.

---

## 7) D1 Binding an Pages Projekt hängen

In deinem Pages Projekt:

1. **Settings** öffnen
2. **Functions** öffnen
3. Bereich **D1 bindings**
4. Binding hinzufügen:
   - Variable name: `DB`
   - D1 database: `sixworld-db`

Wichtig: der Binding-Name muss exakt **DB** heißen.

---

## 8) Environment Variablen setzen

In deinem Pages Projekt:

1. **Settings**
2. **Variables and Secrets**
3. folgende Werte anlegen

### Pflicht

- `ADMIN_SESSION_SECRET`
  - langer zufälliger String
- `ADMIN_USERNAME`
  - z. B. `admin`
- `ADMIN_PASSWORD_HASH`
  - der SHA-256 Hash aus Schritt 5

### Optional

- `X_BEARER_TOKEN`
  - nur wenn der X Feed funktionieren soll

Du kannst alternativ statt `ADMIN_PASSWORD_HASH` auch `ADMIN_PASSWORD` setzen, aber **Hash ist besser**.

---

## 9) Deploy starten

Wenn du GitHub verbunden hast:

1. Projektdateien in dein GitHub Repo hochladen
2. Commit + Push machen
3. Cloudflare deployed dann automatisch

Beispiel:

```bash
git add .
git commit -m "SIXWORLD final"
git push
```

---

## 10) Website testen

Nach dem Deploy:

- Startseite prüfen
- Map Seite öffnen
- unten kleinen Trigger anklicken
- Admin Login testen

Dann mit deinen Admin-Daten einloggen.

---

## 11) Inhalte dauerhaft speichern

Sobald deine Seite online ist und das D1 Binding aktiv ist:

- Änderungen im Admin Panel werden per API gespeichert
- die Inhalte landen in D1
- Besucher sehen die Änderungen live

---

## 12) Falls X Feed nicht funktioniert

Dann ist meistens eines davon die Ursache:

- `X_BEARER_TOKEN` fehlt
- Token ist ungültig
- X API Zugriff ist eingeschränkt

Die Seite funktioniert trotzdem weiter mit:

- manuellen News
- Reddit Feed

---

## 13) Lokaler Demo Login

Im lokalen Preview ist standardmäßig:

- User: `admin`
- Passwort: `sixworld`

Online solltest du eigene sichere Zugangsdaten setzen.

---

## 14) Eigene Domain verbinden

Wenn die Seite in Cloudflare Pages online ist:

1. Pages Projekt öffnen
2. **Custom domains**
3. Domain hinzufügen
4. z. B.:
   - `sixworld.de`
   - `www.sixworld.de`

Cloudflare zeigt dir dann die nötigen DNS-Schritte an.

---

## 15) Reihenfolge kurz zusammengefasst

1. D1 Datenbank erstellen
2. Database ID in `wrangler.toml` eintragen
3. `schema.sql` ausführen
4. `seed.sql` ausführen
5. Admin Passwort Hash erzeugen
6. Pages Projekt erstellen
7. D1 Binding `DB` hinzufügen
8. Variablen/Secrets setzen
9. Repo deployen
10. Admin Login testen

## v19 guest comments / media views

No additional Cloudflare binding is required beyond the existing `DB` D1 binding.
The new Functions create their tables automatically on first use.

Optional manual migration:

```bash
npx wrangler d1 execute sixworld-db --remote --file=migration_v19.sql
```

No separate user-account service is used. Guest nicknames are stored only in the visitor's browser and attached to public comments in D1.


## v27 — GitHub content backup

To enable the automatic GitHub backup in **Admin Panel → Settings → Backups & Static Fallback**:

1. Create a GitHub fine-grained Personal Access Token.
2. Limit repository access to `chabosunited/SixWorld`.
3. Give it **Contents: Read and write** permission.
4. Cloudflare → Workers & Pages → sixworld → Settings → Variables and secrets → Add.
5. Name: `GITHUB_TOKEN`
6. Type: Secret
7. Paste the token as its value.
8. Save and deploy once.

Optional environment variables (not required because v27 has sensible defaults):
- `GITHUB_REPO=chabosunited/SixWorld`
- `GITHUB_BRANCH=main`
- `GITHUB_CONTENT_PATH=data/content.json`

Security:
- Never put the GitHub token inside `wrangler.toml`, JavaScript, GitHub files, or the browser.
- The token is used only inside the authenticated server-side `/api/admin/github-backup` Pages Function.
