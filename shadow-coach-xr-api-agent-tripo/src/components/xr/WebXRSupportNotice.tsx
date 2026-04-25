"use client";

type WebXRSupportNoticeProps = {
  supportMessage: string;
  vrSupported: boolean;
  arSupported: boolean;
  sessionError: string | null;
};

export default function WebXRSupportNotice({
  supportMessage,
  vrSupported,
  arSupported,
  sessionError,
}: WebXRSupportNoticeProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/72 p-5 backdrop-blur-xl">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
        WebXR Support
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-200">{supportMessage}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em]">
        <span
          className={`rounded-full border px-3 py-1 ${
            vrSupported
              ? "border-emerald-400/20 bg-emerald-400/12 text-emerald-100"
              : "border-amber-400/20 bg-amber-400/12 text-amber-100"
          }`}
        >
          VR {vrSupported ? "available" : "unavailable"}
        </span>
        <span
          className={`rounded-full border px-3 py-1 ${
            arSupported
              ? "border-sky-400/20 bg-sky-400/12 text-sky-100"
              : "border-white/12 bg-white/6 text-slate-300"
          }`}
        >
          AR {arSupported ? "available" : "not detected"}
        </span>
      </div>
      {sessionError ? (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {sessionError}
        </div>
      ) : null}
    </section>
  );
}
