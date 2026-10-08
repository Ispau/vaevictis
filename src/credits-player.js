import { pixelText } from './pixel-hud.js';
import { bitmapLines } from './pixel-interface.js';

const SECTIONS = [
  ['DESIGNER', 'TOM FORD', 'AN ORC KILLED HIM WHILE HE WAS DESIGNING THE GAME.'],
  ['MUSIC CREATOR', 'SAMANTHA BURKE', 'SHE MADE THE MUSIC WITH A SYNTHESIZER. SHE ONLY HAS TWO FINGERS.'],
  ['WRITER', 'ISAAC CLAUDIO', 'ISAAC WROTE THE SCRIPT. GPTAUDIUS CHIPPED THE CODE INTO A STONE WITH A PICKAXE.'],
  ['PROGRAMMERS', '', 'THEY WENT EXTINCT WITH THE DINOSAURS.'],
  ['SPECIAL THANKS', '', "TO BRUTUS'S MOTHER, WHO HAD TO SEW HIS LOINCLOTH FIVE TIMES WHILE HE TRAINED.", "AND TO BRUTUS'S BROTHER, WHO ALMOST SUFFOCATED INSIDE THE FLYING WITCH COSTUME."],
];
export function creditsLines() {
  const lines = []; let y = 0;
  const add = (text, scale, color) => { lines.push({text,scale,color,y}); y += scale === 2 ? 24 : 13; };
  add('VAE VICTIS', 2, '#F1D078'); y += 22;
  for (const [role,name,...paragraphs] of SECTIONS) {
    add(role, 2, '#F1D078');
    if (name) add(name, 1, '#74D4DB');
    y += 6;
    for (const paragraph of paragraphs) { for (const line of bitmapLines(paragraph, 66)) add(line,1,'#F3E7C9'); y += 10; }
    y += 26;
  }
  add('POWERED BY',2,'#F1D078');
  add('TRANSFORMATOR PRAE-EXERCITATUS GENERATIVUS (GPT)',1,'#74D4DB');
  return lines;
}
export function creditsPosition(seconds, duration = 35) {
  const lines = creditsLines(), height = lines.at(-1).y + 14;
  const distance = height + 310;
  return { offset: 294 - Math.min(1,Math.max(0,seconds / duration)) * distance, height };
}

export class CreditsPlayer {
  constructor({panel,canvas,skipButton,onFinish = () => {},announce = () => {}}) {
    Object.assign(this,{panel,canvas,skipButton,onFinish,announce});
    this.ctx = canvas.getContext('2d'); this.active = false; this.lines = creditsLines(); this.duration = 35;
    skipButton.addEventListener('click',() => this.skip());
  }
  start() {
    this.elapsed = 0; this.skipElapsed = null; this.active = true; this.panel.hidden = false;
    this.announce('Vae Victis credits. Skip Credits is available.');
    this.skipButton.focus({preventScroll:true}); this.draw();
  }
  skip() { if (this.active && this.skipElapsed === null) this.skipElapsed = 0; }
  finish() { if (!this.active) return; this.active = false; this.panel.hidden = true; this.onFinish(); }
  update(dt) {
    if (!this.active) return;
    this.elapsed += Math.max(0,dt);
    if (this.skipElapsed !== null) this.skipElapsed += Math.max(0,dt);
    if (this.elapsed >= this.duration + 1 || (this.skipElapsed !== null && this.skipElapsed >= .35)) { this.finish(); return; }
    this.draw();
  }
  draw() {
    const g = this.ctx; g.setTransform(1,0,0,1,0,0); g.imageSmoothingEnabled = false;
    g.fillStyle = '#050810'; g.fillRect(0,0,512,288);
    const position = creditsPosition(this.elapsed,this.duration);
    // Enter from the bottom and rise in reading order; the closing credit comes last.
    for (const line of this.lines) {
      const y = Math.round(position.offset + line.y);
      if (y < -20 || y > 288) continue;
      pixelText(g,line.text,Math.round((512-line.text.length*6*line.scale)/2),y,line.color,line.scale);
    }
    const opacity = Math.max(0,1-this.elapsed/.7,(this.elapsed-this.duration)/1,this.skipElapsed === null ? 0 : this.skipElapsed/.35);
    g.fillStyle = `rgba(0,0,0,${Math.min(1,opacity)})`; g.fillRect(0,0,512,288);
  }
}
