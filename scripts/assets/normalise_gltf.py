"""Blender headless: import a Sketchfab glTF, normalise it, decimate and export GLB.

Usage: blender -b --factory-startup --python normalise_gltf.py -- <in.gltf> <out.glb> <target_tris> <longest_dim_m>
Result: one mesh, transforms applied, real-world size in metres, origin at the bottom centre.
"""
import bpy, sys
from mathutils import Vector

src, out, target_tris, size_m = sys.argv[sys.argv.index("--") + 1:]
target_tris, size_m = int(target_tris), float(size_m)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
for o in bpy.data.objects:
    o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active

# Bake every parent transform (Sketchfab wraps models in rotated/scaled empties).
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in bpy.data.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o)

tris_before = sum(len(p.vertices) - 2 for p in ob.data.polygons)
if tris_before > target_tris:
    mod = ob.modifiers.new("decimate", "DECIMATE")
    mod.ratio = target_tris / tris_before
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
tris_after = sum(len(p.vertices) - 2 for p in ob.data.polygons)

# Scale so the longest side is size_m metres, then sit it on the ground at the origin.
s = size_m / max(ob.dimensions)
ob.scale = (s, s, s)
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
ob.location = (0, 0, ob.dimensions.z / 2)
bpy.ops.object.transform_apply(location=True)

bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=False, export_yup=True)
print("EXPORTED", out, f"tris {tris_before} -> {tris_after}", "dims", tuple(round(d, 4) for d in ob.dimensions))
