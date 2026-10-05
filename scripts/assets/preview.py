"""Render a quick studio preview of a GLB. Usage: blender -b --factory-startup --python preview.py -- in.glb out.png"""
import bpy, sys, math
from mathutils import Vector

src, out = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

obs = [o for o in bpy.data.objects if o.type == "MESH"]
mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for o in obs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
centre, size = (mn + mx) / 2, max(mx - mn)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("w"); scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.18, 0.18, 0.2, 1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.6

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam)
cam.data.lens = 85
d = size * 4.2
cam.location = centre + Vector((d * 0.7, -d * 0.7, d * 0.45))
cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

for loc, energy, sz in [((1, -1, 1.4), 60, 1.0), ((-1.5, -0.5, 0.6), 18, 1.5), ((0, 1.5, 1.2), 35, 0.6)]:
    L = bpy.data.objects.new("l", bpy.data.lights.new("l", "AREA"))
    L.data.energy = energy * size * size * 40; L.data.size = sz * size
    L.location = centre + Vector(loc) * size * 2.5
    L.rotation_euler = (centre - L.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(L)

scene.view_settings.view_transform = "Standard"
scene.view_settings.exposure = -1.3
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("RENDERED", out)
