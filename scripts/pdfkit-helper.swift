// PDF evidence helper for dsh-zotero-research.
//
// Uses macOS PDFKit to (a) render a page to PNG, optionally with highlight
// rectangles, and (b) locate a quoted string and return its page + rectangles.
// Coordinates in and out are Zotero-style: [x0, y0, x1, y1] in PDF points with
// the origin at the TOP-LEFT of the page (Zotero's annotationPosition space).
//
//   pdfkit-helper info   <pdf>
//   pdfkit-helper render <pdf> <pageIndex> <scale> <out.png> [rectsJSON]
//   pdfkit-helper search <pdf> <base64Query> [pageIndex]
//   pdfkit-helper crop   <pdf> <pageIndex> <scale> <out.png> <x> <y> <w> <h>

import Foundation
import PDFKit
import AppKit

func fail(_ message: String, code: Int32 = 1) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(code)
}

func loadDocument(_ path: String) -> PDFDocument {
    guard let doc = PDFDocument(url: URL(fileURLWithPath: path)) else {
        fail("cannot open PDF: \(path)")
    }
    return doc
}

func pageBounds(_ page: PDFPage) -> CGRect {
    page.bounds(for: .mediaBox)
}

/// Zotero rects are top-left origin; PDFKit/CG is bottom-left origin.
func toImageRect(_ zoteroRect: [Double], pageHeight: CGFloat, scale: CGFloat) -> CGRect {
    let x0 = CGFloat(zoteroRect[0])
    let y0 = CGFloat(zoteroRect[1])
    let x1 = CGFloat(zoteroRect[2])
    let y1 = CGFloat(zoteroRect[3])
    let top = min(y0, y1)
    let bottom = max(y0, y1)
    return CGRect(
        x: min(x0, x1) * scale,
        y: pageHeight * scale - bottom * scale,
        width: abs(x1 - x0) * scale,
        height: abs(bottom - top) * scale
    )
}

func renderPage(_ page: PDFPage, scale: CGFloat, highlight: [[Double]]) -> Data {
    let bounds = pageBounds(page)
    let width = max(1, Int((bounds.width * scale).rounded()))
    let height = max(1, Int((bounds.height * scale).rounded()))

    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: width,
        pixelsHigh: height,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else { fail("cannot allocate bitmap") }

    rep.size = NSSize(width: width, height: height)
    guard let context = NSGraphicsContext(bitmapImageRep: rep) else { fail("cannot create context") }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    let cg = context.cgContext
    cg.setFillColor(NSColor.white.cgColor)
    cg.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
    cg.scaleBy(x: scale, y: scale)
    // PDFPage.draw draws with the page's own rotation applied.
    page.draw(with: .mediaBox, to: cg)
    NSGraphicsContext.restoreGraphicsState()

    if !highlight.isEmpty {
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = context
        let cg = context.cgContext
        cg.setFillColor(NSColor.systemYellow.withAlphaComponent(0.35).cgColor)
        for rect in highlight where rect.count == 4 {
            cg.fill(toImageRect(rect, pageHeight: bounds.height, scale: scale))
        }
        NSGraphicsContext.restoreGraphicsState()
    }

    guard let png = rep.representation(using: .png, properties: [:]) else { fail("cannot encode PNG") }
    return png
}

/// Convert a PDFKit selection to Zotero-style top-left rects, line by line.
func zoteroRects(for selection: PDFSelection, on page: PDFPage) -> [[Double]] {
    let bounds = pageBounds(page)
    var rects: [[Double]] = []
    for line in selection.selectionsByLine() {
        let r = line.bounds(for: page)
        if r.isEmpty || r.width <= 0 || r.height <= 0 { continue }
        let x0 = Double(r.minX)
        let x1 = Double(r.maxX)
        let y0 = Double(bounds.height - r.maxY)
        let y1 = Double(bounds.height - r.minY)
        rects.append([x0, y0, x1, y1])
    }
    return rects
}

