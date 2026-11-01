/** Scoped styles for the Zotero workspace. System colors follow the host theme. */
export const CSS = `
.dz-app {
  --dz-bg: Canvas;
  --dz-fg: CanvasText;
  --dz-muted: color-mix(in srgb, CanvasText 55%, transparent);
  --dz-line: color-mix(in srgb, CanvasText 14%, transparent);
  --dz-soft: color-mix(in srgb, CanvasText 4%, Canvas);
  --dz-accent: #4d6bfe;
  --dz-warn: #c2410c;
  --dz-ok: #15803d;
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--dz-bg);
  color: var(--dz-fg);
  font: 13px/1.55 system-ui, -apple-system, "Segoe UI", "PingFang SC", sans-serif;
  overflow: hidden;
}
.dz-app * { box-sizing: border-box; }
.dz-col { display: flex; flex-direction: column; min-height: 0; position: relative; flex: 0 0 auto; }
.dz-rail { width: 34px; border-right: 1px solid var(--dz-line); display: flex; align-items: flex-start; justify-content: center; padding-top: 10px; }
.dz-resizer { width: 5px; cursor: col-resize; background: transparent; flex: 0 0 auto; margin-left: -3px; z-index: 3; }
.dz-resizer:hover { background: color-mix(in srgb, var(--dz-accent) 30%, transparent); }
.dz-iconbtn { border: 1px solid var(--dz-line); background: transparent; color: var(--dz-muted); border-radius: 6px; width: 24px; height: 24px; cursor: pointer; font-size: 12px; line-height: 1; }
.dz-iconbtn:hover { color: var(--dz-fg); border-color: var(--dz-accent); }
.dz-seg { display: inline-flex; border: 1px solid var(--dz-line); border-radius: 7px; overflow: hidden; }
.dz-seg button { border: 0; background: transparent; color: var(--dz-muted); padding: 3px 8px; font: inherit; font-size: 11px; cursor: pointer; }
.dz-seg button.active { background: color-mix(in srgb, var(--dz-accent) 16%, transparent); color: var(--dz-fg); font-weight: 600; }
.dz-seg button:disabled { opacity: .45; cursor: default; }
.dz-error { color: #b91c1c; background: color-mix(in srgb, #b91c1c 8%, transparent); border: 1px solid color-mix(in srgb, #b91c1c 35%, transparent); border-radius: 8px; padding: 8px 10px; font-size: 12px; }
.dz-foldhead { display: flex; align-items: center; gap: 6px; }
.dz-foldbtn { border: 0; background: transparent; color: var(--dz-muted); cursor: pointer; font-size: 11px; padding: 0; }
.dz-secnav { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.dz-secnav .dz-chip { cursor: pointer; background: transparent; }
.dz-note-status { font-size: 11px; color: var(--dz-muted); }
.dz-nav { width: 248px; min-width: 200px; border-right: 1px solid var(--dz-line); display: flex; flex-direction: column; min-height: 0; }
.dz-listpane { width: 320px; min-width: 240px; border-right: 1px solid var(--dz-line); display: flex; flex-direction: column; min-height: 0; }
.dz-detail { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.dz-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--dz-line); }
.dz-title { font-weight: 650; font-size: 13px; }
.dz-sub { color: var(--dz-muted); font-size: 11px; }
.dz-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dz-ok); }
.dz-dot.off { background: #b91c1c; }
.dz-scroll { overflow: auto; min-height: 0; flex: 1; }
.dz-pad { padding: 10px 12px; }
.dz-input, .dz-select, .dz-textarea {
  width: 100%; padding: 6px 8px; border-radius: 7px; border: 1px solid var(--dz-line);
  background: var(--dz-soft); color: var(--dz-fg); font: inherit; outline: none;
}
.dz-input:focus, .dz-textarea:focus, .dz-select:focus { border-color: var(--dz-accent); }
.dz-textarea { min-height: 160px; resize: vertical; line-height: 1.6; }
.dz-btn {
  padding: 5px 10px; border-radius: 7px; border: 1px solid var(--dz-line);
  background: var(--dz-soft); color: var(--dz-fg); font: inherit; cursor: pointer;
}
.dz-btn:hover { border-color: var(--dz-accent); }
.dz-btn:disabled { opacity: .45; cursor: default; }
.dz-btn.primary { background: var(--dz-accent); border-color: var(--dz-accent); color: #fff; }
.dz-btn.danger { color: #b91c1c; }
.dz-btn.small { padding: 2px 7px; font-size: 11px; }
.dz-row { display: flex; align-items: center; gap: 6px; }
.dz-wrap { flex-wrap: wrap; }
.dz-collection { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 7px; cursor: pointer; }
.dz-collection:hover { background: var(--dz-soft); }
.dz-collection.active { background: color-mix(in srgb, var(--dz-accent) 14%, transparent); }
.dz-count { margin-left: auto; color: var(--dz-muted); font-size: 11px; }
.dz-itemrow { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; border-bottom: 1px solid var(--dz-line); cursor: pointer; }
.dz-itemrow:hover { background: var(--dz-soft); }
.dz-itemrow.active { background: color-mix(in srgb, var(--dz-accent) 12%, transparent); }
.dz-itemrow .t { font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.dz-badges { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
.dz-badge { font-size: 10px; padding: 0 5px; border-radius: 999px; border: 1px solid var(--dz-line); color: var(--dz-muted); }
.dz-badge.blue { border-color: color-mix(in srgb, var(--dz-accent) 50%, transparent); color: var(--dz-accent); }
.dz-badge.warn { border-color: #f59e0b; color: var(--dz-warn); }
.dz-tabs { display: flex; gap: 2px; padding: 0 10px; border-bottom: 1px solid var(--dz-line); overflow-x: auto; }
.dz-tab { padding: 8px 10px; border: 0; background: transparent; color: var(--dz-muted); cursor: pointer; font: inherit; border-bottom: 2px solid transparent; white-space: nowrap; }
.dz-tab.active { color: var(--dz-fg); border-bottom-color: var(--dz-accent); font-weight: 600; }
.dz-section { border: 1px solid var(--dz-line); border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; background: var(--dz-soft); }
.dz-section h3 { margin: 0 0 6px; font-size: 12px; letter-spacing: .02em; color: var(--dz-muted); text-transform: uppercase; }
.dz-section p { margin: 0 0 6px; white-space: pre-wrap; }
.dz-evidence { border-left: 3px solid var(--dz-accent); padding: 6px 9px; margin: 6px 0; background: color-mix(in srgb, var(--dz-accent) 6%, transparent); border-radius: 0 8px 8px 0; cursor: pointer; }
.dz-evidence:hover { background: color-mix(in srgb, var(--dz-accent) 12%, transparent); }
.dz-evidence .q { font-size: 12px; font-style: italic; }
.dz-evidence .m { font-size: 11px; color: var(--dz-muted); margin-top: 2px; }
.dz-chip { font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--dz-line); }
.dz-chip.ok { color: var(--dz-ok); border-color: color-mix(in srgb, var(--dz-ok) 45%, transparent); }
.dz-chip.warn { color: var(--dz-warn); border-color: color-mix(in srgb, var(--dz-warn) 45%, transparent); }
.dz-overlay { position: fixed; inset: 0; z-index: 2147482000; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; }
.dz-modal { width: min(1100px, calc(100vw - 40px)); height: min(820px, calc(100vh - 60px)); background: var(--dz-bg); border-radius: 12px; border: 1px solid var(--dz-line); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.35); }
.dz-modal.small { width: min(720px, calc(100vw - 40px)); height: auto; max-height: calc(100vh - 80px); }
.dz-modal .dz-head { justify-content: space-between; }
.dz-viewer-body { display: flex; flex: 1; min-height: 0; }
.dz-viewer-img { flex: 1; overflow: auto; background: color-mix(in srgb, CanvasText 8%, Canvas); display: flex; align-items: flex-start; justify-content: center; padding: 12px; }
.dz-viewer-img img { max-width: 100%; box-shadow: 0 4px 18px rgba(0,0,0,.25); background: #fff; }
.dz-viewer-side { width: 360px; border-left: 1px solid var(--dz-line); display: flex; flex-direction: column; min-height: 0; }
.dz-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 2147483000; background: CanvasText; color: Canvas; padding: 8px 14px; border-radius: 9px; font-size: 12px; max-width: 70vw; }
.dz-empty { padding: 28px 16px; text-align: center; color: var(--dz-muted); }
.dz-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.dz-table th, .dz-table td { border: 1px solid var(--dz-line); padding: 6px 8px; vertical-align: top; text-align: left; }
.dz-table th { background: var(--dz-soft); position: sticky; top: 0; }
.dz-graph { width: 100%; height: 420px; background: var(--dz-soft); border-radius: 10px; }
.dz-note-status { font-size: 11px; color: var(--dz-muted); }
.dz-progress { font-size: 11px; color: var(--dz-muted); padding: 6px 12px; border-bottom: 1px solid var(--dz-line); }
.dz-spinner { display: inline-block; width: 10px; height: 10px; border: 2px solid var(--dz-line); border-top-color: var(--dz-accent); border-radius: 50%; animation: dz-spin .8s linear infinite; }
@keyframes dz-spin { to { transform: rotate(360deg); } }
.dz-split { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 980px) {
  .dz-listpane { display: none; }
  .dz-viewer-side { width: 280px; }
}
`
