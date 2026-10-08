import { pixelText } from './pixel-hud.js';
const labels=new WeakMap();
const normalize=value=>String(value).toUpperCase().replace(/[’‘]/g,"'").replace(/[—–]/g,'-').replace(/×/g,'X').replace(/[·•]/g,'*').replace(/[←◀]/g,'<').replace(/[→▶↗›]/g,'>').replace(/[^A-Z0-9 \n/:!?.+\-,'%()=*<>\[\]]/g,'');
export function bitmapLines(value,columns=48){
 const out=[],limit=Math.max(1,Math.floor(columns));
 for(const paragraph of normalize(value).split('\n')){
  let line='';
  for(let word of paragraph.trim().split(/\s+/).filter(Boolean)){
   if(line&&line.length+word.length+1>limit){out.push(line);line='';}
   while(word.length>limit){if(line){out.push(line);line='';}out.push(word.slice(0,limit));word=word.slice(limit);}
   if(word)line+=(line?' ':'')+word;
  }
  out.push(line);
 }
 return out;
}
export function setPixelInterfaceText(el,value){
 const entry=labels.get(el);if(!entry)return false;
 if(entry.value!==String(value)){entry.value=String(value);entry.accessible.textContent=entry.value;entry.paint();}
 return true;
}
// Bitmap copy retains its accessible DOM label and refreshes when gameplay changes it.
export function installPixelInterface(){
 const shell=document.getElementById('game-shell'),items=[],toggles=[];
 const mount=(el,value,{fragment=false,wrap=false}={})=>{
  const accessible=document.createElement('span');accessible.className='sr-only';accessible.textContent=value;
  const canvas=document.createElement('canvas');canvas.className='bitmap-label';canvas.setAttribute('aria-hidden','true');
  const entry={el,canvas,accessible,value:String(value),paint(){
   if(!el.isConnected)return;
   const width=shell.clientWidth,small=fragment||el.matches('#boot-log,.guide-panel *');
   const scale=Math.max(1,Math.round(width/(el.matches('.screen-title')?200:small?700:360)));
   const available=el.id==='message-text'?width*.72:el.id==='boot-log'?width*.82:el.parentElement?.clientWidth||width*.4;
   const lines=bitmapLines(entry.value,wrap?Math.floor(available/(6*scale)):1000);
   canvas.width=Math.max(1,...lines.map(line=>line.length*6));canvas.height=lines.length*10-3;
   const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
   const color=el.matches('#message-text,.screen-title,.game-subtitle,.button-primary')?'#F1D078':getComputedStyle(el).color;
   lines.forEach((line,i)=>pixelText(ctx,line,0,i*10,color));
   canvas.style.width=`${canvas.width*scale}px`;canvas.style.height=`${canvas.height*scale}px`;
  }};
  if(el.matches('.toggle-label')){for(const node of [...el.childNodes])if(node.nodeType===Node.TEXT_NODE)node.remove();el.append(accessible,canvas);}
  else el.replaceChildren(accessible,canvas);
  labels.set(el,entry);items.push(entry);return entry;
 };
 for(const el of document.querySelectorAll('.button,.text-button,.screen-title,.game-subtitle,.eyebrow,.arcade-options .toggle-label'))mount(el,el.textContent.trim().replace(/\s+/g,' '));
 for(const [selector,value] of [['.studio-mark','1UP'],['.edition-label','FREE PLAY']]){const el=document.querySelector(selector);if(el)mount(el,value,{fragment:true});}
 for(const el of document.querySelectorAll('#message-text,#boot-log,#best-value,#loading-label,.result-stats strong,#victory-rank'))mount(el,el.textContent,{wrap:true});
 const walker=document.createTreeWalker(shell,NodeFilter.SHOW_TEXT),nodes=[];
 while(walker.nextNode()){
  const node=walker.currentNode;
  if(node.textContent.trim()&&!node.parentElement.closest('.sr-only,canvas,svg,.hud,#live-announcement,.toggle-label,.toggle-track'))nodes.push(node);
 }
 for(const node of nodes){const span=document.createElement('span');span.className='bitmap-fragment';node.replaceWith(span);mount(span,node.textContent.trim(),{fragment:true,wrap:true});}
 for(const track of document.querySelectorAll('.toggle-track')){
  const input=track.parentElement.querySelector('input'),canvas=document.createElement('canvas');if(!input)continue;
  canvas.className='bitmap-label';canvas.setAttribute('aria-hidden','true');track.append(canvas);toggles.push({input,canvas});
 }
 const resize=()=>{
  for(const entry of items)entry.paint();
  const scale=Math.max(1,Math.round(shell.clientWidth/360));
  for(const {input,canvas} of toggles){canvas.width=18;canvas.height=7;pixelText(canvas.getContext('2d'),input.checked?'ON':'OFF',input.checked?3:0,0,input.checked?'#F1D078':'#8B8F8C');canvas.style.width=`${18*scale}px`;canvas.style.height=`${7*scale}px`;}
 };
 document.addEventListener('click',()=>requestAnimationFrame(resize));document.addEventListener('change',resize);
 new ResizeObserver(resize).observe(shell);resize();
}
