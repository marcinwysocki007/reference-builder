# Deploy auf Render

Schritt-für-Schritt zum Live-Tool. Du brauchst ~30 Minuten + zwei Accounts:

- **GitHub-Account** (für den Code)
- **Render-Account** ([render.com](https://render.com), kostenlos anlegen)

## 1. GitHub-Repo anlegen

1. Geh auf [github.com/new](https://github.com/new)
2. **Repository name**: z.B. `pk-referenzen`
3. **Private** auswählen (wichtig — Code enthält Branding)
4. Nicht README/license/.gitignore initialisieren (haben wir schon)
5. „Create repository"
6. Auf der nächsten Seite siehst du die SSH-/HTTPS-URL, kopiere die

Dann im Terminal vom Projektordner:

```bash
git remote add origin <DEINE-REPO-URL>
git branch -M main
git push -u origin main
```

## 2. Render Blueprint Deploy

1. Auf [dashboard.render.com](https://dashboard.render.com) einloggen
2. **„New" → „Blueprint"** klicken
3. **„Connect GitHub"** falls noch nicht verbunden — Render-App in GitHub installieren und Zugriff auf das Repo geben
4. Repo `pk-referenzen` auswählen → **„Connect"**
5. Render liest `render.yaml` und schlägt zwei Ressourcen vor:
   - **Postgres-DB** `pk-referenzen-db` (Free Plan, 90 Tage Trial)
   - **Web Service** `pk-referenzen` (Starter Plan, $7/Monat)
6. **„Apply"** klicken
7. Beide Ressourcen werden erstellt. **Web Service braucht noch einen API-Key:**
   - Auf den Service klicken → **„Environment"** in der Sidebar
   - Bei `ANTHROPIC_API_KEY`: **„Add value"** → deinen neuen Anthropic-Key einfügen
     - (Falls du noch keinen hast: [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys))
   - **„Save Changes"** — der Deploy startet jetzt automatisch
8. Warten (~5-7 Min für den ersten Build). Logs siehst du live.
9. Wenn Status = **„Live"**, klicke oben auf die URL (z.B. `pk-referenzen.onrender.com`)

## 3. Erster Smoke Test

- Öffne die URL → du siehst die leere Caregivers-Liste (sauberer Start, keine alten Daten)
- „+ Neue Pflegekraft" → Profil-PDF hochladen oder Name eintippen
- Foto + Dokumente hochladen
- Sektion-PDF erstellen → sollte runtergeladen werden

## 4. Beim Tester verteilen

- Schick einfach die URL an die Tester
- **Achtung**: aktuell ohne Auth — wer die URL hat, sieht alles und kann alles. Ist OK für Test-Kreis von 2-5 vertrauten Leuten.
- Wenn Auth nötig: in einem Folgeschritt (NextAuth oder Basic-Pass) — sag Bescheid

## Wichtige Kosten

- Render Web Service Starter: **$7/Monat** (inkl. 24/7 uptime, kein Spin-Down)
- Render Persistent Disk (1 GB): **$0.25/Monat**
- Render Postgres Free: **$0** für 90 Tage, danach **$7/Monat** (basic-256mb)
- Anthropic API: **~$0.05-0.15 pro Dokument** je nach Größe (Opus für Vision-PII ist der teure Posten)

Grobe Monats-Schätzung: ~$15-20 fix + API-Verbrauch.

## Updates

Jeder `git push` auf `main` löst automatisch einen neuen Deploy aus. Schema-Änderungen (Prisma) werden beim Build per `prisma db push` angewandt — bei additiven Changes ohne Datenverlust, bei destruktiven verweigert Prisma den Deploy und du musst manuell migrieren.

## Troubleshooting

**Build schlägt fehl mit `sharp`-Fehler**: Render-Linux braucht die Linux-Binaries. Sind als optionalDependencies in `package.json` — falls trotzdem Probleme: in der Render-Service-Shell `npm rebuild sharp` laufen lassen.

**Build schlägt fehl mit `prisma db push`**: meist DB nicht ready. Service → Manual Deploy → Clear build cache.

**Funktion läuft in Timeout**: Render Web Services haben kein Timeout-Limit. Falls trotzdem 502 nach 90s: prüfen ob die Anthropic-API antwortet oder den Key kontingent gerast hat.

**Foto-Uploads landen nicht im persistenten Storage**: prüfen ob `STORAGE_DIR=/var/data/storage` gesetzt ist und das Disk-Mount in der Service-Übersicht erscheint.
