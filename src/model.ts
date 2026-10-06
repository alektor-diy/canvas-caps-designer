export const UNIT_MM = 17;
export const STANDARD_UNIT_MM = 19.05;
export const PITCHES = [UNIT_MM, STANDARD_UNIT_MM] as const;
export const GRID_U = 0.25;
export const WORK_AREA_WIDTH_U = 20;
export const WORK_AREA_HEIGHT_U = 15;
export const KEY_TYPES = ['1u','1.25u','1.5u','1.75u','2u','2.25u','ISO Enter'] as const;
export type KeyType = typeof KEY_TYPES[number];
export type Key = { id:string; type:KeyType; xMm:number; yMm:number; rotation:number };
export type Artwork = { file:string; xMm:number; yMm:number; widthMm:number; heightMm:number; rotation:number };
export type Project = { name:string; createdAt:string; modifiedAt:string };
export type Design = { formatVersion:1; project:Project; layout:{unitMm:number}; keys:Key[]; artwork:Artwork|null; artwork2?:Artwork|null; frontArtwork?:ArtworkSlot };
export type ArtworkSlot = 0|1;
export const artworkSlots = (design:Design) => [design.artwork, design.artwork2 ?? null] as const;
export const artworkOrder = (design:Design):ArtworkSlot[] => design.frontArtwork===0?[1,0]:[0,1];
export const setArtwork = (design:Design, slot:ArtworkSlot, artwork:Artwork|null):Design => ({...design,[slot===0?'artwork':'artwork2']:artwork});
export const newDesign = (name='My CanvasCapsDesigner'):Design => { const now=new Date().toISOString(); return {formatVersion:1,project:{name,createdAt:now,modifiedAt:now},layout:{unitMm:UNIT_MM},keys:[],artwork:null}; };
export function changePitch(design:Design,unitMm:number):Design {
 if(!PITCHES.some(pitch=>pitch===unitMm))throw Error('非対応のキーピッチです');
 if(unitMm===design.layout.unitMm)return design;
 const ratio=unitMm/design.layout.unitMm;
 const approximate=(value:number)=>Math.round(value*ratio*100)/100;
 const convertArtwork=(art:Artwork|null):Artwork|null=>{
  if(!art)return null;
  // Round the width to 0.01 mm and derive height to preserve the aspect ratio.
  const widthMm=Math.max(.01,approximate(art.widthMm));
  return {...art,xMm:approximate(art.xMm),yMm:approximate(art.yMm),widthMm,heightMm:widthMm*art.heightMm/art.widthMm};
 };
 return {...design,layout:{...design.layout,unitMm},
  keys:design.keys.map(key=>({...key,xMm:key.xMm*ratio,yMm:key.yMm*ratio})),
  artwork:convertArtwork(design.artwork),
  ...(design.artwork2!==undefined?{artwork2:convertArtwork(design.artwork2)}:{})};
}
export const toU=(mm:number,unit=UNIT_MM)=>mm/unit;
export const toMm=(u:number,unit=UNIT_MM)=>u*unit;
export const snapMm=(mm:number,unit=UNIT_MM)=>Math.round(mm/(unit*GRID_U))*unit*GRID_U;
export type ArtworkCorner = 0|1|2|3;
export type ArtworkMoveSnap = {x:ArtworkCorner;y:ArtworkCorner};
export function artworkCorners(art:Artwork){
 const cx=art.xMm+art.widthMm/2,cy=art.yMm+art.heightMm/2,rad=art.rotation*Math.PI/180;
 return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>{
  const x=sx*art.widthMm/2,y=sy*art.heightMm/2;
  return {x:cx+x*Math.cos(rad)-y*Math.sin(rad),y:cy+x*Math.sin(rad)+y*Math.cos(rad)};
 });
}
export function moveArtworkWithSnap(art:Artwork,dx:number,dy:number,unit=UNIT_MM,previous:ArtworkMoveSnap|null=null,snap=true):{artwork:Artwork;snap:ArtworkMoveSnap|null}{
 const moved={...art,xMm:art.xMm+dx,yMm:art.yMm+dy};
 if(!snap)return {artwork:moved,snap:null};
 const corners=artworkCorners(moved),margin=unit*GRID_U*.15;
 const choose=(axis:'x'|'y')=>{
  const candidates=corners.map((corner,i)=>({corner:i as ArtworkCorner,delta:snapMm(corner[axis],unit)-corner[axis]}));
  const nearest=candidates.reduce((best,candidate)=>Math.abs(candidate.delta)<Math.abs(best.delta)-1e-9?candidate:best);
  const incumbent=previous?candidates[previous[axis]]:null;
  // Switch corners only when the new candidate is meaningfully closer.
  return incumbent&&Math.abs(incumbent.delta)<=Math.abs(nearest.delta)+margin?incumbent:nearest;
 };
 const x=choose('x'),y=choose('y');
 return {artwork:{...moved,xMm:moved.xMm+x.delta,yMm:moved.yMm+y.delta},snap:{x:x.corner,y:y.corner}};
}
function unrotatedPolygons(k:Key,unit=UNIT_MM):[number,number][][] {
 const x=k.xMm,y=k.yMm,w=Number.parseFloat(k.type),u=unit;
 if(k.type==='ISO Enter') return [[ [x,y],[x+1.5*u,y],[x+1.5*u,y+u],[x,y+u] ],[ [x+.25*u,y+u],[x+1.5*u,y+u],[x+1.5*u,y+2*u],[x+.25*u,y+2*u] ]];
 return [[[x,y],[x+w*u,y],[x+w*u,y+u],[x,y+u]]];
}
export const keyCenter=(k:Key,unit=UNIT_MM)=>({x:k.xMm+(k.type==='ISO Enter'?1.5:parseFloat(k.type))*unit/2,y:k.yMm+(k.type==='ISO Enter'?2:1)*unit/2});
export const keyTransform=(k:Key,unit=UNIT_MM)=>{const c=keyCenter(k,unit);return `rotate(${k.rotation} ${c.x} ${c.y})`};
function rotateKeyPoint(k:Key,p:[number,number],unit:number):[number,number]{const c=keyCenter(k,unit),r=k.rotation*Math.PI/180,x=p[0]-c.x,y=p[1]-c.y;return [c.x+x*Math.cos(r)-y*Math.sin(r),c.y+x*Math.sin(r)+y*Math.cos(r)]}
export function polygons(k:Key,unit=UNIT_MM):[number,number][][] {return unrotatedPolygons(k,unit).map(poly=>poly.map(p=>rotateKeyPoint(k,p,unit)))}
export function keyCorners(k:Key,unit=UNIT_MM):[number,number][]{
 const x=k.xMm,y=k.yMm,u=unit;
 const points:[number,number][]=k.type==='ISO Enter'?[[x,y],[x+1.5*u,y],[x+1.5*u,y+2*u],[x+.25*u,y+2*u],[x+.25*u,y+u],[x,y+u]]:unrotatedPolygons(k,unit)[0];
 return points.map(p=>rotateKeyPoint(k,p,unit));
}
export function keyPath(k:Key,unit=UNIT_MM){if(k.rotation!==0){const points=keyCorners(k,unit);return `M ${points.map(p=>p.join(' ')).join(' L ')} Z`} const x=k.xMm,y=k.yMm,u=unit,w=k.type==='ISO Enter'?1.5:Number.parseFloat(k.type);if(k.type==='ISO Enter')return `M ${x} ${y} h ${1.5*u} v ${2*u} h ${-1.25*u} v ${-u} h ${-.25*u} Z`;return `M ${x} ${y} h ${w*u} v ${u} h ${-w*u} Z`;}
export function bounds(keys:Key[],unit=UNIT_MM){ if(!keys.length)return {minX:0,minY:0,maxX:0,maxY:0,width:0,height:0}; const pts=keys.flatMap(k=>polygons(k,unit).flat()); const minX=Math.min(...pts.map(p=>p[0])), minY=Math.min(...pts.map(p=>p[1])), maxX=Math.max(...pts.map(p=>p[0])), maxY=Math.max(...pts.map(p=>p[1])); return {minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY}; }
function polyOverlap(a:[number,number][],b:[number,number][]){
 for(const poly of [a,b])for(let i=0;i<poly.length;i++){
  const p=poly[i],q=poly[(i+1)%poly.length],length=Math.hypot(q[0]-p[0],q[1]-p[1]);
  const nx=-(q[1]-p[1])/length,ny=(q[0]-p[0])/length;
  const project=(points:[number,number][])=>points.map(v=>v[0]*nx+v[1]*ny),pa=project(a),pb=project(b);
  if(Math.max(...pa)<=Math.min(...pb)+1e-7||Math.max(...pb)<=Math.min(...pa)+1e-7)return false;
 }
 return true;
}
export function collides(a:Key,b:Key,unit=UNIT_MM){return polygons(a,unit).some(pa=>polygons(b,unit).some(pb=>polyOverlap(pa,pb)));}
export function canPlace(key:Key,keys:Key[],unit=UNIT_MM){const extent=bounds([key],unit),epsilon=1e-7;return extent.minX>=-epsilon&&extent.minY>=-epsilon&&extent.maxX<=WORK_AREA_WIDTH_U*unit+epsilon&&extent.maxY<=WORK_AREA_HEIGHT_U*unit+epsilon&&!keys.some(k=>k.id!==key.id&&collides(key,k,unit));}
export function clampKeyPosition(key:Key,xMm:number,yMm:number,unit=UNIT_MM,snap=true){const extent=bounds([key],unit),minX=key.xMm-extent.minX,minY=key.yMm-extent.minY,maxX=WORK_AREA_WIDTH_U*unit-(extent.maxX-key.xMm),maxY=WORK_AREA_HEIGHT_U*unit-(extent.maxY-key.yMm);return {...key,xMm:Math.min(maxX,Math.max(minX,(snap?key.xMm+snapMm(xMm-key.xMm,unit):xMm))),yMm:Math.min(maxY,Math.max(minY,(snap?key.yMm+snapMm(yMm-key.yMm,unit):yMm)))};}
export function clampKeyGroupDelta(keys:Key[],dx:number,dy:number,unit=UNIT_MM,snap=true){const extent=bounds(keys,unit),snappedX=snap?snapMm(dx,unit):dx,snappedY=snap?snapMm(dy,unit):dy,minX=-extent.minX,minY=-extent.minY,maxX=WORK_AREA_WIDTH_U*unit-extent.maxX,maxY=WORK_AREA_HEIGHT_U*unit-extent.maxY,xMm=Math.min(maxX,Math.max(minX,snappedX)),yMm=Math.min(maxY,Math.max(minY,snappedY));return {xMm:xMm===0?0:xMm,yMm:yMm===0?0:yMm};}
export type KeyCornerSnap={sourceId:string;sourceCorner:number;targetId:string;targetCorner:number;point:[number,number]};
export function moveKeysWithSnap(keys:Key[],others:Key[],dx:number,dy:number,unit=UNIT_MM,tolerance=unit*.4,snap=true,previous:KeyCornerSnap|null=null):{keys:Key[];corner:KeyCornerSnap|null;grid:boolean;placed:boolean}{
 const translated=(x:number,y:number)=>keys.map(k=>({...k,xMm:k.xMm+x,yMm:k.yMm+y}));
 const valid=(targets:Key[])=>targets.every((k,i)=>canPlace(k,[...others,...targets.slice(0,i)],unit));
 if(snap){
  const candidates:{match:KeyCornerSnap;dx:number;dy:number;distance:number;sticky:boolean}[]=[];
  for(const source of keys)keyCorners(source,unit).forEach((p,sourceCorner)=>{
   for(const target of others)keyCorners(target,unit).forEach((point,targetCorner)=>{
    const distance=Math.hypot(point[0]-(p[0]+dx),point[1]-(p[1]+dy));
    const sticky=previous?.sourceId===source.id&&previous.sourceCorner===sourceCorner&&previous.targetId===target.id&&previous.targetCorner===targetCorner;
    if(distance<=tolerance*(sticky?1.4:1))candidates.push({match:{sourceId:source.id,sourceCorner,targetId:target.id,targetCorner,point},dx:point[0]-p[0],dy:point[1]-p[1],distance,sticky});
   });
  });
  candidates.sort((a,b)=>(a.distance-(a.sticky?tolerance*.2:0))-(b.distance-(b.sticky?tolerance*.2:0)));
  for(const candidate of candidates){const targets=translated(candidate.dx,candidate.dy);if(valid(targets))return {keys:targets,corner:candidate.match,grid:false,placed:true};}
 }
 const delta=clampKeyGroupDelta(keys,dx,dy,unit,snap),targets=translated(delta.xMm,delta.yMm);
 const placed=valid(targets);return {keys:placed?targets:keys,corner:null,grid:snap&&placed,placed};
}
export function resizeArtworkWithSnap(art:Artwork,corner:ArtworkCorner,pointer:{x:number;y:number},unit=UNIT_MM,snap=true):{artwork:Artwork;snap:{axis:'x'|'y';corner:ArtworkCorner}|null} {
 let snapAxis:'x'|'y'|null=null;
 const sx=corner===0||corner===3?-1:1,sy=corner<2?-1:1,cx=art.xMm+art.widthMm/2,cy=art.yMm+art.heightMm/2,rad=art.rotation*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);
 const rotate=(x:number,y:number)=>({x:x*cos-y*sin,y:x*sin+y*cos});
 // Convert the pointer from world coordinates back into the artwork's local
 // (unrotated) axes before measuring it against the fixed opposite corner.
 const localPointer={x:cx+(pointer.x-cx)*cos+(pointer.y-cy)*sin,y:cy-(pointer.x-cx)*sin+(pointer.y-cy)*cos};
 const anchor={x:sx<0?art.xMm+art.widthMm:art.xMm,y:sy<0?art.yMm+art.heightMm:art.yMm};
 const widthScale=sx*(localPointer.x-anchor.x)/art.widthMm,heightScale=sy*(localPointer.y-anchor.y)/art.heightMm;
 let scale=(widthScale*art.widthMm*art.widthMm+heightScale*art.heightMm*art.heightMm)/(art.widthMm*art.widthMm+art.heightMm*art.heightMm);
 if(snap){
  // Keep the opposite corner and aspect ratio fixed. The moving corner follows
  // a line in world space; choose its nearest X or Y grid intersection.
  const anchorOffset=rotate(anchor.x-cx,anchor.y-cy),fixed={x:cx+anchorOffset.x,y:cy+anchorOffset.y};
  const diagonal=rotate(sx*art.widthMm,sy*art.heightMm),step=unit*GRID_U;
  const minimum=step/Math.max(art.widthMm,art.heightMm);
  scale=Math.max(minimum,scale);
  const candidates=(['x','y'] as const).flatMap(axis=>{
   const delta=diagonal[axis];if(Math.abs(delta)<1e-8)return [];
   let coordinate=snapMm(fixed[axis]+delta*scale,unit);
   let candidate=(coordinate-fixed[axis])/delta;
   if(candidate<minimum){
    const limit=(fixed[axis]+delta*minimum)/step;
    coordinate=(delta>0?Math.ceil(limit):Math.floor(limit))*step;
    candidate=(coordinate-fixed[axis])/delta;
   }
   return [{scale:candidate,axis}];
  });
  const nearest=candidates.reduce((best,candidate)=>Math.abs(candidate.scale-scale)<Math.abs(best.scale-scale)?candidate:best,candidates[0]);
  scale=nearest.scale;snapAxis=nearest.axis;
 }else scale=Math.max(.05,scale);
 const widthMm=art.widthMm*scale,heightMm=art.heightMm*scale,anchorVector=rotate(-sx*widthMm/2,-sy*heightMm/2),nextCx=cx+rotate(anchor.x-cx,anchor.y-cy).x-anchorVector.x,nextCy=cy+rotate(anchor.x-cx,anchor.y-cy).y-anchorVector.y;
 return {artwork:{...art,xMm:nextCx-widthMm/2,yMm:nextCy-heightMm/2,widthMm,heightMm},snap:snapAxis?{axis:snapAxis,corner}:null};
}
export function resizeArtworkFromCorner(art:Artwork,corner:ArtworkCorner,pointer:{x:number;y:number},unit=UNIT_MM,snap=true):Artwork {
 return resizeArtworkWithSnap(art,corner,pointer,unit,snap).artwork;
}
export function nextKeyPosition(type:KeyType,keys:Key[],anchorId?:string,unit=UNIT_MM){const anchor=keys.find(k=>k.id===anchorId)??keys[keys.length-1],startX=anchor?bounds([anchor],unit).maxX:0,yMm=anchor?.yMm??0;for(let step=0;step<256;step++){const xMm=snapMm(startX+step*unit*GRID_U,unit),candidate:Key={id:'\u0000placement-candidate',type,xMm,yMm,rotation:0};if(canPlace(candidate,keys,unit))return{xMm,yMm};}return null;}
export function manufacturingSizeGuide(unit=UNIT_MM){return unit===STANDARD_UNIT_MM?'13u × 13u':'14u × 14u または 15u × 5u';}
export function manufacturableSize(keys:Key[],unit=UNIT_MM){const b=bounds(keys,unit),w=toU(b.width,unit),h=toU(b.height,unit),epsilon=1e-7;return {ok:unit===STANDARD_UNIT_MM?w<=13+epsilon&&h<=13+epsilon:(w<=14+epsilon&&h<=14+epsilon)||(w<=15+epsilon&&h<=5+epsilon),widthU:w,heightU:h};}
export const effectivePpi=(pixelWidth:number,widthMm:number)=>pixelWidth/(widthMm/25.4);
export function validateDesign(v:unknown): asserts v is Design { if(!v||typeof v!=='object')throw Error('CCAPのproject.jsonが不正です');const d=v as Partial<Design>; if(d.formatVersion!==1)throw Error(`非対応のformatVersionです (${String(d.formatVersion)})`); if(!d.project||typeof d.project.name!=='string'||typeof d.project.createdAt!=='string'||typeof d.project.modifiedAt!=='string'||!d.layout||!Number.isFinite(d.layout.unitMm)||d.layout.unitMm!<=0||!Array.isArray(d.keys)||!Object.prototype.hasOwnProperty.call(d,'artwork'))throw Error('CCAPの必須データが不足しています');const ids=new Set<string>(),validId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;for(const k of d.keys){if(!k||typeof k.id!=='string'||!validId.test(k.id)||ids.has(k.id)||!KEY_TYPES.includes(k.type)||!Number.isFinite(k.xMm)||!Number.isFinite(k.yMm)||!Number.isFinite(k.rotation)||bounds([k],d.layout!.unitMm).minX < -1e-7||bounds([k],d.layout!.unitMm).minY < -1e-7||d.keys.slice(0,d.keys.indexOf(k)).some(prev=>collides(k,prev,d.layout!.unitMm)))throw Error('CCAPのキー情報が不正です');ids.add(k.id);}if(d.frontArtwork!==undefined&&d.frontArtwork!==0&&d.frontArtwork!==1)throw Error('CCAPの画像の重なり順が不正です');if(d.artwork2!==undefined&&d.artwork2!==null&&d.artwork?.file===d.artwork2.file)throw Error('CCAPの画像ファイル名が重複しています');for(const a of [d.artwork,d.artwork2??null]){if(a===null)continue;if(!a||typeof a.file!=='string'||!/[.]((png)|(jpe?g)|(webp))$/i.test(a.file)||![a.xMm,a.yMm,a.widthMm,a.heightMm,a.rotation].every(Number.isFinite)||a.widthMm<=0||a.heightMm<=0)throw Error('CCAPのアートワーク情報が不正です');}}
