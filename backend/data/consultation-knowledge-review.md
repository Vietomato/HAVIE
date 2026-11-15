# Consultation knowledge update — 2026-11-14

The supplied notes were compared with the existing knowledge base and manufacturer sources. The same `havie_badminton_knowledge.json`, `knowledgeBase.js`, product search, conversation state, Groq writer and safety checks remain in use. No parallel knowledge store, model training, catalog products or prices were created in this update.

## Integrated behavior

- Twelve sourced consultation topics cover BP, beginner balance selection, gauge tradeoffs, tension retention, wide feet, shoe sizing, stability, cushioning, shoe fit, frame damage, tension myths and smashing tradeoffs.
- Theory questions receive relevant knowledge without asking for shopping details. Shopping requests still use the existing needs, budget, racket suitability and shoe-size flow. Stored needs and pending questions survive educational detours.
- Named model questions can retrieve public catalog prices directly, without first asking budget or skill. Prices remain tied to actual product records and variants; similar names are not silently merged. Technical comparisons use approved manufacturer specifications, otherwise the missing data is disclosed.
- Named racket tension checks select the requested weight variant. Ambiguous catalog matches do not supply an assumed limit. Frame damage prevents confirming a tension from afar.
- Inventory counts, internal data, account/personal information and secrets remain blocked in chatbot replies and candidate payloads. Price lookup exposes only public prices and product identity.

## Qualifications to the supplied notes

1. **BP boundaries:** do not turn the suggested 285/295 mm bands into universal manufacturer classifications. The supplied ranges overlap at 295 mm, and 285–290 mm is within the supplied even-balance range rather than its head-light range. Bare measurements do not populate manufacturer `balanceType` in the database. The [Yonex 2026 selector](https://www.yonex.com/media/wysiwyg/Catalog/Yonex_Badminton_2026.pdf) supports directional distinctions, not an automatic classification of every model by those two numbers.
2. **Power and durability:** head-light does not inevitably mean a weak smash; head-heavy does not guarantee more power. Gauge alone does not prove tension retention, low stretch or durability against every other construction. The [Exbolt 68 announcement](https://www.yonex.com/news/exbolt-68-hard-hitting-smashes/) discusses material and construction alongside gauge.
3. **Tension:** preserve the current educational tiers, conversion factor and variant-specific manufacturer precedence. Do not replace them with a universal “8.5–10 / 10–10.5 / 11+ kg” prescription. No tension is promised to prevent injury, and a damaged frame requires direct inspection. [Yonex product safety](https://www.yonex.com/product-safety) emphasizes suitability and inspecting equipment.
4. **Nanogy 98:** added as a source-qualified technical entry, without importing a shop product or price. The [Yonex 2024 catalog](https://www.yonex.com/media/wysiwyg/2024-Yonex-Badminton-Catalog.pdf) gives **0.66 mm**; the [current Yonex USA page](https://us.yonex.com/products/nanogy-98-set) gives **0.69 mm**. Replies disclose this conflict and request verification against the exact NBG98 packaging/version rather than asserting either as the current shop specification.
5. **Shoes:** fit, width and stability guidance is grounded in [Yonex fitting guidance](https://www.yonex.com/news/find-your-winning-fit-the-new-power-cushion-65-z-in-4-distinct-fits/), [stability design](https://www.yonex.com/news/new-power-cushion-eclipsion-reliability-built-on-stability/) and product safety. Do not transfer a technology, fit, weight or size conversion between models. A larger size is not automatically a substitute for a wide fit.

## Current data limitations

The existing manufacturer-specification gaps remain; this update does not approve or fabricate database specs. A live named-model check found two similarly named Nanoflare 1000 Z products with different catalog prices. Both prices are reported against their actual product names; no records were merged, repriced or deleted. A precise tension check asks for disambiguation when necessary.

## Example questions

- “BP 295 mm là nặng đầu hay cân bằng?”
- “Vợt nhẹ đầu có đập yếu không?”
- “Dây mỏng và dây dày khác nhau thế nào?”
- “Tôi muốn biết về cước Nanogy 98.”
- “Người mới chơi nên căng bao nhiêu kg?”
- “Căng càng cao càng mạnh phải không?”
- “Chân bè nên chọn giày cầu lông như thế nào?”
- “Giày nhẹ hay đệm êm tốt hơn?”
- “Astrox 88D Tour giá bao nhiêu?”
- “Giày Yonex 65Z4 giá bao nhiêu?”
- “So sánh thông số Astrox 88D Pro và Astrox 88D Tour.”
- “Nanoflare 1000Z 4U căng 29 lbs được không?”

Validation: **252 tests passed, 0 failed**. Coverage includes topic/source validation, pure education routing, catalog matching, 88D/88S and edition distinctions, preservation of conversation needs, missing specifications, damaged-frame refusal, weight-specific limits, privacy and dangerous rewrite detection. No commit or push performed.
