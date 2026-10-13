import React, { createContext, useContext, useEffect, useRef } from 'react';
import source from './shaders/flame.frag?raw';

export const MotionContext = createContext(true);

// Flame shader adapted from the user-supplied LÖVE shader. React lifecycle,
// visibility suspension, resource cleanup and static fallback authored here.
export default function Flame({ level, color = 'red' }) {
  const canvas = useRef(null), enabled = useContext(MotionContext);
  useEffect(() => {
    const node = canvas.current;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    if (!enabled || reduced.matches) return;
    const gl = node.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl) return;
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const shaders = [], program = gl.createProgram();
    for (const [type, code] of [[gl.VERTEX_SHADER, '#version 300 es\nin vec2 position; out vec2 v_texcoord; void main(){v_texcoord=(position+1.0)/2.0;gl_Position=vec4(position,0.,1.);}'], [gl.FRAGMENT_SHADER, source]]) {
      const shader = gl.createShader(type); shaders.push(shader);
      gl.shaderSource(shader, code); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { shaders.forEach(s => gl.deleteShader(s)); gl.deleteProgram(program); return; }
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { shaders.forEach(s => gl.deleteShader(s)); gl.deleteProgram(program); return; }
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniform = Object.fromEntries(['time','amount','texture_details','image_details','colour_1','colour_2','id'].map(name => [name, gl.getUniformLocation(program, name)]));
    let frame = 0, visible = false, last = 0;
    const draw = now => {
      frame = 0;
      if (!visible || document.hidden || reduced.matches) return;
      if (now - last > 40) {
        last = now;
        node.width = Math.max(1, Math.round(node.clientWidth)); node.height = Math.max(1, Math.round(node.clientHeight));
        gl.viewport(0,0,node.width,node.height); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(program);
        gl.uniform1f(uniform.time, now / 1000); gl.uniform1f(uniform.amount, [0,1.4,3,5][level]);
        gl.uniform4f(uniform.texture_details,0,0,1,1); gl.uniform2f(uniform.image_details,1,1);
        gl.uniform4f(uniform.colour_1,...(color === 'blue' ? [0, .616, 1, 1] : [.996, .373, .333, 1]));
        gl.uniform4f(uniform.colour_2,...(color === 'blue' ? [.25, .8, 1, 1] : [1, .65, .3, 1])); gl.uniform1f(uniform.id,1);
        gl.drawArrays(gl.TRIANGLES,0,6); node.dataset.rendered = 'true';
      }
      frame = requestAnimationFrame(draw);
    };
    const resume = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resume(); }); observer.observe(node);
    document.addEventListener('visibilitychange', resume); reduced.addEventListener('change', resume);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', resume); reduced.removeEventListener('change', resume);
      delete node.dataset.rendered; gl.deleteBuffer(buffer); shaders.forEach(s => gl.deleteShader(s)); gl.deleteProgram(program);
      queueMicrotask(() => { if (!node.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext(); });
    };
  }, [level, enabled, color]);
  return <span className={'shader-fire fire-' + level + ' fire-' + color} aria-hidden="true"><span className="static-fire" /><canvas ref={canvas} hidden={!enabled} /></span>;
}
