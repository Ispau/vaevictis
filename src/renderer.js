/** BRUTUS — layered pixel-art renderer. The simulation owns all world coordinates. */
import { pixelText } from './pixel-hud.js';
const W = 960, H = 540, FLOOR = 450;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mod = (n, d) => ((n % d) + d) % d;
const px = n => Math.round(n);
const rand = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); };
const PAL = { dark:'#191827', deepest:'#111320', plum:'#342b3d', stone:'#4d5050', light:'#8c9170', moss:'#777b43', gold:'#d4ae68', cream:'#ffe6a1', teal:'#508b80', rust:'#ae654d' };
const NOMINAL = { hero:96, zombie:80, skeleton:80, ogre:128, boss:160, ghost:96, half_zombie:80, vampire:112, demon:112, witch:112, raven_orc:128, bone_king:160, werewolf:128 };

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function polygon(ctx, points, color) { ctx.fillStyle=color; ctx.beginPath(); points.forEach(([x,y],i)=>i ? ctx.lineTo(px(x),px(y)) : ctx.moveTo(px(x),px(y))); ctx.closePath(); ctx.fill(); }
function rect(ctx,x,y,w,h,color) { ctx.fillStyle=color; ctx.fillRect(px(x),px(y),Math.ceil(w),Math.ceil(h)); }

export class Renderer {
  constructor(canvas) {
    this.canvas=canvas; this.canvas.width=W; this.canvas.height=H;
    this.ctx=canvas.getContext('2d',{alpha:false});
    this.ctx.imageSmoothingEnabled=false;
    this.images={}; this.animations={}; this.manifest={}; this.bounds={}; this.tints=new Map();
    this.time=0; this.reducedMotion=false; this.camera=0; this.groundTiles=[];
    this._buildGround(); this._buildRuins();
  }

  setOptions({reducedMotion=false}={}) { this.reducedMotion=Boolean(reducedMotion); }

  async load() {
    let manifest;
    try { const response=await fetch('assets/manifest.json'); if(!response.ok)return; manifest=await response.json(); }
    catch { return; }
    this.manifest=manifest;
    const getImage=src=>new Promise(resolve=>{ const im=new Image(); im.onload=()=>resolve(im); im.onerror=()=>resolve(null); im.src=src; });
    const all=[];
    for(const [key,entry] of Object.entries(manifest.images||{})) {
      if(key==='werewolf')continue;
      all.push(getImage(typeof entry==='string'?entry:entry.src).then(im=>{
        if(im) { this.images[key]=im; if(NOMINAL[key]) this.bounds[key]=this._alphaBounds(im,0,0,im.width,im.height); }
      }));
    }
    for(const [key,data] of Object.entries(manifest.animations||{})) {
      if(key.startsWith('werewolf_')||['hero_transform','hero_revert'].includes(key))continue;
      all.push(getImage(data.src).then(im=>{
        if(!im)return;
        const fw=data.frameWidth||data.width||96, fh=data.frameHeight||data.height||96;
        const cols=data.cols||data.columns||Math.max(1,Math.floor(im.width/fw));
        const frames=Math.min(data.frames||cols,cols*Math.floor(im.height/fh));
        const bounds=[];
        for(let i=0;i<frames;i++)bounds.push(this._alphaBounds(im,(i%cols)*fw,Math.floor(i/cols)*fh,fw,fh));
        this.animations[key]={...data,image:im,frames,frameWidth:fw,frameHeight:fh,cols,bounds};
      }));
    }
    await Promise.allSettled(all);
    // Reuse the shield already drawn in the approved raised-guard pose as the
    // permanent equipment design in every animation and in the ground pickup.
    const guard=this.animations.hero_defend;
    if(guard){const frame=guard.frames-1,shield=makeCanvas(34,43),ctx=shield.getContext('2d');ctx.beginPath();[[2,8],[9,4],[15,1],[26,3],[33,8],[30,23],[23,36],[18,42],[9,34],[3,23]].forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();ctx.drawImage(guard.image,(frame%guard.cols)*guard.frameWidth+52,Math.floor(frame/guard.cols)*guard.frameHeight+23,34,43,0,0,34,43);this.images.shield=shield;}
  }

  _alphaBounds(image,sx,sy,w,h) {
    try {
      const c=makeCanvas(w,h),ctx=c.getContext('2d',{willReadFrequently:true}); ctx.drawImage(image,sx,sy,w,h,0,0,w,h);
      const data=ctx.getImageData(0,0,w,h).data; let left=w,top=h,right=0,bottom=0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>40){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      return bottom>top?{left,top,right,bottom,width:right-left+1,height:bottom-top+1}:{left:0,top:0,right:w-1,bottom:h-1,width:w,height:h};
    } catch { return {left:0,top:0,right:w-1,bottom:h-1,width:w,height:h}; }
  }

  _buildGround() {
    for(let variant=0;variant<6;variant++) {
      const c=makeCanvas(64,96),g=c.getContext('2d');g.imageSmoothingEnabled=false;
      rect(g,0,0,64,96,'#29272e');
      for(let row=0;row<4;row++)for(let col=-1;col<3;col++){
        const x=col*29+(row%2?14:0),y=12+row*23;
        polygon(g,[[x+3,y],[x+25,y-1],[x+29,y+6],[x+25,y+19],[x+5,y+21],[x,y+15]],['#414044','#35373d','#454348'][Math.floor(rand(row*17+col+variant*50)*3)]);
        rect(g,x+4,y+2,19,2,'#575259');rect(g,x+4,y+4,2,8,'#50494f');
        rect(g,x+8,y+17,15,2,'#22232d');rect(g,x+17,y+7,3,2,'#65605a');
      }
      polygon(g,[[0,0],[64,0],[64,8],[53,8],[51,12],[35,10],[29,15],[23,10],[11,11],[6,8],[0,9]],'#6f7751');
      rect(g,0,1,64,3,'#b2ae70');rect(g,0,5,64,2,'#838c56');
      for(let i=0;i<17;i++){
        const x=Math.floor(rand(i+variant*131)*32)*2,y=8+Math.floor(rand(i+variant*39+21)*34)*2;
        rect(g,x,y,2+Math.floor(rand(i+98)*3)*2,2,['#70755b','#595954','#91886b'][i%3]);
        if(i<7)rect(g,x,4+Math.floor(rand(i+31)*5),2,5+rand(i+51)*9,'#8b8c51');
      }
      this.groundTiles.push(c);
    }
  }

