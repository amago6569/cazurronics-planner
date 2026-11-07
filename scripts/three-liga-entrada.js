// Las piezas de three.js que usa la Liga Cazurra (public/liga). Solo estas, para que el archivo pese lo menos posible.
// Para regenerar public/liga/vendor/three-liga.js después de actualizar three: npm run liga:three
export {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, Object3D,
  SphereGeometry, CylinderGeometry, BoxGeometry, TorusGeometry, PlaneGeometry, CircleGeometry,
  MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial,
  DirectionalLight, HemisphereLight,
  CanvasTexture, Color, Vector3, Matrix4, Quaternion, Euler,
  PMREMGenerator, SRGBColorSpace, ACESFilmicToneMapping, NeutralToneMapping, PCFShadowMap,
  DoubleSide, EquirectangularReflectionMapping, RepeatWrapping, AdditiveBlending,
} from "three";
