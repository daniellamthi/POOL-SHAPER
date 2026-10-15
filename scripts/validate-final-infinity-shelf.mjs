// Re-evaluate the already captured browser data. Opens no browser.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('docs/fullscreen-qa-evidence/final-infinity-shelf');
const raw=JSON.parse(await readFile(resolve(out,'results.json'),'utf8'));
const validated={scope:'Bounded final views only; live snapshots plus independent inspection of all four own PNGs',cases:[],originalHarnessIssue:'FAIL_TEST_SETUP: ResourceTiming asset presence and absence of the generic pool-studio-deck name were invalid proxies for the displayed coastal environment. Original raw results preserved.',visualInspection:'Both Infinity screenshots show the current open sea/sky panorama and complete visible pool rim. Both shelf screenshots show two real chaise forms partially immersed; night is darker with no LEDs selected. No claim about all orbit angles.',posts:raw.posts,errors:raw.errors};
for(const result of raw.results.filter(r=>r.it)){
 const item={id:result.id,status:'PASS',screenshot:result.screenshot,states:[]};
 for(const name of['it','en','itBack']){const s=result[name];assert.deepEqual(s.draft,result.it.draft);assert.deepEqual(s.camera,result.it.camera,'Position/target/FOV/view offset unchanged');assert(s.names.includes('infinity-open-sea-environment')&&s.names.includes('infinity-open-sea'));assert(!s.contextLost);
  assert(s.points.every(p=>Math.abs(p.x)<=1.01&&Math.abs(p.y)<=1.01&&p.z>=-1&&p.z<=1),'All basin/coping/glass AABB corners inside frustum');
  const rim=s.points.filter(p=>p.name==='plan-coping'||p.name==='infinity-glass-wall');assert(rim.length);assert(rim.every(p=>p.px>=s.frame.left-3&&p.px<=s.frame.left+s.frame.width+3&&p.py>=s.frame.top-3&&p.py<=s.frame.top+s.frame.height+3),'Visible rim/glass envelope stays outside UI occluders');
  item.states.push({locale:name,camera:s.camera,frame:s.frame,deltaPosition:s.camera.position.map((v,i)=>v-result.it.camera.position[i]),deltaTarget:s.camera.target.map((v,i)=>v-result.it.camera.target[i]),allBasinCornersInFrustum:true,rimGlassUnoccluded:true,rimGlassPixels:{minX:Math.min(...rim.map(p=>p.px)),maxX:Math.max(...rim.map(p=>p.px)),minY:Math.min(...rim.map(p=>p.py)),maxY:Math.max(...rim.map(p=>p.py))}});
 }
 item.proofLimit='Full wall AABB includes buried front-bottom corners below the visible coping; safe-frame assertion uses the visible rim/glass envelope, while all wall corners remain inside the viewport frustum. Screenshots independently checked for visible clipping. No all-angle claim.';validated.cases.push(item);
}
const shelf=raw.results.find(r=>r.id==='shelf-12x5-qty2-immersion-day-night');assert.equal(shelf.status,'PASS');assert.equal(shelf.states.length,2);const water=[];for(const s of shelf.states){assert.equal(s.chairs.length,2);assert(s.water.length);const waterY=s.water[0].worldY;assert(Math.abs(waterY-s.shelfTop-.22)<.005);for(const chair of s.chairs){assert(Math.abs(chair.baseY-s.shelfTop)<.005);assert(chair.baseY<waterY&&chair.topY>waterY);}water.push({time:s.name,waterY,shelfTop:s.shelfTop,immersion:waterY-s.shelfTop,chairs:s.chairs,screenshot:s.screenshot});}validated.cases.push({id:shelf.id,status:'PASS',states:water});
assert.equal(validated.cases.length,3);assert.equal(validated.posts.length,0);assert.equal(validated.errors.length,0);validated.overall='PASS';await writeFile(resolve(out,'validated-results.json'),JSON.stringify(validated,null,2));console.log(JSON.stringify({overall:validated.overall,cases:validated.cases.map(c=>({id:c.id,status:c.status}))}));