func emitJSON(_ object: Any) {
    let data = try! JSONSerialization.data(withJSONObject: object, options: [])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write("\n".data(using: .utf8)!)
}

let args = CommandLine.arguments
guard args.count >= 3 else {
    fail("usage: pdfkit-helper <info|render|search|crop> <pdf> ...")
}
let command = args[1]
let path = args[2]

switch command {
case "info":
    let doc = loadDocument(path)
    var pages: [[String: Any]] = []
    for index in 0..<doc.pageCount {
        guard let page = doc.page(at: index) else { continue }
        let b = pageBounds(page)
        pages.append([
            "index": index,
            "width": Double(b.width),
            "height": Double(b.height),
            "label": page.label ?? "",
        ])
    }
    emitJSON(["pageCount": doc.pageCount, "pages": pages])

case "render":
    guard args.count >= 6 else { fail("render needs <pageIndex> <scale> <out.png> [rectsJSON]") }
    let doc = loadDocument(path)
    let index = Int(args[3]) ?? 0
    let scale = CGFloat(Double(args[4]) ?? 1.5)
    let out = args[5]
    var rects: [[Double]] = []
    if args.count >= 7, let data = args[6].data(using: .utf8),
       let parsed = try? JSONSerialization.jsonObject(with: data) as? [[Double]] {
        rects = parsed
    }
    guard let page = doc.page(at: index) else { fail("page \(index) out of range") }
    let png = renderPage(page, scale: scale, highlight: rects)
    try! png.write(to: URL(fileURLWithPath: out))

case "search":
    guard args.count >= 4 else { fail("search needs <base64Query> [pageIndex]") }
    guard let queryData = Data(base64Encoded: args[3]),
          let query = String(data: queryData, encoding: .utf8) else { fail("bad base64 query") }
    let doc = loadDocument(path)
    let onlyPage = args.count >= 5 ? Int(args[4]) : nil
    var results: [[String: Any]] = []
    let selections = doc.findString(query, withOptions: [.caseInsensitive])
    for selection in selections.prefix(20) {
        guard let page = selection.pages.first else { continue }
        guard let pageIndex = doc.index(for: page) as Int? else { continue }
        if let onlyPage, pageIndex != onlyPage { continue }
        let rects = zoteroRects(for: selection, on: page)
        guard !rects.isEmpty else { continue }
        results.append([
            "page": pageIndex,
            "label": page.label ?? "",
            "rects": rects,
            "text": selection.string ?? "",
        ])
        if results.count >= 8 { break }
    }
    emitJSON(["query": query, "results": results])

case "region":
    // region <pdf> <pageIndex> <scale> <out.png> <x> <y> <w> <h> [rectsJSON]
    guard args.count >= 10 else { fail("region needs <pageIndex> <scale> <out.png> <x> <y> <w> <h> [rectsJSON]") }
    let doc = loadDocument(path)
    let index = Int(args[3]) ?? 0
    let scale = CGFloat(Double(args[4]) ?? 2.0)
    let out = args[5]
    guard let page = doc.page(at: index) else { fail("page \(index) out of range") }
    let bounds = pageBounds(page)
    var rx = CGFloat(Double(args[6]) ?? 0)
    var ry = CGFloat(Double(args[7]) ?? 0)
    var rw = CGFloat(Double(args[8]) ?? 0)
    var rh = CGFloat(Double(args[9]) ?? 0)
    rx = max(0, min(rx, bounds.width - 1))
    ry = max(0, min(ry, bounds.height - 1))
    rw = max(1, min(rw, bounds.width - rx))
    rh = max(1, min(rh, bounds.height - ry))
    var rects: [[Double]] = []
    if args.count >= 11, let data = args[10].data(using: .utf8),
       let parsed = try? JSONSerialization.jsonObject(with: data) as? [[Double]] {
        rects = parsed
    }
    let pixelWidth = max(1, Int((rw * scale).rounded()))
    let pixelHeight = max(1, Int((rh * scale).rounded()))
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: pixelWidth, pixelsHigh: pixelHeight,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    ) else { fail("cannot allocate bitmap") }
    rep.size = NSSize(width: pixelWidth, height: pixelHeight)
    guard let context = NSGraphicsContext(bitmapImageRep: rep) else { fail("cannot create context") }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    let cg = context.cgContext
    cg.setFillColor(NSColor.white.cgColor)
    cg.fill(CGRect(x: 0, y: 0, width: CGFloat(pixelWidth), height: CGFloat(pixelHeight)))
    cg.scaleBy(x: scale, y: scale)
    // Map the requested top-left region onto the bitmap origin.
    cg.translateBy(x: -rx, y: -(bounds.height - ry - rh))
    page.draw(with: .mediaBox, to: cg)
    NSGraphicsContext.restoreGraphicsState()
    if !rects.isEmpty {
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = context
        let cg = context.cgContext
        cg.setFillColor(NSColor.systemYellow.withAlphaComponent(0.32).cgColor)
        cg.setStrokeColor(NSColor.systemOrange.withAlphaComponent(0.85).cgColor)
        cg.setLineWidth(1.2)
        for rect in rects where rect.count == 4 {
            let x0 = CGFloat(rect[0]), y0 = CGFloat(rect[1]), x1 = CGFloat(rect[2]), y1 = CGFloat(rect[3])
            let imageRect = CGRect(
                x: (min(x0, x1) - rx) * scale,
                y: (ry + rh - max(y0, y1)) * scale,
                width: abs(x1 - x0) * scale,
                height: abs(y1 - y0) * scale
            )
            cg.fill(imageRect)
            cg.stroke(imageRect)
        }
        NSGraphicsContext.restoreGraphicsState()
    }
    guard let png = rep.representation(using: .png, properties: [:]) else { fail("cannot encode PNG") }
    try! png.write(to: URL(fileURLWithPath: out))

