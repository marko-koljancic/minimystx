Web-IFC (IFC.js) Overview and Supported IFC Schemas
Web-IFC (formerly part of the IFC.js project) is an open-source JavaScript/WASM library for working with Building Information Modeling (BIM) data in the IFC format. It enables reading and writing IFC files at native (near C++) speeds directly in web or Node environments
npmjs.com
. This library is a core component of the That Open Company’s toolset (previously IFC.js) aimed at lowering the barrier for developing OpenBIM applications
npmjs.com
. Crucially, Web-IFC can parse IFC files into geometry and data on the fly, making any web browser an IFC viewer/editor. Supported IFC Versions (Schemas): Web-IFC supports multiple IFC schema versions, including IFC2x3, IFC4, and IFC4x3 (the latest infrastructure extension of IFC4)
docs.speckle.systems
. In practice, this means you can load IFC files from older 2x3 projects up through modern IFC4 and IFC4x3 models. The library focuses on the standard STEP text .ifc format (and by extension zipped .ifcZIP after decompression), and it also supports the typical data structures of these schemas. According to Speckle’s documentation (which uses Web-IFC internally), any IFC versions supported by Web-IFC (currently IFC2x3, IFC4, IFC4x3) will work out of the box
docs.speckle.systems
. Note: Very old or very new IFC schema variants outside these (e.g. IFC2x2 or future IFC5) are not officially supported as of now. Additionally, 2D or annotation entities (e.g. IfcAnnotation objects) have limited support – the focus is primarily on 3D building elements and spatial structure
docs.speckle.systems
.
Core Functionality and API – Loading, Querying, and Filtering IFC Data
Loading IFC Models: Web-IFC provides an easy API to load IFC model data. After initializing the WASM module, you use IfcAPI.OpenModel() to parse an IFC from a byte array or string. This returns a modelID handle for that IFC in memory
cdn.jsdelivr.net
. You can have multiple models open simultaneously (each with its own modelID). There are optional loader settings such as placing the model coordinates at the origin or using fast boolean ops during geometry generation (to improve performance on complex boolean geometries). Once loaded, the model’s geometry and data are accessible through the API. For example, you can instruct the library to generate all geometry with LoadAllGeometry() or stream it mesh-by-mesh
cdn.jsdelivr.net
. Geometry generation is performed by the Web-IFC WASM engine, which triangulates IFC constructive geometry (extrusions, Booleans, etc.) into meshes. Querying and Inspecting Model Contents: Web-IFC exposes functions to traverse and query the IFC data hierarchy and attributes. Each IFC entity (e.g. an IfcWall, IfcDoor, etc.) is assigned an Express ID in the model. Key query functions include:
GetLine / GetItem: Retrieve a specific IFC entity by its ID. IfcAPI.GetLine(modelID, expressID) returns the entity as a JavaScript object with all its attributes (optionally flattened to resolve nested references)
cdn.jsdelivr.net
. There is also a higher-level helper getItemProperties(modelID, expressID, recursive) that returns an element’s properties, optionally pulling all nested and inverse relationships
thatopen.github.io
thatopen.github.io
. This is useful for getting a complete property set of an element (e.g. all attributes, pset references, materials, etc.) in one go.
Enumerating Entities by Type: You can fetch all elements of a certain IFC class using GetLineIDsWithType(modelID, type). Here type is an internal numeric code for an IFC entity (Web-IFC provides TypeScript enums or schema constants for IFC classes). This function returns a list (vector) of all Express IDs of that type
cdn.jsdelivr.net
. For example, you can retrieve all walls or all doors in the model by passing the corresponding IFC type code. This is extremely useful for filtering – e.g. a “Filter by Type” node in Minimystx could use this to get all elements of a specified category.
Spatial Structure: The library can provide the spatial hierarchy (Project > Site > Building > Storey > etc.). The getSpatialStructure(modelID) method returns a nested tree of the IfcProject and its decomposition
thatopen.github.io
thatopen.github.io
. Each node in this tree includes references to child elements. This allows you to traverse the project hierarchy or implement nodes that filter elements by their spatial container (for instance, all components in a particular building or storey).
Property Sets and Materials: Beyond raw geometry, Web-IFC fully exposes BIM metadata. Through the IfcAPI.properties interface, you can query an element’s attached property sets and materials. For example, getPropertySets(modelID, elementID) returns all IfcPropertySet definitions linked to a given element (or all psets in the model if no specific element ID is provided)
thatopen.github.io
thatopen.github.io
. Similarly, getMaterialsProperties(modelID, elementID) lists the material assignments (via IfcRelAssociatesMaterial) for an element
thatopen.github.io
thatopen.github.io
. These functions can recurse to gather nested definitions (by setting the recursive flag), ensuring that, for instance, an element’s type properties or composite materials are included. Such capabilities are relevant for Minimystx nodes that might read an element’s parameters or filter by material or property criteria.
Global IDs and GUID Mapping: Each IFC element has a stable GlobalId (a GUID string) in addition to the runtime Express ID. Web-IFC provides CreateIfcGuidToExpressIdMapping(modelID) which builds a bi-directional map so you can look up elements by GUID or get their GUIDs from IDs
cdn.jsdelivr.net
. In a parametric context, this could help track elements across sessions or match elements between models.
Error Handling: If there are parse errors (e.g. due to some IFC misformat), GetAndClearErrors(modelID) can be called to retrieve any error messages
cdn.jsdelivr.net
. In general, the library is robust with standard IFCs, but this can be useful for debugging problematic files.
Using these query functions, you can implement filtering logic in a Minimystx node graph. For example, one node might use GetLineIDsWithType to output all elements of a certain type, then another node could map those IDs to actual property data via GetLine or getItemProperties. Because Web-IFC’s queries run in WASM, they are efficient even for large models (though for very large models, one should be mindful of memory and possibly use the streaming functions or filtering at load time).
Geometry Extraction and Three.js Integration
One of Web-IFC’s core purposes is to convert IFC geometric data into mesh geometry suitable for rendering. Under the hood, it interprets IFC geometry definitions (sweeps, CSG booleans, profiles, etc.) and produces triangular meshes. You can obtain an element’s mesh in two main ways:
Direct geometry access: Using IfcAPI.GetGeometry(modelID, geometryExpressID) returns an IfcGeometry object for a given geometry ID
cdn.jsdelivr.net
. Typically, you first get an element’s representation ID by examining its IFC data (for instance, an IfcProduct has a representation that contains geometry). However, an easier route is provided by higher-level functions: LoadAllGeometry(modelID) forces the load/generation of geometry for the whole model
cdn.jsdelivr.net
, and GetFlatMesh(modelID, expressID) directly returns a mesh data structure (vertices, indices, etc.) for a given element
cdn.jsdelivr.net
. There are also streaming methods (StreamAllMeshes) that iterate through each mesh piece, calling your callback as geometry is generated
cdn.jsdelivr.net
 – useful for progressively loading large models or integrating with asynchronous rendering pipelines.
