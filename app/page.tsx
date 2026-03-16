"use client";

import { useState, useRef, useEffect, Fragment } from "react";

interface Combination {
  indicator1: string; indicator2: string;
  signals_total: number; trades_actual: number; skipped: number;
  win: number; loss: number;
  success_rate: number | null; avg_return: number | null; is_top: boolean;
}
interface EquityPoint {
  date: string;
  strat_spy: number; strat_bond: number; buyhold: number; spy: number; bond: number;
  ticker_ret: number; spy_ret: number; pos_spy: string; pos_bond: string;
}
interface EquitySummary {
  strat_spy_final: number; strat_bond_final: number;
  buyhold_final: number; spy_final: number; bond_final: number;
  best_combo: string; signals_total: number; trades_actual: number; skipped: number;
}
interface AnalysisResult {
  ticker: string; holding_days: number; years: number;
  indicators: string[]; data_start: string; data_end: string;
  combinations: Combination[]; top3: Combination[];
  equity_curve: EquityPoint[]; equity_summary: EquitySummary;
}

const BG     = "#1a1a1a";
const BG2    = "#222222";
const BORDER = "#3d3d3d";
const TEXT1  = "#e8e8e8";
const TEXT2  = "#bbbbbb";
const TEXT3  = "#888888";
const ORANGE = "#ff8c00";
const CYAN   = "#00bcd4";
const GREEN  = "#4caf50";
const RED    = "#f44336";
const YELLOW = "#ffc107";

const CATEGORY_ORDER = ["Trend Following","Mean Reversion","Momentum","Volume","Volatility"];
const CAT_COLOR: Record<string,string> = {
  "Trend Following":"#5c9bd6","Mean Reversion":"#e8a838",
  "Momentum":"#6abf69","Volume":"#7986cb","Volatility":"#ef7070",
};
const LC = { strat_spy:"#ff8c00", strat_bond:"#00bcd4", buyhold:"#5c9bd6", spy:"#6abf69" };
const POS_BG: Record<string,string> = {
  entry:"#1a2e1a", ticker:"#162416", spy:"#1a1f2e", bond:"#1e1a2e", blocked:"#2e2010", "":"transparent",
};
const POS_LABEL: Record<string,string> = {
  entry:"ENTRY", ticker:"HOLD", spy:"SPY", bond:"BOND", blocked:"SKIP", "":"",
};
const POS_TC: Record<string,string> = {
  entry:ORANGE, ticker:GREEN, spy:CYAN, bond:"#9c88cc", blocked:YELLOW, "":TEXT3,
};

