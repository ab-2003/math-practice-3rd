type Attrs = Record<string, string | number | boolean | undefined>;
type Child = Node | string | null | undefined | false;

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Attrs = {}, ...kids: Child[]
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === "text") node.textContent = String(v);
    else if (k === "html") node.innerHTML = String(v);
    else node.setAttribute(k, String(v));
  }
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
};

/** Inline SVG helper. Creatures and charts are drawn, never fetched. */
export const svg = (tag: string, attrs: Attrs = {}, ...kids: Child[]): SVGElement => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    node.setAttribute(k, String(v));
  }
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
};

export const on = <K extends keyof HTMLElementEventMap>(
  node: EventTarget, ev: K, fn: (e: HTMLElementEventMap[K]) => void,
): void => node.addEventListener(ev, fn as EventListener);

export const clear = (node: Element): void => {
  while (node.firstChild) node.removeChild(node.firstChild);
};

export const mount = (root: Element, ...kids: Child[]): void => {
  clear(root);
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    root.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
};