  _buildRuins() {
    const c=makeCanvas(720,290),g=c.getContext('2d');
    for(let i=0;i<5;i++){
      const x=i*160+20,base=275,top=75+Math.floor(rand(i+5)*5)*12;
      rect(g,x,top,24,base-top,'#242b32');rect(g,x+3,top,4,base-top,'#3b4948');rect(g,x+15,top,4,base-top,'#18212b');
      rect(g,x-5,base-12,34,12,'#222931');rect(g,x-4,top-4,32,10,'#33413f');
      for(let y=top+15;y<base-12;y+=19)rect(g,x+2,y,20,2,'#16232c');
      if(i<4) {
        polygon(g,[[x+20,top+15],[x+48,top-24],[x+72,top-34],[x+100,top-21],[x+136,top+22],[x+136,top+44],[x+101,top],[x+74,top-13],[x+56,top-8],[x+24,top+35]],'#2f3d3e');
        polygon(g,[[x+22,top+12],[x+49,top-26],[x+75,top-38],[x+102,top-25],[x+134,top+13],[x+132,top+20],[x+99,top-18],[x+75,top-30],[x+52,top-20],[x+25,top+20]],'#47514a');
      }
      for(let j=0;j<7;j++)rect(g,x+rand(i*71+j)*25,top+rand(j*5+i)*100,2,5+rand(j+27)*12,'#405342');
    }
    this.ruinFallback=c;
  }

  render(game,dt=0) {
    this.time+=Math.min(dt||0,.05); this.game=game;
    const g=this.ctx,t=this.time,menu=game.state==='menu';
    this.camera=menu?280+Math.sin(t*.04)*40:Number(game.camera)||0;
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.imageSmoothingEnabled=false;
    g.fillStyle=PAL.dark;g.fillRect(0,0,W,H);g.save();
    if(!this.reducedMotion && !menu && game.shake>0) {
      const shake=Math.min(10,game.shake);g.translate(px(Math.sin(t*103)*shake),px(Math.cos(t*137)*shake*.65));
    }
    this._sky();this._landscape();this._flyingCreatures();this._middleGround();
    // Recede the scenery so skin, steel and telegraphs retain foreground contrast.
    g.save();g.globalAlpha=.12;rect(g,0,0,W,H,'#121825');g.restore();
    this._terrain(menu?[{x:-1000,y:FLOOR,w:11000,h:110,type:'ground'}]:game.platforms||[]);
    this._groundProps(menu);
    if(!menu) {
      this._props(game.props||[]);this._pickups(game.pickups||[]);
      const actors=[...(game.enemies||[])]; if(game.player)actors.push(game.player);
      actors.sort((a,b)=>a.y-b.y || (a.type==='hero'?1:-1));
      for(const actor of actors)this._actor(actor);
      this._projectiles(game.projectiles||[]); this._particles(game.particles||[]);this._magicEffects(game);
    } else {
      this._actor({x:this.camera+840,y:450,type:'skeleton',facing:-1,state:'idle',animTime:t,hp:51,maxHp:51});
      this._actor({x:this.camera+1005,y:451,type:'boss',facing:-1,state:'idle',animTime:t,hp:1200,maxHp:1200});
      this._actor({x:this.camera+643,y:450,type:'hero',facing:1,state:'idle',animTime:t,hp:100,maxHp:100,rage:0});
    }
    this._atmosphere();this._foreground();
    if(game.flash>0 && !this.reducedMotion){g.globalAlpha=Math.min(.13,game.flash*.18);g.fillStyle='#ffe8b8';g.fillRect(0,0,W,H);g.globalAlpha=1;}
    g.restore();
    // CRT glass supplies the edge vignette. Do not wash out gameplay props.
  }

  _sky() {
    const g=this.ctx,t=this.time;
    const colors=['#201d36','#27223d','#31283f','#403446','#57444b','#746052','#9a8060','#b69b70'];
    for(let i=0;i<colors.length;i++)rect(g,0,i*45,W,46,colors[i]);
    for(let i=0;i<48;i++){
      const x=mod(rand(i*9+4)*W-this.camera*.04,W),y=25+rand(i*13+7)*210;
      g.globalAlpha=.24+Math.sin(t*.6+i)*.1;rect(g,x,y,i%11===0?3:1,i%11===0?3:1,'#fae4b0');
    }g.globalAlpha=1;
    const moonX=730-this.camera*.015,moonY=114;
    for(let i=3;i>0;i--){g.globalAlpha=.025;g.fillStyle='#f9dca0';g.beginPath();g.arc(moonX,moonY,67+i*15,0,Math.PI*2);g.fill();}g.globalAlpha=1;
    g.fillStyle='#d0ae73';g.beginPath();g.arc(moonX,moonY,64,0,Math.PI*2);g.fill();
    g.fillStyle='#f2d499';g.beginPath();g.arc(moonX-3,moonY-4,59,0,Math.PI*2);g.fill();
    for(let i=0;i<19;i++){const x=rand(i+18)*80-40,y=rand(i*3+70)*80-40;rect(g,moonX+x,moonY+y,4+rand(i+50)*13,3+rand(i+40)*8,'#d7b777');}
    this._cloudBank(-this.camera*.08-this.time*2,34,1.25,'#272238','#524150');
    this._cloudBank(180-this.camera*.11+this.time*3,147,.75,'#49404a','#8b6a60');
  }

  _cloudBank(offset,y,scale,dark,edge) {
    const g=this.ctx;
    g.save();g.translate(mod(offset,1100)-1100,y);g.scale(scale,scale);
    for(let repeat=0;repeat<3;repeat++)for(let i=0;i<11;i++){
      const x=repeat*1100+i*103,cy=Math.floor(rand(i*8+3)*35),w=80+rand(i+7)*64,h=18+rand(i*9+30)*17;
      polygon(g,[[x,cy+8],[x+16,cy+8],[x+16,cy],[x+42,cy],[x+42,cy-8],[x+65,cy-8],[x+65,cy],[x+w-12,cy],[x+w-12,cy+8],[x+w,cy+8],[x+w,cy+h],[x+12,cy+h],[x+12,cy+h-5],[x,cy+h-5]],edge);
      polygon(g,[[x,cy+4],[x+18,cy+4],[x+18,cy-4],[x+42,cy-4],[x+42,cy-13],[x+64,cy-13],[x+64,cy-4],[x+w-10,cy-4],[x+w-10,cy+5],[x+w,cy+5],[x+w,cy+h-7],[x+12,cy+h-7],[x+12,cy+h-12],[x,cy+h-12]],dark);
    }g.restore();
  }

