import React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";

/**
 * Depth of field, rendered as an explicit second pass.
 *
 * Why not @react-three/postprocessing: it is not a dependency here, and a new
 * dependency is new determinism risk for one effect. What is needed is small:
 * render the scene into a render target that also carries depth, then draw one
 * full-screen quad that blurs by circle-of-confusion.
 *
 * Why the pass has to be hand-written rather than EffectComposer+BokehPass:
 * this film stacks a transparent 3D plate over a 2D layer. BokehPass (and most
 * stock passes) writes alpha = 1, which would turn the plate into an opaque black
 * rectangle. This pass blurs in premultiplied space and restores straight alpha,
 * so the paper background keeps showing through, including at soft silhouettes.
 *
 * Colour pipeline: three skips tone mapping when a material renders into a render
 * target (that is what OutputPass exists for in the stock composer), so the target
 * holds linear HDR and this pass has to finish the picture itself: the exact
 * three ACESFilmic operator, then sRGB. Verified by matching the no-blur frame
 * against the direct-to-canvas frame.
 *
 * Determinism: every tap is a fixed function of (uv, depth, uniforms) — no time,
 * no random, no accumulation between frames.
 */
export type DofSettings = {
  /**
   * 对焦距离（相机空间 z，单位≈世界单位）。
   * 省略时每帧按"相机到 subject 的距离"自动算 —— 运镜一动焦点就跟着动，
   * 不会出现推轨推过去主体虚掉的穿帮。
   */
  focus?: number;
  /** 自动对焦的落点（世界坐标）。省略则不跟踪，焦点固定在对焦距离上。 */
  subject?: [number, number, number];
  /**
   * 移焦（rack focus）：在 [start, end] 帧之间把焦点从 subject 挪到 to。
   * 这是叙事动作，不是渲染参数 —— 所以由场次给帧号，渲染器只负责插值。
   */
  rack?: { to: [number, number, number]; start: number; end: number };
  /** 从焦点到完全虚化的距离。越小，景深越"薄"。 */
  range?: number;
  /** 完全虚化时的模糊半径（1080p 像素）。 */
  blur?: number;
};

const TAPS = 12;

const quadVert = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const quadFrag = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uRange;
uniform float uBlur;
uniform float uExposure;

float viewDepth(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

vec3 aces(vec3 color) {
  const mat3 ACESInputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777)
  );
  const mat3 ACESOutputMat = mat3(
    vec3(1.60475, -0.10208, -0.00327),
    vec3(-0.53108, 1.10813, -0.07276),
    vec3(-0.07367, -0.00605, 1.07602)
  );
  color *= uExposure / 0.6;
  color = ACESInputMat * color;
  vec3 a = color * (color + 0.0245786) - 0.000090537;
  vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
  color = a / b;
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}

vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  bvec3 small = lessThanEqual(c, vec3(0.0031308));
  return vec3(
    small.r ? lo.r : hi.r,
    small.g ? lo.g : hi.g,
    small.b ? lo.b : hi.b
  );
}

void main() {
  vec4 c0 = texture2D(tColor, vUv);
  float vz = viewDepth(texture2D(tDepth, vUv).x);
  float coc = clamp(abs(vz - uFocus) / max(uRange, 1e-3), 0.0, 1.0);
  float radius = coc * uBlur / uRes.y;

  vec3 acc = c0.rgb;
  float wsum = c0.a;
  float samples = 1.0;
  if (radius > 0.0004) {
    samples += float(${TAPS});
    for (int i = 0; i < ${TAPS}; i++) {
      float fi = float(i) + 0.5;
      float ang = fi * 2.39996323;
      float rad = sqrt(fi / float(${TAPS})) * radius;
      vec4 s = texture2D(tColor, vUv + vec2(cos(ang), sin(ang)) * rad);
      acc += s.rgb;
      wsum += s.a;
    }
  }
  float alpha = wsum / samples;
  vec3 straight = alpha > 0.001 ? (acc / samples) / alpha : vec3(0.0);
  gl_FragColor = vec4(toSRGB(aces(straight)), alpha);
}
`;

export const DepthOfField: React.FC<{ settings: DofSettings; exposure?: number }> = ({ settings, exposure = 1 }) => {
  const frame = useCurrentFrame();
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const subject = React.useMemo(
    () => (settings.subject ? new THREE.Vector3(...settings.subject) : null),
    [settings.subject?.[0], settings.subject?.[1], settings.subject?.[2]]
  );
  const rackTo = React.useMemo(
    () => (settings.rack ? new THREE.Vector3(...settings.rack.to) : null),
    [settings.rack?.to[0], settings.rack?.to[1], settings.rack?.to[2]]
  );
  const focusPoint = React.useMemo(() => new THREE.Vector3(), []);

  const rig = React.useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(size.width, size.height, {
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(size.width, size.height),
      type: THREE.HalfFloatType,
    });
    const quadScene = new THREE.Scene();
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: quadFrag,
      uniforms: {
        tColor: { value: rt.texture },
        tDepth: { value: rt.depthTexture },
        uRes: { value: new THREE.Vector2(size.width, size.height) },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
        uFocus: { value: settings.focus ?? camera.position.length() },
        uRange: { value: settings.range ?? 6 },
        uBlur: { value: ((settings.blur ?? 8) * size.height) / 1080 },
        uExposure: { value: exposure },
      } as Record<string, THREE.IUniform>,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
    return { rt, quadScene, quadCam, material };
  }, [size.width, size.height, camera.near, camera.far, settings.focus, settings.range, settings.blur, exposure, camera]);

  // 近/远裁剪面也可能被场景改（本片不改，但 uniform 不该撒谎）。
  React.useEffect(() => {
    rig.material.uniforms.uNear.value = camera.near;
    rig.material.uniforms.uFar.value = camera.far;
  }, [rig, camera]);

  // 尺寸变化时重建（Remotion 固定 1920×1080，但渲染器不假设）。
  React.useEffect(() => () => { rig.rt.dispose(); rig.material.dispose(); }, [rig]);

  // 接管控件渲染：priority>0 时 R3F 不再自己 render，由这里两趟完成。
  useFrame(() => {
    // 自动对焦：CameraRig（Dolly/Crane/Orbit）在本帧已经改过相机位置，这里读到的是当帧值。
    if (settings.focus === undefined) {
      if (subject) {
        focusPoint.copy(subject);
        if (rackTo && settings.rack) {
          const t = Math.min(1, Math.max(0, (frame - settings.rack.start) / Math.max(1, settings.rack.end - settings.rack.start)));
          focusPoint.lerp(rackTo, t * t * (3 - 2 * t));
        }
        rig.material.uniforms.uFocus.value = camera.position.distanceTo(focusPoint);
      } else {
        rig.material.uniforms.uFocus.value = camera.position.length();
      }
    }
    gl.setRenderTarget(rig.rt);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.clear();
    gl.render(rig.quadScene, rig.quadCam);
  }, 1);

  return null;
};