function cat(ind: string)  { return ind.match(/\((.+)\)/)?.[1] ?? "Other"; }
function short(ind: string){ return ind.replace(/ \(.*\)/, ""); }
function sign(n: number | null){ if(n===null) return "—"; return (n>0?"+":"")+n+"%"; }
function fmtD(n: number)   { return "$"+Math.round(n).toLocaleString("en-US"); }
function fmtGain(val: number){
  const g=val-10000, pct=((g/10000)*100).toFixed(1);
  return `${g>=0?"+":"-"}$${Math.round(Math.abs(g)).toLocaleString("en-US")} (${g>=0?"+":""}${pct}%)`;
}
function cellBg(r: number | null){
  if(r===null) return "#1a1a1a";
  if(r>=3)  return "#0a4a28"; if(r>=2) return "#0a3d20";
  if(r>=1)  return "#0d3018"; if(r>=0) return "#132210";
  if(r>=-1) return "#2e1a00"; if(r>=-2) return "#3d1010";
  return "#4d0808";
}
function cellTc(r: number | null){
  if(r===null) return "#666";
  if(r>=2)  return "#6ee89a"; if(r>=0) return "#5acc80";
  if(r>=-1) return "#e8a038"; return "#f07070";
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function EquityChart({ data, ticker }: { data: EquityPoint[]; ticker: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tipIdx, setTipIdx] = useState<number|null>(null);
  const [tipXY,  setTipXY]  = useState<{x:number;y:number}>({x:0,y:0});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const c = ref.current;
    if (!c || !data || data.length < 2) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const W=c.width, H=c.height;
    const P={t:16,r:16,b:40,l:88};
    const cW=W-P.l-P.r, cH=H-P.t-P.b;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle="#1e1e1e"; ctx.fillRect(0,0,W,H);

    const vals = data.flatMap(d=>[d.strat_spy,d.strat_bond,d.buyhold,d.spy]);
    const lo=Math.min(...vals)*0.98, hi=Math.max(...vals)*1.02;
    const n = data.length;
    const xS=(i:number)=>P.l+(i/(n-1))*cW;
    const yS=(v:number)=>P.t+cH-((v-lo)/(hi-lo))*cH;

    for(let g=0;g<=4;g++){
      const y=P.t+(g/4)*cH, v=hi-(g/4)*(hi-lo);
      ctx.strokeStyle=g===2?"#2e2e2e":"#242424"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(P.l,y); ctx.lineTo(P.l+cW,y); ctx.stroke();
      ctx.fillStyle=TEXT3; ctx.font="10px monospace"; ctx.textAlign="right";
      ctx.fillText(fmtD(v), P.l-6, y+3);
    }
    const y10=yS(10000);
    ctx.strokeStyle="#3a3a3a"; ctx.setLineDash([4,4]); ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(P.l,y10); ctx.lineTo(P.l+cW,y10); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle="#444"; ctx.font="9px monospace"; ctx.textAlign="right";
    ctx.fillText("$10,000", P.l-6, y10-3);

    const step=Math.max(1,Math.floor(n/10));
    ctx.fillStyle=TEXT3; ctx.font="9px monospace"; ctx.textAlign="center";
    for(let i=0;i<n;i+=step)
      ctx.fillText(data[i].date.slice(0,7), xS(i), P.t+cH+14);

    const drawLine=(key:keyof EquityPoint, color:string, lw:number)=>{
      ctx.strokeStyle=color; ctx.lineWidth=lw; ctx.lineJoin="round";
      ctx.beginPath();
      data.forEach((d,i)=>{
        const x=xS(i), y=yS(d[key] as number);
        i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      });
      ctx.stroke();
    };
    drawLine("spy",        LC.spy,       1.5);
    drawLine("buyhold",    LC.buyhold,   1.5);
    drawLine("strat_bond", LC.strat_bond,2);
    drawLine("strat_spy",  LC.strat_spy, 2.5);

    if(tipIdx!==null){
      const x=xS(tipIdx);
      ctx.strokeStyle="#444"; ctx.lineWidth=1; ctx.setLineDash([2,2]);
      ctx.beginPath(); ctx.moveTo(x,P.t); ctx.lineTo(x,P.t+cH); ctx.stroke();
      ctx.setLineDash([]);
      (["strat_spy","strat_bond","buyhold","spy"] as (keyof EquityPoint)[]).forEach(k=>{
        const col = k==="strat_spy"?LC.strat_spy:k==="strat_bond"?LC.strat_bond:k==="buyhold"?LC.buyhold:LC.spy;
        const y=yS(data[tipIdx][k] as number);
        ctx.fillStyle=col; ctx.strokeStyle=BG2; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2); ctx.fill(); ctx.stroke();
      });
    }
  }, [data, tipIdx, ticker]);

  const onMove=(e:React.MouseEvent<HTMLCanvasElement>)=>{
    if(!data||data.length<2) return;
    const c=ref.current; if(!c) return;
    const r=c.getBoundingClientRect();
    const mx=(e.clientX-r.left)*(c.width/r.width);
    const idx=Math.round(((mx-88)/(c.width-104))*(data.length-1));
    if(idx>=0&&idx<data.length){
      setTipIdx(idx);
      setTipXY({x:e.clientX-r.left, y:e.clientY-r.top});
    }
  };

  const pt = tipIdx!==null && data ? data[tipIdx] : null;

  return (
    <div style={{position:"relative"}}>
      <canvas ref={ref} width={1100} height={300}
        style={{width:"100%",height:"auto",display:"block"}}
        onMouseMove={onMove} onMouseLeave={()=>setTipIdx(null)}/>
      {pt&&(
        <div style={{position:"absolute",left:Math.min(tipXY.x+14,700),top:Math.max(tipXY.y-10,10),
          background:"#1a1a1a",border:`1px solid ${BORDER}`,borderRadius:4,
          padding:"10px 14px",fontSize:13,pointerEvents:"none",zIndex:100,
          minWidth:260,fontFamily:"monospace"}}>
          <div style={{color:ORANGE,marginBottom:8,fontSize:11,letterSpacing:1}}>{pt.date}</div>
          {([
            {k:"strat_spy"  as keyof EquityPoint, label:"STRAT A  (SPY idle)",  color:LC.strat_spy},
            {k:"strat_bond" as keyof EquityPoint, label:"STRAT B  (Bond idle)", color:LC.strat_bond},
            {k:"buyhold"    as keyof EquityPoint, label:`${ticker} B&H`,        color:LC.buyhold},
            {k:"spy"        as keyof EquityPoint, label:"SPY B&H",              color:LC.spy},
          ]).map(({k,label,color})=>{
            const v=pt[k] as number, g=v-10000;
            return (
              <div key={String(k)} style={{display:"flex",justifyContent:"space-between",gap:16,marginBottom:4}}>
                <span style={{color,minWidth:170,fontSize:12}}>{label}</span>
                <span style={{color:TEXT1,fontWeight:700}}>
                  {fmtD(v)}
                  <span style={{color:g>=0?GREEN:RED,fontSize:11,marginLeft:6}}>
                    {g>=0?"+":""}{((g/10000)*100).toFixed(1)}%
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Daily Table ───────────────────────────────────────────────────────────────

function DailyTable({ data, ticker }: { data: EquityPoint[]; ticker: string }) {
  if(!data||!data.length) return null;
  return (
    <div>
      <div style={{display:"flex",gap:14,marginBottom:12,flexWrap:"wrap"}}>
        {(["entry","ticker","spy","bond","blocked"] as const).map(p=>(
          <div key={p} style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:8,height:8,background:POS_BG[p],border:`1px solid ${BORDER}`,borderRadius:1}}/>
            <span style={{fontSize:12,color:POS_TC[p]}}>
              {p==="entry"?"Entry day":p==="ticker"?"Holding ticker":p==="spy"?"Idle → SPY":p==="bond"?"Idle → Bond":"Signal skipped"}
            </span>
          </div>
        ))}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{borderCollapse:"collapse",fontSize:14,width:"100%",fontFamily:"monospace"}}>
          <thead>
            <tr style={{background:"#1e1e1e",borderBottom:`2px solid ${BORDER}`}}>
              {["DATE","STRAT A","STRAT B",`${ticker} B&H`,"SPY B&H","US BOND","POS A","POS B",`${ticker} RET`,"SPY RET"].map((h,hi)=>(
                <th key={h} style={{padding:"7px 10px",
                  textAlign:hi===0?"left":hi>=6&&hi<=7?"center":"right",
                  fontSize:11,letterSpacing:1.5,color:TEXT3,fontWeight:400,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row,ri)=>{
              const prev=ri>0?data[ri-1]:null;
              return (
                <tr key={row.date} style={{borderBottom:"1px solid #1e1e1e",background:ri%2===0?BG2:"#202020"}}>
                  <td style={{padding:"6px 10px",color:TEXT3,whiteSpace:"nowrap"}}>{row.date}</td>
                  <td style={{padding:"6px 10px",textAlign:"right",fontWeight:700,
                    color:ri===0?TEXT2:row.strat_spy>=(prev?.strat_spy??0)?GREEN:RED}}>{fmtD(row.strat_spy)}</td>
                  <td style={{padding:"6px 10px",textAlign:"right",fontWeight:700,
                    color:ri===0?TEXT2:row.strat_bond>=(prev?.strat_bond??0)?CYAN:RED}}>{fmtD(row.strat_bond)}</td>
                  <td style={{padding:"6px 10px",textAlign:"right",
                    color:ri===0?TEXT2:row.buyhold>=(prev?.buyhold??0)?GREEN:RED}}>{fmtD(row.buyhold)}</td>
                  <td style={{padding:"6px 10px",textAlign:"right",
                    color:ri===0?TEXT2:row.spy>=(prev?.spy??0)?GREEN:RED}}>{fmtD(row.spy)}</td>
                  <td style={{padding:"6px 10px",textAlign:"right",color:TEXT3}}>{fmtD(row.bond)}</td>
                  <td style={{padding:"6px 10px",textAlign:"center"}}>
                    {row.pos_spy?(
                      <span style={{background:POS_BG[row.pos_spy]||"transparent",
                        color:POS_TC[row.pos_spy]||TEXT3,borderRadius:2,padding:"1px 6px",
                        fontSize:11,display:"inline-block",minWidth:42,textAlign:"center",
                        border:`1px solid ${BORDER}`}}>
                        {POS_LABEL[row.pos_spy]||""}
                      </span>
                    ):null}
                  </td>
                  <td style={{padding:"6px 10px",textAlign:"center"}}>
                    {row.pos_bond?(
                      <span style={{background:POS_BG[row.pos_bond]||"transparent",
                        color:POS_TC[row.pos_bond]||TEXT3,borderRadius:2,padding:"1px 6px",
                        fontSize:11,display:"inline-block",minWidth:42,textAlign:"center",
                        border:`1px solid ${BORDER}`}}>
                        {POS_LABEL[row.pos_bond]||""}
                      </span>
                    ):null}
                  </td>
                  <td style={{padding:"6px 10px",textAlign:"right",fontSize:12,
                    color:row.ticker_ret>=0?GREEN:RED}}>{row.ticker_ret>=0?"+":""}{row.ticker_ret}%</td>
                  <td style={{padding:"6px 10px",textAlign:"right",fontSize:12,
                    color:row.spy_ret>=0?GREEN:RED}}>{row.spy_ret>=0?"+":""}{row.spy_ret}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{marginTop:40}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,
        borderBottom:`1px solid ${BORDER}`,paddingBottom:8}}>
        <span style={{fontSize:12,letterSpacing:2,textTransform:"uppercase",
          color:ORANGE,fontFamily:"monospace"}}>{title}</span>
        <div style={{flex:1,height:1,background:BORDER}}/>
      </div>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [ticker,      setTicker]      = useState("IBM");
  const [holdingDays, setHoldingDays] = useState(5);
  const [years,       setYears]       = useState(2);
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState<AnalysisResult|null>(null);
  const [error,       setError]       = useState<string|null>(null);

  const analyze = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("https://indicatorcombo-production.up.railway.app/api/analyze", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ticker:ticker.toUpperCase(),holding_days:holdingDays,years}),
      });
      if(!res.ok){ const e=await res.json(); throw new Error(e.detail||"Analysis failed"); }
      setResult(await res.json());
    } catch(e:unknown){
      setError(e instanceof Error?e.message:"Unknown error");
    } finally { setLoading(false); }
  };

  const comboMap = new Map<string,Combination>();
  if(result){
    result.combinations.forEach(c=>{
      comboMap.set(`${c.indicator1}||${c.indicator2}`,c);
      comboMap.set(`${c.indicator2}||${c.indicator1}`,c);
    });
  }

  const sorted = result
    ? [...result.indicators].sort((a,b)=>CATEGORY_ORDER.indexOf(cat(a))-CATEGORY_ORDER.indexOf(cat(b)))
    : [];

  const grouped: Record<string,string[]> = {};
  sorted.forEach(ind=>{ const c=cat(ind); if(!grouped[c]) grouped[c]=[]; grouped[c].push(ind); });

  const rowInds = sorted.length>1 ? sorted.slice(1) : [];
  const colInds = sorted.length>1 ? sorted.slice(0,-1) : [];

  const top5 = result
    ? [...result.combinations]
        .filter(c=>c.avg_return!==null&&c.trades_actual>0)
        .sort((a,b)=>(b.avg_return??-999)-(a.avg_return??-999))
        .slice(0,5)
    : [];

  return (
    <main style={{minHeight:"100vh",background:BG,color:TEXT1,
      fontFamily:"monospace",padding:"28px 28px 60px"}}>
      <style>{`
        *{box-sizing:border-box;}
        input:focus{outline:1px solid ${ORANGE};}
        ::-webkit-scrollbar{height:4px;width:4px;background:${BG};}
        ::-webkit-scrollbar-thumb{background:#444;border-radius:2px;}
        td.cell:hover{filter:brightness(1.5);cursor:pointer;}
        button:hover:not(:disabled){background:#ff8c0022!important;}
      `}</style>
      <div style={{maxWidth:1600,margin:"0 auto"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",
          marginBottom:24,borderBottom:`1px solid ${BORDER}`,paddingBottom:14}}>
          <div>
            <span style={{fontSize:20,fontWeight:700,color:TEXT1,letterSpacing:1}}>INDICATOR COMBO ANALYZER</span>
            <span style={{fontSize:13,color:TEXT3,marginLeft:12,letterSpacing:2}}>BACKTEST SYSTEM</span>
          </div>
          <span style={{fontSize:11,color:TEXT3}}>{new Date().toISOString().slice(0,10)}</span>
        </div>

        {/* Controls */}
        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end",
          marginBottom:28,background:BG2,padding:"16px 20px",border:`1px solid ${BORDER}`}}>
          {([
            {label:"TICKER",        value:ticker,      setter:(v:string)=>setTicker(v),              type:"text",   w:90},
            {label:"HOLDING (days)",value:holdingDays, setter:(v:string)=>setHoldingDays(Number(v)), type:"number", w:110},
            {label:"LOOKBACK (yrs)",value:years,       setter:(v:string)=>setYears(Number(v)),       type:"number", w:100},
          ] as {label:string;value:string|number;setter:(v:string)=>void;type:string;w:number}[]).map(({label,value,setter,type,w})=>(
            <div key={label}>
              <div style={{fontSize:11,color:TEXT3,marginBottom:4,letterSpacing:1.5}}>{label}</div>
              <input type={type} value={value} onChange={e=>setter(e.target.value)}
                style={{background:"#111",border:`1px solid ${BORDER}`,color:TEXT1,
                  padding:"7px 10px",fontSize:15,width:w,fontFamily:"monospace",fontWeight:700}}/>
            </div>
          ))}
          <button onClick={analyze} disabled={loading} style={{
            background:"transparent",color:loading?TEXT3:ORANGE,
            border:`1px solid ${loading?BORDER:ORANGE}`,
            padding:"6px 22px",fontSize:14,fontFamily:"monospace",
            fontWeight:700,cursor:loading?"not-allowed":"pointer",
            letterSpacing:1,textTransform:"uppercase"}}>
            {loading?"LOADING...":"RUN  ▶"}
          </button>
        </div>

        {error&&(
          <div style={{background:"#200",border:"1px solid #500",
            padding:"10px 14px",color:RED,marginBottom:20,fontSize:13}}>
            ERROR: {error}
          </div>
        )}
        {loading&&(
          <div style={{textAlign:"center",padding:60,color:TEXT3}}>
            <div style={{fontSize:14,letterSpacing:3}}>COMPUTING INDICATORS...</div>
            <div style={{marginTop:12,fontSize:11,color:TEXT3}}>30–60 seconds</div>
          </div>
        )}

        {result&&!loading&&(
          <div>
            {/* Meta bar */}
            <div style={{display:"flex",gap:2,marginBottom:24,flexWrap:"wrap"}}>
              {([
                {k:"SYMBOL",  v:result.ticker,                                  c:ORANGE},
                {k:"PERIOD",  v:`${result.data_start} → ${result.data_end}`,    c:TEXT1},
                {k:"HOLDING", v:`${result.holding_days}D`,                       c:TEXT1},
                {k:"DAYS",    v:`${result.equity_curve.length}`,                 c:TEXT1},
              ]).map(({k,v,c},i)=>(
                <div key={k} style={{background:BG2,border:`1px solid ${BORDER}`,
                  padding:"5px 14px",display:"flex",gap:8,alignItems:"center",
                  borderLeft:i===0?`2px solid ${ORANGE}`:`1px solid ${BORDER}`}}>
                  <span style={{fontSize:11,color:TEXT3,letterSpacing:1.5}}>{k}</span>
                  <span style={{fontSize:14,color:c,fontWeight:700}}>{v}</span>
                </div>
              ))}
            </div>

            {/* Top 3 */}
            <Section title="TOP COMBINATIONS">
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {result.top3.map((t,i)=>(
                  <div key={i} style={{background:BG2,border:`1px solid ${BORDER}`,
                    borderTop:`2px solid ${i===0?ORANGE:i===1?"#888":"#664422"}`,
                    padding:"14px 18px",minWidth:260,flex:1}}>
                    <div style={{fontSize:11,color:TEXT3,letterSpacing:1,marginBottom:8}}>
                      {["#1  BEST","#2","#3"][i]}
                    </div>
                    <div style={{fontSize:15,marginBottom:12,color:TEXT1}}>
                      <span style={{color:CAT_COLOR[cat(t.indicator1)]||TEXT1,fontWeight:700}}>{short(t.indicator1)}</span>
                      <span style={{color:TEXT3,margin:"0 6px"}}>+</span>
                      <span style={{color:CAT_COLOR[cat(t.indicator2)]||TEXT1,fontWeight:700}}>{short(t.indicator2)}</span>
                    </div>
                    <div style={{display:"flex",gap:0,borderTop:`1px solid ${BORDER}`,paddingTop:10}}>
                      {([
                        {label:"WIN RATE", val:`${t.success_rate}%`,  color:t.success_rate&&t.success_rate>=60?GREEN:TEXT1},
                        {label:"AVG RET",  val:sign(t.avg_return),    color:(t.avg_return??0)>=0?GREEN:RED},
                        {label:"SIGNALS",  val:`${t.signals_total}`,  color:TEXT2},
                        {label:"EXECUTED", val:`${t.trades_actual}`,  color:CYAN},
                        {label:"SKIPPED",  val:`${t.skipped}`,        color:TEXT3},
                      ]).map(({label,val,color},j)=>(
                        <div key={label} style={{flex:1,paddingRight:8,
                          borderLeft:j>0?`1px solid ${BORDER}`:"none",paddingLeft:j>0?8:0}}>
                          <div style={{fontSize:11,color:TEXT3,letterSpacing:1,marginBottom:3}}>{label}</div>
                          <div style={{fontSize:15,fontWeight:700,color}}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Heatmap */}
            <Section title="SIGNAL HEATMAP — WIN RATE / AVG RETURN">
              <div style={{display:"flex",gap:16,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                {CATEGORY_ORDER.map(c=>grouped[c]?(
                  <div key={c} style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:8,height:8,background:CAT_COLOR[c]||TEXT3}}/>
                    <span style={{fontSize:12,color:TEXT3}}>{c} ({grouped[c].length})</span>
                  </div>
                ):null)}
                <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                  {([
                    {bg:"#4d0808",label:"<-2%"},{bg:"#3d1010",label:"-2~-1%"},
                    {bg:"#2e1a00",label:"-1~0%"},{bg:"#132210",label:"0~1%"},
                    {bg:"#0d3018",label:"1~2%"},{bg:"#0a3d20",label:"2~3%"},{bg:"#0a4a28",label:">3%"},
                  ]).map(l=>(
                    <div key={l.label} style={{display:"flex",alignItems:"center",gap:3}}>
                      <div style={{width:10,height:10,background:l.bg,border:`1px solid ${BORDER}`}}/>
                      <span style={{fontSize:11,color:TEXT3}}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{overflowX:"auto",overflowY:"auto",maxHeight:"70vh",border:`1px solid ${BORDER}`}}>
                <table style={{borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{background:"#1e1e1e"}}>
                      <th style={{minWidth:130,position:"sticky",left:0,background:"#1e1e1e",
                        zIndex:20,borderRight:`1px solid ${BORDER}`}}/>
                      {colInds.map(ind=>(
                        <th key={ind} title={ind} style={{
                          writingMode:"vertical-lr",transform:"rotate(180deg)",
                          padding:"10px 2px",fontWeight:400,fontSize:10,
                          width:58,minWidth:58,whiteSpace:"nowrap",
                          color:CAT_COLOR[cat(ind)]||TEXT3,letterSpacing:0.5,
                          borderBottom:`1px solid ${CAT_COLOR[cat(ind)]||TEXT3}66`}}>
                          {short(ind)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowInds.map((rowInd,ri)=>{
                      const rc=cat(rowInd);
                      const isNew=ri===0||cat(rowInds[ri-1])!==rc;
                      return (
                        <Fragment key={rowInd}>
                          {isNew&&(
                            <tr>
                              <td colSpan={colInds.length+1} style={{padding:"5px 10px 3px",fontSize:11,
                                letterSpacing:1,textTransform:"uppercase",
                                color:CAT_COLOR[rc]||TEXT3,
                                borderTop:`1px solid ${BORDER}`,background:"#1c1c1c"}}>
                                {rc}
                              </td>
                            </tr>
                          )}
                          <tr style={{borderBottom:"1px solid #1e1e1e"}}>
                            <td title={rowInd} style={{color:CAT_COLOR[rc]||TEXT3,fontSize:11,
                              padding:"0 12px 0 10px",whiteSpace:"nowrap",fontWeight:400,
                              position:"sticky",left:0,background:BG,zIndex:10,
                              borderRight:`1px solid ${BORDER}`,height:48}}>
                              {short(rowInd)}
                            </td>
                            {colInds.map(colInd=>{
                              const combo=comboMap.get(`${colInd}||${rowInd}`);
                              const isLower=sorted.indexOf(rowInd)>sorted.indexOf(colInd);
                              if(!isLower||!combo||combo.avg_return===null)
                                return <td key={colInd} style={{width:58,background:BG,borderRight:"1px solid #1e1e1e"}}/>;
                              const r=combo.avg_return;
                              const winColor=(combo.success_rate??0)>=60?GREEN:(combo.success_rate??0)>=50?YELLOW:RED;
                              return (
                                <td key={colInd} className="cell"
                                  title={`${short(colInd)} + ${short(rowInd)}\nWin:${combo.success_rate}%  Ret:${sign(r)}\nSig:${combo.signals_total} Trades:${combo.trades_actual} Skip:${combo.skipped}\nW:${combo.win} L:${combo.loss}`}
                                  style={{width:58,height:48,background:cellBg(r),
                                    border:combo.is_top?`1px solid ${ORANGE}`:"1px solid #252525",
                                    textAlign:"center",verticalAlign:"middle",
                                    boxShadow:combo.is_top?`inset 0 0 8px ${ORANGE}44`:"none",
                                    transition:"filter 0.1s"}}>
                                  <div style={{fontSize:11,fontWeight:700,color:winColor,lineHeight:1.4}}>{combo.success_rate}%</div>
                                  <div style={{fontSize:10,color:cellTc(r),lineHeight:1.4}}>{sign(r)}</div>
                                </td>
                              );
                            })}
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Top 5 */}
            <Section title="TOP 5 — DETAILED BREAKDOWN">
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:14,fontFamily:"monospace"}}>
                <thead>
                  <tr style={{background:"#1e1e1e",borderBottom:`1px solid ${BORDER}`}}>
                    {["#","INDICATOR 1","INDICATOR 2","WIN RATE",`AVG (${result.holding_days}D)`,
                      "SIGNALS","TRADES","SKIP","W","L","W/L"].map(h=>(
                      <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:11,
                        letterSpacing:1.5,color:TEXT3,fontWeight:400}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {top5.map((c,i)=>(
                    <tr key={i} style={{borderBottom:"1px solid #1e1e1e",
                      background:i%2===0?BG2:"#202020",
                      borderLeft:i===0?`2px solid ${ORANGE}`:"none"}}>
                      <td style={{padding:"10px 12px",color:i===0?ORANGE:TEXT3}}>{i+1}</td>
                      <td style={{padding:"10px 12px"}}>
                        <span style={{color:CAT_COLOR[cat(c.indicator1)]||TEXT1,fontWeight:700}}>{short(c.indicator1)}</span>
                        <div style={{fontSize:11,color:TEXT3,marginTop:1}}>{cat(c.indicator1)}</div>
                      </td>
                      <td style={{padding:"10px 12px"}}>
                        <span style={{color:CAT_COLOR[cat(c.indicator2)]||TEXT1,fontWeight:700}}>{short(c.indicator2)}</span>
                        <div style={{fontSize:11,color:TEXT3,marginTop:1}}>{cat(c.indicator2)}</div>
                      </td>
                      <td style={{padding:"10px 12px"}}>
                        <span style={{color:(c.success_rate??0)>=60?GREEN:(c.success_rate??0)>=50?YELLOW:RED,
                          fontWeight:700,fontSize:15}}>{c.success_rate}%</span>
                      </td>
                      <td style={{padding:"10px 12px",fontWeight:700,fontSize:15,
                        color:(c.avg_return??0)>=0?GREEN:RED}}>{sign(c.avg_return)}</td>
                      <td style={{padding:"10px 12px",color:TEXT3}}>{c.signals_total}</td>
                      <td style={{padding:"10px 12px",color:CYAN,fontWeight:700}}>{c.trades_actual}</td>
                      <td style={{padding:"10px 12px",color:TEXT3}}>{c.skipped}</td>
                      <td style={{padding:"10px 12px",color:GREEN}}>{c.win}</td>
                      <td style={{padding:"10px 12px",color:RED}}>{c.loss}</td>
                      <td style={{padding:"10px 12px",color:TEXT2}}>{c.loss>0?(c.win/c.loss).toFixed(2):"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* Equity Chart */}
            <Section title="PERFORMANCE COMPARISON — $10,000 BASE CAPITAL">
              <div style={{fontSize:13,color:TEXT3,marginBottom:4}}>
                BEST COMBO: <span style={{color:ORANGE}}>{result.equity_summary.best_combo}</span>
                <span style={{color:TEXT3,marginLeft:20,fontSize:11}}>
                  {result.equity_summary.signals_total} SIGNALS · {result.equity_summary.trades_actual} EXECUTED · {result.equity_summary.skipped} SKIPPED
                </span>
              </div>
              <div style={{fontSize:13,color:TEXT3,marginBottom:20}}>
                STRAT A: signal→{result.ticker}, idle→SPY &nbsp;|&nbsp; STRAT B: signal→{result.ticker}, idle→Bond 4.5%
              </div>
              <div style={{display:"flex",gap:0,marginBottom:16,border:`1px solid ${BORDER}`}}>
                {([
                  {label:"STRAT A  (idle→SPY)",  val:result.equity_summary.strat_spy_final,  color:LC.strat_spy},
                  {label:"STRAT B  (idle→Bond)", val:result.equity_summary.strat_bond_final, color:LC.strat_bond},
                  {label:`${result.ticker}  B&H`, val:result.equity_summary.buyhold_final,   color:LC.buyhold},
                  {label:"SPY  B&H",              val:result.equity_summary.spy_final,        color:LC.spy},
                ] as {label:string;val:number;color:string}[]).map(({label,val,color},i)=>{
                  const g=val-10000;
                  return (
                    <div key={label} style={{flex:1,background:BG2,padding:"14px 16px",
                      borderLeft:i>0?`1px solid ${BORDER}`:"none",borderTop:`2px solid ${color}`}}>
                      <div style={{fontSize:11,color:TEXT3,letterSpacing:1.5,marginBottom:6}}>{label}</div>
                      <div style={{fontSize:20,fontWeight:700,color,marginBottom:4,fontFamily:"monospace"}}>{fmtD(val)}</div>
                      <div style={{fontSize:13,color:g>=0?GREEN:RED}}>{fmtGain(val)}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{background:"#1e1e1e",border:`1px solid ${BORDER}`,padding:"12px 8px 4px"}}>
                <div style={{display:"flex",gap:20,marginBottom:10,paddingLeft:88}}>
                  {([
                    {color:LC.strat_spy,  label:"STRAT A", lw:2.5},
                    {color:LC.strat_bond, label:"STRAT B", lw:2},
                    {color:LC.buyhold,    label:`${result.ticker} B&H`, lw:1.5},
                    {color:LC.spy,        label:"SPY B&H", lw:1.5},
                  ]).map(({color,label,lw})=>(
                    <div key={label} style={{display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:18,height:lw,background:color}}/>
                      <span style={{fontSize:11,color:TEXT3,letterSpacing:1}}>{label}</span>
                    </div>
                  ))}
                </div>
                <EquityChart data={result.equity_curve} ticker={result.ticker}/>
              </div>
            </Section>

            {/* Daily Table */}
            <Section title={`DAILY VALUATIONS — ${result.equity_curve.length} TRADING DAYS`}>
              <DailyTable data={result.equity_curve} ticker={result.ticker}/>
            </Section>
          </div>
        )}
      </div>
    </main>
  );
}
