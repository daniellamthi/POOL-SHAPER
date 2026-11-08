"""Losslessly select Poly Haven Searsia b/g. Usage: python3 scripts/prepare-catalogue-vegetation.py SOURCE_DIR GLTF_FILE REPO_ROOT.
SOURCE_DIR holds the official .bin and textures/ listed in public/models/catalogue/CREDITS.md.
"""
import json, pathlib, copy, hashlib, struct, shutil, sys
repo=pathlib.Path(sys.argv[3])
src=pathlib.Path(sys.argv[1]);j=json.load(open(sys.argv[2]));blob=(src/'searsia_lucida.bin').read_bytes()
assert hashlib.md5(blob).hexdigest() == 'aa4c42ee903a3ac22d53386d82480e6d', 'Unexpected source binary'
out={'asset':{'version':'2.0','generator':'POOL-SHAPER: selected Poly Haven Searsia Lucida b/g; lossless buffers'},'scene':0,'scenes':[{'nodes':[0,1]}],'nodes':[],'meshes':[],'materials':copy.deepcopy(j['materials']),'accessors':[],'bufferViews':[],'buffers':[],'samplers':j['samplers'],'textures':j['textures'][:3],'images':copy.deepcopy(j['images'][:3])}
data=bytearray();accessors={};views={}
def view(old):
 if old not in views:
  v=copy.deepcopy(j['bufferViews'][old]);start=v.get('byteOffset',0);payload=blob[start:start+v['byteLength']]
  while len(data)%4:data.append(0)
  v['buffer']=0;v['byteOffset']=len(data);data.extend(payload);views[old]=len(out['bufferViews']);out['bufferViews'].append(v)
 return views[old]
def accessor(old):
 if old not in accessors:
  a=copy.deepcopy(j['accessors'][old]);a['bufferView']=view(a['bufferView']);accessors[old]=len(out['accessors']);out['accessors'].append(a)
 return accessors[old]
for idx,name in [(1,'tree'),(6,'shrub')]:
 m=copy.deepcopy(j['meshes'][idx]);m['name']=name
 for p in m['primitives']:
  p['indices']=accessor(p['indices']);p['attributes']={k:accessor(v) for k,v in p['attributes'].items()}
 out['nodes'].append({'mesh':len(out['meshes']),'name':name});out['meshes'].append(m)
for m in out['materials']:
 m['normalTexture']['index']=0;m['pbrMetallicRoughness']['baseColorTexture']['index']=1;m['pbrMetallicRoughness']['metallicRoughnessTexture']['index']=2
for im in out['images']:im['uri']='../../textures/catalogue/evergreen/'+pathlib.Path(im['uri']).name
out['buffers']=[{'byteLength':len(data)}]
head=json.dumps(out,separators=(',',':')).encode();head+=b' '*((-len(head))%4);data+=b'\0'*((-len(data))%4)
glb=struct.pack('<III',0x46546c67,2,12+8+len(head)+8+len(data))+struct.pack('<II',len(head),0x4e4f534a)+head+struct.pack('<II',len(data),0x004e4942)+data
model=repo/'public/models/catalogue/evergreen.glb';model.parent.mkdir(parents=True,exist_ok=True);model.write_bytes(glb)
tex=repo/'public/textures/catalogue/evergreen';tex.mkdir(parents=True,exist_ok=True)
for p in (src/'textures').iterdir():shutil.copy2(p,tex/p.name)
print('GLB',len(glb),'sha256',hashlib.sha256(glb).hexdigest(),'triangles',sum(out['accessors'][p['indices']]['count']//3 for m in out['meshes'] for p in m['primitives']))
