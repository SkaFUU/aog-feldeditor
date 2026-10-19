# AOG Field Editor

🇦🇹 [Deutsche Version](README.de.md)

A browser-based editor for [AgOpenGPS](https://github.com/AgOpenGPS-Official/AgOpenGPS) fields. It opens the field folder directly, shows everything on a satellite map and writes the files back in AgOpenGPS format, with no detour through KML.

**▶ Use it here: https://skafuu.github.io/aog-feldeditor/**

The editor is **a single HTML file**. It needs no installation and no server, and it never sends your field data anywhere. The only things loaded from the internet are the map tiles and the map library [Leaflet](https://leafletjs.com/). The interface is available in **English and German**: it follows your browser language, and you can switch with **DE | EN** at the top.

## Features

The layout works like Office: tabs at the top for **Field, Boundary, Tracks, Headland, Tramlines, Flags & Measure** (in the order you usually work), with the matching buttons below them. The field list is on the left, the list for the selected tab (boundaries, tracks, flag …) on the right, and the status bar at the bottom shows messages and the mouse position. The field list and the side panel can be collapsed with the arrows at the map edges, and the side panel can be dragged wider or narrower. Only what belongs to the selected tab can be edited (e.g. boundary points only under "Boundary", flags only under "Flags"); everything else is only shown. **Save** and **Undo** are always at the top left.

**New field**
- Create a new field like in AgOpenGPS: enter a name, click the outer boundary on the map, save. The editor writes the same files AgOpenGPS creates for a new field and puts the origin in the field center.
- "Delete field" deletes the open field completely – the whole field folder with all files and backups. You are asked first; it cannot be undone.

**Edit the field boundary**
- Every point is shown on the satellite image. You can drag points, insert them (click the line) or delete them (right-click or Del). Ctrl+Z undoes the last step.
- While you drag a point, a dashed ghost of the old point and the old boundary stays visible until your next action. The offset is shown as well: direct distance plus east/west and north/south in metres (also when moving flags) – handy if you noted corrections out in the field.
- Draw a new outer or inner boundary by clicking points on the map.
- All boundaries are listed: click a name to edit it (click again to stop editing), the eye shows or hides it, the bin deletes it. Inner boundaries can be marked as **drive-through** (e.g. a ditch or path), and AgOpenGPS builds no U-turn line there.
- **Split**: click two points (they snap to the boundary when close) – the field is split along that line. Choose: one part stays in the field and the other becomes a new field, or both become new fields (the old one stays or is deleted). AB lines and curves are shortened at the cut line and extended there by 99 m like when they are made, flags go by position, tramlines and boundary tram are cut at the line; rebuild the headland afterwards. Saved right away, with backup.
- **Combine**: choose a second field, then for each of the two connections click one point on each field (they snap to the boundary) – there the new boundary goes from one field to the other, also across a lane or ditch. A new field is created with tracks, flags and tramlines of both; the two old fields stay.
- "From coverage" puts an outer boundary around the worked area – handy for fields that were driven without a boundary. The "Precision" slider sets from which change of direction a point is placed: left rough with few points, right traced closely. With "Sides from (m)", every field side of at least that length is traced as its own curve, the way it was driven; where the extended sides meet is the corner and the ragged turning areas are dropped – a rectangular field then has just 4 points. Precision sets how closely the curves follow the contour. Greyed out if the field has no coverage.
- "Reduce" removes unnecessary points. The tolerance is set in the side panel, the reduced boundary is previewed first.
- When saving, the boundary is prepared the same way AgOpenGPS stores it: point spacing, winding direction and the heading of every point. Only then does AgOpenGPS build a correct U-turn line from it.
- Boundaries with too few points are detected when a field is opened and repaired when it is saved.

**Tracks**
- **AB line / curve on the boundary**, like "Draw AB" in AgOpenGPS: click two points that snap to the boundary, then create an AB line or a curve that follows the boundary between them.
- **Boundary as track** ("Boundary Curve"): turns a boundary into a track. If there is more than one boundary, you click the one you want.
- **Smooth** a curve or boundary track (click it on the map or in the list on the right, then "Smooth"; strength with a slider or as a number): either the whole track, or only between two points. In that case the section is replaced by a smooth arc that joins the track without a kink, with extra points in tight bends. If the track lies on a boundary, clicks snap to the boundary points, and **"Move boundary too"** moves the matching boundary points along, so boundary, track and headland stay consistent.
- Rename, show/hide and delete AB lines, curves and headland lines. When renaming, only the name line in the file changes.

**Headland** (calculated like "Headland" in AgOpenGPS 6.8)
- Press **Build around** or **Section**; the settings appear in the side panel: distance in metres or as a number of tool widths of the tool chosen at the top (width minus overlap), and rounded corners with a radius (0 = exactly like AgOpenGPS).
- **Build from lines** (like the Headland Builder): set lines – curve or straight line between two boundary points, an existing track, or every side automatically with "Detect sides" – each with its own distance in metres or tool widths. The headland is built from the crossings of the shifted lines; where there is no line the boundary stays. This gives every side its own distance, or e.g. headlands only at the ends.
- A yellow preview shows the result and follows every change immediately.

**Tramlines**
- Choose the **vehicle** (wheel track) and the **tool** at the top, e.g. the sprayer: the tramline spacing is then its working width. Everything can also be typed in.
- **Along line:** tramlines from a reference line (AB line or curve), with a suggested number right and left so the whole field is covered – or from two lines towards each other (the number per side is suggested). Where tramlines from both sides cross, one side can end at the crossing ("Merge"). Calculated like "Tramlines Multi" in AgOpenGPS.
  - **Middle of 2:** click two tracks – the first tramline lies exactly in the middle between them (for curves equally far from both at every point), more follow at the tramline spacing to both sides.
- **Boundary tram** around the outer boundary, also several rings, optionally with rounded corners (both tracks exactly parallel).
- **Tramline between:** click two tramlines, a new one goes exactly in the middle. **Delete:** click single tramlines (Ctrl+Z brings them back).
- The **working width** of each tramline is shown as a blue area (covered twice = darker), already in the preview; it can be hidden with the eye. The other functions can create it at the same time; tramlines then end at it, otherwise at the boundary.
- The reference line is extended so the tramlines reach the boundary. If there are tramlines already, you choose **Replace** or **Add** before applying.
- Checked with real fields: tramlines created by AgOpenGPS come out the same within 0–2 cm.

**Flags**
- Add, move and delete flags. All flags are listed on the right; click one (in the list or on the map) to show its color, note and coordinates. Selecting the Flags tab shows the flags on the map.

**Field origin (StartFix)** (in the Boundary tab)
- Move the origin to the field center or to any other point. The new point and the 500 m circle are previewed, you confirm in the side panel. All files in the field folder are converted along with it: boundary, headland, tracks, coverage, tramlines, recorded paths, elevation data and background image.
- A circle shows the 500 m within which "Drive In" finds the field. "Drive In" only lists a field when you are within 500 m of its StartFix, which is where you pressed "New" when the field was created.

**Show** (map background and further layers in the Field tab)
- Everything the field contains can be shown or hidden individually, with the eye button in its tab (selecting a tab shows its layers), and deleted completely with the bin (like "Delete applied area" in AgOpenGPS):
  - coverage, with area in ha; areas covered twice are drawn darker
  - AB lines and curves
  - headland and headland lines
  - tramlines
  - contour
  - recorded path
  - the background image saved by AgOpenGPS
- Map background: Esri satellite imagery (worldwide), OpenStreetMap, and **official aerial images (orthophotos)** – usually 10–20 cm and therefore sharper, good for tracing: Austria, Switzerland, the German states (Bavaria, Baden-Württemberg, Brandenburg/Berlin, Hesse, Mecklenburg-Western Pomerania, Lower Saxony, North Rhine-Westphalia, Rhineland-Palatinate, Saxony, Saxony-Anhalt, Schleswig-Holstein, Thuringia), Netherlands, France, Czech Republic, Poland. The chosen country sits on the "Aerial" button.
- **Add your own map**: a tile address (XYZ with `{z}/{x}/{y}`) or a WMS service, as background or as a layer on top. Kept in the browser; the terms of use of the service apply.

**Overlay / compare** (in the Field tab)
- Lay another field or a file (KML, shapefile, eAMA, GeoJSON, ISOXML) over the map as a purple outline – optionally with tracks and tramlines. A file with many areas (e.g. all eAMA plots) shows all of them.
- The overlay stays while you work and when you switch fields, until you remove it.
- Compare: open field red, overlay blue, shared area purple – with the areas in ha and, if it is (nearly) the same field, the distance between the boundaries.

**Import** (in the Field tab)
- Pick a file or simply drop it on the map: **KML/KMZ**, **GeoJSON**, **shapefile** (ZIP or .shp with .dbf and .prj) and **ISOXML** (TASKDATA, also zipped).
- Coordinates are converted: GPS (WGS84/ETRS89), UTM, MGI Lambert (e.g. Austrian AMA/INVEKOS plots), MGI Gauss-Krüger and DHDN Gauss-Krüger.
- Everything in the file is shown as a preview. Click on the map or in the list what to take over.
- **New field**: enter a name – the largest area becomes the outer boundary, holes and areas inside become inner boundaries, lines become tracks (AB line or curve), points become flags.
- **Into open field**: areas as outer boundary (replaces the existing one) or as inner boundaries, plus tracks and flags.
- Files exported from this editor (KML, GeoJSON, shapefile) are recognised: tramlines including the boundary tram, headland and headland lines go back to their place. Coverage is not imported.
- A whole field can also be made in Google Earth: create folders "Boundary", "Tramlines", "Headland", "Headland lines", "Tracks" and "Flags" (or the German names), draw inside them, save as KML and import. An area in the "Tramlines" folder becomes the boundary tram. For shapefiles the file name counts, e.g. "Tramlines.shp".

**Export** (in the Field tab)
- Pick a format and tick what to include: field boundary, tracks, headland, headland lines, tramlines, flags, coverage. The current state in the editor is exported.
- **KML** (e.g. Google Earth), **GeoJSON** (e.g. QGIS), **Shapefile** (ZIP with one file per layer, e.g. for QGIS, farm software and terminals).
- **ISOXML** (TASKDATA.XML, version 4) for terminals: only field boundary and tracks (AB lines and curves) for now. Not tested on terminals yet – feedback is welcome.

**Measure**
- Distance or area with perimeter: click points on the map. The side panel lists the length of every segment and the angles at the points; the map shows numbers and angles. Clicks snap to boundary points, flags and the boundary, and at right angles to the boundary – e.g. to measure the field width exactly. Works without an open field too.
- Angle between two lines: click line 1 and line 2 on the map – a track (for curves the straight line from start to end counts) or an automatically detected field side. The angle is shown in the side panel and at the intersection on the map.

**Field list**
- Choose the folder `Documents\AgOpenGPS` once. All fields then appear in a searchable list, and one click opens a field. Vehicles and tools are read from the same folder. The folder is remembered. (If you choose only `Fields`, you can edit fields but have no vehicle/tool profiles.)

## Usage

1. Open **https://skafuu.github.io/aog-feldeditor/** in **Chrome or Edge**. Alternatively, download `index.html` and open it from your computer.
2. In the **Field** tab, click **"Choose AgOpenGPS folder"** and select `Documents\AgOpenGPS`.
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

## Code structure

Plain HTML, CSS and JavaScript – no build step, no framework (only [Leaflet](https://leafletjs.com) for the map). `index.html` holds the page layout, the code is split by topic:

| File | Content |
|---|---|
| `css/editor.css` | Layout and colours |
| `js/01-i18n.js` | German / English texts |
| `js/02-map.js` | Local plane (like AgOpenGPS `LocalPlane`), state, map, editing boundary points, origin |
| `js/03-files.js` | Reading and writing the AgOpenGPS files, loading/saving, fields folder |
| `js/04-layers.js` | Showing the field layers (tracks, headland, tramlines …) |
| `js/05-boundary-tools.js` | Tool frame (side panel), drawing boundaries, boundary from coverage |
| `js/06-export.js` | Export: KML, GeoJSON, shapefile, ISOXML |
| `js/07-import.js` | Import incl. coordinate systems (UTM, MGI, DHDN) |
| `js/08-split-combine.js` | Split and combine fields |
| `js/09-overlay.js` | Overlay / compare |
| `js/10-tracks.js` | AB lines, curves, smoothing, track files |
| `js/11-new-field.js` | New field, clearing layers, AB/curve like in AgOpenGPS |
| `js/12-geometry.js` | Geometry like AgOpenGPS 6.8: headland, tramlines, offsets, clipping (no UI) |
| `js/13-settings.js` | Settings, vehicle and tool profiles |
| `js/14-headland-tram-tools.js` | Headland and tramline tools |
| `js/15-measure.js` | Measuring distance, area, angle |
| `js/16-ui.js` | Ribbon, side panels, controls, language switch |
| `js/17-maps.js` | Official aerial images by country, your own maps |

The files are loaded in this order and share their functions. `node tools/build-single.js` builds everything into a single `dist/aog-feldeditor.html`, e.g. to pass it on or to use it offline.

## Feedback

Bugs and ideas are welcome as a [GitHub issue](https://github.com/SkaFUU/aog-feldeditor/issues) or in the [AgOpenGPS forum](https://discourse.agopengps.com). If a field doesn't load or looks wrong after saving, the files of that field help a lot.

## Disclaimer

This is a private helper tool and is not affiliated with the AgOpenGPS project. Use it at your own risk and check changed fields in AgOpenGPS before working with them.

## License

[MIT](LICENSE)
