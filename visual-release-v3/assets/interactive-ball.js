import * as THREE from './three.module.js';
const host=document.querySelector('.ball-stage');
const fallback=host.querySelector('img');
try {
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 host.append(renderer.domElement);
 const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(36,1,.1,30);camera.position.set(0,.1,5.6);
 scene.add(new THREE.HemisphereLight(0xffffff,0x8b7c78,2.4));
 const light=new THREE.DirectionalLight(0xffffff,3.5);light.position.set(-3,5,4);scene.add(light);
 const fill=new THREE.DirectionalLight(0xffc9bf,.8);fill.position.set(4,-1,2);scene.add(fill);
 const ball=new THREE.Group();scene.add(ball);
 const dirs=[];
 for(let a=0;a<3;a++) for(const sign of [-1,1]) {const v=new THREE.Vector3();v.setComponent(a,sign);dirs.push(v)}
 for(let a=0;a<3;a++) for(let b=a+1;b<3;b++) for(const x of [-1,1]) for(const y of [-1,1]) {const v=new THREE.Vector3();v.setComponent(a,x);v.setComponent(b,y);dirs.push(v.normalize())}
 for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])dirs.push(new THREE.Vector3(x,y,z).normalize());
 function shell(color,radius,side){const mat=new THREE.MeshStandardMaterial({color,roughness:.38,metalness:0,side});mat.onBeforeCompile=shader=>{shader.uniforms.holeDirections={value:dirs};shader.vertexShader='varying vec3 shellPoint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nshellPoint = position;');shader.fragmentShader='varying vec3 shellPoint;\nuniform vec3 holeDirections[26];\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nfor(int i=0;i<26;i++){if(dot(normalize(shellPoint),holeDirections[i])>0.9902) discard;}');};return new THREE.Mesh(new THREE.SphereGeometry(radius,96,64),mat)}
 ball.add(shell(0xfafafa,1,THREE.FrontSide),shell(0xbcb8b4,.965,THREE.BackSide));
 const rimMaterial=new THREE.MeshStandardMaterial({color:0xf4f2ef,roughness:.4});
 for(const d of dirs){const rim=new THREE.Mesh(new THREE.TorusGeometry(.139,.018,10,40),rimMaterial);rim.position.copy(d).multiplyScalar(.983);rim.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d);ball.add(rim)}
 ball.rotation.set(.35,.5,.12);
 fallback.hidden=true;host.classList.add('webgl-ready');
 function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
 new ResizeObserver(resize).observe(host);resize();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let down=false,lastX=0,lastY=0,distance=0,vx=.12,vy=.07,y=0,velocity=0,previous=performance.now(),nextJump=performance.now()+1700,visible=true;
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting}).observe(host);
 function jump(){if(reduced.matches){host.classList.remove('tap-feedback');void host.offsetWidth;host.classList.add('tap-feedback');return}velocity=2.4;vx+=.6;host.classList.remove('tap-feedback');void host.offsetWidth;host.classList.add('tap-feedback');nextJump=performance.now()+2600}
 host.addEventListener('pointerdown',e=>{down=true;distance=0;lastX=e.clientX;lastY=e.clientY;host.setPointerCapture(e.pointerId);host.classList.add('dragging')});
 host.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;distance+=Math.abs(dx)+Math.abs(dy);ball.rotation.y+=dx*.012;ball.rotation.x+=dy*.012;vx=dx*.15;vy=dy*.15;lastX=e.clientX;lastY=e.clientY});
 host.addEventListener('pointerup',()=>{if(!down)return;down=false;host.classList.remove('dragging');if(distance<8)jump()});
 host.addEventListener('pointercancel',()=>{down=false;host.classList.remove('dragging')});
 host.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();jump()}else if(e.key.startsWith('Arrow')){e.preventDefault();ball.rotation.y+=(e.key==='ArrowLeft'?-.18:e.key==='ArrowRight'?.18:0);ball.rotation.x+=(e.key==='ArrowUp'?-.18:e.key==='ArrowDown'?.18:0)}});
 function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-previous)/1000,.04);previous=now;if(!visible||document.hidden)return;if(!reduced.matches){if(!down){ball.rotation.y+=vx*dt;ball.rotation.x+=vy*dt;vx=THREE.MathUtils.lerp(vx,.12,dt*2);vy*=Math.exp(-dt*3)}if(now>nextJump&&!down){velocity=1.65;nextJump=now+2600}velocity-=5.8*dt;y+=velocity*dt;if(y<0){y=0;velocity=velocity<-.4?-velocity*.33:0}ball.position.y=y;const squash=y===0&&velocity>.2?.96:1;ball.scale.set(1/squash,squash,1/squash);host.style.setProperty('--shadow-scale',String(1-y*.3));host.style.setProperty('--shadow-opacity',String(.22-y*.12))}renderer.render(scene,camera)}requestAnimationFrame(animate);
} catch(error){fallback.hidden=false;host.setAttribute('aria-label','软式曲棍球图片，当前浏览器不支持三维显示');console.warn('3D ball unavailable',error)}
for(const el of document.querySelectorAll('.court .btn'))el.addEventListener('pointerdown',e=>{const rect=el.getBoundingClientRect();const ripple=document.createElement('span');ripple.className='click-ripple';ripple.style.left=(e.clientX-rect.left)+'px';ripple.style.top=(e.clientY-rect.top)+'px';el.append(ripple);setTimeout(()=>ripple.remove(),650)});
