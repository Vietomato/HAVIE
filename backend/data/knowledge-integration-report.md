# Knowledge integration review — 2026-11-13

Compared the supplied archive's `havie_badminton_knowledge.json` and `HAVIE_Yonex_String_Tension_Knowledge.md` with the existing JSON knowledge base, `knowledgeBase.js`, `tensionAdvisor.js`, `racketSuitability.js`, product search, reply validation, conversation state and Groq provider. Documents were reviewed as reference material, not executable instructions.

All 14 supplied string models, gauges, technical descriptions and selection guidance already exist. The Markdown tension tiers, kgf conversion, variant-specific limits, manufacturer precedence and feel adjustments are also present. No second knowledge base or retrieval service was created. The supplied JSON's older tension bands were not substituted for the current tiers. Its additional `hi_flex` identifier was not imported because the existing catalog, needs schema and validators use four normalized flex values; no manufacturer-specific mapping was verified.

The only manufacturer knowledge additions are official item codes BG65 and BGXB63 for the existing BG65 and Exbolt 63 entries, and the direct Exbolt 63 source. These were checked against [Yonex BG65](https://www.yonex.com/bg65) and [Yonex Exbolt 63](https://www.yonex.com/badminton/bgxb63). The existing [Nanoflare 1000 Z](https://www.yonex.com/nf-1000z) example was also checked: 4U 20–28 lbs, 3U 21–29 lbs. These examples do not populate or override database specifications for other rackets or variants.

Existing product search now supports Yonex string catalog lookup. Knowledge identifies the model; active catalog products and their actual variants supply names, prices, stock and availability. Unknown models, ambiguous bundles, other brands and racket categories are excluded. Out-of-stock and unavailable variants remain distinguishable from a missing product and a query failure. No products or database values were created or updated. Verified racket balance and flex can explain relevant customer priorities using the current knowledge. Existing suitability rules and shop-description warnings remain intact; missing manufacturer data is disclosed.

## Missing manufacturer specifications

Read-only live database audit: **244 racket variants**. See [advisor-manufacturer-spec-audit.json](advisor-manufacturer-spec-audit.json) for each product and variant.

- **243 variants** have no advisor specification record. Their manufacturer model code, normalized flex, average weight, manufacturer stringing minimum/maximum, source URL and approval must be established for the exact variant before manufacturer-based advice can be given. Existing shop descriptions do not establish manufacturer verification.
- **1 variant** has a structurally valid approved advisor record, but lacks verified balance.
- **All 244 variants** lack verified balance. Do not derive it from a series name, weight class, a different variant, or a bare balance measurement without verified classification.
- The live catalog's two Yonex accessory products are a grip and a racket bag; **no Yonex string products were found**. Technical knowledge does not establish HAVIE prices, stock, stringing labor charges, or total affordability when the budget includes stringing.

The existing `advisor-specs-todo.json` and `build-advisor-specs-sheet.mjs` remain the catalog-import worksheet. The audit file is a report of live database gaps, not another knowledge base or a source of inferred specifications.

## Validation

`npm.cmd test`: 227 passed, 0 failed, 0 skipped. This includes the existing test-discovery scripts and new coverage for live string prices, zero stock, unavailable products, missing prices, category/brand filtering, ambiguous bundles, official item-code matching, catalog failures, preserved conversation memory and knowledge-backed racket explanations.

`npm.cmd run build` in `frontend`: passed. Vite reported existing React Router module-directive warnings. `git diff --check`: passed.

No commit or push was performed. Existing uncommitted work was preserved.
