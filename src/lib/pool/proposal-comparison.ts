import { DEFAULT_CUSTOMER } from "./config";
import { parseProjectConfiguration, type ProjectConfiguration } from "./project";
import type { ProjectSummaryModel } from "../project-delivery/summary-model";

export const MAX_PROPOSALS = 3;
export interface Proposal {
  id: string;
  name: string;
  createdAt: string;
  project: ProjectConfiguration;
  preview: string | null;
}
export interface ProposalBoard {
  version: 1;
  projectId: string;
  proposals: Proposal[];
  previous: ProjectConfiguration | null;
}
export const comparisonKey = (projectId: string) => `pool-shaper:proposals:v1:${projectId}`;
export const emptyBoard = (projectId: string): ProposalBoard => ({
  version: 1,
  projectId,
  proposals: [],
  previous: null,
});

/** A design revision never copies contact data or attachment URLs. Applying it
 * keeps the current project's identity, contact details and attachments. */
export function designSnapshot(project: ProjectConfiguration): ProjectConfiguration {
  return JSON.parse(
    JSON.stringify({
      ...project,
      config: { ...project.config, customer: { ...DEFAULT_CUSTOMER }, uploads: [] },
    }),
  );
}
export function designFingerprint(project: ProjectConfiguration): string {
  const canonical = parseProjectConfiguration(JSON.stringify(designSnapshot(project)));
  return JSON.stringify(canonical, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value,
  );
}
export function applyProposal(
  current: ProjectConfiguration,
  proposal: ProjectConfiguration,
): ProjectConfiguration {
  if (
    current.projectId !== proposal.projectId ||
    current.config.projectType !== proposal.config.projectType
  ) {
    throw new Error("Proposal belongs to a different project");
  }
  const design = designSnapshot(proposal);
  return {
    ...design,
    config: {
      ...design.config,
      customer: current.config.customer,
      uploads: current.config.uploads,
    },
  };
}
export function parseBoard(raw: string | null, projectId: string): ProposalBoard {
  if (!raw) return emptyBoard(projectId);
  const data = JSON.parse(raw) as ProposalBoard;
  if (
    data?.version !== 1 ||
    data.projectId !== projectId ||
    !Array.isArray(data.proposals) ||
    data.proposals.length > MAX_PROPOSALS
  ) {
    throw new Error("Invalid proposal board");
  }
  const project = (value: ProjectConfiguration) => {
    const parsed = parseProjectConfiguration(JSON.stringify(value));
    if (parsed.projectId !== projectId) throw new Error("Mismatched project");
    return designSnapshot(parsed);
  };
  const ids = new Set<string>();
  const proposals = data.proposals.map((item) => {
    if (
      !item ||
      typeof item.id !== "string" ||
      !item.id ||
      ids.has(item.id) ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      item.name.length > 60 ||
      typeof item.createdAt !== "string" ||
      !Number.isFinite(Date.parse(item.createdAt)) ||
      (item.preview !== null &&
        (typeof item.preview !== "string" ||
          item.preview.length > 600000 ||
          !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(item.preview)))
    ) {
      throw new Error("Invalid proposal");
    }
    ids.add(item.id);
    return {
      id: item.id,
      name: item.name,
      createdAt: item.createdAt,
      preview: item.preview,
      project: project(item.project),
    };
  });
  return {
    version: 1,
    projectId,
    proposals,
    previous: data.previous ? project(data.previous) : null,
  };
}

export interface ComparisonRow {
  key: string;
  section: string;
  label: string;
  values: string[];
  different: boolean;
}
/** Derive both columns from the same canonical model as the existing PDF. */
export function comparisonRows(models: ProjectSummaryModel[]): ComparisonRow[] {
  const rows = new Map<string, { section: string; label: string }>();
  const columns = models.map((model) => {
    const column = new Map<string, string[]>();
    for (const section of model.sections)
      for (const row of section.rows) {
        const key = `${section.id}:${row.label}`;
        rows.set(key, { section: section.title, label: row.label });
        column.set(key, [
          ...(column.get(key) ?? []),
          row.hint ? `${row.value} · ${row.hint}` : row.value,
        ]);
      }
    return new Map(Array.from(column, ([key, values]) => [key, values.sort().join("\n")]));
  });
  return Array.from(rows, ([key, info]) => {
    const values = columns.map((column) => column.get(key) ?? "—");
    return { key, ...info, values, different: new Set(values).size > 1 };
  });
}
