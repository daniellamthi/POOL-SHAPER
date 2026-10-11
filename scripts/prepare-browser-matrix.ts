import fs from "node:fs";
import { backendFixture } from "./backend-fixtures";
import { saveProject } from "../src/lib/project-delivery/service";
import { getProjectStore } from "../src/lib/project-delivery/store";
import { serializeProjectConfiguration } from "../src/lib/pool/project";
const records=[];
for(const scenario of ["A","B","C"] as const) {
  const project=backendFixture(scenario);
  const saved=await saveProject(getProjectStore(),{snapshot:serializeProjectConfiguration(project)});
  records.push({scenario,publicRef:saved.publicRef,projectId:project.projectId,snapshot:project});
}
fs.mkdirSync('/private/tmp/pool-shaper-build2-evidence',{recursive:true});
fs.writeFileSync('/private/tmp/pool-shaper-build2-evidence/browser-matrix-fixtures.json',JSON.stringify(records,null,2));
console.log(JSON.stringify(records.map(({scenario,publicRef})=>({scenario,publicRef}))));
