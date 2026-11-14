"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { createShader } from "shaders/js";
import type { PresetConfig, ShaderInstance } from "shaders/js";

export interface AsciiFieldLayerProps {
  image: string | null;
  /** `#rrggbb` the glyphs are inked in. */
  color: string;
  characters: string;
  cellSize: number;
  /** Most canvas pixels drawn per CSS pixel, however dense the screen. */
  maxDensity: number;
  animating: boolean;
  onReady: () => void;
  onUnavailable: () => void;
}

const Layer = {
  /** Everything the glyphs are picked from; hidden, because only its brightness is used. */
  Glyphs: "glyphs",
  Image: "image",
  Trail: "trail",
  Ink: "ink",
} as const;

const IMAGE_FADE_MS = 450;
/**
 * The field stops redrawing this long after the reader last moved, scrolled or typed. A still
 * field costs nothing; a drifting one redraws the whole viewport every frame.
 */
const IDLE_MS = 3000;
/** The library multiplies a size by the device pixel ratio, up to this, before allocating. */
const LIBRARY_MAX_PIXEL_RATIO = 2;
/** A layer needs some image from the start; mounting one later recompiles the shader. */
const BLANK_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

const WAKE_EVENTS = ["pointermove", "scroll", "keydown", "touchstart"] as const;

const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3;

/**
 * Glyphs are picked from the full brightness range of the hidden group, then that brightness
 * masks one flat colour. The canvas is therefore transparent between glyphs and needs no blend
 * mode over the page.
 */
const presetOf = (
  props: Pick<AsciiFieldLayerProps, "characters" | "cellSize" | "animating">
): PresetConfig => ({
  components: [
    {
      type: "Group",
      id: Layer.Glyphs,
      props: { visible: false },
      children: [
        {
          type: "FractalNoise",
          props: {
            colorA: "#000000",
            colorB: "#ffffff",
            octaves: 3,
            contrast: 0.6,
            speed: props.animating ? 0.12 : 0,
          },
        },
        {
          type: "ImageTexture",
          id: Layer.Image,
          props: {
            url: BLANK_IMAGE,
            objectFit: "cover",
            visible: false,
            opacity: 0,
          },
        },
        {
          type: "CursorTrail",
          id: Layer.Trail,
          props: {
            colorA: "#ffffff",
            colorB: "#9a9a9a",
            radius: 0.6,
            length: 0.7,
            blendMode: "screen",
            visible: props.animating,
          },
        },
        {
          type: "Ascii",
          props: {
            characters: props.characters,
            cellSize: props.cellSize,
            gamma: 0.8,
          },
        },
      ],
    },
    {
      type: "SolidColor",
      id: Layer.Ink,
      props: {
        // `restore` inks it once the shader is built; the colour is not part of its structure.
        color: "#ffffff",
        maskSource: Layer.Glyphs,
        maskType: "luminance",
      },
    },
  ],
});

const AsciiFieldLayer = ({
  image,
  color,
  characters,
  cellSize,
  maxDensity,
  animating,
  onReady,
  onUnavailable,
}: AsciiFieldLayerProps) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shader = useRef<ShaderInstance | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Opacity of the image layer, kept across fades so one can start where the last stopped. */
  const opacity = useRef(0);
  const reportReady = useEffectEvent(onReady);
  const reportUnavailable = useEffectEvent(onUnavailable);

  /** Runs the field until the reader has been still for `IDLE_MS`, then stops it on its last frame. */
  const wake = useEffectEvent(() => {
    const instance = shader.current;
    if (!instance || !animating) return;
    instance.resume();
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => instance.pause(), IDLE_MS);
  });

  /**
   * Sizes the buffer from the box around the canvas. `resize` also writes the size it is given
   * onto the canvas's own style, so the canvas is stretched back over the box afterwards and
   * never measured itself.
   */
  const fit = useEffectEvent(() => {
    const element = canvas.current;
    const box = element?.parentElement;
    if (!element || !box || !shader.current) return;
    const screenRatio = window.devicePixelRatio || 1;
    // The library multiplies what it is given by its own ratio; dividing by it leaves `density`.
    const scale =
      Math.min(screenRatio, maxDensity) /
      Math.min(screenRatio, LIBRARY_MAX_PIXEL_RATIO);
    shader.current.resize(box.clientWidth * scale, box.clientHeight * scale);
    element.style.width = "100%";
    element.style.height = "100%";
  });

  /** Brings a shader that was just built up to the props it missed while it compiled. */
  const restore = useEffectEvent(() => {
    shader.current?.update(Layer.Ink, { color });
    if (image === null) return;
    opacity.current = 1;
    shader.current?.update(Layer.Image, {
      url: image,
      opacity: 1,
      visible: true,
    });
  });

  useEffect(() => {
    const element = canvas.current;
    const box = element?.parentElement;
    if (!element || !box) return;
    let disposed = false;
    const observer = new ResizeObserver(() => fit());

    void createShader(element, presetOf({ characters, cellSize, animating }), {
      // Sizing and pausing are done here, at a lower density and on the reader's activity.
      observeElement: false,
      onReady: () => reportReady(),
      onError: () => reportUnavailable(),
    }).then((instance) => {
      if (disposed) {
        instance.destroy();
        return;
      }
      if (instance.getFailureReason() !== null) return;
      shader.current = instance;
      fit();
      observer.observe(box);
      restore();
      if (animating) wake();
      else instance.pause();
    });

    return () => {
      disposed = true;
      observer.disconnect();
      clearTimeout(idleTimer.current);
      shader.current?.destroy();
      shader.current = null;
    };
    // The preset is the shader's structure: a change to any of these is a different shader.
  }, [characters, cellSize, animating]);

  useEffect(() => {
    for (const event of WAKE_EVENTS) {
      window.addEventListener(event, wake, { passive: true });
    }
    return () => {
      for (const event of WAKE_EVENTS) {
        window.removeEventListener(event, wake);
      }
    };
  }, []);

  useEffect(() => {
    shader.current?.update(Layer.Ink, { color });
    wake();
  }, [color]);

  useEffect(() => {
    fit();
  }, [maxDensity]);

  // A new image starts from nothing, so it develops out of the noise under it; no image fades out.
  useEffect(() => {
    const instance = shader.current;
    if (!instance) return;
    const target = image === null ? 0 : 1;
    const from = image === null ? opacity.current : 0;
    if (image !== null) instance.update(Layer.Image, { url: image });
    wake();

    const start = performance.now();
    let frame = requestAnimationFrame(function step(now: number) {
      const progress = animating
        ? Math.min(1, (now - start) / IMAGE_FADE_MS)
        : 1;
      opacity.current = from + (target - from) * easeOutCubic(progress);
      instance.update(Layer.Image, {
        opacity: opacity.current,
        visible: opacity.current > 0,
      });
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [image, animating]);

  return <canvas ref={canvas} aria-hidden className="block size-full" />;
};

export default AsciiFieldLayer;
