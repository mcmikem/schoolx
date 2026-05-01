export function smoothScroll(id: string) {
  try {
    const el = document.querySelector(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      const target = id.replace("#", "");
      const targetEl = document.getElementById(target);
      if (targetEl)
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (e) {
    console.error("Scroll error:", e);
  }
}
