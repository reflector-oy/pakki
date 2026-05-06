(function () {
  "use strict";

  var preview = document.getElementById("preview");
  var dropHint = document.getElementById("drop-hint");
  var filePicker = document.getElementById("file-picker");
  var reloadBtn = document.getElementById("reloadBtn");
  var printBtn = document.getElementById("printBtn");
  var fileName = document.getElementById("fileName");
  var numberingToggle = document.getElementById("numberingToggle");
  var dragDepth = 0;

  var references = new Map();
  var tokenStore = [];

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeLabel(value) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
  }

  function slugify(value) {
    return value
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/&[a-z0-9#]+;/gi, "")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");
  }

  function protect(html) {
    var index = tokenStore.length;
    tokenStore.push(html);
    return "\u0000" + index + "\u0000";
  }

  function restoreTokens(value) {
    return value.replace(/\u0000(\d+)\u0000/g, function (_, index) {
      return tokenStore[Number(index)] || "";
    });
  }

  function isSafeUrl(url, imageMode) {
    var trimmed = url.trim().replace(/[\u0000-\u001f\u007f\s]+/g, "");
    var lower = trimmed.toLowerCase();

    if (!trimmed) {
      return false;
    }

    if (imageMode && lower.indexOf("data:image/") === 0) {
      return true;
    }

    if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
      return true;
    }

    if (/^(javascript:|vbscript:|data:|file:)/i.test(trimmed)) {
      return false;
    }

    return /^(#|\/|\.\/|\.\.\/|[^:?#]+(?:[/?#]|$))/i.test(trimmed);
  }

  function sanitizeUrl(url, imageMode) {
    var trimmed = url.trim();
    return isSafeUrl(trimmed, imageMode) ? trimmed : "#";
  }

  function sanitizeHtml(html) {
    var cleaned = String(html || "")
      .replace(/<\s*(base|embed|form|iframe|link|meta|object|script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      .replace(/<\s*\/?\s*(base|embed|form|iframe|link|meta|object|script|style)\b[^>]*>/gi, "")
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    var template = document.createElement("template");
    var forbidden = new Set([
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

    template.innerHTML = cleaned;

    Array.from(template.content.querySelectorAll("*")).forEach(function (node) {
      var tag = node.tagName.toLowerCase();

      if (forbidden.has(tag)) {
        node.remove();
        return;
      }

      Array.from(node.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        var value = attr.value;

        if (name.indexOf("on") === 0 || name === "srcdoc") {
          node.removeAttribute(attr.name);
          return;
        }

        if (urlAttrs.has(name)) {
          var isImage = tag === "img" && name === "src";
          if (!isSafeUrl(value, isImage)) {
            node.removeAttribute(attr.name);
          }
        }
      });

      if (tag === "a") {
        node.setAttribute("rel", "noopener noreferrer");
      }
    });

    return template.innerHTML;
  }

  function parseDestination(raw) {
    var text = raw.trim();
    var match;

    if (!text) {
      return null;
    }

    if (text[0] === "<") {
      match = text.match(/^<([^<>\n]*)>(?:\s+(.+))?$/);
      if (!match) {
        return null;
      }
      return {
        url: match[1],
        title: parseTitle(match[2] || "")
      };
    }

    match = text.match(/^(\S+?)(?:\s+(.+))?$/);
    if (!match) {
      return null;
    }

    return {
      url: match[1],
      title: parseTitle(match[2] || "")
    };
  }

  function parseTitle(raw) {
    var text = raw.trim();
    var match = text.match(/^"([^"]*)"$/) ||
      text.match(/^'([^']*)'$/) ||
      text.match(/^\(([^)]*)\)$/);

    return match ? match[1] : "";
  }

  function extractReferenceDefinitions(markdown) {
    references = new Map();
    var lines = markdown.split("\n");
    var kept = [];
    var pattern = /^ {0,3}\[([^\]]+)\]:\s*(<[^>]*>|\S+)(?:\s+("([^"]*)"|'([^']*)'|\(([^)]*)\)))?\s*$/;

    lines.forEach(function (line) {
      var match = line.match(pattern);
      if (!match) {
        kept.push(line);
        return;
      }

      var label = normalizeLabel(match[1]);
      if (!references.has(label)) {
        var url = match[2].replace(/^<|>$/g, "");
        var title = match[4] || match[5] || match[6] || "";
        references.set(label, { url: url, title: title });
      }
    });

    return kept.join("\n");
  }

  function markdownToHtml(markdown) {
    tokenStore = [];
    var source = String(markdown || "")
      .replace(/\u0000/g, "\ufffd")
      .replace(/\r\n?/g, "\n")
      .replace(/\t/g, "    ");

    source = extractReferenceDefinitions(source);
    return parseBlocks(source.split("\n")).trim();
  }

  function parseBlocks(lines) {
    var html = [];
    var index = 0;

    while (index < lines.length) {
      var line = lines[index];

      if (/^\s*$/.test(line)) {
        index += 1;
        continue;
      }

      if (isFencedCodeStart(line)) {
        var fence = parseFencedCode(lines, index);
        html.push(fence.html);
        index = fence.next;
        continue;
      }

      if (isHtmlBlockStart(line)) {
        var htmlBlock = parseHtmlBlock(lines, index);
        html.push(sanitizeHtml(htmlBlock.html));
        index = htmlBlock.next;
        continue;
      }

      if (/^ {4}/.test(line)) {
        var indented = parseIndentedCode(lines, index);
        html.push("<pre><code>" + escapeHtml(indented.code) + "</code></pre>");
        index = indented.next;
        continue;
      }

      var heading = line.match(/^ {0,3}(#{1,6})(?:\s+|$)(.*?)(?:\s+#+\s*)?$/);
      if (heading) {
        var level = heading[1].length;
        var body = parseInline(heading[2].trim());
        var id = slugify(heading[2]);
        html.push("<h" + level + (id ? " id=\"" + escapeHtml(id) + "\"" : "") + ">" + body + "</h" + level + ">");
        index += 1;
        continue;
      }

      if (isThematicBreak(line)) {
        html.push("<hr>");
        index += 1;
        continue;
      }

      if (isBlockquoteStart(line)) {
        var quote = parseBlockquote(lines, index);
        html.push("<blockquote>\n" + parseBlocks(quote.lines) + "\n</blockquote>");
        index = quote.next;
        continue;
      }

      if (isListStart(line)) {
        var list = parseList(lines, index);
        html.push(list.html);
        index = list.next;
        continue;
      }

      if (isTableStart(lines, index)) {
        var table = parseTable(lines, index);
        html.push(table.html);
        index = table.next;
        continue;
      }

      var paragraph = parseParagraph(lines, index);
      html.push(paragraph.html);
      index = paragraph.next;
    }

    return html.join("\n");
  }

  function isFencedCodeStart(line) {
    return /^ {0,3}(`{3,}|~{3,})(.*)$/.test(line);
  }

  function parseFencedCode(lines, start) {
    var opener = lines[start].match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    var marker = opener[1][0];
    var length = opener[1].length;
    var info = opener[2].trim().replace(/`+/g, "");
    var code = [];
    var index = start + 1;
    var closer = new RegExp("^ {0,3}" + (marker === "`" ? "`" : "~") + "{" + length + ",}\\s*$");

    while (index < lines.length && !closer.test(lines[index])) {
      code.push(lines[index]);
      index += 1;
    }

    if (index < lines.length) {
      index += 1;
    }

    var className = info ? " class=\"language-" + escapeHtml(info.split(/\s+/)[0]) + "\"" : "";
    return {
      html: "<pre><code" + className + ">" + escapeHtml(code.join("\n")) + "\n</code></pre>",
      next: index
    };
  }

  function parseIndentedCode(lines, start) {
    var code = [];
    var index = start;

    while (index < lines.length) {
      if (/^ {4}/.test(lines[index])) {
        code.push(lines[index].slice(4));
      } else if (/^\s*$/.test(lines[index])) {
        code.push("");
      } else {
        break;
      }
      index += 1;
    }

    while (code.length && code[code.length - 1] === "") {
      code.pop();
    }

    return {
      code: code.join("\n") + "\n",
      next: index
    };
  }

  function isHtmlBlockStart(line) {
    return /^ {0,3}(<!--|<\?|<![A-Z]|<!\[CDATA\[)/.test(line) ||
      /^ {0,3}<\/?(address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|>|\/>)/i.test(line);
  }

  function parseHtmlBlock(lines, start) {
    var first = lines[start];
    var code = [first];
    var index = start + 1;
    var endPattern = null;

    if (/^ {0,3}<!--/.test(first)) {
      endPattern = /-->/;
    } else if (/^ {0,3}<\?/.test(first)) {
      endPattern = /\?>/;
    } else if (/^ {0,3}<!\[CDATA\[/.test(first)) {
      endPattern = /\]\]>/;
    } else if (/^ {0,3}<![A-Z]/.test(first)) {
      endPattern = />/;
    }

    if (endPattern) {
      while (index < lines.length && !endPattern.test(code[code.length - 1])) {
        code.push(lines[index]);
        index += 1;
      }
    } else {
      while (index < lines.length && !/^\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
    }

    return {
      html: code.join("\n"),
      next: index
    };
  }

  function isThematicBreak(line) {
    return /^ {0,3}(?:([-*_])(?:\s*\1){2,}\s*)$/.test(line);
  }

  function isBlockquoteStart(line) {
    return /^ {0,3}> ?/.test(line);
  }

  function parseBlockquote(lines, start) {
    var quoteLines = [];
    var index = start;

    while (index < lines.length) {
      if (/^ {0,3}> ?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^ {0,3}> ?/, ""));
        index += 1;
        continue;
      }

      if (/^\s*$/.test(lines[index])) {
        quoteLines.push("");
        index += 1;
        continue;
      }

      break;
    }

    return {
      lines: quoteLines,
      next: index
    };
  }

  function listMarker(line) {
    var match = line.match(/^( {0,3})((?:[-+*])|(?:\d{1,9}[.)]))([ \t]+)(.*)$/);
    if (!match) {
      return null;
    }
    return {
      indent: match[1].length,
      marker: match[2],
      padding: match[3],
      content: match[4],
      ordered: /\d/.test(match[2][0])
    };
  }

  function isListStart(line) {
    return Boolean(listMarker(line));
  }

  function parseList(lines, start) {
    var first = listMarker(lines[start]);
    var ordered = first.ordered;
    var baseIndent = first.indent;
    var startNumber = ordered ? parseInt(first.marker, 10) : null;
    var tag = ordered ? "ol" : "ul";
    var index = start;
    var items = [];

    while (index < lines.length) {
      var marker = listMarker(lines[index]);
      if (!marker || marker.indent !== baseIndent || marker.ordered !== ordered) {
        break;
      }

      var contentIndent = marker.indent + marker.marker.length + marker.padding.length;
      var itemLines = [marker.content];
      var hadBlankLine = false;
      index += 1;

      while (index < lines.length) {
        var nextMarker = listMarker(lines[index]);
        if (nextMarker && nextMarker.indent === baseIndent && nextMarker.ordered === ordered) {
          break;
        }

        if (nextMarker && nextMarker.indent < baseIndent) {
          break;
        }

        if (/^\s*$/.test(lines[index])) {
          itemLines.push("");
          hadBlankLine = true;
          index += 1;
          continue;
        }

        var hasContinuationIndent = lines[index].slice(0, contentIndent).trim() === "" &&
          lines[index].length >= contentIndent;

        if (hadBlankLine && !hasContinuationIndent) {
          break;
        }

        if (hasContinuationIndent) {
          itemLines.push(lines[index].slice(contentIndent));
        } else {
          itemLines.push(lines[index]);
        }
        hadBlankLine = false;
        index += 1;
      }

      items.push(renderListItem(itemLines));
    }

    var startAttr = ordered && startNumber !== 1 ? " start=\"" + startNumber + "\"" : "";
    return {
      html: "<" + tag + startAttr + ">\n" + items.join("\n") + "\n</" + tag + ">",
      next: index
    };
  }

  function renderListItem(lines) {
    var task = null;

    if (lines.length && /^\s*\[[ xX]\]\s+/.test(lines[0])) {
      task = /\[[xX]\]/.test(lines[0]);
      lines[0] = lines[0].replace(/^\s*\[[ xX]\]\s+/, "");
    }

    var body = parseBlocks(lines);

    if (task !== null) {
      var checkbox = "<input type=\"checkbox\" disabled" + (task ? " checked" : "") + "> ";
      if (/^<p>/.test(body)) {
        body = body.replace(/^<p>/, "<p>" + checkbox);
      } else {
        body = checkbox + body;
      }
      return "<li class=\"task-list-item\">" + body + "</li>";
    }

    return "<li>" + body + "</li>";
  }

  function isTableStart(lines, index) {
    return index + 1 < lines.length &&
      hasUnescapedPipe(lines[index]) &&
      isTableDelimiter(lines[index + 1]);
  }

  function hasUnescapedPipe(line) {
    return /(^|[^\\])\|/.test(line);
  }

  function isTableDelimiter(line) {
    var cells = splitTableRow(line);
    return cells.length > 0 && cells.every(function (cell) {
      return /^:?-{3,}:?$/.test(cell.trim());
    });
  }

  function splitTableRow(line) {
    var text = line.trim();
    var cells = [];
    var cell = "";
    var escaped = false;
    var index;

    if (text[0] === "|") {
      text = text.slice(1);
    }
    if (text[text.length - 1] === "|" && text[text.length - 2] !== "\\") {
      text = text.slice(0, -1);
    }

    for (index = 0; index < text.length; index += 1) {
      var ch = text[index];
      if (escaped) {
        cell += ch;
        escaped = false;
      } else if (ch === "\\") {
        cell += ch;
        escaped = true;
      } else if (ch === "|") {
        cells.push(cell.trim());
        cell = "";
      } else {
        cell += ch;
      }
    }

    cells.push(cell.trim());
    return cells;
  }

  function parseTable(lines, start) {
    var headers = splitTableRow(lines[start]);
    var aligns = splitTableRow(lines[start + 1]).map(function (cell) {
      cell = cell.trim();
      if (/^:-+:$/.test(cell)) {
        return "center";
      }
      if (/^-+:$/.test(cell)) {
        return "right";
      }
      if (/^:-+$/.test(cell)) {
        return "left";
      }
      return "";
    });
    var index = start + 2;
    var rows = [];

    while (index < lines.length && hasUnescapedPipe(lines[index]) && !/^\s*$/.test(lines[index])) {
      rows.push(splitTableRow(lines[index]));
      index += 1;
    }

    function cellAttr(column) {
      return aligns[column] ? " style=\"text-align: " + aligns[column] + "\"" : "";
    }

    var head = headers.map(function (cell, column) {
      return "<th" + cellAttr(column) + ">" + parseInline(cell) + "</th>";
    }).join("");

    var body = rows.map(function (row) {
      var cells = headers.map(function (_, column) {
        return "<td" + cellAttr(column) + ">" + parseInline(row[column] || "") + "</td>";
      }).join("");
      return "<tr>" + cells + "</tr>";
    }).join("\n");

    return {
      html: "<table>\n<thead><tr>" + head + "</tr></thead>\n<tbody>\n" + body + "\n</tbody>\n</table>",
      next: index
    };
  }

  function isParagraphBreaker(lines, index) {
    if (index >= lines.length) {
      return true;
    }
    return /^\s*$/.test(lines[index]) ||
      isFencedCodeStart(lines[index]) ||
      isHtmlBlockStart(lines[index]) ||
      /^ {0,3}(#{1,6})(?:\s+|$)/.test(lines[index]) ||
      isThematicBreak(lines[index]) ||
      isBlockquoteStart(lines[index]) ||
      isListStart(lines[index]) ||
      isTableStart(lines, index);
  }

  function parseParagraph(lines, start) {
    var text = [lines[start]];
    var index = start + 1;

    while (index < lines.length) {
      if (/^ {0,3}(=+|-+)\s*$/.test(lines[index]) && text.length === 1) {
        var level = lines[index].trim()[0] === "=" ? 1 : 2;
        var inline = parseInline(text[0].trim());
        var id = slugify(text[0]);
        return {
          html: "<h" + level + (id ? " id=\"" + escapeHtml(id) + "\"" : "") + ">" + inline + "</h" + level + ">",
          next: index + 1
        };
      }

      if (isParagraphBreaker(lines, index)) {
        break;
      }

      text.push(lines[index]);
      index += 1;
    }

    return {
      html: "<p>" + parseInline(text.join("\n").trim()) + "</p>",
      next: index
    };
  }

  function parseInline(input) {
    tokenStore = tokenStore || [];
    var text = String(input || "");
    var out = "";
    var index = 0;

    while (index < text.length) {
      var ch = text[index];
      var next = text[index + 1];

      if (ch === "`") {
        var code = readCodeSpan(text, index);
        if (code) {
          out += protect("<code>" + escapeHtml(code.value) + "</code>");
          index = code.next;
          continue;
        }
      }

      if (ch === "\\" && next === "\n") {
        out = out.replace(/[ ]+$/, "");
        out += protect("<br>") + "\n";
        index += 2;
        continue;
      }

      if (ch === "\n") {
        if (/ {2,}$/.test(out)) {
          out = out.replace(/[ ]+$/, "");
          out += protect("<br>");
        }
        out += "\n";
        index += 1;
        continue;
      }

      if (ch === "\\" && /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(next || "")) {
        out += protect(escapeHtml(next));
        index += 2;
        continue;
      }

      if (ch === "&") {
        var entity = text.slice(index).match(/^&(?:#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]{1,31});/);
        if (entity) {
          out += protect(entity[0]);
          index += entity[0].length;
          continue;
        }
      }

      if (ch === "!" && next === "[") {
        var image = readBracketLink(text, index + 1, true);
        if (image) {
          out += protect(renderImage(image));
          index = image.next;
          continue;
        }
      }

      if (ch === "[") {
        var link = readBracketLink(text, index, false);
        if (link) {
          out += protect(renderLink(link));
          index = link.next;
          continue;
        }
      }

      if (ch === "<") {
        var angle = text.indexOf(">", index + 1);
        if (angle !== -1) {
          var raw = text.slice(index, angle + 1);
          var inside = text.slice(index + 1, angle);
          if (/^[a-z][a-z0-9+.-]{1,31}:[^\s<>]*$/i.test(inside)) {
            var safeAutoUrl = sanitizeUrl(inside, false);
            out += protect("<a href=\"" + escapeHtml(safeAutoUrl) + "\">" + escapeHtml(inside) + "</a>");
            index = angle + 1;
            continue;
          }
          if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(inside)) {
            var mail = "mailto:" + inside;
            out += protect("<a href=\"" + escapeHtml(mail) + "\">" + escapeHtml(inside) + "</a>");
            index = angle + 1;
            continue;
          }
          if (/^<\/?[A-Za-z][^>]*>$/.test(raw) || /^<!--[\s\S]*-->$/.test(raw)) {
            out += protect(sanitizeHtml(raw));
            index = angle + 1;
            continue;
          }
        }
      }

      var auto = readPlainAutolink(text, index);
      if (auto) {
        var href = sanitizeUrl(auto.url, false);
        out += protect("<a href=\"" + escapeHtml(href) + "\">" + escapeHtml(auto.url) + "</a>");
        index = auto.next;
        continue;
      }

      out += escapeHtml(ch);
      index += 1;
    }

    return restoreTokens(applyInlineStyles(out));
  }

  function readCodeSpan(text, start) {
    var opener = text.slice(start).match(/^`+/);
    var ticks = opener[0];
    var end = text.indexOf(ticks, start + ticks.length);

    if (end === -1) {
      return null;
    }

    var value = text.slice(start + ticks.length, end).replace(/\s+/g, " ");
    if (/^ .+ $/.test(value) && value.trim()) {
      value = value.slice(1, -1);
    }

    return {
      value: value,
      next: end + ticks.length
    };
  }

  function findClosingBracket(text, start) {
    var depth = 0;
    var index;

    for (index = start; index < text.length; index += 1) {
      if (text[index] === "\\" && index + 1 < text.length) {
        index += 1;
        continue;
      }
      if (text[index] === "[") {
        depth += 1;
      } else if (text[index] === "]") {
        depth -= 1;
        if (depth === 0) {
          return index;
        }
      }
    }

    return -1;
  }

  function readBracketLink(text, bracketStart, imageMode) {
    var close = findClosingBracket(text, bracketStart);
    var label = text.slice(bracketStart + 1, close);
    var after = close + 1;
    var destination = null;
    var refLabel = "";
    var refClose;

    if (close === -1) {
      return null;
    }

    if (text[after] === "(") {
      var paren = findClosingParen(text, after);
      if (paren === -1) {
        return null;
      }
      destination = parseDestination(text.slice(after + 1, paren));
      if (!destination) {
        return null;
      }
      return {
        label: label,
        url: destination.url,
        title: destination.title,
        image: imageMode,
        next: paren + 1
      };
    }

    if (text[after] === "[") {
      refClose = text.indexOf("]", after + 1);
      if (refClose === -1) {
        return null;
      }
      refLabel = text.slice(after + 1, refClose) || label;
      destination = references.get(normalizeLabel(refLabel));
      if (!destination) {
        return null;
      }
      return {
        label: label,
        url: destination.url,
        title: destination.title,
        image: imageMode,
        next: refClose + 1
      };
    }

    destination = references.get(normalizeLabel(label));
    if (destination) {
      return {
        label: label,
        url: destination.url,
        title: destination.title,
        image: imageMode,
        next: after
      };
    }

    return null;
  }

  function findClosingParen(text, start) {
    var depth = 0;
    var quote = "";
    var index;

    for (index = start; index < text.length; index += 1) {
      var ch = text[index];

      if (ch === "\\" && index + 1 < text.length) {
        index += 1;
        continue;
      }

      if (quote) {
        if (ch === quote) {
          quote = "";
        }
        continue;
      }

      if (ch === "\"" || ch === "'") {
        quote = ch;
        continue;
      }

      if (ch === "(") {
        depth += 1;
      } else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          return index;
        }
      }
    }

    return -1;
  }

  function renderLink(link) {
    var href = sanitizeUrl(link.url, false);
    var title = link.title ? " title=\"" + escapeHtml(link.title) + "\"" : "";
    return "<a href=\"" + escapeHtml(href) + "\"" + title + ">" + parseInline(link.label) + "</a>";
  }

  function renderImage(image) {
    var src = sanitizeUrl(image.url, true);
    var title = image.title ? " title=\"" + escapeHtml(image.title) + "\"" : "";
    var alt = image.label.replace(/[`*_~[\]()]/g, "").trim();
    return "<img src=\"" + escapeHtml(src) + "\" alt=\"" + escapeHtml(alt) + "\"" + title + ">";
  }

  function readPlainAutolink(text, start) {
    var rest = text.slice(start);
    var match = rest.match(/^(https?:\/\/[^\s<]+|www\.[^\s<]+)/i);
    var url;

    if (!match) {
      return null;
    }

    url = match[0].replace(/[),.;:!?]+$/, "");
    if (url.indexOf("www.") === 0) {
      url = "https://" + url;
    }

    return {
      url: url,
      next: start + match[0].replace(/[),.;:!?]+$/, "").length
    };
  }

  function applyInlineStyles(value) {
    var parts = value.split(/(\u0000\d+\u0000)/g);
    return parts.map(function (part) {
      if (/^\u0000\d+\u0000$/.test(part)) {
        return part;
      }

      return part
        .replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, "<strong><em>$1</em></strong>")
        .replace(/___(?=\S)([\s\S]*?\S)___/g, "<strong><em>$1</em></strong>")
        .replace(/~~(?=\S)([\s\S]*?\S)~~/g, "<del>$1</del>")
        .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>")
        .replace(/__(?=\S)([\s\S]*?\S)__/g, "<strong>$1</strong>")
        .replace(/\*(?=\S)([\s\S]*?\S)\*/g, "<em>$1</em>")
        .replace(/_(?=\S)([\s\S]*?\S)_/g, "<em>$1</em>");
    }).join("");
  }

  function renderMarkdown(markdown) {
    preview.innerHTML = window.PakkiMarkdown.render(markdown);
    document.body.classList.add("has-document");
    if (reloadBtn) {
      reloadBtn.disabled = false;
    }
    if (printBtn) {
      printBtn.disabled = false;
    }
  }

  function readFile(file) {
    var reader = new FileReader();

    reader.onload = function () {
      if (fileName) {
        fileName.textContent = file.name;
      }
      renderMarkdown(reader.result);
    };

    reader.onerror = function () {
      if (fileName) {
        fileName.textContent = file.name;
      }
      preview.innerHTML = "<p>Tiedostoa ei voitu lukea.</p>";
      document.body.classList.add("has-document");
    };

    reader.readAsText(file);
  }

  function pickFile(files) {
    if (!files || !files.length) {
      return;
    }
    readFile(files[0]);
  }

  window.addEventListener("dragenter", function (event) {
    event.preventDefault();
    dragDepth += 1;
    document.body.classList.add("is-dragging");
  });

  window.addEventListener("dragover", function (event) {
    event.preventDefault();
  });

  window.addEventListener("dragleave", function () {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      document.body.classList.remove("is-dragging");
    }
  });

  window.addEventListener("drop", function (event) {
    event.preventDefault();
    dragDepth = 0;
    document.body.classList.remove("is-dragging");
    pickFile(event.dataTransfer.files);
  });

  dropHint.addEventListener("click", function () {
    filePicker.click();
  });

  if (reloadBtn) {
    reloadBtn.addEventListener("click", function () {
      document.body.classList.remove("has-document");
      preview.innerHTML = "";
      if (fileName) fileName.textContent = "Ei tiedostoa valittuna";
      reloadBtn.disabled = true;
      if (printBtn) printBtn.disabled = true;
      filePicker.value = "";
    });
  }

  if (printBtn) {
    printBtn.addEventListener("click", function () {
      window.print();
    });
  }

  if (numberingToggle) {
    numberingToggle.addEventListener("change", function () {
      document.body.classList.toggle("numbering-disabled", !numberingToggle.checked);
    });
  }

  filePicker.addEventListener("change", function () {
    pickFile(filePicker.files);
    filePicker.value = "";
  });

  window.MarkdownPreview = {
    render: markdownToHtml
  };
}());
