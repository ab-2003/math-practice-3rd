// The grown-ups' door, at /parent/. Same shell, a different app: a read-only
// viewer of a rider's cloud copy or backup file. No PIN, no game, no shop.

import "./ui/styles.css";
import { el } from "./ui/dom";
import { bootParent } from "./ui/parent";
import { boxPush, installShell } from "./ui/shell";

installShell();

const root = document.getElementById("app");
if (root) {
  void bootParent(root).catch((err: unknown) => {
    boxPush(`PARENT BOOT FAILED ${String(err)}`);
    root.append(el("div", { class: "screen" },
      el("h2", { text: "Something went wrong starting up" }),
      el("p", { class: "note", text: String(err) })));
  });
}
