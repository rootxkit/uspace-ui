# Bundled fonts: sources, licence and checksums

The four `woff2` files here are subsets of the Noto fonts, made by
`scripts/subset-fonts.sh` (run by hand; CI never downloads a font). They
are loaded through `@rootxkit/uspace-ui/fonts` (next/font) or
`fonts/fonts.css`, so a console makes no font request to a third party
(docs/PLAN.md D7, spec `06 §4`). `src/fonts/fonts.test.ts` checks every
Georgian block, the Latin set, the size budget and the checksums below.

## Licence

Both families are under the SIL Open Font License 1.1, shipped as
`LICENSE-OFL.txt`. That file is the two upstream `OFL.txt` files joined:
they differ only in their copyright line, so it carries both copyright
lines followed by the licence text once. Neither upstream file declares a
Reserved Font Name, so a subset may keep the name "Noto Sans" (OFL
condition 3 does not apply). The OFL allows bundling and redistribution
with software (condition 1) provided the licence travels with the fonts
(condition 2), which `package.json` `files` ensures.

| Upstream `OFL.txt`                        | SHA-256                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `NotoSans-v2.015.zip` → `OFL.txt`         | `cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a` |
| `NotoSansGeorgian-v2.005.zip` → `OFL.txt` | `8c02263c5d73d40544f9ed91e30c4e947407057a3cc430d7b786189aeceff6df` |

## Sources

| Family             | Version            | Release archive                                                                                             | Archive SHA-256                                                    |
| ------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Noto Sans          | 2.015 (2024-11-20) | https://github.com/notofonts/latin-greek-cyrillic/releases/download/NotoSans-v2.015/NotoSans-v2.015.zip     | `0c34df072a3fa7efbb7cbf34950e1f971a4447cffe365d3a359e2d4089b958f5` |
| Noto Sans Georgian | 2.005 (2024-02-14) | https://github.com/notofonts/georgian/releases/download/NotoSansGeorgian-v2.005/NotoSansGeorgian-v2.005.zip | `10e85011008108308e6feab0408242acb07804da61ede3d3ff236461ae07ab1b` |

The input files are the unhinted TrueType faces in each archive:

| Input                                                        | SHA-256                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `NotoSans/unhinted/ttf/NotoSans-Regular.ttf`                 | `f3961a9cde016d41a4879aecda1474d3a36d6bf54fa0e4643de029cc2248b0e8` |
| `NotoSans/unhinted/ttf/NotoSans-Bold.ttf`                    | `87cb2d84472a7d66da659ee47b6cdb9552326e8c128245231f191b6ac72529d9` |
| `NotoSansGeorgian/unhinted/ttf/NotoSansGeorgian-Regular.ttf` | `f4b229b126859725b75031dd8c051335d20c85e4eb6d525af28f3e83e471baa4` |
| `NotoSansGeorgian/unhinted/ttf/NotoSansGeorgian-Bold.ttf`    | `517722454bbe6587ada79a0509db8c9b292b6a40b025eebe69c151a6508efc7e` |

Noto Sans Georgian 2.005 covers every assigned code point of the
Georgian (Asomtavruli and Mkhedruli), Georgian Extended (Mtavruli) and
Georgian Supplement (Nuskhuri) blocks of Unicode 16.0: 40, 48, 46 and 40
code points. That was read from the font's `cmap` before subsetting and
is what the test checks after.

## Subset command

```sh
pip install fonttools==4.51.0 brotli==1.0.9
sh scripts/subset-fonts.sh
```

The script downloads the two archives (or reuses them from
`$SUBSET_FONTS_CACHE`, default `.cache/fonts`), checks their SHA-256,
and runs, for each weight:

```sh
pyftsubset NotoSans-<Weight>.ttf --unicodes="<latin range>" \
  --flavor=woff2 --no-hinting --output-file=fonts/NotoSans-<Weight>.woff2
pyftsubset NotoSansGeorgian-<Weight>.ttf --unicodes="<georgian range>" \
  --flavor=woff2 --no-hinting --output-file=fonts/NotoSansGeorgian-<Weight>.woff2
```

with the ranges of `src/fonts/faces.ts` (the test compares the script,
`faces.ts`, `index.ts` and `fonts.css`). Run twice on 2026-10-02 with
fontTools 4.51.0 and brotli 1.0.9: both runs gave the same bytes.

The Latin range is narrower than the four whole blocks the plan names
("Latin, Latin Extended, Greek, Cyrillic"): Latin Extended-B and the
combining marks are cut to what the region's Latin orthographies use.
With all of Latin Extended-B and the combining block the two Latin files
were 98.9 kB with Noto's default layout features and the total exceeded
the 120 kB budget of PLAN §8.

## Output

```
9480379181740e04f67cee5b629201f0dd6863c1e567772159272911ea54e449  NotoSans-Regular.woff2
952aa8ffcbd4b3acce8f97d52bb96b34a47f217c6ff76fab4cdf6ebf39890592  NotoSans-Bold.woff2
ccfe428becfbefa9670bb83c3672bd47d9858c0597ad5aaf8456d43bf1175946  NotoSansGeorgian-Regular.woff2
b77bf12570f3986a31475cf44f9eb91d627e0c99d7c2b093173aaa31aa2a8d33  NotoSansGeorgian-Bold.woff2
```

| File                             | Bytes                                                |
| -------------------------------- | ---------------------------------------------------- |
| `NotoSans-Regular.woff2`         | 34 648                                               |
| `NotoSans-Bold.woff2`            | 35 404                                               |
| `NotoSansGeorgian-Regular.woff2` | 13 588                                               |
| `NotoSansGeorgian-Bold.woff2`    | 14 156                                               |
| Total                            | 97 796 (budget 122 880, `package.json` `fontBudget`) |

## Updating

Bump the tags and checksums in `scripts/subset-fonts.sh`, run it, read
the new `cmap` coverage, replace the tables above, and run `pnpm test`.
A new release can drop a glyph; the test is what notices.
