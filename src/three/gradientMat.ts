import {ShaderMaterial} from 'three';
export class GradientMaterial {
  constructor(gradColor1: string, gradColor2: string, hoverColor: string){
    // const gradColor1 = `${15/255}, ${27/255}, ${50/255}`;
    // const gradColor2 = `${43/255}, ${79/255}, ${104/255}`;
    const v3GradColor1 = hexToVec3(gradColor1);
    const v3GradColor2 = hexToVec3(gradColor2);
    const v3HoverColor = hexToVec3(hoverColor);
    return new ShaderMaterial({
      vertexShader,
      fragmentShader: fragmentShader(v3GradColor1, v3GradColor2, v3HoverColor),
      uniforms: {
        hover: {value: false}
      }
    })
  }
}

function hexToVec3(hexColor: string) {
  if (hexColor.startsWith('#')) {
    hexColor = hexColor.slice(1);
  }

  const colorInt = parseInt(hexColor, 16);

  const r = ((colorInt >> 16) & 0xFF) / 255.0;
  const g = ((colorInt >> 8) & 0xFF) / 255.0;
  const b = (colorInt & 0xFF) / 255.0;

  return [r, g, b];
}

// 自定义渐变材质
const vertexShader = `
  varying vec2 vUV;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vUV = (uv + 50.) / 100.;
  }
`;

const fragmentShader = (color1: number[], color2: number[], hoverColor: number[]) => `
  varying vec2 vUV;
  uniform bool hover;
  void main() {
    if (hover) {
      gl_FragColor = vec4(${hoverColor.join(', ')}, 1.);
      return;
    }
    float t = vUV.y;
    vec3 color1 = vec3(${color1.join(', ')});
    vec3 color2 = vec3(${color2.join(', ')});
    float k1 = (vUV.x + vUV.y) / 2.;
    float k2 = 1. - k1;
    vec3 finalColor = color1 * k1 + color2 * k2;
    gl_FragColor = vec4(finalColor, 1.);
  }
`;
