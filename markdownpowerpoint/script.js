(function () {
  "use strict";

  var EMU = 914400;
  var SLIDE_W = 13.333;
  var SLIDE_H = 7.5;
  var SLIDE_CX = 12192000;
  var SLIDE_CY = 6858000;

  var currentFilename = "dokumentti";
  var currentMarkdown = "";
  var logoSvgPromise = null;
  var dropHint = document.getElementById("dropHint");
  var filePicker = document.getElementById("filePicker");
  var preview = document.getElementById("preview");
  var reloadBtn = document.getElementById("reloadBtn");
  var pptBtn = document.getElementById("pptBtn");
  var footerNote = document.getElementById("footerNote");

  // Static values copied from WIP/Reflector_ppt_pohja_2025.potx.
  var deckStyle = {
    bg: "FFFFFF",
    titleBg: "F8F3EC",
    card: "FFFFFF",
    ink: "551500",
    ink2: "551500",
    muted: "969696",
    line: "E8E0D5",
    accent: "F25B11",
    accent2: "FFA349",
    accent3: "57A79F",
    tableFill: "FBE0CF",
    tableFillAlt: "FDF0E8",
    code: "F0EDE8"
  };

  var deckLayout = {
    brand: { x: 0.9, y: 0.58, w: 5.2, h: 0.62 },
    title: { x: 1.75, y: 3.0, w: 10, h: 0.72 },
    subtitle: { x: 1.75, y: 3.78, w: 10, h: 0.42 },
    contentTitle: { x: 0.92, y: 0.64, w: 11.5, h: 0.58 },
    content: { x: 0.92, y: 1.66, w: 11.5, bottom: 6.35 },
    footerY: 6.68
  };

  function getLogoSvg() {
    if (logoSvgPromise) return logoSvgPromise;
    if (window.ReflectorLogoSvg) {
      logoSvgPromise = Promise.resolve(window.ReflectorLogoSvg);
    } else if (window.fetch) {
      logoSvgPromise = fetch("../assets/reflector-logo-orange.svg").then(function (response) {
        if (!response.ok) throw new Error("Logoa ei voitu ladata.");
        return response.text();
      });
    } else {
      logoSvgPromise = Promise.resolve("");
    }
    return logoSvgPromise;
  }

  function xml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function emu(inches) {
    return Math.round(Number(inches || 0) * EMU);
  }

  function size(value) {
    return Math.round(Number(value || 12) * 100);
  }

  function setDocumentLoaded(fileName, markdown, html) {
    currentMarkdown = markdown;
    preview.innerHTML = html;
    document.body.classList.add("has-document");
    reloadBtn.disabled = false;
    pptBtn.disabled = false;
    footerNote.textContent = fileName;
  }

  function setError(fileName, message) {
    currentMarkdown = "";
    preview.innerHTML = "<p>" + xml(message) + "</p>";
    document.body.classList.add("has-document");
    reloadBtn.disabled = false;
    pptBtn.disabled = true;
    footerNote.textContent = fileName;
  }

  function getInlineText(tokens, fallback) {
    if (!tokens || !tokens.length) return String(fallback || "").trim();
    return tokens.map(function (token) {
      if (token.tokens) return getInlineText(token.tokens, token.text);
      if (token.items) {
        return token.items.map(function (item) {
          return getInlineText(item.tokens, item.text);
        }).join(" ");
      }
      return String(token.text || token.raw || "");
    }).join("").replace(/\s+/g, " ").trim();
  }

  function getBlockText(token) {
    if (!token) return "";
    if (token.type === "code") return String(token.text || "");
    if (token.type === "blockquote") {
      return (token.tokens || []).map(getBlockText).filter(Boolean).join("\n");
    }
    if (token.type === "list_item") {
      return (token.tokens || []).map(getBlockText).filter(Boolean).join(" ");
    }
    if (token.tokens) return getInlineText(token.tokens, token.text);
    return String(token.text || token.raw || "").replace(/\s+/g, " ").trim();
  }

  function markdownToSlides(markdown, fallbackTitle) {
    var tokens = window.marked.lexer(markdown || "", { gfm: true, breaks: false });
    var slides = [];
    var documentTitle = fallbackTitle || currentFilename;
    var current = null;
    var hasTitleSlide = false;

    tokens.forEach(function (token) {
      if (token.type === "space") return;

      if (token.type === "heading" && token.depth === 1) {
        documentTitle = getInlineText(token.tokens, token.text) || documentTitle;
        if (!hasTitleSlide) {
          slides.push({ title: documentTitle, subtitle: "", blocks: [], isTitle: true });
          hasTitleSlide = true;
        }
        return;
      }

      if (token.type === "heading" && token.depth === 2) {
        if (current && (current.blocks.length || current.subtitle)) slides.push(current);
        current = {
          title: getInlineText(token.tokens, token.text) || documentTitle,
          subtitle: "",
          blocks: []
        };
        return;
      }

      if (token.type === "heading" && token.depth === 3) {
        if (!current) current = { title: documentTitle, subtitle: "", blocks: [] };
        if (!current.subtitle && !current.blocks.length) {
          current.subtitle = getInlineText(token.tokens, token.text);
        } else {
          current.blocks.push(token);
        }
        return;
      }

      if (token.type === "hr") {
        if (current && (current.blocks.length || current.subtitle)) slides.push(current);
        current = null;
        return;
      }

      if (!current) current = { title: documentTitle, subtitle: "", blocks: [] };
      current.blocks.push(token);
    });

    if (current && (current.blocks.length || current.subtitle)) slides.push(current);
    if (!slides.length) slides.push({ title: documentTitle, subtitle: "", blocks: [], isTitle: true });
    return slides.filter(function (slide) {
      return slide.title || slide.subtitle || slide.blocks.length;
    });
  }

  function estimateTextHeight(text, charsPerLine, lineHeight, minHeight) {
    var lineCount = String(text || "").split(/\n/).reduce(function (count, line) {
      return count + Math.max(1, Math.ceil(line.length / charsPerLine));
    }, 0);
    return Math.max(minHeight || 0.35, lineCount * lineHeight);
  }

  function textParagraphs(text, opts) {
    var paragraphs = String(text || "").split(/\n/);
    return paragraphs.map(function (line) {
      return '<a:p><a:pPr algn="' + xml(opts.align || "l") + '"/><a:r><a:rPr lang="fi-FI" sz="' + size(opts.fontSize || 12) + '"' +
        (opts.bold ? ' b="1"' : "") + (opts.italic ? ' i="1"' : "") + '><a:solidFill><a:srgbClr val="' + xml(opts.color || deckStyle.ink) +
        '"/></a:solidFill><a:latin typeface="' + xml(opts.fontFace || "Montserrat") + '"/><a:cs typeface="' + xml(opts.fontFace || "Montserrat") +
        '"/></a:rPr><a:t>' + xml(line) + '</a:t></a:r></a:p>';
    }).join("");
  }

  function Slide() {
    this.id = 2;
    this.objects = [];
    this.rels = [];
    this.background = deckStyle.bg;
  }

  function textAnchor(value) {
    return value === "mid" ? "ctr" : (value || "t");
  }

  Slide.prototype.nextId = function () {
    return this.id++;
  };

  Slide.prototype.rect = function (x, y, w, h, fill, line) {
    var id = this.nextId();
    this.objects.push('<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="Shape ' + id +
      '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + emu(x) + '" y="' + emu(y) +
      '"/><a:ext cx="' + emu(w) + '" cy="' + emu(h) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
      '<a:solidFill><a:srgbClr val="' + xml(fill || deckStyle.card) + '"/></a:solidFill><a:ln w="6350"><a:solidFill><a:srgbClr val="' +
      xml(line || fill || deckStyle.line) + '"/></a:solidFill></a:ln></p:spPr></p:sp>');
  };

  Slide.prototype.text = function (x, y, w, h, text, opts) {
    var id = this.nextId();
    opts = opts || {};
    this.objects.push('<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="Text ' + id +
      '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + emu(x) + '" y="' + emu(y) +
      '"/><a:ext cx="' + emu(w) + '" cy="' + emu(h) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
      '<a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="' + xml(textAnchor(opts.valign)) +
      '"><a:normAutofit/></a:bodyPr><a:lstStyle/>' + textParagraphs(text, opts) + '</p:txBody></p:sp>');
  };

  Slide.prototype.logo = function (x, y, w, h) {
    var id = this.nextId();
    var relId = "rIdLogo";
    if (!this.rels.some(function (rel) { return rel.id === relId; })) {
      this.rels.push({
        id: relId,
        type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
        target: "../media/reflector-logo-orange.svg"
      });
    }
    this.objects.push('<p:pic><p:nvPicPr><p:cNvPr id="' + id + '" name="Reflector logo"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="' +
      relId + '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="' + emu(x) + '" y="' + emu(y) + '"/><a:ext cx="' +
      emu(w) + '" cy="' + emu(h) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>');
  };

  Slide.prototype.xml = function () {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
      '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="' + xml(this.background || deckStyle.bg) + '"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
      '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + SLIDE_CX +
      '" cy="' + SLIDE_CY + '"/><a:chOff x="0" y="0"/><a:chExt cx="' + SLIDE_CX + '" cy="' + SLIDE_CY + '"/></a:xfrm></p:grpSpPr>' +
      this.objects.join("") + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
  };

  function addChrome(slide, title, pageNumber) {
    slide.text(deckLayout.contentTitle.x, deckLayout.contentTitle.y, deckLayout.contentTitle.w, deckLayout.contentTitle.h, title || currentFilename, {
      fontFace: "Bricolage Grotesque",
      fontSize: 23,
      bold: false,
      color: deckStyle.ink
    });
    slide.logo(0.92, deckLayout.footerY + 0.02, 1.18, 0.18);
    slide.text(10.78, deckLayout.footerY + 0.02, 1.65, 0.2, "Reflector Oy © 2026", {
      fontSize: 8,
      color: deckStyle.accent,
      align: "r"
    });
    slide.text(12.68, deckLayout.footerY + 0.02, 0.25, 0.2, String(pageNumber), {
      fontSize: 8,
      color: deckStyle.ink,
      align: "r"
    });
  }

  function addTitleSlide(slides, title, pageNumber) {
    var slide = new Slide();
    slide.background = deckStyle.titleBg;
    slide.logo(deckLayout.brand.x, deckLayout.brand.y + 0.05, 3.25, 0.48);
    slide.text(deckLayout.title.x, deckLayout.title.y, deckLayout.title.w, deckLayout.title.h, title || currentFilename, {
      fontFace: "Bricolage Grotesque",
      fontSize: 31,
      bold: false,
      color: deckStyle.ink,
      valign: "ctr"
    });
    slide.text(deckLayout.subtitle.x, deckLayout.subtitle.y, deckLayout.subtitle.w, deckLayout.subtitle.h, "Markdown -> PowerPoint", {
      fontFace: "Montserrat",
      fontSize: 16,
      color: deckStyle.accent
    });
    slides.push(slide);
  }

  function addContentSlides(slides, model, pageCounter) {
    var title = model.title || currentFilename;
    var slide = new Slide();
    var y = model.subtitle ? deckLayout.content.y + 0.42 : deckLayout.content.y;
    addChrome(slide, title, pageCounter.value++);
    if (model.subtitle) {
      slide.text(deckLayout.content.x, 1.22, deckLayout.content.w, 0.36, model.subtitle, {
        fontFace: "Montserrat",
        fontSize: 14,
        color: deckStyle.accent
      });
    }
    slides.push(slide);

    function nextSlide() {
      slide = new Slide();
      y = deckLayout.content.y;
      addChrome(slide, title + " (jatkuu)", pageCounter.value++);
      slides.push(slide);
    }

    function ensureSpace(height) {
      if (y + height > deckLayout.content.bottom) nextSlide();
    }

    function addParagraph(text) {
      if (!text) return;
      var height = estimateTextHeight(text, 92, 0.27, 0.42);
      ensureSpace(height + 0.1);
      slide.text(deckLayout.content.x, y, deckLayout.content.w, height, text, { fontSize: 14, color: deckStyle.ink });
      y += height + 0.18;
    }

    function addSubheading(text) {
      if (!text) return;
      ensureSpace(0.55);
      slide.text(deckLayout.content.x, y, deckLayout.content.w, 0.38, text, {
        fontFace: "Bricolage Grotesque",
        fontSize: 17,
        bold: false,
        color: deckStyle.accent
      });
      y += 0.52;
    }

    function addList(token) {
      (token.items || []).forEach(function (item, index) {
        var text = getBlockText(item);
        var prefix = token.ordered ? String(index + 1) + ". " : "- ";
        var height = estimateTextHeight(text, 86, 0.25, 0.34);
        ensureSpace(height + 0.1);
        slide.text(deckLayout.content.x + 0.2, y, deckLayout.content.w - 0.2, height, prefix + text, { fontSize: 13, color: deckStyle.ink });
        y += height + 0.1;
      });
      y += 0.08;
    }

    function addCode(token) {
      var text = String(token.text || "").trim();
      if (!text) return;
      var height = Math.min(2.6, estimateTextHeight(text, 74, 0.2, 0.58));
      ensureSpace(height + 0.2);
      slide.rect(deckLayout.content.x, y - 0.06, deckLayout.content.w, height + 0.1, deckStyle.code, deckStyle.line);
      slide.text(deckLayout.content.x + 0.16, y + 0.04, deckLayout.content.w - 0.32, height, text, {
        fontFace: "Courier New",
        fontSize: 9.5,
        color: deckStyle.ink2
      });
      y += height + 0.32;
    }

    function addTable(token) {
      var rows = [token.header.map(function (cell) { return getInlineText(cell.tokens, cell.text); })];
      (token.rows || []).slice(0, 8).forEach(function (row) {
        rows.push(row.map(function (cell) { return getInlineText(cell.tokens, cell.text); }));
      });
      var cols = Math.max.apply(null, rows.map(function (row) { return row.length; }));
      var rowH = 0.38;
      var cellW = deckLayout.content.w / Math.max(1, cols);
      var height = rows.length * rowH;
      ensureSpace(height + 0.24);
      rows.forEach(function (row, rowIndex) {
        row.forEach(function (cell, colIndex) {
          var x = deckLayout.content.x + colIndex * cellW;
          var fill = rowIndex === 0 ? deckStyle.accent2 : (rowIndex % 2 ? deckStyle.tableFill : deckStyle.tableFillAlt);
          var textColor = rowIndex === 0 ? "FFFFFF" : deckStyle.ink;
          slide.rect(x, y + rowIndex * rowH, cellW, rowH, fill, "FFFFFF");
          slide.text(x + 0.08, y + rowIndex * rowH + 0.08, cellW - 0.16, rowH - 0.08, cell, {
            fontSize: 8.8,
            bold: rowIndex === 0,
            color: textColor
          });
        });
      });
      y += height + 0.28;
    }

    function addQuote(token) {
      var text = getBlockText(token);
      var height = estimateTextHeight(text, 86, 0.25, 0.46);
      ensureSpace(height + 0.22);
      slide.rect(deckLayout.content.x, y - 0.03, 0.06, height + 0.06, deckStyle.accent, deckStyle.accent);
      slide.text(deckLayout.content.x + 0.22, y, deckLayout.content.w - 0.35, height, text, {
        fontSize: 13,
        italic: true,
        color: deckStyle.ink2
      });
      y += height + 0.26;
    }

    model.blocks.forEach(function (token) {
      if (token.type === "heading") addSubheading(getBlockText(token));
      else if (token.type === "paragraph") addParagraph(getBlockText(token));
      else if (token.type === "list") addList(token);
      else if (token.type === "code") addCode(token);
      else if (token.type === "table") addTable(token);
      else if (token.type === "blockquote") addQuote(token);
      else if (token.type === "html") addParagraph(getBlockText(token));
    });
  }

  function buildSlides(markdown, fileTitle) {
    var models = markdownToSlides(markdown, fileTitle);
    var slides = [];
    var pageCounter = { value: 1 };
    models.forEach(function (model, index) {
      if (model.isTitle || (index === 0 && !model.blocks.length && !model.subtitle)) addTitleSlide(slides, model.title, pageCounter.value++);
      else addContentSlides(slides, model, pageCounter);
    });
    return slides;
  }

  function relationships(items) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      items.map(function (item) {
        return '<Relationship Id="' + xml(item.id) + '" Type="' + xml(item.type) + '" Target="' + xml(item.target) + '"/>';
      }).join("") + '</Relationships>';
  }

  function addStaticParts(zip, slides, title) {
    var overrides = slides.map(function (_, index) {
      return '<Override PartName="/ppt/slides/slide' + (index + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>';
    }).join("");

    zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="svg" ContentType="image/svg+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' + overrides + '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>');

    zip.file("_rels/.rels", relationships([
      { id: "rId1", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument", target: "ppt/presentation.xml" },
      { id: "rId2", type: "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", target: "docProps/core.xml" },
      { id: "rId3", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties", target: "docProps/app.xml" }
    ]));

    var presRels = [{ id: "rId1", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster", target: "slideMasters/slideMaster1.xml" }];
    slides.forEach(function (_, index) {
      presRels.push({ id: "rId" + (index + 2), type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide", target: "slides/slide" + (index + 1) + ".xml" });
    });
    presRels.push(
      { id: "rId" + (slides.length + 2), type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme", target: "theme/theme1.xml" },
      { id: "rId" + (slides.length + 3), type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps", target: "presProps.xml" },
      { id: "rId" + (slides.length + 4), type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps", target: "viewProps.xml" },
      { id: "rId" + (slides.length + 5), type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles", target: "tableStyles.xml" }
    );
    zip.file("ppt/_rels/presentation.xml.rels", relationships(presRels));

    var slideIds = slides.map(function (_, index) {
      return '<p:sldId id="' + (256 + index) + '" r:id="rId' + (index + 2) + '"/>';
    }).join("");
    zip.file("ppt/presentation.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>' + slideIds + '</p:sldIdLst><p:sldSz cx="' + SLIDE_CX + '" cy="' + SLIDE_CY + '" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>');

    zip.file("ppt/slideLayouts/slideLayout1.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + SLIDE_CX + '" cy="' + SLIDE_CY + '"/><a:chOff x="0" y="0"/><a:chExt cx="' + SLIDE_CX + '" cy="' + SLIDE_CY + '"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>');
    zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", relationships([
      { id: "rId1", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster", target: "../slideMasters/slideMaster1.xml" }
    ]));

    zip.file("ppt/slideMasters/slideMaster1.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + SLIDE_CX + '" cy="' + SLIDE_CY + '"/><a:chOff x="0" y="0"/><a:chExt cx="' + SLIDE_CX + '" cy="' + SLIDE_CY + '"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>');
    zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", relationships([
      { id: "rId1", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout", target: "../slideLayouts/slideLayout1.xml" },
      { id: "rId2", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme", target: "../theme/theme1.xml" }
    ]));

    zip.file("ppt/theme/theme1.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Pakki"><a:themeElements><a:clrScheme name="Pakki"><a:dk1><a:srgbClr val="' + deckStyle.ink + '"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="' + deckStyle.ink2 + '"/></a:dk2><a:lt2><a:srgbClr val="' + deckStyle.bg + '"/></a:lt2><a:accent1><a:srgbClr val="' + deckStyle.accent + '"/></a:accent1><a:accent2><a:srgbClr val="2D8C7F"/></a:accent2><a:accent3><a:srgbClr val="41744D"/></a:accent3><a:accent4><a:srgbClr val="8A4E7D"/></a:accent4><a:accent5><a:srgbClr val="D09A21"/></a:accent5><a:accent6><a:srgbClr val="7A3010"/></a:accent6><a:hlink><a:srgbClr val="' + deckStyle.accent + '"/></a:hlink><a:folHlink><a:srgbClr val="' + deckStyle.ink2 + '"/></a:folHlink></a:clrScheme><a:fontScheme name="Pakki"><a:majorFont><a:latin typeface="Bricolage Grotesque"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Montserrat"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Pakki"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="15000"/><a:satMod val="350000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="1"/></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="100000"/><a:shade val="100000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="50000"/><a:shade val="100000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="15000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="1"/></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:shade val="100000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="50000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>');
    zip.file("ppt/presProps.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>');
    zip.file("ppt/viewProps.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:slideViewPr><p:cSldViewPr><p:cViewPr varScale="1"><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr><p:guideLst/></p:cSldViewPr></p:slideViewPr></p:viewPr>');
    zip.file("ppt/tableStyles.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>');
    zip.file("docProps/app.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Pakki</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>' + slides.length + '</Slides></Properties>');
    zip.file("docProps/core.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xml(title) + '</dc:title><dc:creator>Pakki</dc:creator><cp:lastModifiedBy>Pakki</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2026-05-06T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-05-06T00:00:00Z</dcterms:modified></cp:coreProperties>');
  }

  function createPptxBlob(markdown, options) {
    options = options || {};
    var title = options.title || currentFilename;
    var slides = buildSlides(markdown, title);
    var zip = new window.JSZip();

    addStaticParts(zip, slides, title);
    return getLogoSvg().then(function (logoSvg) {
      zip.file("ppt/media/reflector-logo-orange.svg", logoSvg);
      slides.forEach(function (slide, index) {
        var num = index + 1;
        zip.file("ppt/slides/slide" + num + ".xml", slide.xml());
        zip.file("ppt/slides/_rels/slide" + num + ".xml.rels", relationships([
          { id: "rId1", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout", target: "../slideLayouts/slideLayout1.xml" }
        ].concat(slide.rels)));
      });

      return zip.generateAsync({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      });
    });
  }

  function downloadBlob(blob, filename) {
    var link = document.createElement("a");
    var url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function loadFile(file) {
    currentFilename = file.name.replace(/\.[^.]+$/, "") || "dokumentti";
    var reader = new FileReader();
    reader.onload = function () {
      try {
        setDocumentLoaded(file.name, reader.result, window.PakkiMarkdown.render(reader.result));
      } catch (error) {
        setError(file.name, "Markdown-tiedostoa ei voitu muuntaa PowerPointiksi.");
        console.error(error);
      }
    };
    reader.onerror = function () {
      setError(file.name, "Tiedostoa ei voitu lukea.");
    };
    reader.readAsText(file, "UTF-8");
  }

  function pickFile(files) {
    if (files && files[0]) loadFile(files[0]);
  }

  dropHint.addEventListener("click", function () {
    filePicker.click();
  });

  filePicker.addEventListener("change", function () {
    pickFile(filePicker.files);
    filePicker.value = "";
  });

  dropHint.addEventListener("dragover", function (event) {
    event.preventDefault();
    dropHint.classList.add("drag-over");
  });

  dropHint.addEventListener("dragleave", function () {
    dropHint.classList.remove("drag-over");
  });

  dropHint.addEventListener("drop", function (event) {
    event.preventDefault();
    dropHint.classList.remove("drag-over");
    pickFile(event.dataTransfer.files);
  });

  reloadBtn.addEventListener("click", function () {
    currentMarkdown = "";
    document.body.classList.remove("has-document");
    preview.innerHTML = "";
    footerNote.textContent = "";
    reloadBtn.disabled = true;
    pptBtn.disabled = true;
    filePicker.value = "";
  });

  pptBtn.addEventListener("click", function () {
    pptBtn.disabled = true;
    pptBtn.textContent = "Luodaan...";
    createPptxBlob(currentMarkdown, { title: currentFilename })
      .then(function (blob) {
        downloadBlob(blob, currentFilename + ".pptx");
      })
      .catch(function (error) {
        console.error(error);
        alert("PowerPoint-tiedoston luonti epäonnistui.");
      })
      .finally(function () {
        pptBtn.disabled = false;
        pptBtn.textContent = "Lataa PowerPoint";
      });
  });

  window.MarkdownPowerPoint = {
    buildSlides: buildSlides,
    createPptxBlob: createPptxBlob,
    markdownToSlides: markdownToSlides
  };
}());
