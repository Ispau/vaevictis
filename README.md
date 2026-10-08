# VAE VICTIS

A pixel-art arcade action platformer starring **Brutus**, a barbarian who takes revenge after monsters burn his village. Battle through ruins, a cemetery, a swamp, a dark forest and an abandoned village, facing undead hordes, flying witches and powerful bosses.

The game combines sword combos, platforming, shield defense, dodge moves and three spectacular magic attacks. Its visual direction draws inspiration from the energetic arcade action of Metal Slug and Final Fight. Opening and ending cinematics tell Brutus's story, followed by scrolling arcade credits.

## Play

Open the published GitHub Pages link in a current desktop browser. Press **Start Game** for a new adventure or **Continue** to resume from a saved checkpoint. Cinematics can be skipped. Click or press a key to allow the browser to start audio.

**Designed to be played on a monitor for the best experience**, preferably in landscape orientation with sound enabled. Fullscreen is available in Options. A keyboard or a compatible gamepad/joystick is recommended.

## Keyboard controls

| Key | Action |
| --- | --- |
| A / D or Left / Right | Move |
| W / S or Up / Down | Aim an attack upward or downward |
| Space | Jump; press again in the air for a double jump |
| J | Sword attack and combo chain |
| K | Heavy sword attack |
| Up + J / Down + J | Directional sword attack |
| Hold I | Raise the shield and guard against frontal attacks |
| L or Shift | Dodge |
| Q | Rage special when the rage meter is full |
| Z | Golden Fist magic |
| X | Storm magic |
| C | Legion magic |
| Escape | Pause / resume; close an open panel |
| M | Mute / unmute all audio |

## Gamepad and joystick controls

Controllers are supported through the browser's Gamepad API. Connect the controller and press one of its buttons to activate it. The following layout uses Xbox-style names and the browser's standard mapping:

| Control | Action |
| --- | --- |
| Left stick / D-pad | Move and aim attacks |
| A | Jump / double jump |
| X | Sword attack |
| Y | Heavy attack |
| B | Dodge |
| Hold LB or LT | Shield guard |
| RB | Rage special |
| Hold RT + X | Golden Fist |
| Hold RT + Y | Storm |
| Hold RT + A | Legion |
| Start | Pause / resume |

USB arcade joysticks that expose a compatible gamepad mapping can also be used. Button names and layouts vary by controller; custom or nonstandard mappings may require a keyboard. Menu navigation and cinematic skipping remain available with the keyboard or mouse.

## Combat and rewards

- Chain sword strikes and mix in heavy attacks while moving, jumping and dodging.
- The second enemy kill drops a shield. Pick it up to unlock permanent shield defense. Guarding protects Brutus from attacks coming from the direction he faces.
- Green potions restore health. Red potions are poisonous and remove health.
- Destroy barrels to release collectible gems. Walk over a gem to earn **250 points** and **10 mana for each of the three spells**.
- Defeating enemies builds mana. Each spell needs its own full meter.
- **Golden Fist:** a massive celestial fist strikes enemies in view.
- **Storm:** lightning hits enemies in view; bosses lose 20% of their maximum health.
- **Legion:** magical duplicates of Brutus attack the enemy horde.
- Checkpoints preserve progress, shield ownership and mana. Continue returns to the last saved checkpoint.

## Options and saved preferences

The **CRT filter and Classic CRT are enabled by default**. Classic CRT adds subtle curved-glass distortion and a smooth black rounded screen edge. Turn off Classic CRT to retain the normal scanline filter; turn off CRT Filter to remove both effects.

Sound, music, CRT Filter, Classic CRT and Reduced Motion preferences are stored in the browser's **localStorage** and restored on later visits. Progress and the best score are also stored locally. Storage belongs to the same browser profile and site origin, and does not synchronize between devices. Clearing site data removes these settings and saves. If browser storage is unavailable, the game still runs but cannot retain preferences or progress.

Music starts enabled. It keeps the same tempo and arrangement during normal fights and boss encounters; boss sound effects provide their own cues. Separate original themes accompany the introduction, ending and credits.

## Creative and technical credits

- **Ideas, script and character design:** Halfjourney Lab. URL:https://medium.com/@halfjourney
- **Pixel-art production:** PixelLab.
- **Music:** original compositions synthesized with the **Web Audio API**, using programmed notes, chords, oscillators, filters, envelopes and percussion.
- **Programming orchestration:** the **GPT6.1 model**, with human supervision.

The game runs in the browser using JavaScript, HTML Canvas and CSS. Pixel-art assets are included as local files. Players do not need a PixelLab account, an API key or an external generation service.

## Publish on GitHub Pages

This folder is a standalone static website. It contains the public game files and no private API credentials or generation tools.

1. Create a GitHub repository for the game.
2. Upload the **contents of this folder** to the repository root: `index.html`, `styles.css`, `src/`, `assets/`, `README.md`, `.nojekyll` and `.gitignore`. Keep the directory structure intact.
3. Open **Settings → Pages** in the repository.
4. Select **Deploy from a branch**, choose the branch containing the files, and select **/(root)**.
5. Save and wait for deployment. Share the Pages URL shown by GitHub.

Do not place another `vaevictis` folder around the files when publishing from the repository root. Assets use relative paths so the game can run at a project URL such as `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

No Node server or build step is required for hosting. For local testing, serve this folder over HTTP with a static web server rather than opening `index.html` directly, because browsers restrict module and JSON loading from `file://` URLs.

**Never upload `API.txt`, `.env` files, credentials, generation-job data or the private development workspace.** Publish only this prepared folder.
