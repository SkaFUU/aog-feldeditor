# AOG Field Editor

🇩🇪 [Deutsche Version](README.de.md)

A browser-based editor for [AgOpenGPS](https://github.com/AgOpenGPS-Official/AgOpenGPS) fields. It opens the field folder directly, shows everything on a satellite map and writes the files back in AgOpenGPS format, with no detour through KML.

**▶ Use it here: https://skafuu.github.io/aog-feldeditor/**

The editor is **a single HTML file**. It needs no installation and no server, and it never sends your field data anywhere. The only things loaded from the internet are the map tiles and the map library [Leaflet](https://leafletjs.com/). The interface is available in **English and German**: it follows your browser language, and you can switch with **DE | EN** at the top.

## Features

The layout works like Office: tabs at the top for **Field, Boundary, Tracks, Headland, Tramlines, Flags, Origin, View and Measure**, with the matching buttons below them. The field list is on the left, the list for the selected tab (boundaries, tracks, flag …) on the right, and the status bar at the bottom shows messages and the mouse position. The field list and the side panel can be hidden. **Save** and **Undo** are always at the top left.

**New field**
- Create a new field like in AgOpenGPS: enter a name, click the outer boundary on the map, save. The editor writes the same files AgOpenGPS creates for a new field and puts the origin in the field center.

**Edit the field boundary**
- Every point is shown on the satellite image. You can drag points, insert them (click the line) or delete them (right-click or Del). Ctrl+Z undoes the last step.
- While you drag a point, a dashed ghost of the old point and the old boundary stays visible until your next action.
- Draw a new outer or inner boundary by clicking points on the map.
- All boundaries are listed: click a name to edit it (click again to stop editing), the eye shows or hides it, the bin deletes it. Inner boundaries can be marked as **drive-through** (e.g. a ditch or path), and AgOpenGPS builds no U-turn line there.
- "Reduce" removes unnecessary points.
- When saving, the boundary is prepared the same way AgOpenGPS stores it: point spacing, winding direction and the heading of every point. Only then does AgOpenGPS build a correct U-turn line from it.
- Boundaries with too few points are detected when a field is opened and repaired when it is saved.

**Tracks**
- **AB line / curve on the boundary**, like "Draw AB" in AgOpenGPS: click two points that snap to the boundary, then create an AB line or a curve that follows the boundary between them.
- **Boundary as track** ("Boundary Curve"): turns a boundary into a track. If there is more than one boundary, you click the one you want.
- **Smooth** a curve or boundary track (click it in the list on the right, then "Smooth"): either the whole track, or only between two points. In that case the section is replaced by a smooth arc that joins the track without a kink, with extra points in tight bends. If the track lies on a boundary, clicks snap to the boundary points, and **"Move boundary too"** moves the matching boundary points along, so boundary, track and headland stay consistent.
- Rename, show/hide and delete AB lines, curves and headland lines. When renaming, only the name line in the file changes.

**Flags**
- Add, move and delete flags. All flags are listed on the right; click one (in the list or on the map) to show its color, note and coordinates. Selecting the Flags tab shows the flags on the map.

**Field origin (StartFix)**
- Move the origin to the field center or to any other point. All files in the field folder are converted along with it: boundary, headland, tracks, coverage, tramlines, recorded paths, elevation data and background image.
- A circle shows the 500 m within which "Drive In" finds the field. "Drive In" only lists a field when you are within 500 m of its StartFix, which is where you pressed "New" when the field was created.

**Show**
- Everything the field contains can be shown or hidden individually, with the eye button in its tab (selecting a tab shows its layers), and deleted completely with the bin (like "Delete applied area" in AgOpenGPS):
  - coverage, with area in ha; areas covered twice are drawn darker
  - AB lines and curves
  - headland and headland lines
  - tramlines
  - contour
  - recorded path
  - the background image saved by AgOpenGPS
- Map background: Esri satellite imagery, the basemap.at orthophoto (Austria only), or OpenStreetMap.

**Measure**
- Distance (with the length of each segment) or area with perimeter: click points on the map. Works without an open field too.

**Field list**
- Choose the folder `Documents\AgOpenGPS\Fields` once. All fields then appear in a searchable list, and one click opens a field. The folder is remembered.

## Usage

1. Open **https://skafuu.github.io/aog-feldeditor/** in **Chrome or Edge**. Alternatively, download `index.html` and open it from your computer.
2. In the **Field** tab, click **"Choose fields folder"** and select `Documents\AgOpenGPS\Fields`.
3. Click a field on the left, edit it, then click **"Save"** at the top.

Important:
- **Close the field in AgOpenGPS before saving.** AgOpenGPS saves when it closes a field and would otherwise overwrite your changes.
- After changing the boundary, **rebuild the headland** in AgOpenGPS.
- Before every save, the editor copies the previous files into a `Backup_<date-time>` subfolder of the field folder. For your first tries, still work on a copy of the field.
- If the field is linked to **AgShare** with auto load enabled, AgOpenGPS loads the cloud version when the field is opened and your local changes are replaced. The editor warns you about this.

Firefox cannot open folders. There you select the field files by hand and get the changed files as downloads.

## Technical notes

- The conversion between latitude/longitude and a field's local metres matches `LocalPlane` in AgOpenGPS.
- The file formats (`Field.txt`, `Boundary.txt`, `Flags.txt`, `TrackLines.txt`, `Headland.txt`, `Headlines.txt`, `Sections.txt`, `Contour.txt`, `Tram.txt`, `RecPath.txt`, `Elevation.txt`, `BackPic.txt`) follow the AgOpenGPS source code (`develop` branch, 2026) and were tested with real fields.
- Files in the field folder that the editor does not know are left untouched.

## Feedback

Bugs and ideas are welcome as a [GitHub issue](https://github.com/SkaFUU/aog-feldeditor/issues) or in the [AgOpenGPS forum](https://discourse.agopengps.com). If a field doesn't load or looks wrong after saving, the files of that field help a lot.

## Disclaimer

This is a private helper tool and is not affiliated with the AgOpenGPS project. Use it at your own risk and check changed fields in AgOpenGPS before working with them.

## License

[MIT](LICENSE)
