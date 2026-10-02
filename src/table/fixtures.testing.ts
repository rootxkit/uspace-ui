// Synthetic rows for the table tests and stories (spec 06 §4: GEO-TEST-*
// numbers, TEST* serials, no real data): a registry-shaped list, a
// deliveries list with freshness, and the problem a refused read returns.
import type { Freshness } from "../api/freshness.js";
import type {
  Identification,
  Problem,
  Severity,
  Trust,
} from "../model/index.js";

export const REG_STATUSES = [
  "active",
  "suspended",
  "revoked",
  "expired",
] as const;
export type RegStatus = (typeof REG_STATUSES)[number];

/** One registration, as an app's adapter would hand it to the table. */
export interface RegistrationRow {
  id: string;
  regNumber: string;
  serial: string | null;
  status: RegStatus;
  /** Personal data: shown to the roles that may see it, never in a URL. */
  email: string | null;
  massKg: number | null;
  maxAltAmslM: number | null;
  updatedAt: string | null;
}

const STATUS_CYCLE: readonly RegStatus[] = REG_STATUSES;

/** `n` registrations, deterministic. */
export function registrationRows(n: number): RegistrationRow[] {
  const rows: RegistrationRow[] = [];
  for (let i = 0; i < n; i++) {
    const k = String(i + 1).padStart(5, "0");
    rows.push({
      id: `reg-${k}`,
      regNumber: `GEO-TEST-${k}`,
      serial: i % 7 === 3 ? null : `TEST${k}`,
      status: STATUS_CYCLE[i % STATUS_CYCLE.length] ?? "active",
      email: i % 5 === 0 ? null : `pilot${k}@example.test`,
      massKg: i % 6 === 2 ? null : ((i * 37) % 2500) / 100,
      maxAltAmslM: i % 9 === 4 ? null : 400 + ((i * 53) % 900),
      updatedAt:
        i % 8 === 5
          ? null
          : new Date(Date.UTC(2026, 8, 1) + i * 3_600_000).toISOString(),
    });
  }
  return rows;
}

/** One row of a picture-shaped list: severity, trust, identification, age. */
export interface PictureRow {
  id: string;
  severity: Severity | null;
  trust: Trust | null;
  identification: Identification | null;
  receivedAtMs: number | null;
  kind: string | null;
}

const ident = (over: Partial<Identification>): Identification => ({
  status: "registered",
  reason: "matched",
  serial: "TEST00001",
  operatorReg: "GEO-TEST-OP-1",
  registeredOperatorReg: "GEO-TEST-OP-1",
  mismatch: false,
  basis: "authenticated",
  ...over,
});

export const PICTURE_NOW_MS = Date.UTC(2026, 9, 2, 9, 15, 6);

export function pictureRows(): PictureRow[] {
  return [
    {
      id: "p1",
      severity: "critical",
      trust: "authenticated",
      identification: ident({}),
      receivedAtMs: PICTURE_NOW_MS - 2000,
      kind: "height_exceedance",
    },
    {
      id: "p2",
      severity: "warning",
      trust: "broadcast",
      identification: ident({ basis: "as_broadcast" }),
      receivedAtMs: PICTURE_NOW_MS - 45_000,
      kind: "zone_incursion",
    },
    {
      id: "p3",
      severity: "info",
      trust: "provider",
      identification: ident({
        basis: "provider",
        status: "suspended",
        reason: "uas_suspended",
      }),
      receivedAtMs: PICTURE_NOW_MS - 15_000,
      kind: "proximity",
    },
    {
      id: "p4",
      severity: null,
      trust: "broadcast",
      identification: ident({
        basis: "as_broadcast",
        mismatch: true,
        reason: "operator_mismatch",
      }),
      receivedAtMs: null,
      kind: null,
    },
    {
      id: "p5",
      severity: "warning",
      trust: null,
      identification: null,
      receivedAtMs: PICTURE_NOW_MS - 1000,
      kind: "lost_link",
    },
  ];
}

/** What a refused list read returns (RFC 9457, M28). */
export const REFUSED: Problem = {
  type: "https://schemas.uspace.ge/problems/cis_stale",
  title: "CIS data out of date",
  status: 503,
  detail: "The dataset has not been refreshed within its bound.",
  instance: null,
  errors: [],
};

