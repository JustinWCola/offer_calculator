import React, { useContext, useEffect, useRef, useState } from 'react';
import { MotionContext } from './Flame.jsx';
import backgroundShader from './shaders/background.frag?raw';

function ShaderSurface({ source, className }) {
  const ref = useRef(null), motion = useContext(MotionContext);
  const [contextVersion, setContextVersion] = useState(0);
  useEffect(() => {
    const canvas = ref.current;
    const lost = event => {
      event.preventDefault(); // Allow the browser to restore this context.
      delete canvas.dataset.rendered;
    };
    const restored = () => setContextVersion(version => version + 1);
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, []);
  useEffect(() => {
    const canvas = ref.current, gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl || gl.isContextLost()) return;
    delete canvas.dataset.error;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)'), program = gl.createProgram(), shaders = [];
    for (const [type, code] of [[gl.VERTEX_SHADER, '#version 300 es\nin vec2 position;out vec2 v_texcoord;void main(){v_texcoord=(position+1.)/2.;gl_Position=vec4(position,0.,1.);}'], [gl.FRAGMENT_SHADER, source]]) {
      const shader = gl.createShader(type); shaders.push(shader);gl.shaderSource(shader, code);gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { canvas.dataset.error = gl.getShaderInfoLog(shader); shaders.forEach(s => gl.deleteShader(s));gl.deleteProgram(program);return; }
      gl.attachShader(program,shader);
    }
    gl.linkProgram(program);if (!gl.getProgramParameter(program,gl.LINK_STATUS)) { canvas.dataset.error=gl.getProgramInfoLog(program); shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);return; }
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    const u=name=>gl.getUniformLocation(program,name);
    let frame=0,visible=false,last=-Infinity;
    function draw(now) {
      frame=0;if (!visible || document.hidden || gl.isContextLost()) return;
      if(now-last>66){last=now;canvas.width=Math.max(1,Math.round(canvas.clientWidth*.65));canvas.height=Math.max(1,Math.round(canvas.clientHeight*.65));gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);
        const t=motion && !reduced.matches ? now/1000 : 0;
        gl.uniform1f(u('time'),t);gl.uniform1f(u('spin_time'),t*.25);gl.uniform1f(u('spin_amount'),.22);gl.uniform1f(u('contrast'),2);
        gl.uniform4f(u('love_ScreenSize'),canvas.width,canvas.height,0,0);
        gl.uniform4f(u('colour_1'),.09,.29,.23,1);gl.uniform4f(u('colour_2'),.16,.43,.33,1);gl.uniform4f(u('colour_3'),.055,.21,.18,1);
        gl.drawArrays(gl.TRIANGLES,0,6);canvas.dataset.rendered='true';
      }
      if(motion&&!reduced.matches)frame=requestAnimationFrame(draw);
    }
    const resume=()=>{cancelAnimationFrame(frame);last=-Infinity;frame=requestAnimationFrame(draw);};
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;resume();});observer.observe(canvas);document.addEventListener('visibilitychange',resume);reduced.addEventListener('change',resume);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',resume);reduced.removeEventListener('change',resume);gl.deleteBuffer(buffer);shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);delete canvas.dataset.rendered;if(!canvas.isConnected)gl.getExtension('WEBGL_lose_context')?.loseContext();};
  },[source,motion,contextVersion]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

export default function SurfaceEffects({ background, crt }) { return <>{background && <ShaderSurface source={backgroundShader} className="table-background-effect" />}{crt && <div className="crt-screen-effect" aria-hidden="true" />}</>; }
