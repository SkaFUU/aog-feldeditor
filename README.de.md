# AOG Feldeditor

🇬🇧 [English version](README.md)

Ein Editor im Browser für Felder aus [AgOpenGPS](https://github.com/AgOpenGPS-Official/AgOpenGPS). Er öffnet den Feldordner direkt, zeigt alles auf einem Satellitenbild und schreibt die Dateien im Format von AgOpenGPS zurück. Ein Umweg über KML ist nicht nötig.

**▶ Hier direkt benutzen: https://skafuu.github.io/aog-feldeditor/**

Der Editor ist **eine einzige HTML-Datei**. Er braucht keine Installation und keinen Server und schickt keine Felddaten ins Internet. Aus dem Internet lädt er nur die Kartenbilder und die Kartenbibliothek [Leaflet](https://leafletjs.com/). Die Oberfläche gibt es auf **Deutsch und Englisch**: Sie richtet sich nach der Sprache des Browsers und lässt sich oben mit **DE | EN** umschalten.

## Funktionen

Die Bedienung ist aufgebaut wie in Office: Oben gibt es Register für **Feld, Grenze, Spuren, Vorgewende, Fahrgassen, Fahnen & Messen** (in der Reihenfolge, in der man meist arbeitet), darunter die passenden Knöpfe. Links steht die Feldliste, rechts die Liste zum gewählten Register (Grenzen, Spuren, Fahne …), unten die Statuszeile mit Meldungen und der Mausposition. Feldliste und Seitenleiste lassen sich mit den Pfeilen an den Kartenrändern ein- und ausklappen, die Seitenleiste am Rand breiter oder schmaler ziehen. Bearbeiten lässt sich nur, was zum gewählten Register gehört (z. B. Grenzpunkte nur unter „Grenze“, Fahnen nur unter „Fahnen“), alles andere wird nur angezeigt. **Speichern** und **Rückgängig** sind immer oben links.

**Neues Feld**
- Ein neues Feld anlegen wie in AgOpenGPS: Namen eingeben, Außengrenze auf die Karte klicken, speichern. Der Editor legt dieselben Dateien an wie AgOpenGPS bei einem neuen Feld und setzt den Ursprung in die Feldmitte.
- „Feld löschen“ löscht das offene Feld komplett – den ganzen Feldordner mit allen Dateien und Sicherungen. Vorher kommt eine Rückfrage, rückgängig machen lässt es sich nicht.

**Schlaggrenze bearbeiten**
- Jeder Punkt ist auf dem Satellitenbild sichtbar und lässt sich verschieben, einfügen (Klick auf die Linie) oder löschen (Rechtsklick oder Entf). Strg+Z macht den letzten Schritt rückgängig.
- Beim Verschieben bleibt ein gestrichelter Schatten des alten Punkts und der alten Grenze sichtbar, bis zur nächsten Aktion.
- Neue Außen- oder Innengrenze zeichnen: Punkte auf die Karte klicken.
- Alle Grenzen stehen in einer Liste: Namen anklicken zum Bearbeiten (nochmal klicken beendet das), das Auge blendet ein oder aus, der Papierkorb löscht. Innengrenzen lassen sich als **befahrbar** markieren (z. B. Graben oder Weg), dann legt AgOpenGPS dort keine Wendelinie an.
- „Aus Fahrspur“ legt eine Außengrenze um die bearbeitete Fläche, praktisch für Felder, die ohne Grenze gefahren wurden. Der Regler „Genauigkeit“ bestimmt, ab welcher Richtungsänderung ein Punkt gesetzt wird: links grob mit wenigen Punkten, rechts genau nachgezeichnet. Mit „Seiten ab (m)“ wird jede Feldseite ab dieser Länge als eigene Kurve nachgezogen, so wie sie abgefahren wurde; wo sich die verlängerten Seiten treffen, ist die Ecke, und die zackigen Wendebereiche fallen weg – ein rechteckiges Feld hat dann nur noch 4 Punkte. Die Genauigkeit bestimmt, wie eng die Kurven der Kontur folgen. Ausgegraut, wenn das Feld keine bearbeitete Fläche hat.
- **Teilen**: zwei Punkte anklicken (nahe der Grenze rasten sie ein) – an der Linie wird das Feld geteilt. Wählbar: ein Teil bleibt im Feld und der andere wird ein neues Feld, oder beide werden neue Felder (das alte bleibt oder wird gelöscht). AB-Linien und Kurven werden an der Schnittlinie gekürzt und dort wie beim Erzeugen 99 m verlängert, Fahnen kommen nach Lage, Fahrgassen und Randfahrgasse werden an der Schnittlinie abgeschnitten; das Vorgewende danach neu erstellen. Gespeichert wird sofort, mit Sicherung.
- **Kombinieren**: zweites Feld wählen, dann für jede der zwei Verbindungen einen Punkt an jedem Feld anklicken (sie rasten auf der Grenze ein) – dort führt die neue Grenze vom einen Feld zum anderen, auch über einen Weg oder Graben. Es entsteht ein neues Feld mit Spuren, Fahnen und Fahrgassen beider Felder; die zwei alten bleiben.
- „Ausdünnen“ entfernt überflüssige Punkte. Die Toleranz wird in der Seitenleiste eingestellt, die ausgedünnte Grenze ist vorher als Vorschau zu sehen.
- Beim Speichern wird die Grenze so aufbereitet, wie AgOpenGPS sie selbst speichert: Punktabstand, Umlaufrichtung und Richtung jedes Punkts. Nur dann berechnet AgOpenGPS daraus eine korrekte Wendelinie.
- Grenzen mit zu wenigen Punkten erkennt der Editor beim Öffnen und repariert sie beim Speichern.

**Spuren**
- **AB / Kurve an Grenze**, wie „AB zeichnen“ in AgOpenGPS: zwei Punkte anklicken, die auf der Grenze einrasten, dann eine AB-Linie oder eine Kurve entlang der Grenze dazwischen anlegen.
- **Grenze als Spur** („Boundary Curve“): macht aus einer Grenze eine Spur. Bei mehreren Grenzen klickst du die gewünschte an.
- **Glätten** einer Kurve oder Grenz-Spur (auf der Karte oder rechts in der Liste anklicken, dann „Glätten“; Stärke mit Regler oder als Zahl): ganz, oder nur zwischen zwei Punkten. Dann wird der Abschnitt durch einen glatten Bogen ersetzt, der ohne Knick anschließt, mit zusätzlichen Punkten in engen Bögen. Liegt die Spur auf einer Grenze, rasten die Klicks auf den Grenzpunkten ein, und **„Grenze mitziehen“** passt die Grenzpunkte gleich mit an, damit Grenze, Spur und Vorgewende zusammenpassen.
- AB-Linien, Kurven und Vorgewende-Linien umbenennen, ein-/ausblenden und löschen. Beim Umbenennen ändert sich in der Datei nur die Namenszeile.

**Vorgewende** (gerechnet wie „Headland“ in AgOpenGPS 6.8)
- **Rundum bauen** oder **Teilstück** drücken, die Einstellungen erscheinen in der Seitenleiste: Abstand in Metern oder als Anzahl Arbeitsbreiten des oben gewählten Geräts (Breite minus Überlappung), Ecken runden mit Radius (0 = genau wie AgOpenGPS).
- **Aus Linien bauen** (wie der Headland Builder): Linien setzen – Kurve oder Gerade zwischen zwei Grenzpunkten, eine vorhandene Spur, oder mit „Seiten erkennen“ jede Seite automatisch –, jede mit eigenem Abstand in Metern oder Arbeitsbreiten. Das Vorgewende entsteht aus den Schnittpunkten der verschobenen Linien; wo keine Linie ist, bleibt die Grenze. So geht jede Seite mit eigenem Abstand oder z. B. nur die Stirnseiten.
- Eine gelbe Vorschau zeigt das Ergebnis, jede Änderung ist sofort zu sehen.

**Fahrgassen**
- Oben **Fahrzeug** (Spurweite) und **Gerät** wählen, z. B. die Feldspritze: der Fahrgassenabstand ist dann ihre Arbeitsbreite. Alles lässt sich auch von Hand eingeben.
- **An Linie:** Fahrgassen von einer Referenzlinie (AB-Linie oder Kurve) aus, mit vorgeschlagener Anzahl rechts und links, sodass das ganze Feld abgedeckt ist – oder von zwei Linien aufeinander zu (Anzahl je Seite wird vorgeschlagen). Wo sich Fahrgassen beider Seiten kreuzen, kann eine Seite am Schnittpunkt enden („Zusammenführen“). Gerechnet wie „Tramlines Multi“ in AgOpenGPS.
- **Randfahrgasse** um die Außengrenze, auch mehrere Ringe, wahlweise mit gerundeten Ecken (beide Spuren genau parallel).
- **Gasse dazwischen:** zwei Fahrgassen anklicken, eine neue kommt genau in die Mitte. **Löschen:** einzelne Fahrgassen anklicken (Strg+Z holt sie zurück).
- Die **Arbeitsbreite** jeder Fahrgasse wird als blaue Fläche gezeigt (doppelt befahren = dunkler), auch schon in der Vorschau; mit dem Auge ausblendbar. Bei den anderen Funktionen kann sie gleich mit erzeugt werden; die Fahrgassen enden dann an ihr, sonst an der Grenze.
- Die Referenzlinie wird verlängert, damit die Fahrgassen bis zur Grenze reichen. Gibt es schon Fahrgassen, heißt es vor dem Übernehmen: **Ersetzen** oder **Ergänzen**.
- Mit echten Feldern geprüft: Die von AgOpenGPS erzeugten Fahrgassen kommen auf 0–2 cm genau gleich heraus.

**Fahnen**
- Fahnen setzen, verschieben und löschen. Rechts stehen alle Fahnen; ein Klick (in der Liste oder auf der Karte) klappt Farbe, Notiz und Koordinaten auf. Das Register „Fahnen“ blendet die Fahnen auf der Karte ein.

**Feld-Ursprung (StartFix)** (im Register Grenze)
- Der Ursprung lässt sich in die Feldmitte oder an eine beliebige Stelle verschieben. Der neue Punkt und der 500-m-Kreis werden vorher angezeigt, bestätigt wird in der Seitenleiste. Alle Dateien im Feldordner werden dabei mit umgerechnet: Grenze, Vorgewende, Spuren, bearbeitete Fläche, Fahrgassen, Pfade, Höhendaten und Hintergrundbild.
- Ein Kreis zeigt die 500 m, in denen „Drive In“ das Feld findet. „Drive In“ zeigt ein Feld nur an, wenn du höchstens 500 m vom StartFix entfernt bist, also von der Stelle, an der beim Anlegen „Neu“ gedrückt wurde.

**Anzeigen** (Kartenhintergrund und weitere Ebenen im Register Feld)
- Alles, was das Feld enthält, lässt sich einzeln mit dem Auge in seinem Register ein- und ausblenden (das Register anwählen blendet seine Ebenen ein) und mit dem Papierkorb komplett löschen (wie „Bearbeitete Fläche löschen“ in AgOpenGPS):
  - bearbeitete Fläche, mit ha-Angabe; doppelt bearbeitete Stellen werden dunkler
  - AB-Linien und Kurven
  - Vorgewende und Vorgewende-Linien
  - Fahrgassen
  - Kontur
  - aufgezeichneter Pfad
  - das Hintergrundbild aus AgOpenGPS
- Kartenhintergrund: Satellitenbild von Esri, für Österreich wahlweise das Orthofoto von basemap.at, oder OpenStreetMap.

**Überlagern / Vergleichen** (im Register Feld)
- Ein anderes Feld oder eine Datei (KML, Shapefile, eAMA, GeoJSON, ISOXML) als lila Umriss über die Karte legen – auf Wunsch mit Spuren und Fahrgassen. Bei einer Datei mit vielen Flächen (z. B. alle eAMA-Schläge) werden alle gezeigt.
- Die Überlagerung bleibt stehen, auch beim Arbeiten und beim Feldwechsel, bis man sie entfernt.
- Vergleichen: offenes Feld rot, Überlagerung blau, gemeinsame Fläche lila – dazu die Flächen in ha und, wenn es (fast) dasselbe Feld ist, der Abstand der Grenzen.

**Importieren** (im Register Feld)
- Datei wählen oder einfach auf die Karte ziehen: **KML/KMZ**, **GeoJSON**, **Shapefile** (ZIP oder .shp mit .dbf und .prj) und **ISOXML** (TASKDATA, auch als ZIP).
- Koordinaten werden umgerechnet: GPS (WGS84/ETRS89), UTM, MGI Lambert (z. B. AMA/INVEKOS-Feldstücke), MGI Gauß-Krüger und DHDN Gauß-Krüger.
- Alles aus der Datei erscheint als Vorschau. Auf der Karte oder in der Liste anklicken, was übernommen wird.
- **Neues Feld**: Namen eingeben – die größte Fläche wird die Außengrenze, Löcher und Flächen darin werden Innengrenzen, Linien werden Spuren (AB-Linie oder Kurve), Punkte werden Fahnen.
- **Ins offene Feld**: Flächen als Außengrenze (ersetzt die bestehende) oder als Innengrenzen, dazu Spuren und Fahnen.
- Dateien, die mit diesem Editor exportiert wurden (KML, GeoJSON, Shapefile), werden erkannt: Fahrgassen samt Randfahrgasse, Vorgewende und Vorgewende-Linien kommen wieder an ihren Platz. Die bearbeitete Fläche wird nicht importiert.
- Ein ganzes Feld lässt sich auch in Google Earth anlegen: Ordner „Grenze“, „Fahrgassen“, „Vorgewende“, „Vorgewende-Linien“, „Spuren“ und „Fahnen“ (oder englisch) anlegen und darin zeichnen, als KML speichern und importieren. Eine Fläche im Ordner „Fahrgassen“ wird zur Randfahrgasse. Bei Shapefiles zählt der Dateiname, z. B. „Fahrgassen.shp“.

**Exportieren** (im Register Feld)
- Format wählen und abhaken, was mit soll: Feldgrenze, Spuren, Vorgewende, Vorgewende-Linien, Fahrgassen, Fahnen, bearbeitete Fläche. Exportiert wird der aktuelle Stand im Editor.
- **KML** (z. B. Google Earth), **GeoJSON** (z. B. QGIS), **Shapefile** (ZIP mit einer Datei je Ebene, z. B. für QGIS, Hof-Programme und Terminals).
- **ISOXML** (TASKDATA.XML, Version 4) für Terminals: vorerst nur Feldgrenze und Spuren (AB-Linien und Kurven). Noch nicht an Terminals getestet – Rückmeldungen sind willkommen.

**Messen**
- Strecke oder Fläche mit Umfang: Punkte auf die Karte klicken. In der Seitenleiste stehen die Länge jeder Teilstrecke und die Winkel an den Punkten, auf der Karte Nummern und Winkel. Klicks rasten auf Grenzpunkten, Fahnen und der Grenze ein, und rechtwinklig zur Grenze – so lässt sich z. B. die Feldbreite genau messen. Geht auch ohne geöffnetes Feld.
- Winkel zwischen zwei Linien: Linie 1 und Linie 2 auf der Karte anklicken – eine Spur (bei Kurven zählt die Gerade von Anfang bis Ende) oder eine automatisch erkannte Feldseite. Der Winkel steht in der Seitenleiste und am Schnittpunkt auf der Karte.

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
