# AOG Feldeditor

🇬🇧 [English version](README.md)

Ein Editor im Browser für Felder aus [AgOpenGPS](https://github.com/AgOpenGPS-Official/AgOpenGPS). Er öffnet den Feldordner direkt, zeigt alles auf einem Satellitenbild und schreibt die Dateien im Format von AgOpenGPS zurück. Ein Umweg über KML ist nicht nötig.

**▶ Hier direkt benutzen: https://skafuu.github.io/aog-feldeditor/**

Der Editor ist **eine einzige HTML-Datei**. Er braucht keine Installation und keinen Server und schickt keine Felddaten ins Internet. Aus dem Internet lädt er nur die Kartenbilder und die Kartenbibliothek [Leaflet](https://leafletjs.com/). Die Oberfläche gibt es auf **Deutsch und Englisch**: Sie richtet sich nach der Sprache des Browsers und lässt sich oben mit **DE | EN** umschalten.

## Funktionen

**Schlaggrenze bearbeiten**
- Jeder Punkt ist auf dem Satellitenbild sichtbar und lässt sich verschieben, einfügen (Klick auf die Linie) oder löschen (Rechtsklick oder Entf). Strg+Z macht den letzten Schritt rückgängig.
- Außen- und Innengrenzen werden unterstützt.
- „Ausdünnen“ entfernt überflüssige Punkte.
- Beim Speichern wird die Grenze so aufbereitet, wie AgOpenGPS sie selbst speichert: Punktabstand, Umlaufrichtung und Richtung jedes Punkts. Nur dann berechnet AgOpenGPS daraus eine korrekte Wendelinie.
- Grenzen mit zu wenigen Punkten erkennt der Editor beim Öffnen und repariert sie beim Speichern.

**Fahnen**
- Fahnen setzen, verschieben und löschen, Farbe und Notiz ändern.

**Feld-Ursprung (StartFix)**
- Der Ursprung lässt sich in die Feldmitte oder an eine beliebige Stelle verschieben. Alle Dateien im Feldordner werden dabei mit umgerechnet: Grenze, Vorgewende, Spuren, bearbeitete Fläche, Fahrgassen, Pfade, Höhendaten und Hintergrundbild.
- Ein Kreis zeigt die 500 m, in denen „Drive In“ das Feld findet. „Drive In“ zeigt ein Feld nur an, wenn du höchstens 500 m vom StartFix entfernt bist, also von der Stelle, an der beim Anlegen „Neu“ gedrückt wurde.

**Anzeigen**
- Alles, was das Feld enthält, lässt sich einzeln ein- und ausblenden:
  - bearbeitete Fläche, mit ha-Angabe
  - AB-Linien und Kurven
  - Vorgewende und Vorgewende-Linien
  - Fahrgassen
  - Kontur
  - aufgezeichneter Pfad
  - das Hintergrundbild aus AgOpenGPS
- Kartenhintergrund: Satellitenbild von Esri, für Österreich wahlweise das Orthofoto von basemap.at, oder OpenStreetMap.

**Namen**
- AB-Linien, Kurven und Vorgewende-Linien umbenennen. Dabei ändert sich in der Datei nur die Namenszeile.

**Felder-Liste**
- Einmal den Ordner `Dokumente\AgOpenGPS\Fields` wählen. Danach stehen alle Felder in einer Liste mit Suche, ein Klick öffnet das Feld. Der Ordner wird gemerkt.

## Benutzung

1. **https://skafuu.github.io/aog-feldeditor/** in **Chrome oder Edge** öffnen. Alternativ `index.html` herunterladen und vom eigenen Rechner öffnen.
2. **„Felder-Ordner wählen…“** klicken und `Dokumente\AgOpenGPS\Fields` auswählen.
3. Ein Feld anklicken, bearbeiten, **„Änderungen speichern“**.

Wichtig:
- **Das Feld vorher in AgOpenGPS schließen.** AgOpenGPS speichert beim Schließen und würde deine Änderungen sonst überschreiben.
- Nach einer Änderung an der Grenze in AgOpenGPS das **Vorgewende neu erstellen**.
- Vor jedem Speichern legt der Editor die bisherigen Dateien in einem Unterordner `Backup_<Datum-Uhrzeit>` im Feldordner ab. Beim ersten Ausprobieren trotzdem besser mit einer Kopie des Feldes arbeiten.
- Ist das Feld mit **AgShare** verknüpft und dort „Automatisch laden“ aktiv, lädt AgOpenGPS beim Öffnen die Cloud-Version. Deine lokalen Änderungen werden dann überschrieben. Der Editor weist darauf hin.

Firefox kann keine Ordner öffnen. Dort wählst du die Dateien des Feldes von Hand aus und bekommst die geänderten Dateien als Download.

## Technisches

- Die Umrechnung zwischen Längen-/Breitengrad und den lokalen Metern eines Feldes entspricht `LocalPlane` aus AgOpenGPS.
- Die Dateiformate (`Field.txt`, `Boundary.txt`, `Flags.txt`, `TrackLines.txt`, `Headland.txt`, `Headlines.txt`, `Sections.txt`, `Contour.txt`, `Tram.txt`, `RecPath.txt`, `Elevation.txt`, `BackPic.txt`) sind am Quellcode von AgOpenGPS (Zweig `develop`, Stand 2026) ausgerichtet und mit echten Feldern getestet.
- Unbekannte Dateien im Feldordner fasst der Editor nicht an.

## Rückmeldungen

Fehler und Ideen gern als [GitHub-Issue](https://github.com/SkaFUU/aog-feldeditor/issues) oder im [AgOpenGPS-Forum](https://discourse.agopengps.com). Wenn ein Feld nicht lädt oder nach dem Speichern falsch aussieht, helfen die Dateien dieses Feldes sehr.

## Haftung

Das ist ein privates Hilfswerkzeug ohne Verbindung zum AgOpenGPS-Projekt. Die Nutzung erfolgt auf eigene Gefahr. Kontrolliere geänderte Felder in AgOpenGPS, bevor du damit arbeitest.

## Lizenz

[MIT](LICENSE)
