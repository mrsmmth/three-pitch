(() => {
  "use strict";

  const STORAGE_KEY = "three-pitch-state-v1";
  const NOTES = [
    ["C",0],["C♯",1],["D",2],["D♯",3],["E",4],["F",5],
    ["F♯",6],["G",7],["G♯",8],["A",9],["A♯",10],["B",11]
  ].map(([name,value]) => ({name,value}));
  const BASES = [["major","Major"],["minor","Minor"]].map(([id,label])=>({id,label}));
  const SHAPES = [["sus4","sus4"],["dim","Dim"],["aug","Aug"]].map(([id,label])=>({id,label}));
  const DECORATIONS = ["6","7","maj7","dim7","add9","9","11","13"].map(id=>({id,label:id}));
  const DEFAULT_STATE = {root:0,base:"major",shapes:[],decorations:[],melody:0};

  const $ = id => document.getElementById(id);
  const rootGrid=$("rootGrid"), baseGrid=$("baseGrid"), shapeGrid=$("shapeGrid"), decorationGrid=$("decorationGrid"), melodyGrid=$("melodyGrid");
  const chordName=$("chordName"), chordTones=$("chordTones"), upperResultNote=$("upperResultNote"), lowerResultNote=$("lowerResultNote"), maybeNotes=$("maybeNotes");

  let state = loadState();

  function loadState(){
    try{
      const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(!raw || typeof raw!=="object") return {...DEFAULT_STATE};
      return {
        root:Number.isInteger(raw.root)?((raw.root%12)+12)%12:0,
        base:raw.base==="minor"?"minor":"major",
        shapes:Array.isArray(raw.shapes)?raw.shapes.filter(id=>SHAPES.some(x=>x.id===id)):[],
        decorations:Array.isArray(raw.decorations)?raw.decorations.filter(id=>DECORATIONS.some(x=>x.id===id)):[],
        melody:Number.isInteger(raw.melody)?((raw.melody%12)+12)%12:0
      };
    }catch{return {...DEFAULT_STATE};}
  }

  function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
  function noteName(value){return NOTES[((value%12)+12)%12].name;}

  function makeButton(label,className,selected,onClick,aria){
    const el=document.createElement("button");
    el.type="button";
    el.className=className+(selected?" selected":"");
    el.textContent=label;
    el.setAttribute("aria-pressed",selected?"true":"false");
    if(aria) el.setAttribute("aria-label",aria);
    el.addEventListener("click",onClick);
    return el;
  }

  function renderSelectors(){
    rootGrid.innerHTML="";
    NOTES.forEach(note=>rootGrid.appendChild(makeButton(note.name,"note-button",state.root===note.value,()=>{state.root=note.value;update();},`コードのルート ${note.name}`)));

    baseGrid.innerHTML="";
    BASES.forEach(base=>baseGrid.appendChild(makeButton(base.label,"choice-button",state.base===base.id,()=>{state.base=base.id;update();})));

    shapeGrid.innerHTML="";
    SHAPES.forEach(shape=>shapeGrid.appendChild(makeButton(shape.label,"choice-button",state.shapes.includes(shape.id),()=>toggleShape(shape.id))));

    decorationGrid.innerHTML="";
    DECORATIONS.forEach(dec=>decorationGrid.appendChild(makeButton(dec.label,"decoration-button",state.decorations.includes(dec.id),()=>toggleDecoration(dec.id))));

    melodyGrid.innerHTML="";
    NOTES.forEach(note=>melodyGrid.appendChild(makeButton(note.name,"note-button",state.melody===note.value,()=>{state.melody=note.value;update();},`主旋律 ${note.name}`)));
  }

  function toggleShape(id){
    const selected=new Set(state.shapes);
    if(selected.has(id)) selected.delete(id);
    else{
      if(id==="dim") selected.delete("aug");
      if(id==="aug") selected.delete("dim");
      selected.add(id);
    }
    state.shapes=[...selected];
    update();
  }

  function toggleDecoration(id){
    const selected=new Set(state.decorations);
    if(selected.has(id)) selected.delete(id);
    else{
      if(["7","maj7","dim7"].includes(id)) ["7","maj7","dim7"].forEach(x=>selected.delete(x));
      selected.add(id);
    }
    state.decorations=[...selected];
    update();
  }

  function baseIntervals(){
    const sus4=state.shapes.includes("sus4");
    const dim=state.shapes.includes("dim");
    const aug=state.shapes.includes("aug");

    let third;
    if(sus4) third=5;
    else if(dim) third=3;
    else third=state.base==="minor"?3:4;

    let fifth=7;
    if(dim) fifth=6;
    if(aug) fifth=8;
    return [...new Set([0,third,fifth])];
  }

  function decorationIntervals(){
    const out=[];
    for(const id of state.decorations){
      if(id==="6") out.push(9);
      if(id==="7") out.push(10);
      if(id==="maj7") out.push(11);
      if(id==="dim7") out.push(9);
      if(id==="add9") out.push(2);
      if(id==="9") out.push(10,2);
      if(id==="11") out.push(10,2,5);
      if(id==="13") out.push(10,2,5,9);
    }
    return [...new Set(out)];
  }

  const toPitch=interval=>(state.root+interval)%12;
  const upwardDistance=(pitch,melody)=>(pitch-melody+12)%12;
  const downwardDistance=(pitch,melody)=>(melody-pitch+12)%12;

  function chooseDirectionalHarmony(triad,direction){
    const distance=direction==="up"?upwardDistance:downwardDistance;
    const candidates=triad
      .map(pitch=>({pitch,distance:distance(pitch,state.melody)}))
      .filter(item=>item.distance>0)
      .sort((a,b)=>a.distance-b.distance||a.pitch-b.pitch);
    return candidates[0]?.pitch??triad[0];
  }

  function buildChordLabel(){
    let label=noteName(state.root);
    const sus4=state.shapes.includes("sus4"),dim=state.shapes.includes("dim"),aug=state.shapes.includes("aug");
    if(dim&&!sus4) label+=state.base==="minor"?"m♭5":"dim";
    else if(aug&&!sus4) label+=state.base==="minor"?"m♯5":"aug";
    else{
      if(state.base==="minor") label+="m";
      if(sus4) label+="sus4";
      if(dim) label+="♭5";
      if(aug) label+="♯5";
    }
    ["6","7","maj7","dim7","add9","9","11","13"].forEach(id=>{if(state.decorations.includes(id)) label+=id;});
    return label;
  }

  function renderResult(){
    const triad=[...new Set(baseIntervals().map(toPitch))];
    const extras=[...new Set(decorationIntervals().map(toPitch))];
    const upper=chooseDirectionalHarmony(triad,"up");
    const lower=chooseDirectionalHarmony(triad,"down");
    const all=[...new Set([...triad,...extras])];
    const alternatives=all
      .filter(p=>p!==upper&&p!==lower)
      .sort((a,b)=>upwardDistance(a,state.root)-upwardDistance(b,state.root));

    chordName.textContent=buildChordLabel();
    chordTones.textContent=all.map(noteName).join(" · ");
    upperResultNote.textContent=noteName(upper);
    lowerResultNote.textContent=noteName(lower);
    maybeNotes.innerHTML="";
    if(!alternatives.length){
      const x=document.createElement("span");
      x.className="maybe-empty";
      x.textContent="—";
      maybeNotes.appendChild(x);
    }else{
      alternatives.forEach(p=>{
        const x=document.createElement("span");
        x.className="maybe-note";
        x.textContent=noteName(p);
        maybeNotes.appendChild(x);
      });
    }
  }

  function update(){saveState();renderSelectors();renderResult();}
  update();
})();
