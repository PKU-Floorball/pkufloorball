import * as THREE from './three.module.js';
const host=document.querySelector('.ball-stage');
const fallback=host.querySelector('img');
try {
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 host.append(renderer.domElement);
 const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(36,1,.1,30);camera.position.set(0,.1,5.6);
 // A broad studio reflection and fine moulded-plastic grain, rather than flat shading.
 const studio=document.createElement('canvas');studio.width=512;studio.height=256;
 const ctx=studio.getContext('2d');ctx.fillStyle='#77736f';ctx.fillRect(0,0,512,256);
 for(const [x,y,r] of [[120,75,110],[400,90,80]]){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#ffffff');g.addColorStop(.4,'#eeece8');g.addColorStop(1,'#77736f');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
 const environment=new THREE.CanvasTexture(studio);environment.mapping=THREE.EquirectangularReflectionMapping;environment.colorSpace=THREE.SRGBColorSpace;
 const pmrem=new THREE.PMREMGenerator(renderer);const lighting=pmrem.fromEquirectangular(environment);scene.environment=lighting.texture;environment.dispose();pmrem.dispose();
 const grain=document.createElement('canvas');grain.width=128;grain.height=128;
 const grainCtx=grain.getContext('2d'),pixels=grainCtx.createImageData(128,128);
 let seed=27;for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const value=155+(seed%80);pixels.data.set([value,value,value,255],i)}grainCtx.putImageData(pixels,0,0);
 const bump=new THREE.CanvasTexture(grain);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.repeat.set(8,4);
 scene.add(new THREE.HemisphereLight(0xffffff,0x8f3235,.35));
 const light=new THREE.DirectionalLight(0xffffff,2.1);light.position.set(-3,5,4);scene.add(light);
 const fill=new THREE.DirectionalLight(0xffede4,.55);fill.position.set(4,-1,2);scene.add(fill);
 const ball=new THREE.Group();scene.add(ball);
 // The rail and the ball use the same rising path. Perspective supplies depth.
 const path=s=>new THREE.Vector3(.55*s,.35*s+.15*s*s,-1.4*s);
 const railPoints=Array.from({length:65},(_,i)=>path(i/64*1.65).add(new THREE.Vector3(0,-1,0)));
 const rail=new THREE.Line(new THREE.BufferGeometry().setFromPoints(railPoints),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.18}));
 scene.add(rail);
 const dirs=[];
 for(let a=0;a<3;a++) for(const sign of [-1,1]) {const v=new THREE.Vector3();v.setComponent(a,sign);dirs.push(v)}
 for(let a=0;a<3;a++) for(let b=a+1;b<3;b++) for(const x of [-1,1]) for(const y of [-1,1]) {const v=new THREE.Vector3();v.setComponent(a,x);v.setComponent(b,y);dirs.push(v.normalize())}
 for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])dirs.push(new THREE.Vector3(x,y,z).normalize());
 function shell(color,radius,side){const mat=new THREE.MeshStandardMaterial({color,roughness:.38,metalness:0,bumpMap:bump,bumpScale:.002,envMapIntensity:.45,side});mat.onBeforeCompile=shader=>{shader.uniforms.holeDirections={value:dirs};shader.vertexShader='varying vec3 shellPoint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nshellPoint = position;');shader.fragmentShader='varying vec3 shellPoint;\nuniform vec3 holeDirections[26];\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nfor(int i=0;i<26;i++){if(dot(normalize(shellPoint),holeDirections[i])>0.9902) discard;}');};return new THREE.Mesh(new THREE.SphereGeometry(radius,96,64),mat)}
 ball.add(shell(0xf8f7f3,1,THREE.FrontSide),shell(0xcac7bf,.94,THREE.BackSide));
 const rimMaterial=new THREE.MeshStandardMaterial({color:0xf8f7f3,roughness:.4,bumpMap:bump,bumpScale:.0015});
 for(const d of dirs){const rim=new THREE.Mesh(new THREE.TorusGeometry(.139,.0025,8,48),rimMaterial);rim.position.copy(d).multiplyScalar(.991);rim.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d);ball.add(rim);
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(.139,.131,.057,48,1,true),rimMaterial);
  wall.material=wall.material.clone();wall.material.side=THREE.DoubleSide;
  wall.position.copy(d).multiplyScalar(.961);wall.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);ball.add(wall)}
 ball.rotation.set(.35,.5,.12);
 fallback.hidden=true;host.classList.add('webgl-ready');
 function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
 new ResizeObserver(resize).observe(host);resize();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let down=false,lastX=0,lastY=0,distance=0,vx=.12,vy=.07,y=0,velocity=0,previous=performance.now(),impact=0,nextJump=performance.now()+1700,visible=true,travel=0,trackVelocity=0,rolling=false;
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting}).observe(host);
 function jump(){impact=1;if(reduced.matches){host.classList.remove('tap-feedback');void host.offsetWidth;host.classList.add('tap-feedback');return}rolling=true;trackVelocity=2.7;velocity=0;host.classList.remove('tap-feedback');void host.offsetWidth;host.classList.add('tap-feedback');nextJump=performance.now()+2600}
 host.addEventListener('pointerdown',e=>{down=true;distance=0;lastX=e.clientX;lastY=e.clientY;host.setPointerCapture(e.pointerId);host.classList.add('dragging')});
 host.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;distance+=Math.abs(dx)+Math.abs(dy);ball.rotation.y+=dx*.012;ball.rotation.x+=dy*.012;vx=dx*.15;vy=dy*.15;lastX=e.clientX;lastY=e.clientY});
 host.addEventListener('pointerup',()=>{if(!down)return;down=false;host.classList.remove('dragging');if(distance<8)jump()});
 host.addEventListener('pointercancel',()=>{down=false;host.classList.remove('dragging')});
 host.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();jump()}else if(e.key.startsWith('Arrow')){e.preventDefault();ball.rotation.y+=(e.key==='ArrowLeft'?-.18:e.key==='ArrowRight'?.18:0);ball.rotation.x+=(e.key==='ArrowUp'?-.18:e.key==='ArrowDown'?.18:0)}});
 function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-previous)/1000,.04);previous=now;if(!visible||document.hidden)return;if(!reduced.matches){if(!down){ball.rotation.y+=vx*dt;ball.rotation.x+=vy*dt;vx=THREE.MathUtils.lerp(vx,.12,dt*2);vy*=Math.exp(-dt*3)}if(now>nextJump&&!down&&!rolling){velocity=1.25;nextJump=now+3100}if(rolling){
  const oldTravel=travel;
  // Gravity projected onto the incline decelerates the launch and reverses it.
  const slope=.35+.3*travel;
  const metric=.55*.55+slope*slope+1.4*1.4;
  trackVelocity+=(-9.81*slope/metric-.12*trackVelocity)*dt;
  travel+=trackVelocity*dt;
  if(travel<=0){travel=0;trackVelocity=0;rolling=false;nextJump=now+3100;impact=.25}
  const step=travel-oldTravel;
  ball.rotation.x-=step*1.4;ball.rotation.z-=step*.55;
  ball.position.copy(path(travel));
  host.style.setProperty('--shadow-x',`${travel*12}%`);
  host.style.setProperty('--shadow-scale',String(1-travel*.25));
  host.style.setProperty('--shadow-opacity',String(.15-travel*.06));
 }else{
 ball.position.x=0;ball.position.z=0;host.style.setProperty('--shadow-x','0%');
 velocity-=5.8*dt;y+=velocity*dt;if(y<0){y=0;velocity=velocity<-.4?-velocity*.33:0}ball.position.y=y;impact=Math.max(0,impact-dt*3);const squash=1-impact*.035;ball.scale.set(1/squash,squash,1/squash);host.style.setProperty('--shadow-scale',String(1-y*.3));host.style.setProperty('--shadow-opacity',String(.15-y*.1))}}host.dataset.travel=String(travel);host.dataset.rotation=ball.rotation.toArray().slice(0,3).join(',');host.dataset.height=String(ball.position.y);renderer.render(scene,camera)}requestAnimationFrame(animate);
} catch(error){fallback.hidden=false;host.setAttribute('aria-label','软式曲棍球图片，当前浏览器不支持三维显示');console.warn('3D ball unavailable',error)}
