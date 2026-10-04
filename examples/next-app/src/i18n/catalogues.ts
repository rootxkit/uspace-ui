// The example's own ka/en catalogues, handed to the kit's I18nProvider
// (which puts them ahead of the kit's). Every display string comes from
// here or from the kit.
import type { Catalogues } from "@rootxkit/uspace-ui/i18n";
import en from "./en.json";
import ka from "./ka.json";

export const catalogues: Catalogues = { ka, en };
