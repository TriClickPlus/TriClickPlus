/*
 * TriClick (c) 2026 TriClick. MIT License, see LICENSE.
 * File: theme-init.js
 * Contact: chromedeveloper1@gmail.com
 * Build ID: 98c76752-c731-4cf8-b7a4-b81f0646db2e
 * Sets the saved theme before the first paint so the popup never flashes the wrong colors.
 */
(function () {
  var root = document.documentElement;
  var t = null;
  try {
    t = localStorage.getItem("tc_theme");
  } catch (e) {}
  if (t !== "dark" && t !== "light") t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  root.dataset.theme = t;
  root.classList.add("pending", "boot");
  setTimeout(function () {
    root.classList.remove("pending");
  }, 500);
})();
