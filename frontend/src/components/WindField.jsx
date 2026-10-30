import { useEffect, useRef } from "react";

const PARTICLES = 90;

export function WindField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const particles = Array.from({ length: PARTICLES }, (_, index) => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.0007 + Math.random() * 0.0014,
      length: 10 + Math.random() * 28,
      alpha: 0.2 + Math.random() * 0.55,
      phase: index * 0.37,
    }));
    let frame;
    let width = 0;
    let height = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (time) => {
      context.clearRect(0, 0, width, height);
      const gradient = context.createRadialGradient(width * 0.72, height * 0.35, 0, width * 0.72, height * 0.35, width * 0.8);
      gradient.addColorStop(0, "rgba(74, 222, 128, 0.14)");
      gradient.addColorStop(1, "rgba(74, 222, 128, 0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      particles.forEach((particle) => {
        const drift = Math.sin(time * 0.0007 + particle.phase + particle.y * 8) * 0.07;
        particle.x = (particle.x + particle.speed) % 1;
        const x = particle.x * width;
        const y = (particle.y + drift) * height;
        const trail = particle.length * (width / 900);
        const glow = context.createLinearGradient(x - trail, y, x, y);
        glow.addColorStop(0, "rgba(74, 222, 128, 0)");
        glow.addColorStop(1, `rgba(167, 243, 208, ${particle.alpha})`);
        context.strokeStyle = glow;
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(x - trail, y);
        context.lineTo(x, y - 1);
        context.stroke();
      });

      frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="wind-field" aria-label="Animated wind flow visualization" role="img" />;
}
