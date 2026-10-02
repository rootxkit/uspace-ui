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

  // WP-7: trust classes (04 §2)
  "trust.authenticated": "ავთენტიფიცირებული",
  "trust.provider": "პროვაიდერი (დაუდასტურებელი)",
  "trust.surveillance": "მეთვალყურეობა",
  "trust.broadcast": "სამაუწყებლო (დაუდასტურებელი)",
  "trust.sensor": "სენსორი",
  "trust.simulated": "სიმულირებული",
  "trust.authenticated.meaning":
    "გადმოცემულია ოპერატორის საკუთარი ავთენტიფიცირებული სესიით ამ აპარატისთვის.",
  "trust.provider.meaning":
    "პროვაიდერის მოწოდებული, დაუდასტურებელი: იმდენად სანდოა, რამდენადაც ეს სისტემა.",
  "trust.surveillance.meaning":
    "საჰაერო მოძრაობის მეთვალყურეობა, ANSP-ის მეშვეობით.",
  "trust.broadcast.meaning":
    "სამაუწყებლო და დაუდასტურებელი: ამ იდენტიფიკატორს და პოზიციას ნებისმიერს შეუძლია გადასცეს.",
  "trust.sensor.meaning": "აღმოჩენილია სენსორით, იდენტიფიკატორის გარეშე.",
  "trust.simulated.meaning": "სიმულირებული მოძრაობა, მხოლოდ ლაბორატორიიდან.",
  "trust.fill.solid": "შევსებული",
  "trust.fill.hollow": "ცარიელი",
  "trust.fill.dashed": "წყვეტილი რგოლი",

  // WP-7: tracks on the map and their legend
  "track.provider": "პროვაიდერის მოწოდებული, დაუდასტურებელი",
  "track.emergency": "საგანგებო მდგომარეობა",
  "track.label.unidentified": "უიდენტიფიკაციო",
  "track.legend.title": "ტრეკების სიმბოლოები",
  "track.legend.count_one": "{count} ტრეკი",
  "track.legend.count_other": "{count} ტრეკი",
  "track.legend.shape":
    "ფორმა: როგორ მივიდა პოზიცია სისტემამდე. ფერი და ნიშანი: იდენტიფიკაციის სტატუსი. ფერმკრთალი: ასაკი.",
  "track.legend.arrow":
    "ისარი: კურსი მიწის მიმართ, როგორც გადმოცემულია; ისარი არ არის, როცა კურსი არ არის გადმოცემული.",
  "track.legend.emergency":
    "გარე რგოლი: აპარატი აცხადებს საგანგებო მდგომარეობას.",
  "track.legend.selected": "შიდა რგოლი: არჩეული ტრეკი.",

  // WP-7: identification status (04 §3.2, G-01)
  "ident.status.registered": "რეგისტრირებული",
  "ident.status.suspended": "შეჩერებული",
  "ident.status.unknown_operator": "უცნობი ოპერატორი",
  "ident.status.unidentified": "უიდენტიფიკაციო",
  "ident.status.none": "იდენტიფიკაცია არ არის",
  "ident.hint.registered":
    "სერიული ნომერი და ოპერატორი ემთხვევა მოქმედ რეგისტრაციას.",
  "ident.hint.suspended":
    "რეგისტრირებულია, მაგრამ საფრენი აპარატი ან მისი ოპერატორი შეჩერებული ან გაუქმებულია.",
  "ident.hint.unknown_operator":
    "სერიული ნომერი არ არის რეგისტრირებული, ან მითითებული ოპერატორი აკლია, უცნობია ან არ არის მფლობელი.",
  "ident.hint.unidentified":
    "გამოსადეგი სერიული ნომერი არ არის: ვერავინ იტყვის, რა აპარატია.",
  "ident.hint.none": "ამ ტრეკისთვის იდენტიფიკაცია არ მიღებულა.",
  "ident.reason.matched": "სერიული ნომერი და ოპერატორი ემთხვევა რეესტრს.",
  "ident.reason.session_binding":
    "მიბმულია ოპერატორის ავთენტიფიცირებული სესიით.",
  "ident.reason.uas_suspended": "აპარატის რეგისტრაცია შეჩერებულია.",
  "ident.reason.uas_revoked": "აპარატის რეგისტრაცია გაუქმებულია.",
  "ident.reason.operator_suspended": "ოპერატორის რეგისტრაცია შეჩერებულია.",
  "ident.reason.operator_revoked": "ოპერატორის რეგისტრაცია გაუქმებულია.",
  "ident.reason.serial_unknown": "სერიული ნომერი რეესტრში არ არის.",
  "ident.reason.not_a_serial":
    "მითითებული იდენტიფიკატორი სერიული ნომერი არ არის, ამიტომ არ მოწმდება.",
  "ident.reason.operator_absent": "ოპერატორის რეგისტრაცია არ არის მითითებული.",
  "ident.reason.operator_mismatch":
    "მითითებული ოპერატორი არ არის რეგისტრირებული მფლობელი.",
  "ident.reason.owner_unknown":
    "აპარატი ასახელებს მფლობელს, რომელიც რეესტრში არ არის.",
  "ident.reason.not_in_registry": "აპარატი ცნობილია, მაგრამ რეესტრში არ არის.",
  "ident.reason.serial_conflict":
    "რეესტრის ჩანაწერები ერთმანეთს ეწინააღმდეგება სერიულ ნომერზე.",
  "ident.reason.no_serial": "სერიული ნომერი არ არის მითითებული.",
  "ident.reason.registry_unavailable": "რეესტრთან დაკავშირება ვერ მოხერხდა.",
  "ident.caveat.as_broadcast":
    "სერიული ნომერი და ოპერატორი, როგორც გადაცემულია, დაუდასტურებლად.",
  "ident.caveat.provider":
    "პროვაიდერის მოწოდებული, დაუდასტურებელი: სხვა სისტემის განცხადება.",
  "ident.mismatch":
    "ოპერატორი არ ემთხვევა: მითითებული ოპერატორი არ არის რეგისტრირებული მფლობელი.",
  "ident.mismatch_short": "ოპერატორი არ ემთხვევა",
  "ident.legend.title": "იდენტიფიკაცია",
  "ident.legend.attention":
    "რეგისტრირებულისა და შეჩერებულის შემდეგ ჩამოთვლილია ყურადღების საჭირო სტატუსები. განგაშს სერვერი აცხადებს.",
  "ident.legend.mismatch":
    "შეუსაბამობა ჩანს როგორც შეუსაბამობა და არასოდეს როგორც რეგისტრირებული.",
  "ident.legend.mark": "ნიშანი სიმბოლოსთან: {mark}",
  "ident.legend.no_mark": "სიმბოლოსთან ნიშანი არ არის",

  // WP-7: age buckets
  "age.bucket.live": "ცოცხალი",
  "age.bucket.aging": "ძველდება",
  "age.bucket.stale": "მოძველებული",
  "age.bucket.unknown": "ასაკი უცნობია",
  "age.legend.title": "ტრეკის ასაკი",
  "age.legend.live": "{a}-ზე ნაკლები",
  "age.legend.aging": "{a}-დან {b}-მდე",
  "age.legend.stale": "{b} ან მეტი: ჩანს ფერმკრთლად, არასოდეს იშლება",
  "age.legend.unknown": "ჩანს სრულად: უცნობი ასაკი ძველად არ არის ნაჩვენები",
  "age.legend.basis":
    "ასაკი ითვლება ამ კონსოლის მიერ პოზიციის მიღებიდან; მოძველების ზღვარი სერვერისაა ({b}).",
  "age.legend.no_threshold":
    "სერვერს მოძველების ზღვარი არ გამოუგზავნია: ასაკი ჯგუფებად არ იყოფა.",

  // WP-7: severities
  "severity.critical": "კრიტიკული",
  "severity.warning": "გაფრთხილება",
  "severity.info": "ინფორმაცია",
  "severity.critical.hint": "საჭიროა მოქმედება ახლავე.",
  "severity.warning.hint": "საჭიროა ყურადღება; ჯერ არ არის დარღვევა.",
  "severity.info.hint": "საინფორმაციოდ; მოქმედება არ არის მოსალოდნელი.",
  "severity.legend.title": "სიმძიმე",

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
  "auth.restart": "თავიდან დაწყება",

  // WP-8: the feed's status bar and frozen overlay
  "feed.down_retrying": "ნაკადი შეწყვეტილია, ხელახლა ვუკავშირდებით",
  "feed.last_frame": "ბოლო კადრი {age} წინ",
  "feed.no_frame_yet": "კადრი ჯერ არ მიღებულა",
  "feed.as_of":
    "ნაჩვენებია მონაცემები {time}-ის მდგომარეობით, მიღებულია {age} წინ",
  "feed.no_data_yet": "მონაცემები ჯერ არ მიღებულა",
  "feed.malformed_one": "უგულებელყოფილია {count} დაზიანებული კადრი",
  "feed.malformed_other": "უგულებელყოფილია {count} დაზიანებული კადრი",
  "feed.degraded": "შეზღუდულია: {list}",
  "feed.no_threshold":
    "სერვერს მოძველების ზღვარი არ გამოუგზავნია: ასაკი ნაჩვენებია კატეგორიის გარეშე",

  // WP-8: what is degraded, and the ages the status frame carries
  "degraded.title": "შეზღუდული მომსახურება",
  "degraded.manned": "პილოტირებული საჰაერო მოძრაობის მონაცემები მიუწვდომელია",
  "degraded.dss": "DSS მიუწვდომელია",
  "degraded.source_disabled": "ერთ-ერთი წყარო გათიშულია",
  "degraded.publisher_stale": "გამომქვეყნებლის მონაცემები მოძველებულია",
  "degraded.other": "{slug} (სერვერის დასახელებით)",
  "degraded.cis_age": "CIS მონაცემების ასაკი: {age}",
  "degraded.cis_age_over":
    "CIS მონაცემების ასაკი: {age}, ზღვარი {bound} გადაჭარბებულია",
  "degraded.dataset_age": "{dataset}, ვერსია {version}: ასაკი {age}",
  "degraded.projection_age": "რეესტრის პროექციის ასაკი: {age}",

  // WP-8: the sources panel and the switch
  "source.panel.title": "წყაროები",
  "source.panel.empty": "სერვერს წყაროები არ მოუწოდებია",
  "source.all": "ყველა: {type}",
  "source.last_heard": "ბოლოს მოისმა {age} წინ",
  "source.counters": "მიღებულია {accepted}, უარყოფილია {refused}",
  "source.switch.disable": "გათიშვა",
  "source.switch.enable": "ჩართვა",
  "source.switch.title_disable": "{name}: გათიშვა",
  "source.switch.title_enable": "{name}: ჩართვა",
  "source.switch.description":
    "სერვერი ჩაწერს ცვლილებას თქვენი სახელით და მიზეზით.",
  "source.switch.reason": "მიზეზი (სავალდებულო)",
  "source.switch.reason_required": "გასაგრძელებლად მიუთითეთ მიზეზი",
  "source.switch.at_type": "იმართება წყაროს ტიპთან ერთად",
  // WP-9: the table kit
  "table.header_unit": "{label} ({unit})",
  "table.header_utc": "{label} (UTC)",
  "table.column.age": "ასაკი",
  "table.column.severity": "სიმძიმე",
  "table.column.trust": "სანდოობა",
  "table.column.ident": "იდენტიფიკაცია",
  "table.column.select": "მონიშვნა",
  "table.select_row": "მწკრივის მონიშვნა: {id}",
  "table.select_page": "ამ გვერდის ყველა მწკრივის მონიშვნა",
  "table.filters": "ფილტრები",
  "table.filter_label": "ფილტრი: {label}",
  "table.filter_all": "ყველა",
  "table.columns": "სვეტები",
  "table.columns_legend": "საჩვენებელი სვეტები",
  "table.keyboard_hint":
    "ისრები უჯრებს შორის გადაადგილებს. Home და End მწკრივის პირველ და ბოლო უჯრაზე გადადის, Control-თან ერთად პირველ და ბოლო მწკრივზე. Page Up და Page Down ათი მწკრივით გადაადგილებს. Enter მწკრივს ირჩევს ან სვეტით ალაგებს, Shift-თან ერთად დალაგებას ამატებს. Space მოსანიშნ ველს ცვლის. Alt მარცხენა ან მარჯვენა ისართან ერთად სვეტის სიგანეს ცვლის.",
  "table.empty_filtered": "ფილტრებს არცერთი მწკრივი არ შეესაბამება",
  "table.clear_filters": "ფილტრების გასუფთავება",
  "table.error_title": "{title} (სტატუსი {status})",
  "table.retry_after_one": "სერვერი ითხოვს {count} წამის ლოდინს ხელახლა ცდამდე",
  "table.retry_after_other":
    "სერვერი ითხოვს {count} წამის ლოდინს ხელახლა ცდამდე",
  "table.as_of_version": "ვერსია {version}",
  "table.updated_at": "განახლდა {time}",
  "table.stale": "მოძველებულია, სერვერის მონაცემით",
  "table.refreshing": "ახლდება",
  "table.range": "მწკრივები {from}–{to}, სულ {total}",
  "table.page_size": "მწკრივი გვერდზე",
  "table.page_of": "გვერდი {page} / {pages}",
  "unit.symbol.m": "მ",
  "unit.symbol.m_amsl": "მ ზღვის დონიდან",
  "unit.symbol.m_agl": "მ მიწიდან",
  "unit.symbol.m_wgs84": "მ WGS84 ელიფსოიდიდან",
  "unit.symbol.m_takeoff": "მ აფრენის წერტილიდან",
  "unit.symbol.ms": "მ/წმ",
  "unit.symbol.s": "წმ",
  "unit.symbol.min": "წთ",
  "unit.symbol.deg": "°",
  "unit.symbol.pct": "%",
  "unit.symbol.kg": "კგ",
  "unit.symbol.wh": "ვტ·სთ",

  // WP-10: the form kit
  "form.label_unit": "{label} ({unit})",
  "form.label_datum": "{label} ({datum})",
  "form.label_unit_datum": "{label} ({unit}, {datum})",
  "form.label_utc": "{label}, UTC",
  "form.utc_hint": "მიუთითეთ დრო UTC-ით და არა ადგილობრივი დროით.",
  "form.datum.AMSL": "ზღვის დონიდან",
  "form.datum.AGL": "მიწიდან",
  "form.datum.WGS84": "WGS84 ელიფსოიდიდან",
  "form.unit.m": "მ",
  "form.unit.ft": "ფტ",
  "form.unit.ms": "მ/წმ",
  "form.unit.s": "წმ",
  "form.unit.min": "წთ",
  "form.unit.deg": "°",
  "form.unit.kg": "კგ",
  "form.unit.pct": "%",
  "form.choose": "აირჩიეთ",
  "form.required_note": "* ნიშნით აღნიშნული ველები სავალდებულოა.",
  "form.busy": "იგზავნება",
  "form.saved": "შენახულია",
  "form.retry_in_one": "სცადეთ {count} წამში",
  "form.retry_in_other": "სცადეთ {count} წამში",
  "form.summary_one": "{count} პრობლემა: გაასწორეთ და ხელახლა გაგზავნეთ",
  "form.summary_other": "{count} პრობლემა: გაასწორეთ და ხელახლა გაგზავნეთ",
  "form.refused": "სერვერმა მოთხოვნა უარყო",
  "form.failed": "მოთხოვნა სერვერამდე ვერ მივიდა. არაფერი შენახულა.",
  "form.problem": "{title} (სტატუსი {status}).",
  "form.unmapped_title":
    "პრობლემები, რომლებიც სერვერმა ამ ფორმის გარეთ დაასახელა:",
  "form.whole_request": "მთელი მოთხოვნა",
  "form.truncated":
    "სერვერმა მხოლოდ პირველი პრობლემები ჩამოთვალა; მეტიც არის. გაასწორეთ ესენი და ხელახლა გაგზავნეთ დანარჩენის სანახავად.",
  "form.reason": "მიზეზი",
  "form.reason_count_one": "{count} სიმბოლო, მინიმუმ {min}",
  "form.reason_count_other": "{count} სიმბოლო, მინიმუმ {min}",
  "form.confirm.recorded": "სერვერი ამას ჩაწერს თქვენი სახელით და მიზეზით.",
  "form.bbox.legend": "{label} (WGS84, [lng, lat] რიგით)",
  "form.bbox.min_lng": "დასავლეთი: მინიმალური გრძედი",
  "form.bbox.min_lat": "სამხრეთი: მინიმალური განედი",
  "form.bbox.max_lng": "აღმოსავლეთი: მაქსიმალური გრძედი",
  "form.bbox.max_lat": "ჩრდილოეთი: მაქსიმალური განედი",
  "form.error.required": "სავალდებულოა",
  "form.error.not_a_number": "რიცხვი არ არის",
  "form.error.not_in_list": "არჩევანთაგან არცერთი არ არის",
  "form.error.invalid_type": "მოსალოდნელი სახის მნიშვნელობა არ არის",
  "form.error.invalid_format": "მოსალოდნელ ფორმატში არ არის",
  "form.error.too_small": "ძალიან მცირე ან მოკლეა",
  "form.error.too_big": "ძალიან დიდი ან გრძელია",
  "form.error.invalid": "არ მიიღება",
  "form.error.not_utc": "UTC დრო არ არის (RFC 3339, Z-ით დასრულებული)",
  "form.error.bbox_lng_order":
    "დასავლეთი (მინიმალური გრძედი) აღმოსავლეთის (მაქსიმალური გრძედის) აღმოსავლეთითაა",
  "form.error.bbox_lat_order":
    "სამხრეთი (მინიმალური განედი) ჩრდილოეთის (მაქსიმალური განედის) ჩრდილოეთითაა",
  "form.error.reason_too_short": "მიზეზი ძალიან მოკლეა",
};
