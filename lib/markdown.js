(function () {
  "use strict";

  var blockedTags = new Set([
    "base",
    "embed",
    "form",
    "iframe",
    "link",
    "meta",
    "object",
    "script",
    "style"
  ]);
  var urlAttrs = new Set(["href", "src", "cite", "poster", "xlink:href"]);

  function isSafeUrl(url, imageMode) {
    var trimmed = String(url || "").trim().replace(/[\u0000-\u001f\u007f\s]+/g, "");
    var lower = trimmed.toLowerCase();

    if (!trimmed) return false;
    if (imageMode && lower.indexOf("data:image/") === 0) return true;
    if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return true;
    if (/^(javascript:|vbscript:|data:|file:)/i.test(trimmed)) return false;

    return /^(#|\/|\.\/|\.\.\/|[^:?#]+(?:[/?#]|$))/i.test(trimmed);
  }

  function sanitizeHtml(html) {
    var template = document.createElement("template");

    template.innerHTML = String(html || "")
      .replace(/<\s*(base|embed|form|iframe|link|meta|object|script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      .replace(/<\s*\/?\s*(base|embed|form|iframe|link|meta|object|script|style)\b[^>]*>/gi, "")
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

    Array.from(template.content.querySelectorAll("*")).forEach(function (node) {
      var tag = node.tagName.toLowerCase();

      if (blockedTags.has(tag)) {
        node.remove();
        return;
      }

      Array.from(node.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        var isImageSource = tag === "img" && name === "src";

        if (name.indexOf("on") === 0 || name === "srcdoc") {
          node.removeAttribute(attr.name);
          return;
        }

        if (urlAttrs.has(name) && !isSafeUrl(attr.value, isImageSource)) {
          node.removeAttribute(attr.name);
        }
      });

      if (tag === "a") {
        node.setAttribute("rel", "noopener noreferrer");
      }
    });

    return template.innerHTML;
  }

  function render(markdown) {
    if (!window.marked || typeof window.marked.parse !== "function") {
      throw new Error("Marked-kirjastoa ei ole ladattu.");
    }

    var source = String(markdown || "")
      .replace(/^[\u200B\u200C\u200D\u200E\u200F\uFEFF]/, "")
      .replace(/\r\n?/g, "\n");

    return sanitizeHtml(window.marked.parse(source, {
      async: false,
      breaks: false,
      gfm: true
    }));
  }

  window.PakkiMarkdown = {
    render: render,
    sanitizeHtml: sanitizeHtml
  };
}());
