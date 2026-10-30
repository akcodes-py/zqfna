import { useEffect, useRef } from "react";
import * as THREE from "three";

const COLORS = {
  forecast: { core: 0x86efac, particle: 0x4ade80, accent: 0x38bdf8 },
  accuracy: { core: 0x7dd3fc, particle: 0x38bdf8, accent: 0x60a5fa },
};

export function SignalScene({ mode = "forecast" }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const palette = COLORS[mode] || COLORS.forecast;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.2, 5.2);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch (error) {
      host.classList.add("signal-scene--fallback");
      console.warn("Three.js signal scene unavailable; using the CSS wind field fallback.", error);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    const onContextLost = (event) => {
      event.preventDefault();
      host.classList.add("signal-scene--fallback");
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost, false);

    const group = new THREE.Group();
    group.position.x = 1.05;
    scene.add(group);
    const coreMaterial = new THREE.MeshBasicMaterial({ color: palette.core, wireframe: true, transparent: true, opacity: 0.9 });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), coreMaterial);
    group.add(core);
    const rings = [];
    [1.05, 1.35, 1.7].forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.008 + index * 0.003, 6, 48),
        new THREE.MeshBasicMaterial({ color: index === 1 ? palette.accent : palette.core, transparent: true, opacity: 0.42 - index * 0.08 })
      );
      ring.rotation.set(index * 0.7, index * 0.45, index * 0.3);
      group.add(ring);
      rings.push(ring);
    });

    const turbineGroup = new THREE.Group();
    turbineGroup.position.set(-2.05, -1.05, -0.5);
    scene.add(turbineGroup);
    const turbineMeshes = [];
    const createTurbine = (x, y, z, scale) => {
      const turbine = new THREE.Group();
      turbine.position.set(x, y, z);
      turbine.scale.setScalar(scale);
      const wireframe = mode === "accuracy";
      const poleMaterial = new THREE.MeshBasicMaterial({ color: palette.core, transparent: true, opacity: wireframe ? 0.24 : 0.3, wireframe });
      const bladeMaterial = new THREE.MeshBasicMaterial({ color: palette.core, transparent: true, opacity: wireframe ? 0.48 : 0.72, wireframe });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.05, 1.25, 8), poleMaterial);
      pole.position.y = 0.62;
      turbine.add(pole);
      const hub = new THREE.Group();
      hub.position.y = 1.25;
      turbine.add(hub);
      const nacelle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.07), bladeMaterial);
      nacelle.position.x = 0.07;
      hub.add(nacelle);
      for (let index = 0; index < 3; index += 1) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.025, 0.018), bladeMaterial);
        blade.position.x = 0.32;
        blade.rotation.z = (index * Math.PI * 2) / 3;
        hub.add(blade);
      }
      turbineGroup.add(turbine);
      turbineMeshes.push(hub);
    };
    createTurbine(-1.35, -0.35, -0.7, 0.72);
    createTurbine(-0.2, -0.35, -0.25, 0.5);
    createTurbine(1.0, -0.28, 0.1, 0.88);
    createTurbine(1.75, -0.38, -1.1, 0.42);

    const positions = new Float32Array(180 * 3);
    for (let index = 0; index < 180; index += 1) {
      const radius = 1.5 + Math.random() * 2.2;
      const angle = Math.random() * Math.PI * 2;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = (Math.random() - 0.5) * 2.8;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: palette.particle, size: 0.018, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending }));
    scene.add(particles);

    const pointer = { x: 0, y: 0 };
    const onPointerMove = (event) => {
      const rect = host.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    let frame;
    const animate = (time) => {
      group.rotation.y += 0.0025;
      group.rotation.x += (pointer.y * 0.18 - group.rotation.x) * 0.025;
      group.rotation.z += (pointer.x * 0.12 - group.rotation.z) * 0.025;
      core.rotation.x += 0.004;
      core.rotation.y -= 0.006;
      rings.forEach((ring, index) => {
        ring.rotation.x += 0.001 + index * 0.0007;
        ring.rotation.z -= 0.0015 + index * 0.0005;
      });
      turbineMeshes.forEach((hub, index) => {
        hub.rotation.z -= 0.012 + index * 0.002;
      });
      particles.rotation.y = time * 0.000035;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    resize();
    window.addEventListener("resize", resize);
    host.addEventListener("pointermove", onPointerMove);
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      host.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      particleGeometry.dispose();
      particles.material.dispose();
      core.geometry.dispose();
      coreMaterial.dispose();
      rings.forEach((ring) => {
        ring.geometry.dispose();
        ring.material.dispose();
      });
      turbineMeshes.forEach((hub) => {
        const turbine = hub.parent;
        turbine.children.forEach((part) => {
          if (part.geometry) part.geometry.dispose();
          if (part.material) part.material.dispose();
        });
        hub.children.forEach((part) => {
          if (part.geometry) part.geometry.dispose();
          if (part.material) part.material.dispose();
        });
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === host) renderer.domElement.remove();
    };
  }, [mode]);

  return <div ref={hostRef} className={`signal-scene signal-scene--${mode}`} aria-hidden="true" />;
}
