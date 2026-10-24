
import numpy as np, json, os
from PIL import Image
src="/mnt/e/Strata-data/models/swift-IQ2_XS/视图.png"
out="/mnt/e/aigen_out/probe3d/out"
im=Image.open(src).convert("RGB"); a=np.asarray(im).astype(np.float32); H,W,_=a.shape
mx=a.max(2); mn=a.min(2); chroma=mx-mn; lum=a.mean(2)
fg=(chroma>14)&(lum<250)
views={"front":(28,313,94,565),"side":(328,513,94,566),"back":(526,805,94,563)}
R={}
for name,(x0,x1,y0,y1) in views.items():
    hh=y1-y0+1; m=fg[y0:y1+1, x0:x1+1]
    rows=[]
    for yy in range(hh):
        xs=np.where(m[yy])[0]
        if len(xs)==0: rows.append(None); continue
        runs=[]; s=xs[0]; p=xs[0]
        for x in xs[1:]:
            if x-p>2: runs.append((s,p)); s=x
            p=x
        runs.append((s,p))
        rows.append(runs)
    # crotch: first row (from top) where >=2 runs with gap>8
    crotch=None
    for yy in range(hh):
        r0=rows[yy]
        if r0 and len(r0)>=2 and (r0[1][0]-r0[0][1])>10:
            crotch=yy; break
    # profile: for 128 heights, left/right extent in normalized coords (x center = bbox center)
    cx=(x1-x0)/2
    prof=[]
    for i in range(128):
        yy=min(hh-1,int((i+0.5)*hh/128)); r0=rows[yy]
        if not r0: prof.append([None,None]); continue
        prof.append([round((r0[0][0]-cx)/hh,4), round((r0[-1][1]-cx)/hh,4)])
    # cream belly: low chroma interior, not touching border
    sub=a[y0:y1+1, x0:x1+1]
    inner=m.copy()
    # flood fill from border to mark background
    from collections import deque
    bg=np.zeros_like(inner)
    dq=deque()
    for x in range(inner.shape[1]):
        for y in (0,inner.shape[0]-1):
            if not inner[y,x] and not bg[y,x]: bg[y,x]=1; dq.append((y,x))
    for y in range(inner.shape[0]):
        for x in (0,inner.shape[1]-1):
            if not inner[y,x] and not bg[y,x]: bg[y,x]=1; dq.append((y,x))
    while dq:
        y,x=dq.popleft()
        for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny,nx=y+dy,x+dx
            if 0<=ny<inner.shape[0] and 0<=nx<inner.shape[1] and not inner[ny,nx] and not bg[ny,nx]:
                bg[ny,nx]=1; dq.append((ny,nx))
    interior=(bg==0)
    sch=sub.max(2)-sub.min(2)
    cream=interior&(sch<26)&(sub.mean(2)>200)
    creaminfo=None
    if cream.sum()>200:
        ys,xs=np.where(cream)
        creaminfo={"bbox_rel":[round(float(xs.min())/hh,4),round(float(ys.min())/hh,4),round(float(xs.max())/hh,4),round(float(ys.max())/hh,4)],
                   "area_frac":round(float(cream.sum())/float(inner.sum()),4),
                   "rgb":[round(float(v),1) for v in np.median(sub[cream],0)]}
    R[name]={"bbox":[x0,y0,x1,y1],"h":hh,"prof128":prof,"crotch_rel":round(crotch/hh,4) if crotch else None,
             "cream":creaminfo}
json.dump(R,open(out+"/ref_views.json","w"),indent=1)
for k,v in R.items():
    print(k,"h",v["h"],"crotch",v["crotch_rel"],"cream",v["cream"])
    # print extents every 8
    print(" ".join(f"{i}:{v['prof128'][i][0]}/{v['prof128'][i][1]}" for i in range(0,128,8)))