  _landscape() {
    const g=this.ctx,cam=this.camera;
    const sceneKeys=['ruins','cemetery','swamp','dark_forest','abandoned_village'];
    const scenery=this.images[this.game?.biome||sceneKeys[(this.game?.stage||1)-1]]||this.images.background;
    if(scenery) {
      // Complete authored panorama, opaque and at integer 2x pixel scale.
      // Mirrored edge repeats avoid both a seam and the old 130px snap.
      this._parallaxImage(scenery,.09,FLOOR,2);
    } else {
      for(let depth=0;depth<3;depth++){
        const base=365+depth*25,span=290-depth*35,offset=mod(cam*(.13+depth*.07),span);
        for(let i=-1;i<6;i++){
          const x=i*span-offset,peak=base-115-depth*22-rand(i+depth*21)*65;
          polygon(g,[[x-70,base],[x+span*.44,peak],[x+span*.54,peak+28],[x+span,base]],['#5b5968','#384951','#29383f'][depth]);
          polygon(g,[[x+span*.44,peak],[x+span*.36,peak+58],[x+span*.50,peak+41],[x+span*.44,peak+82],[x+span*.7,base]],['#9a9582','#648c80','#416e62'][depth]);
        }
      }
    }
    if(!scenery&&this.images.mountains) {
      const im=this.images.mountains,w=1024,h=im.height*2,x=-mod(cam*.15,1024);
      g.save();g.globalAlpha=1;
      for(let i=-1;i<2;i++)g.drawImage(im,px(x+i*w),410-h,w,h);
      g.restore();
    }
    // Broken, horizontal mist bands are deliberately pixelated.
    for(let i=0;i<4;i++){g.globalAlpha=.04+i*.009;rect(g,0,320+i*20,W,9+i*2,'#d4cfa3');}g.globalAlpha=1;
    if(this.game.stage>=2){g.save();g.globalAlpha=.045;for(let i=0;i<5;i++){const x=mod(i*240+this.time*9-cam*.25,1200)-100;rect(g,x,420+i%2*10,160,6,'#b8c8a0');}g.restore();}
  }

  _parallaxImage(image,ratio,baseline,scale=2) {
    const g=this.ctx,w=image.width*scale,h=image.height*scale,offset=this.camera*ratio;
    const first=Math.floor(offset/w)-1,last=Math.floor((offset+W)/w)+1;
    g.save();g.globalAlpha=1;
    for(let tile=first;tile<=last;tile++){
      const x=px(tile*w-offset),mirror=mod(tile,2)===1;
      g.save();g.translate(x+(mirror?w:0),baseline-h);if(mirror)g.scale(-1,1);
      g.drawImage(image,0,0,w,h);g.restore();
    }
    g.restore();
  }

  _flyingCreatures() {
    const g=this.ctx,t=this.time,cam=this.camera;
    const dragonX=mod(840-t*13-cam*.07,1380)-180,dragonY=133+Math.sin(t*.7)*9;
    g.save();g.globalAlpha=.80;
    if(this.animations.dragon_fly || this.images.dragon) this._ambientSprite('dragon','fly',dragonX,dragonY,120,-1);
    else {
      g.translate(px(dragonX),px(dragonY));const wing=Math.sin(t*4)*19;
      polygon(g,[[-44,5],[-20,-3],[-4,-7],[6,-4],[20,-8],[32,-3],[24,1],[14,3],[5,11],[-9,9],[-26,14]],'#302d3b');
      polygon(g,[[-7,4],[-36,-15-wing],[-14,-10-wing],[-4,-25-wing],[4,-3],[20,-26-wing],[27,-13-wing],[52,-16-wing],[26,7],[9,12]],'#302d3b');
      rect(g,25,-4,2,2,'#dbbb7e');
    }g.restore();
    for(let i=0;i<3;i++){
      const x=mod(t*(12+i*4)+i*316-cam*.12,1160)-100,y=112+i*23+Math.sin(t*.7+i)*8;
      if(this.animations.eagle_fly||this.images.eagle)this._ambientSprite('eagle','fly',x,y,26+i*3,1);
      else {const wing=px(Math.sin(t*5+i)*6);polygon(g,[[x-13,y+wing],[x-4,y-2],[x,y],[x+4,y-2],[x+13,y+wing],[x+6,y+2],[x,y+4],[x-6,y+2]],'#302d38');}
    }
    if(!this.reducedMotion){
      const phase=mod(t+4,18);
      if(phase<.16 || phase>.29&&phase<.37){
        const x=610-mod(cam*.09,210);g.save();g.globalAlpha=phase<.16?.65:.32;
        polygon(g,[[x,28],[x-12,63],[x+1,63],[x-16,93],[x-7,88],[x-23,133],[x+10,82],[x-2,86],[x+19,53],[x+4,54],[x+13,28]],'#e4e0b2');g.restore();
      }
    }
  }

  _ambientSprite(type,action,x,y,width,facing) {
    const g=this.ctx,a=this.animations[`${type}_${action}`],im=a?.image||this.images[type];if(!im)return;
    g.save();g.translate(px(x),px(y));g.scale(facing,1);
    if(a){const f=Math.floor(this.time*(a.fps||8))%a.frames;g.drawImage(im,f%a.cols*a.frameWidth,Math.floor(f/a.cols)*a.frameHeight,a.frameWidth,a.frameHeight,-width/2,-width*a.frameHeight/a.frameWidth/2,width,width*a.frameHeight/a.frameWidth);}
    else g.drawImage(im,-width/2,-width*im.height/im.width/2,width,width*im.height/im.width);
    g.restore();
  }

  _middleGround() {
    const g=this.ctx,cam=this.camera;
    // The panorama already includes its architecture. Add a distinct near
    // silhouette plane, never a transparent copy of those same buildings.
    g.save();g.globalAlpha=1;
    const offset=cam*.45,first=Math.floor(offset/480)-1,last=Math.ceil((offset+W)/480);
    for(let i=first;i<=last;i++){
      const x=i*480-offset,height=115+rand(i+3)*50;
      polygon(g,[[x+15,447],[x+12,399],[x+2,363],[x+9,447],[x-7,447],[x-2,379],[x-24,360],[x-39,356],[x-27,353],[x-8,361],[x-10,338],[x-3,344],[x+3,373],[x+11,350],[x+19,447]],'#20252b');
      polygon(g,[[x+7,375],[x+32,344],[x+25,430-height],[x+36,340],[x+47,333],[x+37,350],[x+13,385]],'#20252b');
    }
    g.restore();
  }

  _terrain(platforms) {
    const g=this.ctx,cam=this.camera;
    rect(g,0,FLOOR+30,W,H-FLOOR,'#151720');
    for(const p of platforms){
      const x=px(p.x-cam),w=p.w,y=p.y,h=p.type==='ground'?Math.max(p.h,H-y+20):p.h;
      if(x>W+80||x+w< -80)continue;
      g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
      for(let tx=Math.floor(p.x/64)*64;tx<p.x+w;tx+=64){
        const variant=Math.floor(rand(tx+1)*this.groundTiles.length),tile=this.groundTiles[variant];
        for(let ty=0;ty<h;ty+=96)g.drawImage(tile,px(tx-cam),y+ty);
      }
      const im=this.images.tiles||this.images.ground;
      if(im){
        const meta=this.manifest.tiles||this.manifest.tilemap||{},size=meta.tileSize||32,drawSize=size*2;
        if(im.width===size*4 && im.height===size*4){
          // PixelLab's returned atlas is unordered Wang tiles: index 3 (wang_12)
          // is the continuous grassy top, index 6 (wang_0) is solid masonry.
          // The top half of wang_12 is air. Crop it so the visible edge agrees
          // with the platform collision surface instead of floating 24px below it.
          for(let ix=0;ix<w;ix+=drawSize){
            g.drawImage(im,3*size,size/2,size,size/2,x+ix,y,drawSize,drawSize/2);
            for(let iy=drawSize/2;iy<h;iy+=drawSize)
              g.drawImage(im,2*size,size,size,size,x+ix,y+iy,drawSize,drawSize);
          }
        }else for(let ix=0;ix<w;ix+=im.width*1.5)g.drawImage(im,x+ix,y,im.width*1.5,im.height*1.5);
      }
      g.restore();
      if(p.type!=='ground'){
        rect(g,x,y+h-3,w,3,'#191d28');rect(g,x+3,y+2,w-6,2,'#b2ad76');
        for(let i=12;i<w-10;i+=25){rect(g,x+i,y+h,3,8+rand(p.x+i)*14,'#475e43');rect(g,x+i+2,y+h+7,5,3,'#6e7950');}
      } else {
        rect(g,x,y,2,h,'#909275');rect(g,x+w-3,y,3,h,'#161c28');
        // A few loose grass tufts on the collision edge.
        for(let j=0;j<w;j+=53){const gx=x+j;if(gx< -20||gx>W+20)continue;this._grass(gx,y,rand(p.x+j));}
      }
    }
  }