Three.js compatibility: Web-IFC was designed to work hand-in-hand with Three.js. In fact, the official IFC loader for Three.js (previously web-ifc-three) uses Web-IFC under the hood
github.com
. The output geometry (vertex arrays, index arrays, and face-material assignments) from Web-IFC can be directly fed into Three.js BufferGeometries and Meshes. Each FlatMesh from GetFlatMesh includes an array of geometries and an overall IFC Express ID
cdn.jsdelivr.net
cdn.jsdelivr.net
, so one can create a Three.js Mesh for each IFC element or group of elements. Web-IFC even preserves basic material color information from the IFC (each PlacedGeometry has a color property)
cdn.jsdelivr.net
. In practice, Minimystx’s Three.js rendering can easily consume Web-IFC output: you can construct geometry objects in the scene for each IFC element or merge them as needed. The integration is proven – IFC.js’s viewer component could add meshes to a Three.js scene and even handle selection and hiding of elements. For example, the IFC.js loader created efficient BufferGeometries and allowed operations like highlighting selected elements, toggling visibility, or isolating subsets
github.com
. Minimystx can leverage the same approach, meaning Web-IFC is fully compatible with rendering in Three.js.
Because you mentioned you already have a Three.js scene and renderer set up, the relevant part is obtaining the mesh data from Web-IFC. Typically, after calling OpenModel, one would do something like:
const geom = ifcApi.GetFlatMesh(modelID, elementId);
const verts = ifcApi.GetVertexArray( geom.geometries.get(0).GetVertexData(), 
                                     geom.geometries.get(0).GetVertexDataSize() );