export const FRESHNESS: Freshness = {
  etag: '"v42"',
  version: "42",
  updatedAt: "2026-10-02T09:14:00Z",
  ageS: 66,
  stale: false,
};

/** One delivery of a publication, as the CISP lists them. */
export interface DeliveryRow {
  id: string;
  subscriber: string;
  dataset: string;
  version: string;
  deliveredAt: string | null;
  latencyS: number | null;
  state: "delivered" | "pending" | "failed";
}

export function deliveryRows(): DeliveryRow[] {
  return [
    {
      id: "d1",
      subscriber: "TEST-USSP-1",
      dataset: "zones",
      version: "42",
      deliveredAt: "2026-10-02T09:14:02Z",
      latencyS: 1.8,
      state: "delivered",
    },
    {
      id: "d2",
      subscriber: "TEST-USSP-2",
      dataset: "zones",
      version: "42",
      deliveredAt: null,
      latencyS: null,
      state: "pending",
    },
    {
      id: "d3",
      subscriber: "TEST-ANSP-1",
      dataset: "uspace_airspace",
      version: "7",
      deliveredAt: "2026-10-02T08:59:40Z",
      latencyS: 12.4,
      state: "failed",
    },
  ];
}

/** The app's own catalogue for the fixture columns, in both languages. */
export const APP_CATALOGUES = {
  en: {
    "reg.regNumber": "Registration number",
    "reg.serial": "Serial",
    "reg.status": "Status",
    "reg.status.active": "Active",
    "reg.status.suspended": "Suspended",
    "reg.status.revoked": "Revoked",
    "reg.status.expired": "Expired",
    "reg.email": "Email",
    "reg.massKg": "Mass",
    "reg.maxAltAmslM": "Ceiling",
    "reg.updatedAt": "Updated",
    "reg.caption": "Registered aircraft",
    "reg.empty": "No registrations yet",
    "pic.kind": "Kind",
    "pic.kind.height_exceedance": "Height limit exceeded",
    "pic.kind.zone_incursion": "Zone incursion",
    "pic.kind.proximity": "Proximity",
    "pic.kind.lost_link": "No link to the operator",
    "dlv.subscriber": "Subscriber",
    "dlv.dataset": "Dataset",
    "dlv.version": "Version",
    "dlv.deliveredAt": "Delivered",
    "dlv.latencyS": "Latency",
    "dlv.state": "State",
    "dlv.state.delivered": "Delivered",
    "dlv.state.pending": "Pending",
    "dlv.state.failed": "Failed",
  },
  ka: {
    "reg.regNumber": "რეგისტრაციის ნომერი",
    "reg.serial": "სერიული ნომერი",
    "reg.status": "სტატუსი",
    "reg.status.active": "აქტიური",
    "reg.status.suspended": "შეჩერებული",
    "reg.status.revoked": "გაუქმებული",
    "reg.status.expired": "ვადაგასული",
    "reg.email": "ელფოსტა",
    "reg.massKg": "მასა",
    "reg.maxAltAmslM": "ჭერი",
    "reg.updatedAt": "განახლდა",
    "reg.caption": "რეგისტრირებული საჰაერო ხომალდები",
    "reg.empty": "რეგისტრაციები ჯერ არ არის",
    "pic.kind": "სახე",
    "pic.kind.height_exceedance": "სიმაღლის ზღვარი გადაჭარბებულია",
    "pic.kind.zone_incursion": "ზონაში შეჭრა",
    "pic.kind.proximity": "სიახლოვე",
    "pic.kind.lost_link": "ოპერატორთან კავშირი შეწყდა",
    "dlv.subscriber": "გამომწერი",
    "dlv.dataset": "მონაცემთა ნაკრები",
    "dlv.version": "ვერსია",
    "dlv.deliveredAt": "მიწოდებულია",
    "dlv.latencyS": "დაყოვნება",
    "dlv.state": "მდგომარეობა",
    "dlv.state.delivered": "მიწოდებულია",
    "dlv.state.pending": "მოლოდინში",
    "dlv.state.failed": "ვერ მიეწოდა",
  },
} as const;