  _grass(x,y,seed) {
    const g=this.ctx,h=4+seed*8;
    polygon(g,[[x-7,y],[x-10,y-h*.7],[x-3,y-3],[x-3,y-h],[x+1,y-4],[x+5,y-h*.7],[x+4,y],[x+8,y]],'#87905a');
    rect(g,x-1,y-4,2,4,'#b4b779');
  }

  _groundProps(menu) {
    const g=this.ctx,cam=this.camera;
    g.save();g.globalAlpha=1;g.globalCompositeOperation='source-over';
    for(let i=Math.floor(cam/320)-1;i<Math.floor((cam+W)/320)+1;i++){
      const wx=i*320+135,x=wx-cam,seed=rand(i+40);
      const supported=menu||(this.game.platforms||[]).some(p=>p.type==='ground'&&wx>p.x+20&&wx<p.x+p.w-20);
      if(!supported)continue;
      if(i%3===0){this._torch(x,448,1);}
      else if(i%3===1){
        polygon(g,[[x-33,450],[x-30,433],[x-21,423],[x+19,424],[x+33,438],[x+36,450]],'#171A21');
        polygon(g,[[x-28,448],[x-25,435],[x-18,427],[x+17,428],[x+29,439],[x+31,448]],'#5B6168');
        polygon(g,[[x-25,435],[x-18,427],[x+17,428],[x+25,437],[x-12,435],[x-18,444]],'#8B8F8C');
        rect(g,x-15,429,22,3,'#C7C4B8');rect(g,x+15,440,9,3,'#3A4048');this._grass(x+12,448,seed);
      }else{
        rect(g,x-5,434,12,10,'#b5b096');rect(g,x-2,430,8,4,'#d0c7a0');
        rect(g,x-4,438,4,3,'#37333c');rect(g,x+3,438,3,3,'#37333c');rect(g,x,443,5,3,'#d0c7a0');
        rect(g,x+13,446,19,3,'#9c9c7c');rect(g,x+30,443,3,5,'#bab895');
      }
    }
    g.restore();
  }

  _torch(x,y,scale=1) {
    const g=this.ctx,t=this.time;g.save();g.translate(px(x),px(y));g.scale(scale,scale);
    for(let j=3;j>0;j--){g.globalAlpha=.035;rect(g,-13-j*7,-95-j*5,26+j*14,43+j*8,'#ffbe69');}g.globalAlpha=1;
    const fire=this.animations.torch_flame;
    if(fire){const frame=mod(Math.floor(t*(fire.fps||10)+x),fire.frames);g.imageSmoothingEnabled=false;g.drawImage(fire.image,(frame%fire.cols)*fire.frameWidth,Math.floor(frame/fire.cols)*fire.frameHeight,fire.frameWidth,fire.frameHeight,-48,-(fire.anchorY||120),96,128);}
    for(let i=0;i<3;i++){const age=mod(t*.55+i*.3,1);g.globalAlpha=1-age;rect(g,Math.sin(age*9+i)*7,-86-age*42,2,2,'#fbd886');}g.restore();
  }

  _props(props) {
    const g=this.ctx;
    for(const prop of props) {
      if(prop.broken)continue;const x=prop.x-this.camera,y=prop.y;
      if(x < -260 || x > W+260)continue;
      const sprite=this.images[prop.type==='tree'?'tree_prop':prop.type==='barrel'?'barrel_prop':''];
      if(sprite){g.save();g.globalAlpha=1;g.imageSmoothingEnabled=false;g.drawImage(sprite,px(x-sprite.width),px(y-sprite.height*2+4),sprite.width*2,sprite.height*2);g.restore();continue;}
      if(prop.type==='tree') {
        rect(g,x-18,y-184,36,184,'#432E1B');rect(g,x-13,y-182,10,178,'#72502A');rect(g,x+9,y-161,5,155,'#A87836');
        polygon(g,[[x-8,y-120],[x-70,y-167],[x-76,y-202],[x-68,y-207],[x-58,y-178],[x+5,y-145]],'#72502A');
        polygon(g,[[x+8,y-158],[x+59,y-207],[x+89,y-210],[x+87,y-201],[x+65,y-195],[x+19,y-142]],'#432E1B');
        polygon(g,[[x-17,y],[x-53,y],[x-40,y-11],[x-19,y-19],[x+12,y-19],[x+45,y-4],[x+54,y],[x+18,y]],'#72502A');
        for(let k=0;k<6;k++)rect(g,x-11+k%2*15,y-35-k*24,3,15,'#252A33');
      }else if(prop.type==='pipe') {
        rect(g,x-10,y-120,20,120,'#252A33');rect(g,x-6,y-116,12,113,'#5B6168');rect(g,x-5,y-112,3,103,'#C7C4B8');rect(g,x-15,y-119,30,9,'#8B8F8C');
      }else {
        polygon(g,[[x-22,y-52],[x-17,y-62],[x+17,y-62],[x+22,y-52],[x+22,y-8],[x+16,y],[x-16,y],[x-22,y-8]],'#432E1B');
        for(let k=0;k<4;k++)rect(g,x-17+k*9,y-52,7,49,k%2?'#A87836':'#72502A');
        for(const by of [-49,-15]){rect(g,x-23,y+by,46,7,'#252A33');rect(g,x-21,y+by,42,3,'#8B8F8C');}
      }
    }
  }