case "crop":
    // crop <pdf> <pageIndex> <scale> <out.png> <x> <y> <w> <h>  (top-left PDF coords)
    guard args.count >= 9 else { fail("crop needs <pageIndex> <scale> <out.png> <x> <y> <w> <h>") }
    let doc = loadDocument(path)
    let index = Int(args[3]) ?? 0
    let scale = CGFloat(Double(args[4]) ?? 1.5)
    let out = args[5]
    guard let page = doc.page(at: index) else { fail("page \(index) out of range") }
    let bx = CGFloat(Double(args[6]) ?? 0)
    let by = CGFloat(Double(args[7]) ?? 0)
    let bw = CGFloat(Double(args[8]) ?? 0)
    let bh = CGFloat(Double(args[9]) ?? 0)
    let bounds = pageBounds(page)
    // Expand to keep legends/axes and surrounding context.
    let padX = max(bw * 0.18, 24)
    let padY = max(bh * 0.28, 24)
    let x0 = max(0, bx - padX)
    let y0 = max(0, by - padY)
    let x1 = min(bounds.width, bx + bw + padX)
    let y1 = min(bounds.height, by + bh + padY)
    let rect = CGRect(
        x: x0 * scale,
        y: (bounds.height - y1) * scale,
        width: (x1 - x0) * scale,
        height: (y1 - y0) * scale
    )
    let full = renderPage(page, scale: scale, highlight: [])
    guard let source = NSBitmapImageRep(data: full),
          let cgSource = source.cgImage,
          let cropped = cgSource.cropping(to: rect) else { fail("cannot crop") }
    let rep = NSBitmapImageRep(cgImage: cropped)
    let png = rep.representation(using: .png, properties: [:])!
    try! png.write(to: URL(fileURLWithPath: out))

default:
    fail("unknown command: \(command)")
}
