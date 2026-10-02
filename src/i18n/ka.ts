// The kit's Georgian catalogue: every key of `en.ts`, in the same groups.
// Wording reused from the predecessor console where operators already read
// it (utm/web-pilot/src/i18n.ts). The rules of en.ts apply here too:
// "დაუდასტურებელი" (unverified) on every broadcast string, "დაკარგ-"
// (lost) only for a recorded gap.
import type { Key } from "./en.js";

export const ka: Readonly<Record<Key, string>> = {
  // WP-2: common words
  "common.dash": "—",
  "common.yes": "დიახ",
  "common.no": "არა",
  "common.unknown": "უცნობია",
  "common.none": "არ არის",
  "common.not_provided": "მითითებული არ არის",
  "common.loading": "იტვირთება",

  // WP-2: actions
  "action.close": "დახურვა",
  "action.cancel": "გაუქმება",
  "action.confirm": "დადასტურება",
  "action.retry": "ხელახლა ცდა",
  "action.show_details": "დეტალების ჩვენება",
  "action.hide_details": "დეტალების დამალვა",

  // WP-2: languages
  "lang.label": "ენა",
  "lang.name.ka": "ქართული",
  "lang.name.en": "ინგლისური",

  // WP-2: connection states of the console feed
  "feed.connecting": "უკავშირდება",
  "feed.live": "ცოცხალი",
  "feed.reconnecting":
    "ხელახლა უკავშირდება: ნაჩვენებია ბოლო მიღებული მონაცემები",
  "feed.closed": "კავშირი არ არის",
  "feed.frozen": "გაყინულია: განახლება არ მოსულა {age}",
  "feed.session_expired": "სესია დასრულდა: ხელახლა შედით სისტემაში",
  "feed.dropped_one": "გამოტოვებულია {count} კადრი",
  "feed.dropped_other": "გამოტოვებულია {count} კადრი",
  "feed.gap_recorded":
    "მონაცემები დაკარგულია: დაფიქსირებული წყვეტა {from}-დან {to}-მდე",

  // WP-2: source states and switches
  "source.state.healthy": "მუშაობს",
  "source.state.stale": "მოძველებული: დიდი ხანია არ ისმის",
  "source.state.lagging": "ჩამორჩება: მონაცემები კვლავ მოდის",
  "source.state.unreachable": "მიუწვდომელია: მონაცემები ინახება წყაროსთან",
  "source.state.never_heard": "არასდროს მოსმენილა",
  "source.state.disabled": "გამორთულია",
  "source.lagging_by": "ჩამორჩება {age}-ით",
  "source.disabled_by": "გამორთო: {who}",
  "source.disabled_by.type": "გამორთულია: მთელი ტიპი გამორთულია",
  "source.disabled_by.instance": "გამორთულია: ეს წყარო გამორთულია",
  "source.disabled_by.default_deny":
    "გამორთულია: ახალი წყაროები ჩართვამდე გამორთულია",
  "source.silent_since": "დუმს {time}-დან",
  "source.refused_one": "გამორთულ მდგომარეობაში უარყოფილია {count} კადრი",
  "source.refused_other": "გამორთულ მდგომარეობაში უარყოფილია {count} კადრი",

  // WP-2: ages
  "age.seconds": "{n} წმ",
  "age.minutes": "{n} წთ",
  "age.hours": "{n} სთ",
  "age.days": "{n} დღე",
  "age.ago": "{age} წინ",
  "age.since_captured": "დაფიქსირებიდან {age}",
  "age.since_received": "მიღებიდან {age}",

  // WP-2: datums and units
  "alt.amsl": "{v} მ ზღვის დონიდან",
  "alt.agl": "{v} მ მიწიდან",
  "alt.wgs84": "{v} მ WGS84 ელიფსოიდიდან",
  "alt.pressure": "{v} მ ბარომეტრული სიმაღლე",
  "alt.network": "{v} მ ზღვის დონიდან, ქსელური პროვაიდერის მონაცემით",
  "alt.pressure_note":
    "ბარომეტრული სიმაღლე აითვლება 1013,25 ჰპა-დან და არა ზღვის დონიდან: მისი ცდომილება უცნობია",
  "height.takeoff": "{v} მ აფრენის წერტილიდან",
  "height.ground": "{v} მ მიწიდან",
  "unit.speed": "{v} მ/წმ",
  "unit.distance": "{v} მ",
  "time.utc": "{time} UTC",
  "time.local": "{time} {zone}",

  // WP-2: trust and identification basis
  "track.broadcast": "სამაუწყებლო და დაუდასტურებელი",
  "track.broadcast_caveat":
    "სამაუწყებლო და დაუდასტურებელი: ამ იდენტიფიკატორს და პოზიციას ნებისმიერს შეუძლია გადასცეს.",
  "alert.broadcast_caveat":
    "ეხება სამაუწყებლო და დაუდასტურებელ ტრეკს: მისი პოზიცია მხოლოდ განცხადებაა.",
  "ident.basis.authenticated": "ავთენტიფიცირებული",
  "ident.basis.as_broadcast": "როგორც გადაცემულია, დაუდასტურებლად",
  "ident.basis.provider": "პროვაიდერის მოწოდებული, დაუდასტურებელი",
  "ident.registered_as_broadcast":
    "რეგისტრირებული, როგორც გადაცემულია, დაუდასტურებლად",

  // WP-1: the vendored shadcn/ui components' text
  "ui.close": "დახურვა",
  "ui.more": "მეტი",
  "ui.more_pages": "მეტი გვერდი",
  "ui.previous": "წინა",
  "ui.next": "შემდეგი",
  "ui.previous_page": "წინა გვერდზე გადასვლა",
  "ui.next_page": "შემდეგ გვერდზე გადასვლა",
  "ui.pagination": "გვერდები",
  "ui.breadcrumb": "ნავიგაციის ჯაჭვი",
  "ui.command_title": "ბრძანებების პანელი",
  "ui.command_description": "ბრძანების ძიება",

  // WP-3: map
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

  // WP-6: zones and restrictions
  "zone.type.PROHIBITED": "აკრძალული",
  "zone.type.REQ_AUTHORIZATION": "საჭიროებს ნებართვას",
  "zone.type.CONDITIONAL": "პირობითი",
  "zone.type.NO_RESTRICTION": "შეზღუდვის გარეშე",
  "zone.type.USPACE": "U-space საჰაერო სივრცე",
  "zone.pattern.solid": "სრული შევსება",
  "zone.pattern.hatched": "დაშტრიხული",
  "zone.pattern.dotted": "წერტილოვანი",
  "zone.pattern.none": "მხოლოდ კონტური",
  "zone.legend.title": "ზონების ტიპები",
  "zone.legend.count_one": "{count} ზონა",
  "zone.legend.count_other": "{count} ზონა",
  "zone.legend.dimmed": "გამკრთალი: სერვერის ცნობით, ზონა ახლა არ მოქმედებს.",
  "zone.legend.unstated":
    "სრულად ნაჩვენებია, როცა სერვერი არ აცნობებს, მოქმედებს თუ არა ზონა.",
  "zone.card.unnamed": "უსახელო ზონა",
  "zone.card.identifier": "იდენტიფიკატორი",
  "zone.card.type": "ტიპი",
  "zone.card.lower": "ქვედა ზღვარი",
  "zone.card.upper": "ზედა ზღვარი",
  "zone.card.message": "შეტყობინება",
  "zone.card.applicability": "მოქმედება",
  "zone.applicability.applies": "ახლა მოქმედებს, სერვერის ცნობით",
  "zone.applicability.not_applicable": "ახლა არ მოქმედებს, სერვერის ცნობით",
  "zone.card.version": "ვერსია",
  "zone.card.updated": "განახლდა",
  "restriction.card.state": "მდგომარეობა",
  "restriction.card.starts": "იწყება",
  "restriction.card.ends": "მთავრდება",
  "restriction.state.planned": "დაგეგმილი",
  "restriction.state.active": "აქტიური",
  "restriction.state.ended": "დასრულებული",
  "restriction.state.cancelled": "გაუქმებული",
  "restriction.state.unstated": "მდგომარეობა მითითებული არ არის",

  // WP-5: sign-in
  "auth.title": "შესვლა",
  "auth.username": "მომხმარებლის სახელი",
  "auth.password": "პაროლი",
  "auth.otp": "ერთჯერადი კოდი",
  "auth.submit": "შესვლა",
  "auth.submitting": "მიმდინარეობს შესვლა",
  "auth.failed": "შესვლა უარყოფილია (სტატუსი {status})",
  "auth.unreachable":
    "შესვლის სერვისთან დაკავშირება ვერ მოხერხდა. სცადეთ ხელახლა.",
  "auth.retry_in_one": "სცადეთ ხელახლა {count} წამში",
  "auth.retry_in_other": "სცადეთ ხელახლა {count} წამში",
  "auth.mfa_required":
    "პაროლი მიღებულია. შეიყვანეთ ერთჯერადი კოდი ავთენტიკატორის აპლიკაციიდან.",
  "auth.enrol":
    "თქვენს ანგარიშს ავთენტიკატორი ჯერ არ აქვს. დაამატეთ ეს გასაღები ავთენტიკატორის აპლიკაციაში და შეიყვანეთ მის მიერ ნაჩვენები კოდი.",
  "auth.enrol_key": "ავთენტიკატორის გასაღები",
  "auth.recovery_codes":
    "აღდგენის კოდები: თითოეული მუშაობს ერთხელ, ერთჯერადი კოდის ნაცვლად. შეინახეთ ისინი ახლავე; ისინი აღარ გამოჩნდება.",
  "auth.continue": "გაგრძელება",
};
