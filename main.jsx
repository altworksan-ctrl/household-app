:root {
  --paper: #eae7dc;
  --card: #fbfaf6;
  --stub: #fffdf7;
  --ink: #23281f;
  --ink-soft: #6b6f60;
  --line: #dad6c8;
  --mustard: #d6a419;
  --rust: #bd4c2e;
  --rust-tint: #f5e2dc;
  --moss: #4b6b4e;
  --moss-tint: #e1e9df;
  --denim: #3e5c76;
  --denim-tint: #dfe6ec;
}

* {
  font-family: "Inter", sans-serif;
  box-sizing: border-box;
}

.font-display {
  font-family: "Space Grotesk", sans-serif;
}

.font-mono {
  font-family: "JetBrains Mono", monospace;
  font-variant-numeric: tabular-nums;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
}

input,
select {
  font-family: "Inter", sans-serif;
  color: var(--ink);
  background: var(--card);
}

button {
  -webkit-tap-highlight-color: transparent;
  font-family: inherit;
}

.stub-perf {
  height: 12px;
  background-image: radial-gradient(circle at 6px 6px, var(--paper) 3.5px, transparent 4px);
  background-size: 12px 12px;
  background-position: left top;
}

::selection {
  background: var(--mustard);
  color: white;
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
