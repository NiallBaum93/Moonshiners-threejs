# Place your GLB here

Copy your Blender-exported `.glb` file into this folder and name it:

```
bottle.glb
```

The app loads it from `/models/bottle.glb` (i.e. this folder inside `public/`).

## Liquid mesh detection

`BottleModel.tsx` auto-detects the liquid mesh by checking if its name contains
any of these keywords (case-insensitive):

```
liquid, fluid, fill, content, spirit, moonshine, whiskey, whisky, water, drink
```

If your liquid mesh isn't detected, open the browser console — the component
logs **every mesh name** in the GLB so you can add yours to the `LIQUID_KEYWORDS`
array at the top of `components/BottleModel.tsx`.