  _magicEffects(game) {
    const effect=game.magicEffect;if(!effect)return;const g=this.ctx,t=effect.elapsed,impact=effect.impactAt,x=effect.x-this.camera;
    g.save();
    if(effect.kind==='fist') {
      g.globalAlpha=.3;rect(g,0,0,W,H,'#0B0D13');g.globalAlpha=1;
      g.save();g.globalAlpha=.35;rect(g,x-116,FLOOR-4,232,8,'#0B0D13');rect(g,x-92,FLOOR-9,184,18,'#0B0D13');g.restore();
      const cy=t<impact?-340+Math.pow(t/impact,2)*754:414+(t-impact)*180;
      if(t<impact+.23&&this.images.sky_fist){
        const im=this.images.sky_fist,w=300,h=w*im.height/im.width,alphaBottom=192/208;
        const bottom=t<impact?-330+Math.pow(t/impact,2)*780:FLOOR+(t-impact)*45;
        g.drawImage(im,px(x-w/2),px(bottom-h*alphaBottom),w,h);
      }else if(t<impact+.23){
        const fx=clamp(x-108,80,W-290);
        rect(g,fx+24,cy-260,168,180,'#432E1B');rect(g,fx+38,cy-254,126,170,'#D6A84B');
        for(let i=0;i<4;i++){rect(g,fx+i*54,cy-85,52,101,'#432E1B');rect(g,fx+i*54+5,cy-81,42,85,'#A87836');rect(g,fx+i*54+8,cy-78,31,19,'#F1D078');}
        rect(g,fx-35,cy-34,70,69,'#72502A');rect(g,fx-26,cy-29,50,44,'#D6A84B');
      }
      if(t>=impact){const radius=(t-impact)*540;for(let i=0;i<14;i++){const a=i*Math.PI/7;rect(g,x+Math.cos(a)*radius,FLOOR-9-Math.abs(Math.sin(a))*radius*.16,34,9,'#C7C4B8');}}
    }else if(effect.kind==='storm') {
      const bolt=this.images.storm_bolt;
      if(bolt&&t>.2&&t<1.3)for(const wx of effect.targetXs){
        const tx=wx-this.camera,height=FLOOR+8,width=px(height*bolt.width/bolt.height);
        g.drawImage(bolt,px(tx-width/2),0,width,height);
      }
    }else if(effect.kind==='legion') {
      const targetXs=effect.targetXs.length?effect.targetXs:[game.player.x+180];
      for(let i=0;i<12;i++){
        const tx=targetXs[i%targetXs.length],direction=i%2?1:-1;
        const cx=tx-direction*Math.max(0,180-t*250)+(i%3-1)*35-this.camera;
        const clone={...game.player,state:'attack',attack:null,attackIndex:i%3,attackProgress:mod(t*2+i*.13,1),animTime:t,facing:direction};
        g.globalAlpha=.55;
        this._drawActorSprite(clone,cx,FLOOR,this._animation(clone),this.images.hero,1.5,true);
      }
    }
    g.restore();
  }

  _pickups(pickups) {
    const g=this.ctx;
    for(const p of pickups){const x=p.x-this.camera,y=p.y+Math.sin(this.time*4+p.x)*4;if(x< -50||x>W+50)continue;
      g.save();g.globalAlpha=.12;g.fillStyle=p.type==='health'?'#eca577':'#e8cf87';g.beginPath();g.ellipse(x,y+10,15,5,0,0,Math.PI*2);g.fill();g.globalAlpha=1;
      if(p.type?.endsWith('_potion')) {
        const color=p.type==='green_potion'?'#69944F':p.type==='red_potion'?'#C73332':'#F1D078';
        rect(g,x-5,y-27,10,5,'#72502A');rect(g,x-4,y-22,8,8,'#C7C4B8');
        polygon(g,[[x-4,y-17],[x-11,y-10],[x-11,y+3],[x-6,y+8],[x+6,y+8],[x+11,y+3],[x+11,y-10],[x+4,y-17]],'#171A21');
        rect(g,x-8,y-8,16,12,color);rect(g,x-5,y-10,3,12,'#F3E7C9');rect(g,x-4,y+5,8,2,'#8B8F8C');
      }else if(p.type==='shield'&&this.images.shield) {
        g.drawImage(this.images.shield,px(x-21),px(y-32),42,42);
      }else if(p.type==='gem') {
        const colors=['','#171A21','#236078','#74D4DB','#F3E7C9'];
        const rows=['00001110000','00012321000','00123432100','01234443210','12334443321','12333333321','01233333210','00123332100','00012321000','00001210000','00000100000'];
        rows.forEach((row,iy)=>[...row].forEach((value,ix)=>{if(value!=='0')rect(g,x-11+ix*2,y-22+iy*2,2,2,colors[Number(value)]);}));
      }else if(['club','pipe','tree','barrel'].includes(p.type)) {
        if(p.type==='tree'&&this.images.uprooted_tree)g.drawImage(this.images.uprooted_tree,px(x-80),px(y-32),160,80);
        else {rect(g,x-5,y-35,10,42,p.type==='pipe'?'#8B8F8C':'#72502A');rect(g,x-3,y-33,3,38,'#D6A84B');}
      }else if(['health','meat','food'].includes(p.type)){
        rect(g,x-2,y-3,6,10,'#e7d6ab');rect(g,x-5,y+5,5,4,'#fff0c5');rect(g,x+2,y+5,5,4,'#fff0c5');
        polygon(g,[[x-11,y-15],[x-5,y-22],[x+5,y-21],[x+12,y-12],[x+7,y-3],[x-4,y-2]],'#4f3036');
        polygon(g,[[x-9,y-15],[x-4,y-20],[x+5,y-18],[x+8,y-11],[x+3,y-5],[x-5,y-5]],'#c4794d');rect(g,x-6,y-16,7,3,'#f2b376');
      }else{
        polygon(g,[[x,y-25],[x+11,y-16],[x+8,y-6],[x,y],[x-8,y-6],[x-11,y-16]],'#302d39');
        polygon(g,[[x,y-22],[x+8,y-15],[x+5,y-7],[x,y-3],[x-6,y-8],[x-7,y-15]],p.type==='rage'?'#87b99b':'#ddbd74');rect(g,x-3,y-18,3,8,'#fff0b1');
      }
      if(Math.floor(this.time*3+p.x)%5===0){rect(g,x+15,y-22,2,8,'#fff0b1');rect(g,x+12,y-19,8,2,'#fff0b1');}g.restore();
    }
  }

  _animation(actor) {
    const type=actor.type||'hero',state=actor.state||'idle';let names=[];
    if(type==='hero') {
      if(state==='attack')names=[actor.attack?.direction==='up'?'attack_2':actor.attack?.direction==='down'?'heavy':actor.attackIndex===2?'attack_3':actor.attackIndex===1?'attack_2':'attack_1','attack'];
      else if(state==='heavy')names=['heavy','attack'];
      else if(state==='airattack')names=['airattack','attack_2','attack_1'];
      else if(state==='special')names=['special','heavy','attack'];
      else if(state==='dash')names=['dash','run'];
      else if(state==='fall')names=['fall','jump'];
      else if(state==='dead')names=['death','hurt_death'];
      else if(state==='hurt')names=['hurt_death'];
      else if(state==='drink')names=['drink','idle'];
      else names=[state];
    }else{
      if(state==='run'||state==='walk')names=['walk','run'];
      else if(state==='telegraph')names=['telegraph','idle'];
      else if(state==='recover')names=['idle'];
      else names=[state];
    }
    if(type==='raven_orc'&&['attack','telegraph'].includes(state)&&this.animations.orc_roar)return {key:'orc_roar',data:this.animations.orc_roar,action:'roar'};
    if(type==='hero'&&actor.shield)for(const name of names){const key=`hero_shield_${name}`;if(this.animations[key])return {key,data:this.animations[key],action:name};}
    for(const name of names)if(this.animations[`${type}_${name}`])return {key:`${type}_${name}`,data:this.animations[`${type}_${name}`],action:name};
    if(type==='half_zombie'&&this.animations.zombie_attack&&state==='attack')return {key:'zombie_attack',data:this.animations.zombie_attack,action:'attack'};
    if(this.animations[`${type}_idle`])return {key:`${type}_idle`,data:this.animations[`${type}_idle`],action:'idle'};
    return null;
  }

