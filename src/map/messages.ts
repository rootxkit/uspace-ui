// The map's own strings in both languages. Interim: WP-2's catalogues
// (src/i18n/en.ts, ka.ts) do not exist yet; when they land these keys move
// there under a WP-3 comment and `mapText` becomes `useT()`. The keys are
// already the catalogue's (`map.*`), so no caller changes.

export type MapLang = "ka" | "en";

const en = {
  "map.region": "Map",
  "map.loading": "Loading the base map",
  "map.no_basemap":
    "No base map: positions are drawn on a plain background. The base map files are missing or unreadable.",
  "map.no_basemap_attribution": "no base map",
  "map.osm_as_of": "OSM data as of {date} (UTC)",
  "map.webgl_unavailable":
    "The map cannot be drawn: this browser has no WebGL. Viewport:",
  "map.bbox": "{minLng}, {minLat} to {maxLng}, {maxLat} (lng, lat, WGS84)",
  "map.controls": "Map buttons",
  "map.zoom_in": "Zoom in",
  "map.zoom_out": "Zoom out",
  "map.north": "Turn the map to north up",
  "map.scheme_dark": "Dark map",
  "map.layers": "Layers",
  "map.layers_close": "Close layers",
} as const;

export type MapKey = keyof typeof en;

const ka: Record<MapKey, string> = {
  "map.region": "რუკა",
  "map.loading": "საბაზისო რუკა იტვირთება",
  "map.no_basemap":
    "საბაზისო რუკა არ არის: პოზიციები ნაჩვენებია ცარიელ ფონზე. საბაზისო რუკის ფაილები აკლია ან ვერ იკითხება.",
  "map.no_basemap_attribution": "საბაზისო რუკა არ არის",
  "map.osm_as_of": "OSM მონაცემები {date}-ის მდგომარეობით (UTC)",
  "map.webgl_unavailable":
    "რუკის დახატვა შეუძლებელია: ამ ბრაუზერს არ აქვს WebGL. ხედის არე:",
  "map.bbox": "{minLng}, {minLat} — {maxLng}, {maxLat} (გრძედი, განედი, WGS84)",
  "map.controls": "რუკის ღილაკები",
  "map.zoom_in": "მასშტაბის გაზრდა",
  "map.zoom_out": "მასშტაბის შემცირება",
  "map.north": "რუკის ჩრდილოეთისკენ მობრუნება",
  "map.scheme_dark": "მუქი რუკა",
  "map.layers": "ფენები",
  "map.layers_close": "ფენების დახურვა",
};

export const MAP_MESSAGES: Readonly<
  Record<MapLang, Readonly<Record<MapKey, string>>>
> = { en, ka };

/** The map string for `key` in `lang`, with `{name}` placeholders filled. */
export function mapText(
  lang: MapLang,
  key: MapKey,
  vars: Readonly<Record<string, string>> = {},
): string {
  return MAP_MESSAGES[lang][key].replace(
    /\{(\w+)\}/g,
    (whole, name: string) => vars[name] ?? whole,
  );
}
