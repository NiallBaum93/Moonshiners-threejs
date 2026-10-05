import bpy

print("=== FILE", bpy.data.filepath)
for ob in bpy.data.objects:
    info = f"  OBJ {ob.name!r} type={ob.type} loc={tuple(round(v, 3) for v in ob.location)} scale={tuple(round(v, 3) for v in ob.scale)} dims={tuple(round(v, 3) for v in ob.dimensions)}"
    if ob.type == 'MESH':
        me = ob.data
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        info += f" verts={len(me.vertices)} tris={tris} mats={[m.name for m in me.materials if m]} mods={[m.type for m in ob.modifiers]}"
    print(info)
for img in bpy.data.images:
    print(f"  IMG {img.name!r} packed={bool(img.packed_file)} size={tuple(img.size)} path={img.filepath!r}")
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    links = []
    for l in mat.node_tree.links:
        links.append(f"{l.from_node.type}:{l.from_node.name}.{l.from_socket.name} -> {l.to_node.type}.{l.to_socket.name}")
    print(f"  MAT {mat.name!r}")
    for s in links:
        print("     ", s)
