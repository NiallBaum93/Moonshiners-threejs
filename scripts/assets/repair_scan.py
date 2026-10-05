"""Close the open side of a scanned strawberry and re-export it lit, with normals.

The scan never saw one side of the berry (it was resting on something), so that
side is an open hole. This builds a curved patch over it that follows the
berry's roundness, and skins it with one clean, seeded piece of the scan's own
texture, laid over it flat like a sticker. (Scan textures are patchworks of
small fragments; this one has a large clean piece in its top-left corner.)

Usage: blender -b --factory-startup --python repair_scan.py -- <in.gltf> <out.glb> <target_tris> <longest_dim_m>
"""
import bpy, bmesh, sys
from mathutils import Vector

src, out, target_tris, size_m = sys.argv[sys.argv.index("--") + 1:]
target_tris, size_m = int(target_tris), float(size_m)
RINGS = 12
# The clean piece of skin in the texture: its middle and radius, in Blender's
# UV space (origin bottom left). Specific to strawberry_scan's texture.
SKIN_UV = Vector((0.156, 0.79))
SKIN_RADIUS = 0.11

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
for o in bpy.data.objects:
    o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in bpy.data.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o)

bm = bmesh.new()
bm.from_mesh(ob.data)
size = max(ob.dimensions)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=size * 1e-6)
bmesh.ops.triangulate(bm, faces=bm.faces)
bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
uv = bm.loops.layers.uv.active

# The boundary loops, each in order around the hole.
def loops_of_boundary():
    edges = {e for e in bm.edges if e.is_boundary}
    loops = []
    while edges:
        e = edges.pop()
        a, b = e.verts
        loop = [a, b]
        while True:
            nxt = next((x for x in loop[-1].link_edges if x in edges), None)
            if nxt is None:
                break
            edges.discard(nxt)
            v = nxt.other_vert(loop[-1])
            if v is loop[0]:
                break
            loop.append(v)
        loops.append(loop)
    return loops

loops = sorted(loops_of_boundary(), key=len, reverse=True)
hole = loops[0]
print("HOLE", len(hole), "verts; other loops", [len(l) for l in loops[1:]])

# The berry's middle, and which way the hole faces (outwards).
centre = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
rim = sum((v.co for v in hole), Vector()) / len(hole)
normal = Vector()
for i, v in enumerate(hole):  # Newell's method
    a, b = v.co, hole[(i + 1) % len(hole)].co
    normal += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
normal.normalize()
if normal.dot(rim - centre) < 0:
    normal = -normal

# The patch: rings from the hole's edge in towards its middle, bulging out
# to the same distance from the berry's middle as the edge, so it's round.
reach = sum(((v.co - centre).length for v in hole)) / len(hole)
rings = [hole]
for k in range(1, RINGS):
    t = k / RINGS
    ring = []
    for v in hole:
        flat = v.co.lerp(rim, t)
        r = (v.co - centre).length * (1 - t) + reach * t
        ring.append(bm.verts.new(centre + (flat - centre).normalized() * r))
    rings.append(ring)
tip = bm.verts.new(centre + (rim - centre).normalized() * reach)

new_faces = []
n = len(hole)
for k in range(RINGS - 1):
    for i in range(n):
        j = (i + 1) % n
        for tri in ((rings[k][i], rings[k][j], rings[k + 1][j]), (rings[k][i], rings[k + 1][j], rings[k + 1][i])):
            try:
                new_faces.append(bm.faces.new(tri))
            except ValueError:
                pass
for i in range(n):
    try:
        new_faces.append(bm.faces.new((rings[-1][i], rings[-1][(i + 1) % n], tip)))
    except ValueError:
        pass
# Lay the clean skin over the patch, flat, as seen from straight on.
across = normal.orthogonal().normalized()
up = normal.cross(across)
spread = max(((v.co - rim) - (v.co - rim).dot(normal) * normal).length for v in hole)
for f in new_faces:
    for l in f.loops:
        d = l.vert.co - rim
        l[uv].uv = SKIN_UV + Vector((d.dot(across), d.dot(up))) / spread * SKIN_RADIUS

# Any other little gaps: just fill them.
bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=8)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
for f in bm.faces:
    f.smooth = True
print("PATCH faces", len(new_faces), "boundary edges left", sum(1 for e in bm.edges if e.is_boundary))
bm.to_mesh(ob.data)
bm.free()

# Fewer triangles for the web, then make sure every face points outwards again.
tris_before = len(ob.data.polygons)
if tris_before > target_tris:
    mod = ob.modifiers.new("decimate", "DECIMATE")
    mod.ratio = target_tris / tris_before
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
bm = bmesh.new(); bm.from_mesh(ob.data)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(ob.data); bm.free()
for p in ob.data.polygons:
    p.use_smooth = True
print("TRIS", tris_before, "->", len(ob.data.polygons))

# Real size, sitting on the ground at the origin.
s = size_m / max(ob.dimensions)
ob.scale = (s, s, s)
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
ob.location = (0, 0, ob.dimensions.z / 2)
bpy.ops.object.transform_apply(location=True)

# A lit material (the scan came unlit, so it ignored the studio's lights).
image = next(n.image for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type == "TEX_IMAGE")
mat = bpy.data.materials.new("strawberry")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
tex = mat.node_tree.nodes.new("ShaderNodeTexImage"); tex.image = image
mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.6
bsdf.inputs["Metallic"].default_value = 0.0
ob.data.materials.clear(); ob.data.materials.append(mat)

bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=False, export_yup=True, export_normals=True)
print("EXPORTED", out, "dims", tuple(round(d, 4) for d in ob.dimensions))
