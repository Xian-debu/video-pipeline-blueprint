
import numpy as np, json, os
from PIL import Image
src="/mnt/e/Strata-data/models/swift-IQ2_XS/视图.png"
out="/mnt/e/aigen_out/probe3d/out"; os.makedirs(out,exist_ok=True)
im=Image.open(src).convert("RGB")
a=np.asarray(im).astype(np.float32)
H,W,_=a.shape
r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
mx=a.max(2); mn=a.min(2); chroma=mx-mn; lum=a.mean(2)
fg=(chroma>14)&(lum<250)
# remove noise: column occupancy
col=fg.sum(0)
# split into views by gaps of empty columns
cols=np.where(col>3)[0]
groups=[]; start=cols[0]; prev=cols[0]
for c in cols[1:]:
    if c-prev>8: groups.append((start,prev)); start=c
    prev=c
groups.append((start,prev))
res={"size":[W,H],"groups":[[int(x0),int(x1)] for x0,x1 in groups]}
views=[]
for gi,(x0,x1) in enumerate(groups):
    m=fg[:,x0:x1+1]
    rows=np.where(m.sum(1)>0)[0]
    y0,y1=rows[0],rows[-1]
    mm=m[y0:y1+1,:]
    hh=y1-y0+1
    # silhouette profile: width fraction and center offset at 64 heights (top=0)
    prof=[]
    for i in range(64):
        yy=min(hh-1,int((i+0.5)*hh/64))
        xs=np.where(mm[yy])[0]
        if len(xs)==0: prof.append([i,0,0,0]); continue
        prof.append([i, round(float((xs[-1]-xs[0]+1)/hh),4), round(float((xs[0]+xs[-1])/2-(x1-x0)/2)/hh,4), int(len(xs))])
    # colors: sample body color at mid-torso
    cy=y0+int(hh*0.62); cx=x0+int((x1-x0)/2)
    patch=a[cy-3:cy+4,cx-3:cx+4].reshape(-1,3)
    body_rgb=[round(float(v),1) for v in np.median(patch,0)]
    # green eye mask in this view
    sub=a[y0:y1+1, x0:x1+1]
    gr,gg,gb=sub[:,:,0],sub[:,:,1],sub[:,:,2]
    eye=(gg>gr+18)&(gg>gb+10)&(gg>60)&(gg<200)
    eyc=[]
    if eye.sum()>20:
        ys,xs=np.where(eye)
        # split into blobs by x clustering
        order=np.argsort(xs); xs2=xs[order]; ys2=ys[order]
        cuts=np.where(np.diff(xs2)>6)[0]
        segs=np.split(np.arange(len(xs2)),cuts+1)
        for s in segs:
            if len(s)<10: continue
            eyc.append([round(float(xs2[s].mean())/hh,4), round(float(ys2[s].mean())/hh,4),
                        round(float((xs2[s].max()-xs2[s].min()+1)/hh),4),
                        round(float((ys2[s].max()-ys2[s].min()+1)/hh),4),
                        int(len(s))])
    views.append({"bbox":[int(x0),int(y0),int(x1),int(y1)],"h":int(hh),"body_rgb":body_rgb,
                  "eyes":eyc,"profile":prof})
res["views"]=views
json.dump(res,open(out+"/ref_measure.json","w"),indent=1)
# diagnostic overlay
ov=np.array(im).copy()
ov[fg]=[255,0,255]
Image.fromarray(ov).save(out+"/ref_fg.png")
print(json.dumps({k:v for k,v in res.items() if k!="views"},ensure_ascii=False))
for v in views:
    print("view bbox",v["bbox"],"h",v["h"],"body",v["body_rgb"],"eyes",v["eyes"][:4])
print("ok")
