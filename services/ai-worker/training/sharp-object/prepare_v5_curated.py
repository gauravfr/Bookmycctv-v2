from __future__ import annotations

import hashlib, json, shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
DATASETS=ROOT/"research"/"datasets"
KNIFE=DATASETS/"knife-training-v3"
SCISSORS=DATASETS/"openimages-train-scissors-neg-v2"
OUTPUT=DATASETS/"sharp-training-v5-curated"
MAX_KNIFE_BOX_AREA=.35

def split_for(image_id):
    value=int(hashlib.sha256(image_id.encode()).hexdigest()[:8],16)%100
    return "train" if value<70 else "validation" if value<85 else "test"

def write_item(source, labels, split, stem, provenance, manifest):
    image_target=OUTPUT/"images"/split/f"{stem}.jpg"; label_target=OUTPUT/"labels"/split/f"{stem}.txt"
    image_target.parent.mkdir(parents=True,exist_ok=True); label_target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,image_target); label_target.write_text("\n".join(labels)+( "\n" if labels else ""),encoding="utf-8")
    manifest.append({"id":stem,"split":split,"image":str(image_target.relative_to(OUTPUT)),"labels":labels,**provenance})

def main():
    if OUTPUT.exists(): raise FileExistsError(f"Refusing to overwrite {OUTPUT}")
    manifest=[]; excluded=[]
    knife_sources=json.loads((KNIFE/"source-manifest.json").read_text(encoding="utf-8"))
    for item in knife_sources:
        split=item["split"]; source=KNIFE/item["image"]; label=KNIFE/"labels"/split/f"{source.stem}.txt"
        if item["role"]=="positive":
            rows=[]
            for row in label.read_text(encoding="utf-8").splitlines():
                parts=row.split(); area=float(parts[3])*float(parts[4])
                if area<=MAX_KNIFE_BOX_AREA: rows.append(row)
            if not rows:
                excluded.append({"id":source.stem,"reason":"all_knife_boxes_exceed_area_gate","source":item}); continue
        else: rows=[]
        write_item(source,rows,split,source.stem,{"role":item["role"],"sourceDataset":"knife-training-v3","license":item.get("license")},manifest)
    scissors_manifest=json.loads((SCISSORS/"manifest.json").read_text(encoding="utf-8"))
    for item in scissors_manifest:
        split=split_for(item["imageId"]); rows=[]
        for box in item["boxes"]:
            width=box["xmax"]-box["xmin"]; height=box["ymax"]-box["ymin"]
            if width<=0 or height<=0: continue
            rows.append(f"1 {(box['xmin']+box['xmax'])/2:.8f} {(box['ymin']+box['ymax'])/2:.8f} {width:.8f} {height:.8f}")
        if rows: write_item(SCISSORS/item["image"],rows,split,"scissors-"+item["imageId"],
                            {"role":"positive","sourceDataset":"openimages-train-scissors-neg-v2","license":item["license"]},manifest)
    (OUTPUT/"data.yaml").write_text(f"path: {OUTPUT.as_posix()}\ntrain: images/train\nval: images/validation\ntest: images/test\nnames:\n  0: knife\n  1: scissors\n",encoding="utf-8")
    (OUTPUT/"manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    summary={"items":len(manifest),"excludedKnifeImages":len(excluded),"maxKnifeBoxArea":MAX_KNIFE_BOX_AREA,
             "bySplit":{s:sum(x["split"]==s for x in manifest) for s in ("train","validation","test")},
             "knifePositive":sum(x["role"]=="positive" and x["sourceDataset"]=="knife-training-v3" for x in manifest),
             "scissorsPositive":sum(x["sourceDataset"]=="openimages-train-scissors-neg-v2" for x in manifest),
             "hardNegative":sum(x["role"]=="hard_negative" for x in manifest),"excluded":excluded}
    (OUTPUT/"summary.json").write_text(json.dumps(summary,indent=2),encoding="utf-8"); print(json.dumps({k:v for k,v in summary.items() if k!="excluded"},indent=2))

if __name__=="__main__": main()
