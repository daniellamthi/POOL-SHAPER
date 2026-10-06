/**
 * Project Book PDF (Build 2). Renders the Premium Summary model -- itself
 * derived only from the canonical ProjectConfiguration -- so the PDF can
 * never say something the configurator or the Summary does not.
 * A4 landscape, concise, client-facing; not a technical data dump.
 */
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { ProjectSummaryModel, SummaryRow, SummarySection } from "./summary-model";

export interface ProjectBookInput {
  model: ProjectSummaryModel;
  publicRef: string;
  shareUrl: string;
  /** JPEG/PNG data URL of the clean hero capture, when available. */
  heroDataUrl?: string | null;
  issuedAt: Date;
}

const W = 297;
const H = 210;
const M = 18;
const INK: [number, number, number] = [17, 17, 19];
const MUTE: [number, number, number] = [110, 110, 115];
const LINE: [number, number, number] = [226, 226, 231];
const VIOLET: [number, number, number] = [95, 92, 201];

/** The standard PDF fonts are WinAnsi: map the few symbols outside it. */
export function pdfText(value: string): string {
  return value.replace(/→/g, "–").replace(/≈\s?/g, "ca. ").replace(/[^\x20-\x7E -ÿ–—·’“”…€]/g, "");
}

function header(doc: jsPDF, title: string, publicRef: string, page: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTE);
  doc.text("PISCINE WELLNESS · PROJECT BOOK", M, 12);
  doc.text(pdfText(`${publicRef} · ${page}`), W - M, 12, { align: "right" });
  doc.setDrawColor(...LINE);
  doc.line(M, 15, W - M, 15);
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(pdfText(title), M, 32);
}

function rows(doc: jsPDF, list: ReadonlyArray<SummaryRow>, x: number, y: number, width: number) {
  for (const row of list) {
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTE);
    doc.text(pdfText(row.label), x, y);
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    let valueX = x + width;
    if (row.swatch) {
      doc.setFillColor(row.swatch.hex);
      doc.setDrawColor(...LINE);
      doc.circle(x + width - 2.2, y - 1.3, 2, "FD");
      valueX -= 6.5;
    }
    const value = doc.splitTextToSize(pdfText(row.value), width * 0.66) as string[];
    doc.text(value, valueX, y, { align: "right" });
    let height = Math.max(1, value.length) * 4.6;
    if (row.hint) {
      doc.setFontSize(8);
      doc.setTextColor(...MUTE);
      const hint = doc.splitTextToSize(pdfText(row.hint), width * 0.66) as string[];
      doc.text(hint, x + width, y + height, { align: "right" });
      height += hint.length * 3.8;
    }
    y += height + 3;
    doc.setDrawColor(...LINE);
    doc.line(x, y - 2.2, x + width, y - 2.2);
    y += 2.4;
  }
  return y;
}

function sectionBlock(doc: jsPDF, section: SummarySection, x: number, y: number, width: number) {
  doc.setFontSize(8);
  doc.setTextColor(...VIOLET);
  doc.text(pdfText(section.title.toUpperCase()), x, y);
  return rows(doc, section.rows, x, y + 8, width);
}

function drawPlan(doc: jsPDF, model: ProjectSummaryModel, x: number, y: number, w: number, h: number) {
  const pts = model.plan.outline;
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs);
  const scale = Math.min((w - 20) / (maxX - minX), (h - 20) / (maxZ - minZ));
  const ox = x + (w - (maxX - minX) * scale) / 2;
  const oy = y + (h - (maxZ - minZ) * scale) / 2;
  const map = (p: readonly [number, number]): [number, number] => [
    ox + (p[0] - minX) * scale,
    oy + (p[1] - minZ) * scale,
  ];
  doc.setFillColor(214, 230, 236);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.35);
  const mapped = pts.map(map);
  const [first, ...rest] = mapped;
  if (first) {
    doc.lines(
      rest.map((p, i) => [p[0] - (mapped[i]![0]), p[1] - (mapped[i]![1])]),
      first[0],
      first[1],
      [1, 1],
      "FD",
      true,
    );
  }
  doc.setLineWidth(0.2);
  doc.setDrawColor(...MUTE);
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  const bottom = oy + (maxZ - minZ) * scale + 7;
  const right = ox + (maxX - minX) * scale + 7;
  doc.line(ox, bottom, ox + (maxX - minX) * scale, bottom);
  doc.text(
    pdfText(`L ${model.plan.length.toFixed(2).replace(".", ",")} m`),
    ox + ((maxX - minX) * scale) / 2,
    bottom + 4.5,
    { align: "center" },
  );
  doc.line(right, oy, right, oy + (maxZ - minZ) * scale);
  doc.text(
    pdfText(`W ${model.plan.width.toFixed(2).replace(".", ",")} m`),
    right + 2.5,
    oy + ((maxZ - minZ) * scale) / 2,
  );
  doc.setTextColor(...MUTE);
  doc.text(pdfText(`Profondità ${model.plan.depthLabel}`), x, y + h + 2);
}

