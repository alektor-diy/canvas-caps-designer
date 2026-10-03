export const UNIT_MM = 17;
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
export const newDesign = (name='My Canvas caps'):Design => { const now=new Date().toISOString(); return {formatVersion:1,project:{name,createdAt:now,modifiedAt:now},layout:{unitMm:UNIT_MM},keys:[],artwork:null}; };
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
export function polygons(k:Key,unit=UNIT_MM):[number,number][][] {
 const x=k.xMm,y=k.yMm,w=Number.parseFloat(k.type),u=unit;
 if(k.type==='ISO Enter') return [[ [x,y],[x+1.5*u,y],[x+1.5*u,y+u],[x,y+u] ],[ [x+.25*u,y+u],[x+1.5*u,y+u],[x+1.5*u,y+2*u],[x+.25*u,y+2*u] ]];
 return [[[x,y],[x+w*u,y],[x+w*u,y+u],[x,y+u]]];
}
export function keyPath(k:Key,unit=UNIT_MM){const x=k.xMm,y=k.yMm,u=unit,w=k.type==='ISO Enter'?1.5:Number.parseFloat(k.type);if(k.type==='ISO Enter')return `M ${x} ${y} h ${1.5*u} v ${2*u} h ${-1.25*u} v ${-u} h ${-.25*u} Z`;return `M ${x} ${y} h ${w*u} v ${u} h ${-w*u} Z`;}
export function bounds(keys:Key[],unit=UNIT_MM){ if(!keys.length)return {minX:0,minY:0,maxX:0,maxY:0,width:0,height:0}; const pts=keys.flatMap(k=>polygons(k,unit).flat()); const minX=Math.min(...pts.map(p=>p[0])), minY=Math.min(...pts.map(p=>p[1])), maxX=Math.max(...pts.map(p=>p[0])), maxY=Math.max(...pts.map(p=>p[1])); return {minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY}; }
function polyOverlap(a:[number,number][],b:[number,number][]){const ax=Math.min(...a.map(p=>p[0])),ay=Math.min(...a.map(p=>p[1])),bx=Math.max(...a.map(p=>p[0])),by=Math.max(...a.map(p=>p[1])),cx=Math.min(...b.map(p=>p[0])),cy=Math.min(...b.map(p=>p[1])),dx=Math.max(...b.map(p=>p[0])),dy=Math.max(...b.map(p=>p[1]));return ax<dx-1e-7&&bx>cx+1e-7&&ay<dy-1e-7&&by>cy+1e-7;}
export function collides(a:Key,b:Key,unit=UNIT_MM){return polygons(a,unit).some(pa=>polygons(b,unit).some(pb=>polyOverlap(pa,pb)));}
export function canPlace(key:Key,keys:Key[],unit=UNIT_MM){const extent=bounds([key],unit),epsilon=1e-7;return extent.minX>=-epsilon&&extent.minY>=-epsilon&&extent.maxX<=WORK_AREA_WIDTH_U*unit+epsilon&&extent.maxY<=WORK_AREA_HEIGHT_U*unit+epsilon&&!keys.some(k=>k.id!==key.id&&collides(key,k,unit));}
export function clampKeyPosition(key:Key,xMm:number,yMm:number,unit=UNIT_MM){const extent=bounds([key],unit),minX=key.xMm-extent.minX,minY=key.yMm-extent.minY,maxX=WORK_AREA_WIDTH_U*unit-(extent.maxX-key.xMm),maxY=WORK_AREA_HEIGHT_U*unit-(extent.maxY-key.yMm);return {...key,xMm:Math.min(maxX,Math.max(minX,snapMm(xMm,unit))),yMm:Math.min(maxY,Math.max(minY,snapMm(yMm,unit)))};}
export function clampKeyGroupDelta(keys:Key[],dx:number,dy:number,unit=UNIT_MM){const extent=bounds(keys,unit),snappedX=snapMm(dx,unit),snappedY=snapMm(dy,unit),minX=-extent.minX,minY=-extent.minY,maxX=WORK_AREA_WIDTH_U*unit-extent.maxX,maxY=WORK_AREA_HEIGHT_U*unit-extent.maxY,xMm=Math.min(maxX,Math.max(minX,snappedX)),yMm=Math.min(maxY,Math.max(minY,snappedY));return {xMm:xMm===0?0:xMm,yMm:yMm===0?0:yMm};}
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
export function nextKeyPosition(type:KeyType,keys:Key[],anchorId?:string,unit=UNIT_MM){const anchor=keys.find(k=>k.id===anchorId)??keys[keys.length-1],startX=anchor?anchor.xMm+bounds([anchor],unit).width:0,yMm=anchor?.yMm??0;for(let step=0;step<256;step++){const xMm=snapMm(startX+step*unit*GRID_U,unit),candidate:Key={id:'\u0000placement-candidate',type,xMm,yMm,rotation:0};if(canPlace(candidate,keys,unit))return{xMm,yMm};}return null;}
export function manufacturableSize(keys:Key[],unit=UNIT_MM){const b=bounds(keys,unit),w=toU(b.width,unit),h=toU(b.height,unit);return {ok:(w<=14&&h<=14)||(w<=15&&h<=5),widthU:w,heightU:h};}
export const effectivePpi=(pixelWidth:number,widthMm:number)=>pixelWidth/(widthMm/25.4);
export function validateDesign(v:unknown): asserts v is Design { if(!v||typeof v!=='object')throw Error('CCAPのproject.jsonが不正です');const d=v as Partial<Design>; if(d.formatVersion!==1)throw Error(`非対応のformatVersionです (${String(d.formatVersion)})`); if(!d.project||typeof d.project.name!=='string'||typeof d.project.createdAt!=='string'||typeof d.project.modifiedAt!=='string'||!d.layout||!Number.isFinite(d.layout.unitMm)||d.layout.unitMm!<=0||!Array.isArray(d.keys)||!Object.prototype.hasOwnProperty.call(d,'artwork'))throw Error('CCAPの必須データが不足しています');const ids=new Set<string>(),validId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;for(const k of d.keys){if(!k||typeof k.id!=='string'||!validId.test(k.id)||ids.has(k.id)||!KEY_TYPES.includes(k.type)||!Number.isFinite(k.xMm)||!Number.isFinite(k.yMm)||k.xMm<0||k.yMm<0||k.rotation!==0||d.keys.slice(0,d.keys.indexOf(k)).some(prev=>collides(k,prev,d.layout!.unitMm)))throw Error('CCAPのキー情報が不正です');ids.add(k.id);}if(d.frontArtwork!==undefined&&d.frontArtwork!==0&&d.frontArtwork!==1)throw Error('CCAPの画像の重なり順が不正です');if(d.artwork2!==undefined&&d.artwork2!==null&&d.artwork?.file===d.artwork2.file)throw Error('CCAPの画像ファイル名が重複しています');for(const a of [d.artwork,d.artwork2??null]){if(a===null)continue;if(!a||typeof a.file!=='string'||!/[.]((png)|(jpe?g)|(webp))$/i.test(a.file)||![a.xMm,a.yMm,a.widthMm,a.heightMm,a.rotation].every(Number.isFinite)||a.widthMm<=0||a.heightMm<=0)throw Error('CCAPのアートワーク情報が不正です');}}
