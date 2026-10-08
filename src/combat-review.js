// Deterministic review of the production character and permanent shield.
export function installCombatReview(game) {
 const panel=document.createElement('div');panel.style.cssText='position:fixed;bottom:8px;left:8px;z-index:99;background:#171827;padding:8px;display:flex;gap:6px;flex-wrap:wrap;color:#ffe6a1';panel.setAttribute('aria-label','Combat animation review');
 let frozen=true,move='idle',progress=.45,ownedShield=false,stopAtImpact=false,previewCamera=0;
 const pose=()=>{game.start();game.enemies=[];game.pickups=[];game.particles=[];game.projectiles=[];game.message='';game.messageTimer=0;game.camera=previewCamera;
 Object.assign(game.player,{x:previewCamera+370,y:450,vx:0,vy:0,grounded:true,shield:ownedShield,state:move,defending:move==='defend'&&ownedShield,animTime:progress,attackProgress:progress,attackIndex:move==='attack2'?1:0});
 if(move==='attack2')game.player.state='attack';if(move==='defend'&&!ownedShield)game.player.state='idle';
 if(['attack','attack2','heavy'].includes(move))game.player.attack={kind:move==='heavy'?'heavy':'light',index:game.player.attackIndex,elapsed:progress,duration:1,start:.2,end:.6};
 if(move==='dead'){game.player.dead=true;game.player.animTime=progress*1.2;}
 };
 for(const [label,state] of [['Idle','idle'],['Slash','attack'],['Uppercut','attack2'],['Heavy','heavy'],['Guard','defend'],['Death','dead']]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{move=state;frozen=true;pose();};panel.append(button);}
 const shield=document.createElement('button');shield.textContent='Get shield';shield.onclick=()=>{ownedShield=true;pose();};panel.append(shield);
 const slider=document.createElement('input');slider.type='range';slider.min=0;slider.max=100;slider.value=45;slider.setAttribute('aria-label','Animation progress');slider.oninput=()=>{progress=Number(slider.value)/100;pose();};panel.append(slider);
 const camera=document.createElement('input');camera.type='range';camera.min=0;camera.max=1900;camera.value=0;camera.setAttribute('aria-label','Parallax camera');camera.oninput=()=>{previewCamera=Number(camera.value);game.camera=previewCamera;game.player.x=previewCamera+370;};panel.append(camera);
 const live=document.createElement('button');live.textContent='Play';live.onclick=()=>{frozen=false;game.start();game.player.shield=ownedShield;};panel.append(live);
 const boss=document.createElement('button');boss.textContent='Boss preview';boss.onclick=()=>{frozen=true;move='idle';pose();game._spawnEnemy('raven_orc',game.camera+650,-1,'warlord');game.gates[0].active=true;};panel.append(boss);
 for(const [label,kind] of [['Sky fist','fist'],['Storm','storm'],['Legion','legion']]){const magic=document.createElement('button');magic.textContent=label;magic.onclick=()=>{ownedShield=true;move='idle';pose();game.arenas.forEach(a=>a.cleared=true);game._spawnEnemy('zombie',game.camera+590);game._spawnEnemy('skeleton',game.camera+730);game.player.mana[kind]=100;game._castMagic(kind);frozen=false;stopAtImpact=true;};panel.append(magic);}
 const notice=document.createElement('button');notice.textContent='Message preview';let noticeIndex=0;
 const notices=['VAE VICTIS! THE SWORD IS HUNGRY.','THE BONE KING * CHALLENGER APPROACHES.','ALL CLEAN! THE FLOOR WOULD DISAGREE.'];
 notice.onclick=()=>{frozen=true;stopAtImpact=false;pose();game.message=notices[noticeIndex++%notices.length];game.messageTimer=100;};panel.append(notice);
 document.body.append(panel);pose();return ()=>{if(stopAtImpact&&game.magicEffect?.impacted){frozen=true;stopAtImpact=false;}return frozen;};
}
