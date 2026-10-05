"""Blender headless: rebuild a clean glTF-friendly material on the pumpkin and export GLB.

Usage: blender -b pumpkin.blend --python export_pumpkin.py -- <tex_dir> <prefix> <out.glb>
  tex_dir must contain <prefix>_basecolor-2K.png, _roughness-2K.png,
  _normal-gl-2K.png (green already flipped to OpenGL), _ambientocclusion-2K.png
"""
import bpy, sys, os

tex_dir, prefix, out = sys.argv[sys.argv.index("--") + 1:]

def img(name, non_color):
    im = bpy.data.images.load(os.path.join(tex_dir, f"{prefix}_{name}-2K.png"))
    if non_color:
        im.colorspace_settings.name = "Non-Color"
    return im

mesh_obs = [o for o in bpy.data.objects if o.type == "MESH"]
assert len(mesh_obs) == 1, mesh_obs
ob = mesh_obs[0]

mat = bpy.data.materials.new(prefix)
mat.use_nodes = True
nt = mat.node_tree
nt.nodes.clear()
out_node = nt.nodes.new("ShaderNodeOutputMaterial")
bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
nt.links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])

base = nt.nodes.new("ShaderNodeTexImage"); base.image = img("basecolor", False)
nt.links.new(base.outputs["Color"], bsdf.inputs["Base Color"])

rough = nt.nodes.new("ShaderNodeTexImage"); rough.image = img("roughness", True)
nt.links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])

nrm = nt.nodes.new("ShaderNodeTexImage"); nrm.image = img("normal-gl", True)
nmap = nt.nodes.new("ShaderNodeNormalMap")
nt.links.new(nrm.outputs["Color"], nmap.inputs["Color"])
nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

# Ambient occlusion: the glTF exporter reads it from a node group named "glTF Material Output".
grp = bpy.data.node_groups.get("glTF Material Output") or bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
if "Occlusion" not in [s.name for s in grp.interface.items_tree]:
    grp.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
gnode = nt.nodes.new("ShaderNodeGroup"); gnode.node_tree = grp
ao = nt.nodes.new("ShaderNodeTexImage"); ao.image = img("ambientocclusion", True)
nt.links.new(ao.outputs["Color"], gnode.inputs["Occlusion"])

bsdf.inputs["Metallic"].default_value = 0.0
ob.data.materials.clear()
ob.data.materials.append(mat)

# Centre the pumpkin on its base so it sits on the ground at the origin.
bpy.context.view_layer.objects.active = ob
ob.select_set(True)
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
ob.location = (0, 0, ob.dimensions.z / 2)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    use_selection=True,
    export_image_format="AUTO",
    export_tangents=False,
    export_yup=True,
)
print("EXPORTED", out, ob.name, tuple(round(d, 3) for d in ob.dimensions))
