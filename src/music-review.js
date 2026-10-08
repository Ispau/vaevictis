import { AudioSystem } from './audio.js';

const tracks = [
  {scene:'intro',title:'The Oath of Brutus',bpm:84,description:'The village burns. A quiet lament becomes a march of vengeance.'},
  {scene:'ending',title:'The Last Promise',bpm:68,description:'At the graves of his people, Brutus finds a solemn peace.'},
  {scene:'credits',title:'Vae Victis — Victory of the Golden Fist',bpm:108,description:'A heroic fanfare celebrating the warrior and his three powers.'}
];

function wav(buffer) {
  const channels=buffer.numberOfChannels, length=buffer.length, bytes=length*channels*2;
  const result=new ArrayBuffer(44+bytes), view=new DataView(result);
  const label=(offset,text)=>[...text].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
  label(0,'RIFF');view.setUint32(4,36+bytes,true);label(8,'WAVE');label(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);
  view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);
  label(36,'data');view.setUint32(40,bytes,true);
  const samples=Array.from({length:channels},(_,c)=>buffer.getChannelData(c));let peak=0;
  for(const sample of samples)for(const value of sample)peak=Math.max(peak,Math.abs(value));
  const gain=peak>0?Math.min(12,.88/peak):1;
  for(let i=0;i<length;i++)for(let c=0;c<channels;c++){
    const fade=Math.min(1,i/buffer.sampleRate,(length-i)/(buffer.sampleRate*1.3));
    view.setInt16(44+(i*channels+c)*2,Math.round(Math.max(-1,Math.min(1,samples[c][i]*gain*fade))*32767),true);
  }
  return {blob:new Blob([result],{type:'audio/wav'}),peak,gain};
}

async function renderTrack(track) {
  const sampleRate=44100, seconds=16*4*60/track.bpm+2;
  const context=new OfflineAudioContext(2,Math.ceil(seconds*sampleRate),sampleRate);
  const audio=new AudioSystem({volume:.5});audio.context=context;audio.scene=track.scene;
  audio.voices={size:0,add(){},delete(){}};
  audio.master=context.createGain();audio.music=context.createGain();audio.effects=context.createGain();audio.limiter=context.createDynamicsCompressor();
  audio.master.gain.value=.5;audio.music.gain.value=.38;
  Object.assign(audio.limiter.threshold,{value:-12});audio.limiter.knee.value=18;audio.limiter.ratio.value=6;audio.limiter.attack.value=.004;audio.limiter.release.value=.18;
  audio.music.connect(audio.master);audio.master.connect(audio.limiter);audio.limiter.connect(context.destination);
  audio.noiseBuffer=context.createBuffer(1,sampleRate*2,sampleRate);
  const noise=audio.noiseBuffer.getChannelData(0);let seed=1977,previous=0;
  for(let i=0;i<noise.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const white=seed/2147483648-1;previous=(previous+.08*white)/1.08;noise[i]=white*.68+previous*2.8;}
  const duration=60/track.bpm/4;
  for(let step=0;step<256;step++)audio._musicStep(step,step*duration+.02,duration);
  return {...wav(await context.startRendering()),seconds};
}

document.getElementById('render').addEventListener('click',async()=>{
  const button=document.getElementById('render'),status=document.getElementById('status'),container=document.getElementById('tracks');button.disabled=true;
  try{
    for(const track of tracks){
      status.textContent=`RENDERING ${track.scene.toUpperCase()}...`;
      const {blob,seconds,peak,gain}=await renderTrack(track),url=URL.createObjectURL(blob);
      const article=document.createElement('article'),heading=document.createElement('h2'),copy=document.createElement('p'),player=document.createElement('audio'),link=document.createElement('a');
      heading.textContent=`${track.scene.toUpperCase()} — ${track.title}`;copy.textContent=track.description;
      player.controls=true;player.src=url;player.setAttribute('aria-label',track.scene+' soundtrack');
      link.textContent=`DOWNLOAD ${track.scene.toUpperCase()} WAV`;link.href=url;link.download=`vae-victis-${track.scene}.wav`;
      article.dataset.peak=String(peak);article.dataset.gain=String(gain);article.dataset.seconds=String(seconds);
      article.append(heading,copy,player,link);container.append(article);
    }
    status.textContent='THREE TRACKS READY. THE SAME SCORE AND SYNTHESIZER AS THE GAME, MASTERED FOR LISTENING.';
  }catch(error){status.textContent=`RENDER FAILED: ${error.message}`;button.disabled=false;}
});
