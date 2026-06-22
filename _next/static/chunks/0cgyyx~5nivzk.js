(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,47023,e=>{"use strict";var r=e.i(71645);let t="https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.9.9/build/opensheetmusicdisplay.min.js",n=null;e.s(["default",0,function({song:e,containerRef:i,onReady:o,onError:s}){return(0,r.useEffect)(()=>{if(!i.current)return;let r=!1,a=null;return(async()=>{try{let s=await fetch(`/api/musicxml/${e.id}`);if(r)return;if(404===s.status){let r;i.current&&(i.current.innerHTML=(r=e.id,`
  <div style="padding:16px 20px;font-family:system-ui,sans-serif;color:#92400e;
       background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;line-height:1.6">
    <strong>MusicXML not yet generated for this song.</strong><br/>
    To render with OSMD, generate the file first:<br/>
    <code style="display:inline-block;margin-top:6px;padding:4px 8px;background:#fef3c7;
          border-radius:4px;font-size:12px">
      python scripts/scrape_musicxml.py --generate --id ${r}
    </code><br/>
    <span style="margin-top:6px;display:inline-block;color:#78350f;font-size:11px">
      Or run <code>--generate-all</code> to generate for every song at once.
    </span>
  </div>
`)),o();return}if(!s.ok)throw Error(`Failed to load MusicXML: HTTP ${s.status}`);let d=await s.text();if(r)return;await (n||(n=new Promise((e,r)=>{if(window.opensheetmusicdisplay?.OpenSheetMusicDisplay)return void e();let n=document.querySelector(`script[src="${t}"]`);if(n){n.addEventListener("load",()=>e()),window.opensheetmusicdisplay?.OpenSheetMusicDisplay&&e();return}let i=document.createElement("script");i.src=t,i.async=!0,i.onload=()=>e(),i.onerror=()=>r(Error("Failed to load OSMD from CDN")),document.head.appendChild(i)})));let{OpenSheetMusicDisplay:c}=window.opensheetmusicdisplay;if(r||!i.current||(a=new c(i.current,{autoResize:!0,backend:"svg",drawTitle:!0,drawComposer:!1,drawCredits:!1,drawLyrics:!0,drawMetronomeMarks:!1,followCursor:!1}),await a.load(d),r))return;a.render(),r||o()}catch(e){r||(console.error("[OsmdRenderer] render error:",e),s(e instanceof Error?e.message:String(e)))}})(),()=>{r=!0;try{a?.clear()}catch{}i.current&&(i.current.innerHTML="")}},[e,i,o,s]),null}])}]);