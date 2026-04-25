"use client";

export default function XRControlsHelp() {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/72 p-5 backdrop-blur-xl">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
        Controls & Testing
      </div>
      <div className="mt-3 space-y-3 text-sm leading-7 text-slate-200">
        <p>
          Desktop preview uses Orbit controls so teammates can inspect the scene
          without a headset. Drag to orbit and use the mode buttons to preview
          manual, replay, and autonomous visualization states.
        </p>
        <p>
          For headset testing, deploy over HTTPS and open the page in a WebXR
          compatible browser such as Quest Browser, then choose <span className="font-medium text-white">Enter VR</span>.
        </p>
        <p className="text-slate-300">
          Voice prompt generation stays in the isolated <span className="font-medium text-white">/tripo</span> debug page. WebXR only consumes asset URLs and mock episode data here.
        </p>
      </div>
    </section>
  );
}
