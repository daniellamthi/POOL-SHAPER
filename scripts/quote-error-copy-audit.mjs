import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";

const output = join(process.cwd(), "node_modules/.cache/quote-error-i18n.mjs");
await build({
  input: "src/lib/i18n/index.tsx",
  output: { file: output, format: "esm" },
  platform: "node",
  external: ["react", "react/jsx-runtime"],
  resolve: { alias: { "@": join(process.cwd(), "src") } },
});
const { translateText } = await import(pathToFileURL(output).href);
const source = readFileSync("src/configurator/steps/final-review/LeadRequestDialog.tsx", "utf8");
const message = "Le tue scelte e i dati inseriti restano in questa pagina. Puoi riprovare.";
assert(source.includes(`t(${JSON.stringify(message)})`));
assert(!source.includes("La tua configurazione resta salvata"));
let checks = 2;
for (const [locale, expected] of [
  ["it", message],
  ["en", "Your selections and entered details remain on this page. You can try again."],
]) {
  assert.equal(translateText(message, locale), expected);
  for (const failure of [
    "Salvataggio del progetto non riuscito. Riprova prima di inviare la richiesta.",
    "Invio non riuscito. Riprova tra poco.",
  ]) {
    const alert = `${translateText(failure, locale)} ${translateText(message, locale)}`;
    assert(
      !/resta salvata|remains saved/i.test(alert),
      "Failure must not assert a successful save",
    );
    assert.match(alert, locale === "it" ? /questa pagina.*riprovare/i : /this page.*try again/i);
    checks += 2;
  }
  checks++;
}
console.log(
  JSON.stringify({
    status: "PASS",
    checks,
    scope:
      "Current error-alert wiring and real IT/EN translation; browser failure/retry required separately; no network",
  }),
);
