# AOG Feldeditor

🇬🇧 [English version](README.md)

Ein Editor im Browser für Felder aus [AgOpenGPS](https://github.com/AgOpenGPS-Official/AgOpenGPS). Er öffnet den Feldordner direkt, zeigt alles auf einem Satellitenbild und schreibt die Dateien im Format von AgOpenGPS zurück. Ein Umweg über KML ist nicht nötig.

**▶ Hier direkt benutzen: https://skafuu.github.io/aog-feldeditor/**

Der Editor ist **eine einzige HTML-Datei**. Er braucht keine Installation und keinen Server und schickt keine Felddaten ins Internet. Aus dem Internet lädt er nur die Kartenbilder und die Kartenbibliothek [Leaflet](https://leafletjs.com/). Die Oberfläche gibt es auf **Deutsch und Englisch**: Sie richtet sich nach der Sprache des Browsers und lässt sich oben mit **DE | EN** umschalten.

## Funktionen

Die Bedienung ist aufgebaut wie in Office: Oben gibt es Register für **Feld, Grenze, Spuren, Vorgewende, Fahrgassen, Fahnen, Ursprung, Ansicht und Messen**, darunter die passenden Knöpfe. Links steht die Feldliste, rechts die Liste zum gewählten Register (Grenzen, Spuren, Fahne …), unten die Statuszeile mit Meldungen und der Mausposition. Feldliste und Seitenleiste lassen sich ausblenden. Bearbeiten lässt sich nur, was zum gewählten Register gehört (z. B. Grenzpunkte nur unter „Grenze“, Fahnen nur unter „Fahnen“), alles andere wird nur angezeigt. **Speichern** und **Rückgängig** sind immer oben links.

**Neues Feld**
- Ein neues Feld anlegen wie in AgOpenGPS: Namen eingeben, Außengrenze auf die Karte klicken, speichern. Der Editor legt dieselben Dateien an wie AgOpenGPS bei einem neuen Feld und setzt den Ursprung in die Feldmitte.

**Schlaggrenze bearbeiten**
- Jeder Punkt ist auf dem Satellitenbild sichtbar und lässt sich verschieben, einfügen (Klick auf die Linie) oder löschen (Rechtsklick oder Entf). Strg+Z macht den letzten Schritt rückgängig.
- Beim Verschieben bleibt ein gestrichelter Schatten des alten Punkts und der alten Grenze sichtbar, bis zur nächsten Aktion.
- Neue Außen- oder Innengrenze zeichnen: Punkte auf die Karte klicken.
- Alle Grenzen stehen in einer Liste: Namen anklicken zum Bearbeiten (nochmal klicken beendet das), das Auge blendet ein oder aus, der Papierkorb löscht. Innengrenzen lassen sich als **befahrbar** markieren (z. B. Graben oder Weg), dann legt AgOpenGPS dort keine Wendelinie an.
- „Ausdünnen“ entfernt überflüssige Punkte.
- Beim Speichern wird die Grenze so aufbereitet, wie AgOpenGPS sie selbst speichert: Punktabstand, Umlaufrichtung und Richtung jedes Punkts. Nur dann berechnet AgOpenGPS daraus eine korrekte Wendelinie.
- Grenzen mit zu wenigen Punkten erkennt der Editor beim Öffnen und repariert sie beim Speichern.

**Spuren**
- **AB / Kurve an Grenze**, wie „AB zeichnen“ in AgOpenGPS: zwei Punkte anklicken, die auf der Grenze einrasten, dann eine AB-Linie oder eine Kurve entlang der Grenze dazwischen anlegen.
- **Grenze als Spur** („Boundary Curve“): macht aus einer Grenze eine Spur. Bei mehreren Grenzen klickst du die gewünschte an.
- **Glätten** einer Kurve oder Grenz-Spur (rechts in der Liste anklicken, dann „Glätten“): ganz, oder nur zwischen zwei Punkten. Dann wird der Abschnitt durch einen glatten Bogen ersetzt, der ohne Knick anschließt, mit zusätzlichen Punkten in engen Bögen. Liegt die Spur auf einer Grenze, rasten die Klicks auf den Grenzpunkten ein, und **„Grenze mitziehen“** passt die Grenzpunkte gleich mit an, damit Grenze, Spur und Vorgewende zusammenpassen.
- AB-Linien, Kurven und Vorgewende-Linien umbenennen, ein-/ausblenden und löschen. Beim Umbenennen ändert sich in der Datei nur die Namenszeile.

**Vorgewende** (gerechnet wie „Headland“ in AgOpenGPS 6.8)
- **Rundum bauen** oder **Teilstück** drücken, die Einstellungen erscheinen in der Seitenleiste: Abstand in Metern oder als Anzahl Arbeitsbreiten des oben gewählten Geräts (Breite minus Überlappung), Ecken runden mit Radius (0 = genau wie AgOpenGPS).
- **Teilstück:** die zwei Ecken einer Seite anklicken, Kurve entlang der Grenze oder gerade Linie. Das Vorgewende wird an dieser Seite mit dem eingestellten Abstand neu gesetzt.
- Eine gelbe Vorschau zeigt das Ergebnis, jede Änderung ist sofort zu sehen.

**Fahrgassen**
- Oben **Fahrzeug** (Spurweite) und **Gerät** wählen, z. B. die Feldspritze: der Fahrgassenabstand ist dann ihre Arbeitsbreite. Alles lässt sich auch von Hand eingeben.
- **An Linie:** eine bestimmte Anzahl Fahrgassen neben einer Referenzlinie (AB-Linie oder Kurve), gerechnet wie „Tramlines Multi“ in AgOpenGPS.
- **Feld füllen:** das ganze Feld parallel zu einer Referenzlinie (eine oder beide Seiten) – oder von zwei Linien aufeinander zu, die Anzahl je Seite wird vorgeschlagen. Wo sich Fahrgassen beider Seiten kreuzen, kann eine Seite am Schnittpunkt gekürzt werden (umschaltbar).
- **Randfahrgasse** um die Außengrenze, auch mehrere Ringe, wahlweise mit gerundeten Ecken (beide Spuren genau parallel).
- **Gasse dazwischen:** zwei Fahrgassen anklicken, eine neue kommt genau in die Mitte. **Löschen:** einzelne Fahrgassen anklicken (Strg+Z holt sie zurück).
- Die **Arbeitsbreite** jeder Fahrgasse wird als blaue Fläche gezeigt (doppelt befahren = dunkler), auch schon in der Vorschau; mit dem Auge ausblendbar. Bei den anderen Funktionen kann sie gleich mit erzeugt werden; die Fahrgassen enden dann an ihr, sonst an der Grenze.
- Die Referenzlinie wird verlängert, damit die Fahrgassen bis zur Grenze reichen. Gibt es schon Fahrgassen, heißt es vor dem Übernehmen: **Ersetzen** oder **Ergänzen**.
- Mit echten Feldern geprüft: Die von AgOpenGPS erzeugten Fahrgassen kommen auf 0–2 cm genau gleich heraus.

**Fahnen**
- Fahnen setzen, verschieben und löschen. Rechts stehen alle Fahnen; ein Klick (in der Liste oder auf der Karte) klappt Farbe, Notiz und Koordinaten auf. Das Register „Fahnen“ blendet die Fahnen auf der Karte ein.

**Feld-Ursprung (StartFix)**
- Der Ursprung lässt sich in die Feldmitte oder an eine beliebige Stelle verschieben. Alle Dateien im Feldordner werden dabei mit umgerechnet: Grenze, Vorgewende, Spuren, bearbeitete Fläche, Fahrgassen, Pfade, Höhendaten und Hintergrundbild.
- Ein Kreis zeigt die 500 m, in denen „Drive In“ das Feld findet. „Drive In“ zeigt ein Feld nur an, wenn du höchstens 500 m vom StartFix entfernt bist, also von der Stelle, an der beim Anlegen „Neu“ gedrückt wurde.

**Anzeigen**
- Alles, was das Feld enthält, lässt sich einzeln mit dem Auge in seinem Register ein- und ausblenden (das Register anwählen blendet seine Ebenen ein) und mit dem Papierkorb komplett löschen (wie „Bearbeitete Fläche löschen“ in AgOpenGPS):
  - bearbeitete Fläche, mit ha-Angabe; doppelt bearbeitete Stellen werden dunkler
  - AB-Linien und Kurven
  - Vorgewende und Vorgewende-Linien
  - Fahrgassen
  - Kontur
  - aufgezeichneter Pfad
  - das Hintergrundbild aus AgOpenGPS
- Kartenhintergrund: Satellitenbild von Esri, für Österreich wahlweise das Orthofoto von basemap.at, oder OpenStreetMap.

**Messen**
- Strecke (mit Länge jeder Teilstrecke) oder Fläche mit Umfang: Punkte auf die Karte klicken. Geht auch ohne geöffnetes Feld.

**Felder-Liste**
- Einmal den Ordner `Dokumente\AgOpenGPS` wählen. Danach stehen alle Felder in einer Liste mit Suche, ein Klick öffnet das Feld. Fahrzeuge und Geräte liest der Editor aus demselben Ordner. Der Ordner wird gemerkt. (Wer nur `Fields` wählt, kann die Felder bearbeiten, hat aber keine Fahrzeug-/Geräteprofile.)

## Benutzung

1. **https://skafuu.github.io/aog-feldeditor/** in **Chrome oder Edge** öffnen. Alternativ `index.html` herunterladen und vom eigenen Rechner öffnen.
2. Im Register **Feld** auf **„AgOpenGPS-Ordner wählen“** klicken und `Dokumente\AgOpenGPS` auswählen.
3. Links ein Feld anklicken, bearbeiten, oben **„Speichern“**.

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