  _actor(actor) {
    const g=this.ctx,type=actor.renderType||actor.type||'hero',x=actor.x-this.camera,y=actor.y;
    if(x< -240||x>W+240||y>H+200)return;
    const isHero=actor.type==='hero',dead=actor.dead||actor.state==='dead',time=actor.animTime||0;
    const image=this.images[type],anim=this._animation(actor),size=NOMINAL[type]||96;
    // A shared pixel scale preserves the approved relative character proportions.
    const standardScale=actor.isBoss?1:({zombie:1.09,ghost:.9,half_zombie:.68,vampire:.78,witch:.82,raven_orc:.82}[type]||1);
    const scale=(this.manifest.characterScale||1.5)*(actor.scale||1)*standardScale;
    const nominalHeight=size*scale;
    const ground=Math.min(FLOOR,y+(actor.grounded?0:Math.max(0,450-y)));
    g.save();g.globalAlpha=dead?.2:.32;g.fillStyle='#100f1b';g.beginPath();g.ellipse(x,ground+1,(type==='boss'?55:type==='ogre'?43:27)*clamp(1-(ground-y)/400,.5,1),5,0,0,Math.PI*2);g.fill();g.restore();
    if(actor.state==='telegraph'&&!dead)this._telegraph(actor,x,y,nominalHeight);
    if(isHero&&actor.state==='dash')for(let i=3;i>0;i--){g.save();g.globalAlpha=.12*(4-i);this._drawActorSprite(actor,x-actor.facing*i*20,y,anim,image,scale,true);g.restore();}
    if(isHero&&actor.rage>=100&&!dead){g.save();g.globalAlpha=.10+.035*Math.sin(this.time*7);for(let i=0;i<3;i++)rect(g,x-30-i*6,y-110+i*8,60+i*12,105-i*5,'#efc574');g.restore();}
    g.save();
    if(dead&&!isHero){g.globalAlpha=clamp((actor.deathTimer??.6)/.65,0,.8);}
    else if(actor.invulnerable>0&&isHero){g.globalAlpha=Math.floor(this.time*17)%2?.6:1;}
    this._drawActorSprite(actor,x,y,anim,image,scale,false);
    // Carry equipment on the off arm; guard already has this same shield baked in.
    if(isHero&&actor.shield&&this.images.shield&&!dead&&!anim?.data.includesShield&&actor.state!=='defend'){
      const shield=this.images.shield,sw=50,sh=sw*shield.height/shield.width,pose=this._shieldPose(actor);
      g.save();g.translate(px(x),px(y));g.scale(actor.facing||1,1);g.translate(pose.x,pose.y);g.rotate(pose.angle);g.drawImage(shield,-sw/2,-sh/2,sw,sh);g.restore();
    }
    if(isHero&&actor.blockTimer>0)this._guardImpact(actor,x,y);
    g.restore();
    if(!dead)this._attackFX(actor,x,y);
    if(!isHero&&!dead&&actor.hp<actor.maxHp&&type!=='boss'){
      const width=type==='ogre'?52:38,bottom=y-nominalHeight+4;
      rect(g,x-width/2-2,bottom-3,width+4,7,'#161720');rect(g,x-width/2,bottom-1,width,3,'#564543');
      rect(g,x-width/2,bottom-1,width*clamp(actor.hp/actor.maxHp,0,1),3,'#e4b371');
    }
  }

  _drawActorSprite(actor,x,y,anim,image,scale,trail=false) {
    const g=this.ctx,type=actor.type||'hero',state=actor.state||'idle';g.save();g.translate(px(x),px(y));g.scale(actor.facing||1,1);
    if(actor.dead&&actor.type!=='hero'){g.translate(0,-12);g.rotate((actor.facing||1)*-.9);}
    let bounds,source,sx=0,sy=0,fw,fh;
    if(anim){
      const a=anim.data;
      const f=this._actorFrame(actor,anim);
      sx=f%a.cols*a.frameWidth;sy=Math.floor(f/a.cols)*a.frameHeight;fw=a.frameWidth;fh=a.frameHeight;source=a.image;bounds=a.bounds[f];
    }else if(image){source=image;fw=image.width;fh=image.height;bounds=this.bounds[type];}
    if(source){
      // Keep a fixed source-canvas origin: per-frame alpha bounds cause feet to slide during attacks.
      const b=bounds||{bottom:fh-1},base=this.bounds[type],nominal=NOMINAL[type]||fw;
      const metadata=anim?.data||this.manifest.spriteMetadata?.[type]||{};
      const pixelScale=metadata.pixelScale?metadata.pixelScale*(actor.scale||1):scale*Math.min(1,nominal/fw);
      let bob=0;
      if(!anim){
        if(state==='run'||state==='walk'){bob=Math.abs(Math.sin((actor.animTime||this.time)*12))*3;g.rotate(Math.sin((actor.animTime||this.time)*12)*.025);}
        else bob=Math.sin((actor.animTime||this.time)*3)*1;
      }
      if(state==='dash')g.rotate(.10);
      if(state==='hurt')g.rotate(-.09);
      const anchor=metadata.pivotY??(base?base.bottom:fh-1);
      const dy=-Math.min(fh-1,anchor)*pixelScale-bob;
      const dx=-(metadata.pivotX??fw/2)*pixelScale;
      g.drawImage(source,sx,sy,fw,fh,px(dx),px(dy),px(fw*pixelScale),px(fh*pixelScale));
      if((actor.flash>0||trail)&&!this.reducedMotion){
        const key=`${type}:${anim?.key||'static'}:${sx}:${sy}:${trail?'trail':'hit'}`;
        let tinted=this.tints.get(key);
        if(!tinted){tinted=makeCanvas(fw,fh);const c=tinted.getContext('2d');c.drawImage(source,sx,sy,fw,fh,0,0,fw,fh);c.globalCompositeOperation='source-in';c.fillStyle=trail?'#d7bc83':'#fff0c0';c.fillRect(0,0,fw,fh);this.tints.set(key,tinted);}
        g.globalAlpha*=trail?.45:.62;g.drawImage(tinted,px(dx),px(dy),px(fw*pixelScale),px(fh*pixelScale));
      }
    }else this._fallbackActor(actor,scale);
    g.restore();
  }

