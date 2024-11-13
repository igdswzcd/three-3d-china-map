import { ShaderMaterial } from 'three';

interface GradUVParams {
  midX: number;
  midY: number;
  disX: number;
  disY: number;
}

export class GradientMaterial {
  constructor(
    gradColor1: string,
    gradColor2: string,
    hoverColor: string,
    gradUVParams: GradUVParams,
  ) {
    const v3GradColor1 = hexToVec3(gradColor1);
    const v3GradColor2 = hexToVec3(gradColor2);
    const v3HoverColor = hexToVec3(hoverColor);
    return new ShaderMaterial({
      vertexShader,
      fragmentShader: fragmentShader(
        v3GradColor1,
        v3GradColor2,
        v3HoverColor,
        gradUVParams,
      ),
      uniforms: {
        hover: { value: false },
      },
    });
  }
}

function hexToVec3(hexColor: string) {
  if (hexColor.startsWith('#')) {
    hexColor = hexColor.slice(1);
  }

  const colorInt = parseInt(hexColor, 16);

  const r = ((colorInt >> 16) & 0xff) / 255.0;
  const g = ((colorInt >> 8) & 0xff) / 255.0;
  const b = (colorInt & 0xff) / 255.0;

  return [r, g, b];
}

// 自定义渐变材质
const vertexShader = `
  varying vec2 vUV;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vUV = uv;
  }
`;

const fragmentShader = (
  color1: number[],
  color2: number[],
  hoverColor: number[],
  { midX, midY, disX, disY }: GradUVParams,
) => `
  varying vec2 vUV;
  uniform bool hover;
  void main() {
    if (hover) {
      gl_FragColor = vec4(${hoverColor.join(', ')}, 1.);
      return;
    }
    float t = vUV.y;
    float kx = 1. - abs((vUV.x - ${midX}) * 1.5 / ${disX});
    float ky = 1. - abs((vUV.y - ${midY}) * 1.5 / ${disY});
    float k1 = (kx + ky) / 2.;
    float k2 = 1. - k1;
    vec3 color1 = vec3(${color1.join(', ')});
    vec3 color2 = vec3(${color2.join(', ')});
    vec3 finalColor = color1 * k1 + color2 * k2;
    gl_FragColor = vec4(finalColor, 1.);
  }
`;
