// Docs page: the "delete my data" button asks twice instead of using confirm(),
// and only removes this app's own keys.
(function () {
  const btn = document.getElementById("resetAll");
  const msg = document.getElementById("resetMsg");
  if (!btn) return;
  let armed = false;
  btn.addEventListener("click", () => {
    if (!armed) {
      armed = true;
      btn.textContent = "Click again to delete everything";
      msg.textContent = "This cannot be undone.";
      return;
    }
    let n = 0;
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith("lens:")) { localStorage.removeItem(k); n++; }
      msg.textContent = n ? `Deleted ${n} saved item${n === 1 ? "" : "s"}.` : "Nothing was saved in this browser.";
    } catch {
      msg.textContent = "This browser blocks storage, so nothing was saved.";
    }
    armed = false;
    btn.textContent = "Delete all my code and progress in this browser";
  });
})();