const indices = ifcApi.GetIndexArray( geom.geometries.get(0).GetIndexData(), 
                                      geom.geometries.get(0).GetIndexDataSize() );
// ... then use verts & indices to build a THREE.BufferGeometry
However, the IFC.js project provided convenience abstractions to handle this, and the newer That Open Engine converts IFC to an intermediate Fragments format for efficient handling
docs.thatopen.com
docs.thatopen.com
. In your case (Minimystx), you can either use the raw Web-IFC API as above, or even consider using their components if it fits. But since you have custom integration, directly using the Web-IFC API gives you full control. In summary, Web-IFC can generate all the necessary Three.js-compatible geometry, making it straightforward to visualize IFC models in Minimystx’s real-time node-based environment.
Editing IFC Data – Adding, Removing, and Exporting Models
One powerful aspect of Web-IFC is that it’s not read-only – it also supports creating and editing IFC models (though some features are still maturing). The library can be used to modify an IFC’s contents and write it back out to a file, which is ideal for future Minimystx features like parametric IFC editing or generation. The API includes functions such as CreateModel() to start a new blank IFC model in memory
cdn.jsdelivr.net
, and WriteLine()/WriteRawLineData() to add or modify entities in the model
cdn.jsdelivr.net
. Each “line” corresponds to an IFC entity instance in the EXPRESS schema sense. In practice, adding a new element involves creating all required IFC instances (for the element and its relationships) via WriteLine calls. For example, one could create a new IfcWall entity, then create an IfcRelContainedInSpatialStructure to place it in a storey, set its geometric representation, etc., by writing those lines. Web-IFC’s properties helpers even provide some high-level shortcuts for certain relations – e.g. setPropertySets(modelID, elementID, psetID) will create the IfcRelDefinesByProperties link between an element and an existing property set
thatopen.github.io
thatopen.github.io
. Likewise, setMaterialsProperties will link a material to an element via the appropriate relation
thatopen.github.io
thatopen.github.io
. These indicate the library is gearing up to simplify common editing operations. After performing additions or modifications in memory, you can export the result to a new IFC file using ExportFileAsIFC(modelID), which returns a byte array of the IFC STEP text that you can save
cdn.jsdelivr.net
. This function serializes all the current data (including any changes made via writes) into a valid IFC file. In other words, Web-IFC allows round-trip editing: read an IFC, manipulate it, and write out an updated IFC. This covers your need for future nodes that perform add/remove/export operations in Minimystx. For removing elements, the library doesn’t have a one-call “delete entity” method in the current API (as of v0.0.71). However, removal can be achieved by deleting or disconnecting an entity’s relationships and ensuring it’s not referenced before export. In practice, one could remove an element by: (a) using WriteLine to nullify references to it (for example, remove it from its containing relationship sets), and (b) possibly manipulating the internal model data so that the entity is not serialized. This is more manual, but likely will be wrapped in future helper methods. Given the ability to write raw lines, a deletion could be simulated by writing an override of the line to a dummy "deleted" state or simply not including it when exporting. This area is evolving, and contributions or updates from the community are possible. For now, adding and modifying elements is well-supported (as confirmed by the library docs noting you can “create and edit [IFC files] directly”
docs.thatopen.com
), and exporting is fully functional. Minimystx can plan to use these capabilities to, say, generate new IFC building elements from a parametric design or to remove elements as part of a design option node, then output the resulting IFC model.
Relevance for Minimystx and Node-Based Workflows
In the context of Minimystx’s parametric node flow, Web-IFC’s features map cleanly to various node types and operations:
IFC File Input Node: Using Web-IFC’s loading functions, a node can take a file path or binary, call OpenModel, and output a handle or context that other nodes use. This node would represent reading one or more IFC models into the scene. (Web-IFC can handle multiple models, so you could have multiple such input nodes active, each with its own modelID.)
Filter/Query Nodes: With the querying API, you can create nodes that filter or select subsets of the model. For example, a “Filter by Type” node can use GetLineIDsWithType to get all element IDs of a chosen class (the node’s parameter could be an IFC entity type like "IfcWall"). Another “Query by Property” node might iterate over elements and use getItemProperties to check property values, outputting those that meet criteria. Because Web-IFC provides access to all property sets and relationships, you can implement very rich queries (e.g. find all components with a certain name, or all doors with a fire rating property above X). The spatial structure node can use getSpatialStructure to output the hierarchy; subsequent nodes could pick one branch of that tree (like a particular building storey) and retrieve all child element IDs from it.
Geometry Nodes: If your workflow needs geometric outputs (for analysis or visualization within the parametric environment), a node could call GetFlatMesh or StreamAllMeshes to produce Three.js geometry objects. For instance, a “Get Element Geometry” node might take an element ID and output a mesh or geometry resource that other nodes (or the renderer) can use. Minimystx’s Three.js interface can then display this. Web-IFC ensures that each geometry piece is associated with the originating IFC element’s ID, so interaction nodes (like “On Select Element”) can map a picked Three.js object back to IFC data, if needed, by storing expressIDs in the mesh userData.
Property and Analysis Nodes: A node could utilize getPropertySets or getMaterialsProperties to fetch all the properties of an element or set of elements and then feed that into analytical nodes. For example, a “Report Element Properties” node might output a structured list of properties for any given element, which could then be displayed in the UI or used in a rule-checking script. Since Web-IFC gives raw access to IFC relationships (like IfcRelAssociatesMaterial, IfcRelDefinesByProperties, etc.), you can traverse the graph of IFC data arbitrarily. This is powerful for building custom analyses in a visual programming context.
Future Edit/Write Nodes: Looking forward, Minimystx could have nodes that create new IFC elements or modify existing ones. For example, a parametric wall generation node might use a template IFC wall definition (or build one from scratch via CreateModel + WriteLine) and allow parametric changes to its dimensions, then insert it into an existing model’s spatial structure. A “Remove Element” node could mark an element for deletion (perhaps by removing its references using Web-IFC’s write methods). Finally, an IFC Export node would call ExportFileAsIFC on a modelID (after upstream nodes have made changes) to output a finalized IFC file. All these are made possible by Web-IFC’s editing API. As of now, creating completely new geometry from scratch in IFC (e.g. from arbitrary Three.js meshes) requires constructing the appropriate IFC representations manually – a complex task – but simpler parametric modifications (moving an element’s position, changing a property value, adding a new window by copying an existing one, etc.) are achievable with the provided API.
In summary, Web-IFC covers the full lifecycle of IFC data in a way that aligns with a node-based editor like Minimystx. It supports reading multiple IFC files, navigating their content (types, spatial breakdown, relationships), extracting or visualizing geometry, and even editing and writing IFC data. It is actively maintained (v0.0.71 as of September 2025) and used in production-ready tools, indicating a level of stability and performance you can trust for integration. The compatibility with Three.js is well-established – in fact, Web-IFC was the backbone of IFC.js’s Three.js viewer
github.com
github.com
, so you can confidently use it alongside Minimystx’s Three.js rendering engine. The open-source nature (MPL-2.0 license
github.com
 for core, and MIT for some components) also means you can inspect the internals or even contribute features if needed for your project’s future needs. Sources:
Web-IFC Project Readme (That Open Company) – features and installation
npmjs.com
docs.thatopen.com
Speckle Docs – supported IFC versions via Web-IFC
docs.speckle.systems
docs.speckle.systems
Web-IFC API Reference – key methods for model loading, querying, and editing
cdn.jsdelivr.net
cdn.jsdelivr.net
thatopen.github.io
thatopen.github.io
IFC.js / Web-IFC-Three Documentation – integration with Three.js and viewer capabilities
github.com
github.com
Citations

web-ifc - npm

https://www.npmjs.com/package/web-ifc

IFC and File Imports - Speckle Docs

https://docs.speckle.systems/connectors/direct-uploads/file-uploads

IFC and File Imports - Speckle Docs

https://docs.speckle.systems/connectors/direct-uploads/file-uploads

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts
Properties | That Open Engine | web-ifc

https://thatopen.github.io/engine_web-ifc/docs/classes/Properties.Properties.html
Properties | That Open Engine | web-ifc

https://thatopen.github.io/engine_web-ifc/docs/classes/Properties.Properties.html

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts
Properties | That Open Engine | web-ifc

https://thatopen.github.io/engine_web-ifc/docs/classes/Properties.Properties.html
Properties | That Open Engine | web-ifc

https://thatopen.github.io/engine_web-ifc/docs/classes/Properties.Properties.html
Properties | That Open Engine | web-ifc

