import assert from "node:assert/strict";
import { build } from "rolldown";

const { output } = await build({ input: "src/components/pool/wizard/wizard-guidance.ts", output: { format: "esm" }, write: false });
const bundle = output.find(chunk => chunk.type === "chunk");
assert(bundle, "Guidance helper bundles");
const { captureWizardChoice, nextWizardOptions, revealWizardOptions, claimWizardGuidance, wizardGuidanceVersion } =
  await import(`data:text/javascript;base64,${Buffer.from(`${bundle.code}\n//# sourceURL=wizard-guidance-under-test.mjs`).toString("base64")}`);

// Minimal DOM contract, including document order and hidden ancestors. No
// window/page scrolling API exists, so accidental ancestor scrolling fails.
class Element {
  constructor(tag, attributes = {}, children = []) {
    this.tag = tag;
    this.attributes = { ...attributes };
    this.children = [];
    this.parentElement = null;
    this.textContent = "";
    for (const child of children) this.append(child);
  }
  append(child) { child.parentElement = this; this.children.push(child); }
  remove() { this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
  get id() { return this.attributes.id; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  hasAttribute(name) { return name in this.attributes; }
  setAttribute(name, value) { this.attributes[name] = value; }
  matches(selector) {
    return selector.split(",").some(part => {
      part = part.trim();
      const disabled = this.hasAttribute("disabled");
      if (part.includes(":not(:disabled)")) {
        if (disabled) return false;
        part = part.replace(":not(:disabled)", "");
      }
      if (part === ":disabled") return disabled;
      if (part.startsWith(".")) return (this.getAttribute("class") ?? "").split(" ").includes(part.slice(1));
      const match = /^([a-z][a-z0-9]*)?(?:\[([^=\]]+)(?:="([^"]*)")?\])?$/.exec(part);
      if (!match) throw new Error(`Unsupported mock selector: ${part}`);
      return (!match[1] || this.tag === match[1]) &&
        (!match[2] || (match[3] === undefined ? this.hasAttribute(match[2]) : this.getAttribute(match[2]) === match[3]));
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
  all() { return this.children.flatMap(child => [child, ...child.all()]); }
  querySelectorAll(selector) { return this.all().filter(child => child.matches(selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  contains(child) { return child === this || this.all().includes(child); }
  getClientRects() { return this.closest('[hidden], [aria-hidden="true"]') ? [] : [{}]; }
  compareDocumentPosition(other) {
    let root = this;
    while (root.parentElement) root = root.parentElement;
    const order = [root, ...root.all()];
    return order.indexOf(other) > order.indexOf(this) ? 4 : 2;
  }
}

let checks = 0;
const equal = (actual, expected, label) => { assert.equal(actual, expected, label); checks++; };
const button = id => new Element("button", { id, "data-wizard-choice": "", "aria-pressed": "true" });
const group = (id, children, attributes = {}) => new Element("div", { id, role: "group", "aria-label": id, ...attributes }, children);
const grid = (id, children) => group(id, children, { "data-wizard-choice-grid": "" });
let content, scroller;
const setup = (...children) => {
  content = new Element("div", {}, children);
  scroller = new Element("div", { class: "pool-dock-scroll" }, [content]);
};
const target = id => content.all().find(element => element.id === id);

setup(grid("choices", [button("a"), button("b"), button("c")]), group("next", [button("d")]));
let snapshot = captureWizardChoice(content, scroller, target("a"));
equal(nextWizardOptions(content, snapshot)?.id, "next", "Next decision starts after all sibling cards");
target("a").append(new Element("svg", {}, [new Element("path", { id: "icon" })]));
equal(captureWizardChoice(content, scroller, target("icon"))?.choice.id, "a", "SVG icon clicks identify the card");
target("choices").append(group("disclosed", [button("variant1"), button("variant2")]));
equal(nextWizardOptions(content, snapshot)?.id, "disclosed", "New dependent group wins over following decision");
snapshot = captureWizardChoice(content, scroller, target("variant1"));
equal(nextWizardOptions(content, snapshot)?.id, "next", "Variant does not jump to remaining sibling variant");
target("choices").append(group("other-family", [button("other-variant")]));
snapshot = captureWizardChoice(content, scroller, target("variant1"));
equal(nextWizardOptions(content, snapshot)?.id, "next", "Variant skips other parent-family alternatives");
snapshot = captureWizardChoice(content, scroller, target("a"));
target("choices").append(group("hidden-options", [button("hidden-choice")], { hidden: "" }));
equal(nextWizardOptions(content, snapshot)?.id, "next", "Hidden options are ignored");
snapshot = captureWizardChoice(content, scroller, target("a"));
delete target("hidden-options").attributes.hidden;
equal(nextWizardOptions(content, snapshot)?.id, "hidden-options", "Previously hidden group counts as disclosed");
target("a").setAttribute("aria-pressed", "false");
equal(nextWizardOptions(content, snapshot), null, "Removing an optional does not move forward");
target("a").setAttribute("aria-expanded", "true");
equal(nextWizardOptions(content, snapshot)?.id, "hidden-options", "Disclosure need not select a default");
target("a").setAttribute("disabled", "");
equal(captureWizardChoice(content, scroller, target("a")), null, "Disabled choices do not create guidance");
setup(grid("source", [button("a")]), grid("stair-shape", [button("shape")]), grid("orientation", [button("orientation-choice")]));
snapshot = captureWizardChoice(content, scroller, target("shape"));
equal(nextWizardOptions(content, snapshot)?.id, "orientation", "Shape choice reaches next orientation group");
snapshot = captureWizardChoice(content, scroller, target("a"));
target("stair-shape").setAttribute("aria-label", "Replacement dependent decision");
equal(nextWizardOptions(content, snapshot)?.id, "stair-shape", "Reused DOM group with a new decision is detected");
snapshot = captureWizardChoice(content, scroller, target("a"));
target("source").remove();
equal(nextWizardOptions(content, snapshot), null, "Detached source cannot target unrelated existing groups");
content.append(group("replacement", [button("replacement-choice")]));
equal(nextWizardOptions(content, snapshot)?.id, "replacement", "Replaced parent can disclose a new group");
setup(new Element("fieldset", { id: "colors" }, [new Element("legend"), new Element("button", { id: "color", "aria-pressed": "true" })]),
  new Element("div", { id: "quantity", "data-wizard-guidance-group": "" }, [new Element("select")]));
snapshot = captureWizardChoice(content, scroller, target("color"));
equal(nextWizardOptions(content, snapshot)?.id, "quantity", "Native colour picker reaches quantity control");
setup(new Element("div", { role: "radiogroup", "aria-label": "Skin" }, [new Element("button", { id: "radio", role: "radio", "aria-checked": "true" })]), group("next", [button("next-choice")]));
snapshot = captureWizardChoice(content, scroller, target("radio"));
equal(nextWizardOptions(content, snapshot)?.id, "next", "Radio choices participate");
content.append(group("scene", [new Element("button", { id: "night", "aria-pressed": "true" })], { class: "day-night-switch" }));
content.append(new Element("div", { role: "tablist" }, [new Element("button", { id: "tab", role: "tab", "aria-pressed": "true" })]));
content.append(new Element("button", { id: "continue" }));
content.append(new Element("input", { id: "slider", type: "range" }));
content.append(group("scene-preview", [button("preview-time")], {"data-wizard-guidance-ignore":""}));
for (const id of ["night", "tab", "continue", "slider", "preview-time"]) equal(captureWizardChoice(content, scroller, target(id)), null, `${id} does not create guidance`);
snapshot = captureWizardChoice(content, scroller, target("radio"));
claimWizardGuidance(scroller);
equal(wizardGuidanceVersion(scroller) > snapshot.version, true, "Explicit guide invalidates generic request");
const version = wizardGuidanceVersion(scroller);
captureWizardChoice(content, scroller, target("radio"));
equal(wizardGuidanceVersion(scroller) > version, true, "Later choice invalidates stale delayed guidance");
for (const reduced of [false, true]) {
  const calls = [];
  const scrollport = { scrollTop: 100, scrollHeight: 900, clientHeight: 260,
    getBoundingClientRect: () => ({ top: 100, bottom: 360 }), scrollTo: options => calls.push(options) };
  for (const top of [-50, 180, 1200]) {
    const section = { getBoundingClientRect: () => ({ top, bottom: top + 180 }) };
    calls.length = 0;
    const moved = revealWizardOptions(scrollport, section, reduced);
    equal(moved, top !== 180, "Already visible options do not move");
    if (moved) {
      equal(calls[0].top, Math.max(0, Math.min(top - 12, 640)), "Only scrollport scroll is bounded");
      equal(calls[0].behavior, reduced ? "auto" : "smooth", "Reduced motion respected");
    }
  }
}
console.log(`Wizard guidance: ${checks} checks PASS (actual helper with mock DOM; groups, nested variants, disclosure, native controls, bounded scroll, reduced motion). Integrated browser QA is separate.`);