export async function buildProjectBook(input: ProjectBookInput): Promise<jsPDF> {
  const { model, publicRef, shareUrl, heroDataUrl, issuedAt } = input;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: false });
  doc.setProperties({
    title: `Project Book ${publicRef}`,
    subject: model.headline,
    creator: "POOL-SHAPER · Piscine Wellness",
  });
  const date = issuedAt.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

  // 1 · Cover
  if (heroDataUrl) {
    const format = heroDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    const props = doc.getImageProperties(heroDataUrl);
    const ratio = props.width / props.height;
    const boxW = W,
      boxH = 150;
    const drawW = ratio > boxW / boxH ? boxW : boxH * ratio;
    const drawH = ratio > boxW / boxH ? boxW / ratio : boxH;
    doc.setFillColor(192, 192, 194);
    doc.rect(0, 0, W, boxH, "F");
    doc.addImage(heroDataUrl, format, (W - drawW) / 2, (boxH - drawH) / 2, drawW, drawH);
  } else {
    doc.setFillColor(238, 238, 241);
    doc.rect(0, 0, W, 150, "F");
  }
  doc.setFontSize(8);
  doc.setTextColor(...MUTE);
  doc.text("PISCINE WELLNESS · POOL-SHAPER", M, 163);
  doc.setFontSize(24);
  doc.setTextColor(...INK);
  doc.text("Project Book", M, 175);
  doc.setFontSize(10.5);
  doc.text(doc.splitTextToSize(pdfText(model.headline), 170) as string[], M, 184);
  doc.setFontSize(8);
  doc.setTextColor(...MUTE);
  doc.text("PROJECT ID", W - M, 163, { align: "right" });
  doc.setFontSize(18);
  doc.setTextColor(...VIOLET);
  doc.text(publicRef, W - M, 173, { align: "right" });
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTE);
  doc.text(pdfText(date), W - M, 181, { align: "right" });

  const byId = (id: SummarySection["id"]) => model.sections.find((s) => s.id === id);

  // 2 · Progetto
  doc.addPage();
  header(doc, "Il progetto", publicRef, 2);
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTE);
  doc.text(pdfText(model.subline), M, 40);
  const pool = byId("pool");
  const water = byId("water");
  if (pool) sectionBlock(doc, pool, M, 54, 120);
  if (water) sectionBlock(doc, water, W / 2 + 6, 54, 120);

  // 3 · Materiali
  doc.addPage();
  header(doc, "Materiali e finiture", publicRef, 3);
  const materials = byId("materials");
  if (materials) sectionBlock(doc, materials, M, 50, 160);

  // 4 · Accesso, comfort e optional
  doc.addPage();
  header(doc, "Accesso, comfort e optional", publicRef, 4);
  let leftY = 50,
    rightY = 50;
  for (const id of ["comfort", "lighting", "exterior", "scene"] as const) {
    const section = byId(id);
    if (!section) continue;
    if (leftY <= rightY) leftY = sectionBlock(doc, section, M, leftY, 120) + 6;
    else rightY = sectionBlock(doc, section, W / 2 + 6, rightY, 120) + 6;
  }

  // 5 · Pianta e dati tecnici
  doc.addPage();
  header(doc, "Pianta e scheda tecnica", publicRef, 5);
  drawPlan(doc, model, M, 44, 130, 120);
  const techY = rows(doc, model.technical, W / 2 + 6, 50, 120);
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTE);
  doc.text(doc.splitTextToSize(pdfText(model.technicalNote), 120) as string[], W / 2 + 6, techY + 4);
  if (model.deferred.length) {
    doc.text(
      doc.splitTextToSize(pdfText(`Da definire con il consulente: ${model.deferred.join(" · ")}`), 120) as string[],
      W / 2 + 6,
      techY + 16,
    );
  }

  // 6 · Riferimento, QR e proposta
  doc.addPage();
  header(doc, "Il tuo progetto, sempre con te", publicRef, 6);
  const qr = await QRCode.toDataURL(shareUrl, { margin: 1, width: 512, errorCorrectionLevel: "M" });
  doc.addImage(qr, "PNG", M, 48, 62, 62);
  doc.setFontSize(8);
  doc.setTextColor(...MUTE);
  doc.text("PROJECT ID", M + 76, 56);
  doc.setFontSize(26);
  doc.setTextColor(...VIOLET);
  doc.text(publicRef, M + 76, 68);
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text("Inquadra il codice o apri il link per rivedere il progetto in 3D:", M + 76, 82);
  doc.setTextColor(...VIOLET);
  doc.textWithLink(pdfText(shareUrl), M + 76, 89, { url: shareUrl });
  doc.setFillColor(...VIOLET);
  doc.roundedRect(M + 76, 100, 92, 13, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10.5);
  doc.textWithLink("Richiedi la tua proposta", M + 122, 108.2, { url: shareUrl, align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(...MUTE);
  doc.text(
    doc.splitTextToSize(
      "Un consulente Piscine Wellness verifica configurazione, fattibilità e investimento. Cita il Project ID in ogni comunicazione.",
      150,
    ) as string[],
    M + 76,
    124,
  );
  return doc;
}
