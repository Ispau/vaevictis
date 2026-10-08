// A timed attract boot. It never changes gameplay or writes the player's save.
import { setPixelInterfaceText } from './pixel-interface.js';
export function installArcadeBoot({skip=false,onFinish=()=>{}}={}) {
 const panel=document.getElementById('arcade-boot');
 if(!panel||skip){if(panel)panel.hidden=true;return;}
 const log=document.getElementById('boot-log'),brand=document.getElementById('boot-brand'),menu=document.getElementById('menu-screen');
 if(menu)menu.inert=true;
 const lines=['CAPCON SYSTEM / VV-01','68000 CPU .............. OK','WORK RAM 000000-FFFFFF','MEMORY TEST ........... OK','VIDEO RAM ............. OK','SPRITE ROM ............ OK','SOUND ROM ............. OK','INPUT PORTS ........... OK','ALL SYSTEMS GO'];
 let tick=0,timer=null;
 const finish=()=>{clearInterval(timer);panel.hidden=true;if(menu)menu.inert=false;document.removeEventListener('keydown',key,true);document.getElementById('start-button')?.focus({preventScroll:true});onFinish();};
 const key=e=>{if(e.code==='Enter'||e.code==='Space'||e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish();}};
 document.addEventListener('keydown',key,true);
 document.getElementById('skip-boot').addEventListener('click',finish,{once:true});
 document.getElementById('skip-boot').focus({preventScroll:true});
 timer=setInterval(()=>{tick++;if(tick<=lines.length){const value=lines.slice(0,tick).join('\n');if(!setPixelInterfaceText(log,value))log.textContent=value;}if(tick===11){log.hidden=true;brand.hidden=false;}if(tick===24)finish();},260);
}
