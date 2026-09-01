export type Rgb = readonly [number, number, number];

export type RecolorSettings = {
  background: string;
  text: string;
  darkPoint: number;
  lightPoint: number;
};

export function normalizeHex(input: string): string | null {
  let value = input.trim();
  if (!value.startsWith('#')) value = `#${value}`;

  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return null;
  return value.toUpperCase();
}

export function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error(`Invalid color: ${hex}`);

  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

function mix(from: number, to: number, amount: number): number {
  return Math.round(from + (to - from) * amount);
}

/**
 * Recolors neutral (gray-ish) pixels while leaving colorful artwork alone.
 * Dark pixels become the selected text color, light pixels become the selected
 * paper color, and anti-aliased pixels are blended between them.
 */
export function recolorImageData(
  source: ImageData,
  settings: RecolorSettings,
): ImageData {
  const output = new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
  );

  const data = output.data;
  const background = hexToRgb(settings.background);
  const text = hexToRgb(settings.text);
  const darkPoint = Math.max(0, Math.min(254, settings.darkPoint));
  const lightPoint = Math.max(darkPoint + 1, Math.min(255, settings.lightPoint));

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;

    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const maxChannel = Math.max(red, green, blue);
    const minChannel = Math.min(red, green, blue);

    // Keep clearly colored pixels (photos, illustrations, highlights) intact.
    // Neutral PDF paper, text, and antialiasing are recolored.
    if (maxChannel - minChannel > 34) continue;

    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const amount = Math.max(
      0,
      Math.min(1, (luminance - darkPoint) / (lightPoint - darkPoint)),
    );

    data[i] = mix(text[0], background[0], amount);
    data[i + 1] = mix(text[1], background[1], amount);
    data[i + 2] = mix(text[2], background[2], amount);
  }

  return output;
}
