// Builds public/data/vn-administrative-units.json, the province/district/ward list used by checkout.
// Source: https://provinces.open-api.vn/api/v1/?depth=3 (63 provinces, 3 levels).
// Usage: download that URL to a file, then run
//   node scripts/build-vn-administrative-units.mjs <downloaded.json>
// Output shape (names only, to keep the file small):
//   [[provinceName, [[districtName, [wardName, ...]], ...]], ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [source] = process.argv.slice(2);
if (!source) {
  console.error("Usage: node scripts/build-vn-administrative-units.mjs <downloaded.json>");
  process.exit(1);
}

const name = (value) => {
  if (typeof value !== "string" || !value.trim() || value.length > 80) {
    throw new Error(`Invalid name: ${JSON.stringify(value)}`);
  }
  return value.trim();
};

const provinces = JSON.parse(fs.readFileSync(source, "utf8")).map((province) => [
  name(province.name),
  (province.districts ?? []).map((district) => [
    name(district.name),
    (district.wards ?? []).map((ward) => name(ward.name)),
  ]),
]);

const output = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/data/vn-administrative-units.json");
fs.writeFileSync(output, JSON.stringify(provinces));
console.log(`Wrote ${provinces.length} provinces to ${output}`);
