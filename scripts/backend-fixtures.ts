import { DEFAULT_CUSTOMER, DEFAULT_CONTROL_POINTS } from "../src/lib/pool/config";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import { createProjectId, parseProjectConfiguration, serializeProjectConfiguration, type ProjectConfiguration } from "../src/lib/pool/project";
import type { LeadSubmission } from "../src/lib/lead/types";

export function backendFixture(scenario: "A" | "B" | "C"): ProjectConfiguration {
  const project: ProjectConfiguration = {
    schemaVersion: 1, projectId: createProjectId(),
    config: {
      projectType: "new", poolType: scenario === "C" ? "above-ground" : "in-ground", structure: scenario === "C" ? "modular-steel-panels" : "reinforced-concrete",
      shape: "rectangle", shapeSelected: true, customMode: "draw", controlPoints: DEFAULT_CONTROL_POINTS,
      dimensions: { length: scenario === "B" ? 12 : 8, width: scenario === "B" ? 5 : 4, depth: 1.5, cornerRadius: 0, floorProfile: "flat" },
      system: scenario === "B" ? "infinity" : "skimmer", overflowType: "visible", skimmerFinish: "white", skimmerType: "standard",
      finish: "liner", linerColor: "motionSandBeach179", mosaicFinish: DEFAULT_MOSAIC_FINISH_ID,
      copingMaterial: "prun", paving: "gres", poolAccess: "internalSteps", internalStairType: "corner",
      features: scenario === "C" ? ["ledLighting", "externalStaircase"] : ["ledLighting"],
      equipment: scenario === "C" ? ["pellicano"] : [], sceneTime: scenario === "B" ? "night" : "day", ledColor: "#FFFFFF", ledIntensity: 0.6,
      ...(scenario === "C" ? { exteriorPanelFinish: "steel-satin", externalStairSide: "long", externalStairPlatformExtended: true } : {}),
      customer: DEFAULT_CUSTOMER, uploads: [],
    },
    renovation: { areas: [], currentFinish: "liner", filtrationWorks: [], replaceCoping: null, copingMaterial: "", structureIssues: [], equipmentUpgrades: [] },
  };
  return parseProjectConfiguration(serializeProjectConfiguration(project));
}

export function notificationFixture(): LeadSubmission {
  const project = backendFixture("A");
  return { requestId: crypto.randomUUID(), projectId: project.projectId, projectReference: "PW-0000-000000", schemaVersion: 1,
    createdAt: new Date().toISOString(), project, attachments: [],
    customer: { name: "QA sintetico", email: "qa@example.com", phone: "+39 000 0000000", projectLocation: "Test" },
    commercial: { timing: "evaluating", notes: "Solo test tecnico" }, privacy: { accepted: true, marketingConsent: false } };
}
