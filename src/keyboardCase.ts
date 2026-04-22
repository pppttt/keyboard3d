import * as THREE from "three";
import type { CaseMaterial, SceneConfig } from "./keycap";

const materialSettings: Record<CaseMaterial, { roughness: number; metalness: number; height: number }> = {
  aluminum: { roughness: 0.32, metalness: 0.72, height: 8 },
  polycarbonate: { roughness: 0.18, metalness: 0.02, height: 7 },
  wood: { roughness: 0.64, metalness: 0.01, height: 8 },
  acrylic: { roughness: 0.2, metalness: 0.03, height: 7 },
};

export class KeyboardCase {
  static build(width: number, height: number, config: SceneConfig) {
    const group = new THREE.Group();
    const settings = materialSettings[config.caseConfig.material] ?? materialSettings.aluminum;

    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(width + 28, height + 28, settings.height),
      new THREE.MeshStandardMaterial({
        color: config.caseConfig.color,
        roughness: settings.roughness,
        metalness: settings.metalness,
      }),
    );
    plate.position.z = -settings.height / 2 - 1.2;
    plate.receiveShadow = true;
    plate.castShadow = true;
    group.add(plate);

    const inset = new THREE.Mesh(
      new THREE.BoxGeometry(width + 10, height + 10, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x101316, roughness: 0.8, metalness: 0.02 }),
    );
    inset.position.z = 0.05;
    inset.receiveShadow = true;
    group.add(inset);

    return group;
  }
}
