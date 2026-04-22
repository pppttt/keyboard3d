import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Keyboard } from "./Keyboard";
import { KeyboardCase } from "./keyboardCase";
import {
  buildReadout,
  createDefaultSkinTexture,
  profiles,
  type SceneConfig,
} from "./keycap";

const CAMERA_HEIGHT_MM = 400;
const LIGHT_HEIGHT_MM = 200;

export class KeycapScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
  readonly controls: OrbitControls;
  readonly keyGroup = new THREE.Group();
  readonly caseGroup = new THREE.Group();
  title = "";
  subtitle = "";
  private animationId = 0;
  private resizeObserver: ResizeObserver;
  private skinTexture: THREE.Texture = createDefaultSkinTexture();
  private projectionTexture: THREE.CanvasTexture | null = null;
  private projectionVersion = -1;
  private readout = "";
  private layoutFrame: { width: number; height: number } | null = null;
  private layoutFrameKey = "";
  private topViewDistance = LIGHT_HEIGHT_MM;
  private spotLight = new THREE.SpotLight(0xffffff, 9.5, 0, Math.PI / 4, 0.45, 0.9);
  private spotTarget = new THREE.Object3D();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.background = new THREE.Color(0x20252a);
    this.scene.fog = new THREE.Fog(0x20252a, 520, 980);
    this.setTopViewCamera();
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 0);
    this.controls.maxDistance = 240;
    this.setupScene();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.animate();
  }

  update(config: SceneConfig) {
    if (config.projectionCanvas) {
      if (!this.projectionTexture || this.projectionTexture.image !== config.projectionCanvas || this.projectionVersion !== config.projectionVersion) {
        this.projectionTexture?.dispose();
        this.projectionTexture = new THREE.CanvasTexture(config.projectionCanvas);
        this.projectionTexture.anisotropy = 8;
        this.projectionTexture.colorSpace = THREE.SRGBColorSpace;
        this.projectionTexture.generateMipmaps = false;
        this.projectionTexture.minFilter = THREE.LinearFilter;
        this.projectionTexture.magFilter = THREE.LinearFilter;
        this.projectionTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.projectionTexture.wrapT = THREE.ClampToEdgeWrapping;
      }
      this.projectionVersion = config.projectionVersion;
      this.projectionTexture.needsUpdate = true;
      this.skinTexture = this.projectionTexture;
    } else if (config.skinImage) {
      this.skinTexture = new THREE.Texture(config.skinImage);
      this.skinTexture.anisotropy = 8;
      this.skinTexture.needsUpdate = true;
    }
    const built = Keyboard.build(config, this.skinTexture);
    this.topViewDistance = config.spotLightDistance || LIGHT_HEIGHT_MM;
    this.keyGroup.clear();
    this.keyGroup.add(built.group);
    this.updateCase(built.bottomW, built.bottomH, config);
    const profile = profiles[config.profileId] ?? profiles.cherry;
    this.title = config.layoutKeys.length ? `${profile.label} layout` : `${profile.label} ${built.rowId}`;
    this.subtitle = `${built.cfg.totalDepth} mm tall, ${built.cfg.topTilt} deg tilt, ${profile.common.dishType} dish`;
    this.readout = buildReadout(config);
    if (config.layoutKeys.length) {
      const frameKey = `${built.bottomW.toFixed(2)}:${built.bottomH.toFixed(2)}`;
      this.layoutFrame = { width: built.bottomW, height: built.bottomH };
      if (frameKey !== this.layoutFrameKey) {
        this.layoutFrameKey = frameKey;
      }
      this.frameLayout(built.bottomW, built.bottomH);
    } else {
      this.layoutFrame = null;
      this.layoutFrameKey = "";
      this.setTopViewCamera();
    }
    this.updateSpotLight();
  }

  getReadout() {
    return this.readout;
  }

  resetCamera() {
    if (this.layoutFrame) {
      this.frameLayout(this.layoutFrame.width, this.layoutFrame.height);
      return;
    }
    this.setTopViewCamera();
  }

  private frameLayout(width: number, height: number) {
    this.setTopViewCamera();
    const size = Math.max(width, height, CAMERA_HEIGHT_MM);
    this.camera.far = Math.max(2000, size * 5);
    this.camera.updateProjectionMatrix();
    this.controls.maxDistance = Math.max(240, size * 4);
  }

  dispose() {
    cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    this.renderer.dispose();
  }

  private setupScene() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 3.2));
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x85919a, 4.8));
    const keyLight = new THREE.DirectionalLight(0xfff0cf, 2.2);
    keyLight.position.set(80, 70, 180);
    keyLight.castShadow = true;
    this.scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.4);
    fillLight.position.set(-90, -80, 120);
    this.scene.add(fillLight);
    const diagonalLight = new THREE.DirectionalLight(0xffffff, 1.1);
    diagonalLight.position.set(100, -80, 110);
    this.scene.add(diagonalLight);
    const rimLight = new THREE.DirectionalLight(0x9fd7ff, 0.9);
    rimLight.position.set(-120, 90, 140);
    this.scene.add(rimLight);
    this.spotTarget.position.set(0, 0, 0);
    this.scene.add(this.spotTarget);
    this.spotLight.position.set(0, 0, LIGHT_HEIGHT_MM);
    this.spotLight.target = this.spotTarget;
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.set(1024, 1024);
    this.spotLight.shadow.camera.near = 5;
    this.spotLight.shadow.camera.far = 420;
    this.scene.add(this.spotLight);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 520),
      new THREE.MeshStandardMaterial({ color: 0x2c3237, roughness: 0.86, metalness: 0 }),
    );
    floor.position.z = -0.02;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.scene.add(this.caseGroup);
    this.scene.add(this.keyGroup);
  }

  private updateCase(width: number, height: number, config: SceneConfig) {
    this.caseGroup.clear();
    this.caseGroup.add(KeyboardCase.build(width, height, config));
  }

  private setTopViewCamera() {
    this.camera.position.set(0, 0, CAMERA_HEIGHT_MM);
    this.camera.up.set(0, 1, 0);
    this.controls?.target.set(0, 0, 0);
    this.controls?.update();
  }

  private updateSpotLight() {
    this.spotLight.position.set(0, 0, this.topViewDistance || LIGHT_HEIGHT_MM);
    const distance = this.spotLight.position.distanceTo(this.spotTarget.position);
    this.spotLight.distance = Math.max(distance * 2.4, 260);
    this.spotLight.shadow.camera.far = Math.max(distance * 2.4, 260);
    this.spotLight.shadow.camera.updateProjectionMatrix();
  }

  private resize() {
    const rect = (this.canvas.parentElement ?? this.canvas).getBoundingClientRect();
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    if (this.layoutFrame) {
      this.frameLayout(this.layoutFrame.width, this.layoutFrame.height);
    } else {
      this.updateSpotLight();
    }
  }

  private animate = () => {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.animate);
  };
}
