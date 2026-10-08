// Original 5 x 7 bitmap lettering. HUD pixels share the world's nearest-neighbour scale.
const FONT = {
 A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['111','010','010','010','010','010','111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','11001','10101','10011','10011','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','11011','10001'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
 '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['010','110','010','010','010','010','111'],'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],'4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],':':['0','1','0','0','1','0','0'],'/':['00001','00001','00010','00100','01000','10000','10000'],'-':['000','000','000','111','000','000','000'],'.':['0','0','0','0','0','1','1'],'!':['1','1','1','1','1','0','1'],'+':['00000','00100','00100','11111','00100','00100','00000'],' ':['000','000','000','000','000','000','000']
};
const C={ink:'#10131d',edge:'#343a49',steel:'#87969c',white:'#f6e9cc',gold:'#e9ac55',darkGold:'#83503a',green:'#65bd80',red:'#b74249',cyan:'#74d4db'};
Object.assign(FONT,{
 "'":['1','1','0','0','0','0','0'],',':['0','0','0','0','0','1','1'],
 '%':['11001','11010','00100','01000','10110','00110','00000'],
 '(' :['01','10','10','10','10','10','01'],')':['10','01','01','01','01','01','10'],
 '*':['00000','10101','01110','11111','01110','10101','00000'],
 '=':['00000','00000','11111','00000','11111','00000','00000'],
 '>':['100','010','001','010','100','000','000'],'<':['001','010','100','010','001','000','000'],
 '[':['11','10','10','10','10','10','11'],']':['11','01','01','01','01','01','11']
});
function rect(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
export function pixelText(ctx,value,x,y,color=C.white,scale=1){
 ctx.fillStyle=color;
 for(const ch of String(value).toUpperCase()) { const glyph=FONT[ch]||FONT[' '],offset=Math.floor((5-glyph[0].length)/2);for(let row=0;row<7;row++)for(let col=0;col<glyph[row].length;col++)if(glyph[row][col]==='1')ctx.fillRect(x+(col+offset)*scale,y+row*scale,scale,scale);x+=6*scale; }
}
function panel(ctx,x,y,w,h){rect(ctx,x+2,y+2,w,h,'#080b12');rect(ctx,x,y,w,h,C.ink);rect(ctx,x+1,y,w-2,1,C.steel);rect(ctx,x,y+1,1,h-2,C.steel);rect(ctx,x+1,y+h-1,w-2,1,C.edge);rect(ctx,x+w-1,y+1,1,h-2,C.edge);for(const dx of [2,w-3])rect(ctx,x+dx,y+2,1,1,C.gold);}
function meter(ctx,x,y,w,h,ratio,color,highlight){
 rect(ctx,x,y,w,h,'#090d16'); const inner=w-4,fill=Math.round(inner*Math.max(0,Math.min(1,ratio||0)));
 rect(ctx,x+2,y+2,inner,h-4,'#3b2833');if(fill){rect(ctx,x+2,y+2,fill,h-4,color);rect(ctx,x+2,y+2,fill,1,highlight);}
 for(let i=10;i<inner;i+=11)rect(ctx,x+2+i,y+2,1,h-4,'#111925');
 rect(ctx,x,y,w,1,C.edge);rect(ctx,x,y+h-1,w,1,C.steel);
}
function sprite(ctx,rows,x,y,palette,scale=1){rows.forEach((row,iy)=>[...row].forEach((p,ix)=>{if(palette[p])rect(ctx,x+ix*scale,y+iy*scale,scale,scale,palette[p]);}));}
const FACE=[
 '....hhhhhhhh....','...hhahhhahhh...', '..hhhrrrrrrhhh..','..hhrrrrrrrrhh..',
 '.hhhsssssssshhh.','.hhhbbssssbbhhh.','.hhhswbssbwshhh.','.hhhsssssssshhh.',
 '.hhhsdssss dshhh.'.replace(' ', 'd'),'.hhhssdssdsshhh.','.hhhsssbbssshhh.','.hhhssdwwdsshhh.',
 '.hhhtssssssthhh.','hhhttsddddstthhh','hhttttssss tttthh'.replace(' ', 's'),'hhtttttttttttthh'
];
export function drawPixelHud(ctx,game,art={}){
 if(!game.player||game.state==='menu')return;
 const p=game.player;
 ctx.save();ctx.setTransform(ctx.canvas.width/480,0,0,ctx.canvas.height/270,0,0);ctx.imageSmoothingEnabled=false;
 panel(ctx,7,7,174,41);panel(ctx,190,7,155,17);panel(ctx,353,7,75,41);
 rect(ctx,11,11,34,34,'#72502A');
 if(art.portrait){ctx.drawImage(art.portrait,12,12,32,32);rect(ctx,11,11,34,1,'#F1D078');rect(ctx,11,44,34,1,'#432E1B');}
 else sprite(ctx,FACE,12,12,{h:'#171723',a:'#35303a',r:'#d74e43',s:'#cd8752',d:'#985139',b:'#251e27',w:'#f5e1b1',t:'#427c79'},2);
 pixelText(ctx,'BRUTUS',50,11,C.white);
 pixelText(ctx,`${Math.max(0,Math.ceil(p.hp))}/${p.maxHp||100}`,114,11,C.gold);
 meter(ctx,49,20,126,10,p.hp/(p.maxHp||100),p.hp<30?C.red:C.green,p.hp<30?'#f18778':'#b1e39b');
 pixelText(ctx,'Q',49,31,C.gold);meter(ctx,59,31,78,7,(p.rage||0)/100,'#c67936','#f8d07b');
 pixelText(ctx,p.rage>=100?'READY':'RAGE',143,31,p.rage>=100?C.gold:C.steel);
 pixelText(ctx,p.defending?'GUARD UP':p.shield?'I HOLD GUARD':'FIND SHIELD',50,39,p.defending?C.cyan:C.steel);
 pixelText(ctx,`ACT ${game.stage||1}`,196,12,C.gold);
 const scenes={1:'SUNSET RUINS',2:'GRAVEYARD',3:'DARK MARSH',4:'DARK FOREST',5:'ASH VILLAGE'};
 pixelText(ctx,(scenes[game.stage]||'FINAL BATTLE'),235,12,C.white);
 pixelText(ctx,'SCORE',359,11,C.gold);pixelText(ctx,String(Math.floor(game.score||0)).padStart(7,'0').slice(-7),359,23);
 const magics=[['fist','Z',C.gold],['storm','X',C.cyan],['legion','C','#c695e5']];
 magics.forEach(([kind,key,color],i)=>{const x=190+i*52,ready=(p.mana?.[kind]||0)>=100;panel(ctx,x,27,48,27);pixelText(ctx,key,x+4,31,color);meter(ctx,x+13,30,31,9,(p.mana?.[kind]||0)/100,color,C.white);pixelText(ctx,ready?'READY':kind==='fist'?'FIST':kind==='storm'?'STORM':'LEGION',x+4,44,ready?C.gold:C.white);});
 pixelText(ctx,p.shield?'V SHIELD':'NO SHIELD',359,38,p.shield?C.gold:C.steel);
 if(game.combo>=2){pixelText(ctx,`${game.combo} HITS`,385,55,C.gold);meter(ctx,385,66,77,5,(game.comboTimer||0)/(game.comboDuration||3),'#e9ac55','#f6e9cc');}
 if(game.boss&&!game.boss.dead&&game.boss.hp>0){const b=game.boss;panel(ctx,116,242,248,22);pixelText(ctx,b.name||'KING OF HUNGER',122,246,C.gold);meter(ctx,122,256,236,5,b.hp/b.maxHp,C.red,'#f29681');}
 else {rect(ctx,7,255,466,10,'#10131dcc');pixelText(ctx,'J SWORD   K HEAVY   I HOLD SHIELD   SPACE JUMP   L DODGE',12,257,C.white);}
 ctx.restore();
}