  _shieldPose(actor) {
    const state=actor.state||'idle',t=actor.animTime||0;
    // Attack and guard clips contain their shield. Remaining movement states
    // carry it steadily rather than moving an independent object up/down.
    if(state==='run')return {x:30,y:-65,angle:0};
    if(state==='jump'||state==='fall')return {x:27,y:-72,angle:-.15};
    if(state==='dash')return {x:28,y:-85,angle:-.12};
    return {x:30,y:-65,angle:0};
  }

  _actorFrame(actor,anim) {
    const a=anim.data,state=actor.state||'idle',last=a.frames-1,time=actor.animTime??0;
    if(state==='drink')return Math.min(last,Math.floor((actor.drink?.progress||0)*a.frames));
    if(state==='defend')return Math.min(last,Math.floor(time*(a.includesShield?18:24)));
    if(state==='dead')return Math.min(last,Math.floor(time*(a.fps||10)));
    if(state==='hurt')return Math.min(2,last,Math.floor(time*18));
    if(['attack','heavy','airattack','special'].includes(state)) {
      const progress=actor.type==='hero'&&Number.isFinite(actor.attackProgress)
        ?actor.attackProgress:clamp(time/(actor.attackKind==='rush'?.8:.58),0,1);
      if(actor.attack&&Number.isFinite(a.contactFrame)) {
        const elapsed=actor.attack.elapsed,start=actor.attack.start,end=actor.attack.end,contact=a.contactFrame;
        if(elapsed<start)return Math.min(contact-1,Math.floor(elapsed/start*contact));
        if(elapsed<=end)return Math.min(last,contact+Math.floor((elapsed-start)/Math.max(.01,end-start)*Math.min(2,last-contact)));
        const recovery=Math.min(last,contact+2);
        return Math.min(last,recovery+Math.floor((elapsed-end)/Math.max(.01,actor.attack.duration-end)*(last-recovery+1)));
      }
      return Math.min(last,Math.floor(clamp(progress,0,1)*a.frames));
    }
    if(state==='jump'||state==='fall'||state==='dash')return Math.min(last,Math.floor(time*(a.fps||12)));
    return Math.floor(time*(a.fps||10))%a.frames;
  }

  _guardImpact(actor,x,y) {
    const g=this.ctx,life=clamp(actor.blockTimer/.18,0,1),burst=1-life;
    g.save();g.translate(px(x+(actor.facing||1)*43),px(y-80));
    for(let i=0;i<7;i++){
      const angle=-Math.PI*.85+i*Math.PI*1.7/6,r=9+burst*24;
      rect(g,Math.cos(angle)*r,Math.sin(angle)*r,life>0.5?5:3,3,i%2?'#f2c56c':'#fff2be');
    }
    if(life>.6){rect(g,-2,-9,4,18,'#fff2be');rect(g,-9,-2,18,4,'#fff2be');}
    g.restore();
  }

  _fallbackActor(actor,scale) {
    const g=this.ctx,type=actor.type||'hero',hero=type==='hero',big=type==='boss'?1.7:type==='ogre'?1.35:hero?1:.86;
    g.scale(scale*big,scale*big);g.translate(0,-3);
    const t=actor.animTime||0,walk=actor.state==='run'||actor.state==='walk',step=walk?Math.sin(t*11)*5:0;
    const skin=hero?'#c28855':type==='skeleton'?'#c8c8a2':type==='zombie'?'#8b9862':'#9c8058',shadow=hero?'#815044':'#53574c';
    const stroke='#22202c';
    rect(g,-16-step,-23,14,23,stroke);rect(g,3+step,-23,13,23,stroke);
    rect(g,-14-step,-23,10,17,skin);rect(g,5+step,-23,9,17,shadow);
    rect(g,-19-step,-7,17,7,'#514139');rect(g,3+step,-7,19,7,'#514139');rect(g,-18-step,-8,14,2,'#ad9165');
    polygon(g,[[-20,-52],[-14,-60],[12,-60],[22,-50],[17,-31],[-15,-30]],stroke);
    polygon(g,[[-17,-51],[-12,-58],[10,-58],[19,-50],[15,-34],[-13,-34]],skin);
    rect(g,-13,-50,9,9,'#dcac70');rect(g,2,-50,12,8,skin);rect(g,-9,-37,22,3,shadow);
    polygon(g,[[-15,-34],[15,-34],[20,-20],[8,-18],[3,-24],[-3,-18],[-20,-23]],hero?'#963e35':'#585842');
    rect(g,-16,-35,32,5,'#332c32');rect(g,-2,-35,8,6,'#c9a561');
    polygon(g,[[-17,-56],[-28,-48],[-27,-32],[-16,-31],[-13,-46]],stroke);
    rect(g,-25,-46,10,14,skin);rect(g,-27,-35,14,7,'#547e71');rect(g,-25,-34,9,2,'#b5ad7f');
    polygon(g,[[14,-56],[26,-51],[29,-34],[18,-30],[14,-43]],stroke);rect(g,18,-47,9,15,skin);
    rect(g,18,-34,13,7,'#577e70');rect(g,20,-32,9,2,'#b7b482');
    rect(g,-12,-78,25,24,stroke);rect(g,-9,-76,21,20,skin);rect(g,-11,-80,24,8,'#28242b');
    rect(g,-14,-77,6,22,'#28242b');rect(g,9,-74,7,8,'#28242b');
    rect(g,-3,-69,4,3,stroke);rect(g,7,-69,4,3,stroke);rect(g,1,-60,10,3,'#eee0b2');
    if(type==='skeleton'){rect(g,-7,-69,6,6,'#303139');rect(g,4,-69,6,6,'#303139');rect(g,-1,-62,3,4,'#303139');}
    if(type==='boss')for(let i=0;i<3;i++){rect(g,-13+i*11,-85,8,9,'#d1ab64');polygon(g,[[-13+i*11,-85],[-10+i*11,-96],[-5+i*11,-85]],'#ead28f');}
    g.save();g.translate(25,-27);if(['attack','heavy'].includes(actor.state))g.rotate(-1.8+(actor.attackProgress||0)*3.1);
    polygon(g,[[-5,0],[2,-6],[58,5],[69,15],[55,17]],stroke);polygon(g,[[1,-3],[57,7],[65,13],[53,13]],'#d4d7c0');polygon(g,[[1,-3],[57,7],[53,10],[2,0]],'#f4ecd1');
    rect(g,-8,-8,5,17,'#b4a070');g.restore();
  }

