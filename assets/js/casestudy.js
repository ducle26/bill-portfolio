/* Shared by the case study pages.
   One button opens or closes every folded code block.
   Visitors who picked "Classmate or professor" on the home page get the code open from the start. */
(function () {
  var btn = document.getElementById("code-toggle");
  var folds = Array.prototype.slice.call(document.querySelectorAll("details.code-fold"));
  if (!btn) return;
  if (!folds.length) { btn.hidden = true; return; }

  function setAll(open) {
    folds.forEach(function (d) { d.open = open; });
    btn.textContent = open ? "Hide all code" : "Show all code";
    btn.setAttribute("aria-pressed", open ? "true" : "false");
  }
  btn.addEventListener("click", function () {
    setAll(btn.getAttribute("aria-pressed") !== "true");
  });

  var visitor = null;
  try { visitor = sessionStorage.getItem("bl-visitor"); } catch (e) {}
  if (visitor === "classmate") setAll(true);
})();