https://thatopen.github.io/engine_web-ifc/docs/classes/Properties.Properties.html
Properties | That Open Engine | web-ifc

https://thatopen.github.io/engine_web-ifc/docs/classes/Properties.Properties.html
Properties | That Open Engine | web-ifc

https://thatopen.github.io/engine_web-ifc/docs/classes/Properties.Properties.html
Properties | That Open Engine | web-ifc

https://thatopen.github.io/engine_web-ifc/docs/classes/Properties.Properties.html

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts

GitHub - ThatOpen/web-ifc-three: The official IFC Loader for Three.js.

https://github.com/ThatOpen/web-ifc-three

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts

GitHub - ThatOpen/web-ifc-three: The official IFC Loader for Three.js.

https://github.com/ThatOpen/web-ifc-three

IfcLoader | That Open docs

https://docs.thatopen.com/Tutorials/Components/Core/IfcLoader

IfcLoader | That Open docs

https://docs.thatopen.com/Tutorials/Components/Core/IfcLoader

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts
Properties | That Open Engine | web-ifc

https://thatopen.github.io/engine_web-ifc/docs/classes/Properties.Properties.html
Properties | That Open Engine | web-ifc

https://thatopen.github.io/engine_web-ifc/docs/classes/Properties.Properties.html
Properties | That Open Engine | web-ifc

https://thatopen.github.io/engine_web-ifc/docs/classes/Properties.Properties.html
Properties | That Open Engine | web-ifc

https://thatopen.github.io/engine_web-ifc/docs/classes/Properties.Properties.html

IfcLoader | That Open docs

https://docs.thatopen.com/Tutorials/Components/Core/IfcLoader

GitHub - ThatOpen/web-ifc-three: The official IFC Loader for Three.js.

https://github.com/ThatOpen/web-ifc-three

GitHub - ThatOpen/engine_web-ifc: Reading and writing IFC files with Javascript, at native speeds.

https://github.com/ThatOpen/engine_web-ifc

cdn.jsdelivr.net

https://cdn.jsdelivr.net/npm/web-ifc@0.0.32/web-ifc-api.d.ts
Properties | That Open Engine | web-ifc

https://thatopen.github.io/engine_web-ifc/docs/classes/Properties.Properties.html
All Sources

npmjs

docs.speckle

cdn.jsdelivr
thatopen.github

github

docs.thatopen