  _telegraph(actor,x,y,height) {
    const g=this.ctx,progress=1-clamp(actor.telegraphTimer/(actor.telegraphDuration||1),0,1),r=actor.type==='boss'?93:actor.type==='ogre'?70:46;
    g.save();g.globalAlpha=.12+progress*.15;g.fillStyle='#ec8b56';g.beginPath();g.ellipse(x+actor.facing*r*.4,y+1,r,10,0,0,Math.PI*2);g.fill();g.globalAlpha=.9;
    const top=y-height-11;rect(g,x-5,top,10,15,'#291e2b');rect(g,x-3,top+2,6,8,'#f7c16e');rect(g,x-2,top+12,4,3,'#f7c16e');
    for(let i=0;i<3;i++){const a=this.time*5+i*2;rect(g,x+Math.cos(a)*29,y-height*.65+Math.sin(a)*21,3,3,'#f7bd72');}g.restore();
  }

  _attackFX(actor,x,y) {
    const g=this.ctx,state=actor.state,isHero=actor.type==='hero';
    if(!['attack','heavy','airattack','special'].includes(state))return;
    const p=Number.isFinite(actor.attackProgress)?actor.attackProgress:clamp(1-(actor.attackTimer||0)/.58,0,1);
    const activeStart=actor.attack?actor.attack.start/actor.attack.duration:.18;
    const activeEnd=actor.attack?actor.attack.end/actor.attack.duration:.62;
    if(p<activeStart||p>activeEnd)return;
    const heavy=state==='heavy',special=state==='special'||actor.attackKind==='special',reach=special?185:heavy?114:95+(actor.attackIndex||0)*9;
    const alpha=Math.sin(clamp((p-.14)/.71,0,1)*Math.PI);
    g.save();g.translate(px(x),px(y-54));g.scale(actor.facing||1,1);g.globalAlpha=alpha*.48;
    const start=heavy?-2.05:-1.14,end=heavy?1.25:1.15;
    const mid=-.4+p*1.5,points=[],inner=[];
    for(let i=0;i<=15;i++) {const angle=start+(end-start)*i/15;points.push([Math.cos(angle)*reach,Math.sin(angle)*reach*.65]);inner.unshift([Math.cos(angle)*(reach-8-10*Math.sin(i/15*Math.PI)),Math.sin(angle)*(reach-8-10*Math.sin(i/15*Math.PI))*.65]);}
    // Small stepped sparks leave the weapon and its key poses readable.
    for(let i=2;i<points.length-2;i++){
      const [tx,ty]=points[i];
      rect(g,Math.round(tx/3)*3,Math.round(ty/3)*3,3,3,isHero?(special?'#e2c077':'#f3e3ae'):'#ce7959');
    }
    g.globalAlpha=alpha*.95;
    for(let i=0;i<5;i++){const a=start+(end-start)*(i/5),r=reach+8+rand(i+9)*16;rect(g,Math.cos(a)*r,Math.sin(a)*r*.65,3+rand(i)*4,2,'#fff2bd');}
    if(special){
      g.globalAlpha=alpha*.65;g.lineWidth=3;g.strokeStyle='#f6d490';g.beginPath();g.ellipse(0,22,reach+32,44,0,0,Math.PI*2);g.stroke();
      for(let i=0;i<12;i++){const a=i*Math.PI/6+this.time*3;rect(g,Math.cos(a)*(reach+20),Math.sin(a)*62-20,4,9,'#eccc83');}
    }
    g.restore();
  }

  _projectiles(projectiles) {
    const g=this.ctx;
    for(const p of projectiles){const x=p.x-this.camera,y=p.y;if(x< -60||x>W+60)continue;const sign=p.vx<0?-1:1;
      g.save();g.translate(px(x),px(y));g.scale(sign,1);
      if(p.type==='raven') {
        const wing=Math.floor(this.time*14)%2?18:-17;
        polygon(g,[[-15,-2],[-27,wing],[-4,-8],[5,-8],[22,wing],[17,-1],[4,6],[-6,3]],'#0B0D13');rect(g,9,-3,6,3,'#D6A84B');rect(g,4,-6,2,2,'#C73332');g.restore();continue;
      }
      if(p.type==='bone_hand') {
        const rise=p.delay>0?4:Math.min(68,(1.2-p.life)*130);
        rect(g,-25,9,50,5,'#171A21');
        for(let k=0;k<5;k++){const fh=rise-[9,2,0,5,19][k];rect(g,-22+k*10,-fh,8,fh+9,'#5B6168');rect(g,-21+k*10,-fh,5,fh+7,'#C7C4B8');for(let j=0;j<3;j++)rect(g,-21+k*10,-fh+j*16,5,2,'#8B8F8C');}
        g.restore();continue;
      }
      for(let i=3;i>0;i--){g.globalAlpha=.12;rect(g,-i*13,-6+i,14,12-i*2,'#b7c47e');}g.globalAlpha=1;
      polygon(g,[[-13,-5],[0,-9],[13,-2],[8,6],[-2,8],[-14,3]],'#526d60');polygon(g,[[-6,-4],[2,-6],[10,-1],[5,4],[-5,3]],'#c7d59a');rect(g,0,-3,6,4,'#fff0bb');g.restore();
    }
  }

  _particles(particles) {
    const g=this.ctx;
    for(const p of particles){const x=p.x-this.camera,y=p.y;if(x< -80||x>W+80)continue;g.save();g.globalAlpha=clamp(p.life/(p.maxLife||1),0,1);
      if(p.text){const tx=px(x-p.text.length*5);pixelText(g,p.text,tx+2,px(y)+2,'#171A21',2);pixelText(g,p.text,tx,px(y),p.color||'#F3E7C9',2);}
      else {const size=p.size||3;rect(g,x-size/2,y-size/2,size,size,p.color||'#eed394');if(size>4)rect(g,x-size/2,y-size/2,size/2,2,'#fff0b6');}
      g.restore();
    }
  }

  _atmosphere() {
    const g=this.ctx,t=this.time;
    for(let i=0;i<28;i++){
      const x=mod(rand(i*9+24)*1200+t*(4+rand(i)*8)-this.camera*.5,1200)-120,y=mod(rand(i*7+31)*310-t*(2+rand(i+8)*6),310)+175;
      g.globalAlpha=(.14+Math.sin(t*1.5+i)*.10)*(y<440?1:.5);rect(g,x,y,i%5===0?3:2,i%5===0?3:2,i%3===0?'#e8bb78':'#bfcca0');
    }g.globalAlpha=1;
  }

  _foreground() {
    const g=this.ctx,cam=this.camera;
    for(let i=Math.floor(cam/185)-1;i<Math.floor((cam+W)/185)+2;i++){
      const x=i*185-cam*1.02,seed=rand(i*23+11),h=18+seed*35;
      polygon(g,[[x-21,H],[x-26,H-h*.4],[x-16,H-h*.35],[x-23,H-h],[x-10,H-h*.65],[x-4,H-5],[x+1,H-h*.5],[x+13,H-h*.65],[x+8,H-4],[x+26,H-h*.3],[x+20,H]],'#121923');
      if(i%3===0){rect(g,x-4,H-h*.6,2,h*.4,'#32433b');rect(g,x-11,H-h*.55,8,2,'#32433b');}
    }
  }
}
