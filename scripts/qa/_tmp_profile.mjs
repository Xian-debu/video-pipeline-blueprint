import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const dir = mkdtempSync(join(tmpdir(), "p-"));
const out = join(dir, "p.mjs");
await build({ entryPoints: ["src/gears/profile.ts"], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error" });
const m = await import(pathToFileURL(out).href);
const segX=(a,b,c,d)=>{const d1=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);const d2=(b.x-a.x)*(d.y-a.y)-(b.y-a.y)*(d.x-a.x);const d3=(d.x-c.x)*(a.y-c.y)-(d.y-c.y)*(a.x-c.x);const d4=(d.x-c.x)*(b.y-c.y)-(d.y-c.y)*(b.x-c.x);return((d1>0)!==(d2>0))&&((d3>0)!==(d4>0));};
const crossings=(A,B)=>{let n=0;for(let i=0;i<A.length;i++)for(let j=0;j<B.length;j++)if(segX(A[i],A[(i+1)%A.length],B[j],B[(j+1)%B.length]))n++;return n;};
const D=Math.PI/180;
const sun=m.gearShape2D({z:24,module:2,pressureAngleDeg:20,faceWidth:3});
const pl=m.gearShape2D({z:18,module:2,pressureAngleDeg:20,faceWidth:3});
const ring=m.gearShape2D({z:60,module:2,pressureAngleDeg:20,faceWidth:3,internal:true});
const arm=(24+18)*2/2;
const zs=24,zp=18,zr=60;
let worstS=0, worstR=0;
for(let i=0;i<=120;i++){
  const th = (i*0.5)*D; // 0..60 deg of sun
  const c = th/3.5, ps = -0.6666667*th + 10*D;
  const S = m.rotateOutline(sun.outline, th);
  const R = m.rotateOutline(ring.outline, 0);
  for(let k=0;k<3;k++){
    const psi = c + k*120*D;
    const P = m.translateOutline(m.rotateOutline(pl.outline, ps), arm*Math.cos(psi), arm*Math.sin(psi));
    worstS=Math.max(worstS, crossings(S,P));
    worstR=Math.max(worstR, crossings(P,R));
  }
}
console.log("planetary sweep 0..60deg: sunX", worstS, "ringX", worstR);
