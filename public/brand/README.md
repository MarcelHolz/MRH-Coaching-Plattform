# Marken-Bildmaterial

Dieser Ordner ist gitignored bis auf diese Datei — die eigentlichen
Bilddateien werden bewusst nicht versioniert (Marcels persönliche Fotos,
kein Grund sie im Repo zu duplizieren, wenn sie schon auf mrh-beratung.de
liegen).

Bitte folgende drei Dateien manuell hier ablegen (Dateinamen exakt so
beibehalten, sie werden im Code referenziert):

| Datei | Quelle | Verwendung |
| --- | --- | --- |
| `marcel-blazer.webp` | https://mrh-beratung.de/storage/1/Marcel_blauer_Blazer_optimiert.webp | Coachie-Login (rechte Spalte), Hero-Kachel im Dashboard |
| `marcel-hemd.webp` | https://mrh-beratung.de/storage/2/Marcel_weisses-Hemd_optimiert.webp | Passwort-festlegen-Seite, Sidebar der Programm-Detailseite |
| `cashmor-cover.png` | https://mrh-beratung.de/storage/6/book-cover-CIdx-O2m.png | optional, aktuell nicht eingebunden |

Claude Code konnte diese Dateien nicht automatisch herunterladen — der
Netzwerkzugriff auf `mrh-beratung.de` ist in der Sandbox-Umgebung
blockiert. Solange die Dateien fehlen, zeigen die Seiten an den
entsprechenden Stellen ein gebrochenes Bild-Icon statt des Fotos; der
Rest der Seite funktioniert trotzdem normal.
