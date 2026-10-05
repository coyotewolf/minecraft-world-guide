# Minecraft world artwork

Generated with the built-in imagegen tool on 2026-10-05. Decorative artwork, not an in-game screenshot. Existing recipe icons and collection models were not regenerated.

References inspected before generation:

- Saints Dragons Atroxiia game-model preview: `assets/art/93540926f9d6c6228775d04d.png`
- Create water wheel: `assets/art/8bf2dd189d7e10349ab4ed88.png`
- MineColonies town hall: `assets/art/fd7cfa2f66cd61eb14d24221.png`

## Landscape prompt — assets/world-panorama.png

Create a wide 1536x1024 Minecraft Java vanilla 1.20.1-style website world panorama. This is new decorative website artwork, not an item icon or game screenshot. Reference 1 is the installed Saints Dragons Atroxiia in-game model: retain its pale segmented square body, long tail, angular limbs, gold horn/spine accents; show one such dragon on a stepped rocky hill in the upper right, clearly block-model rather than smooth fantasy dragon. Reference 2 is Create's wooden water wheel with gray mechanical axle: reproduce its recognizable block geometry at a riverside cobblestone and oak workshop on the left with visible cogwheels, shafts and a short rail track. Reference 3 is MineColonies town hall building block: use it as the visual cue for a substantial oak-plank/cobblestone colony town hall, practical timber buildings, small wheat field and stone path in middle-left. All environment should look like unshaded vanilla Minecraft: 16x16 visibly pixelated oak, grass, cobblestone, leaf and dirt textures on discrete cubes, square sun and rectangular flat white clouds, chunky stepped terrain, bright natural blue sky, moderate vanilla ambient light, no shaders, no bloom, no cinematic fog, no painterly surface, no glossy lighting, no realistic grass. Broad calm river in lower middle, ordinary green plains and oak woods. Layout for responsive webpage: central 40 percent is relatively calm distant sky/grass/river so a login panel can overlay it; distribute colony on left and dragon hill on right but readable from central portrait crop as well. Vanilla restrained colors, screenshot-like cubic camera perspective, no letters or words, no HUD, no border, no logos. Fill entire landscape canvas.

## Portrait prompt — assets/world-portrait.png

References: generated landscape above, original Atroxiia preview, and original water wheel.

Recompose the supplied Minecraft-style panorama into a PORTRAIT 1024x1536 mobile login background. Match the same world, vanilla pixel block textures and restrained daytime colors. Do NOT simply crop. Place the pale gold-spined long angular Atroxiia dragon from reference 2 on a stepped rocky ridge clearly visible across the UPPER 25 percent, against square clouds and blue sky. Place oak and cobblestone MineColonies town hall and practical village on lower left quarter, and Create wooden waterwheel/gray shafts/cogwheels from reference 3 by a stream in LOWER RIGHT quarter. The CENTER between 28 and 72 percent height must remain calm river and distant plain so an opaque login panel covers it without hiding the distinctive dragon above and colony/factory below. World is discrete Minecraft cubes with vanilla 16x16 oak/stone/grass/water textures, no smooth fantasy art, no photorealism, no shader bloom, no cinematic fog, no illustrated gradients. Flat Minecraft sunlight, square sun, cuboid model dragon as reference, no letters, HUD, logo or frame. This is decorative artwork for a game guide website.

## Entrance animation

CSS uses the landscape on desktop and portrait on mobile. The scenery drifts slowly, then the title, town hall and item sprites appear. A rotating game cog and stepped vanilla XP-style loading bar run for the existing 4.6-second opening. The scene zooms gently as the title fades and the full-screen login inventory panel opens. Skip, reduced-motion preference, signed-in routing and key setup remain supported.

Vanilla dirt menu background, stone and oak plank textures in `assets/vanilla` were extracted from the installed Minecraft 1.20.1 client resource archive.
