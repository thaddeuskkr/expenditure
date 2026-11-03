// Deterministic exports of the existing arrow mark in the Charcoal & Mauve palette.
// Run from ExpenditureTracker: swift scripts/generate-brand-assets.swift
import AppKit
import CoreText

let web = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let native = web.deletingLastPathComponent().appendingPathComponent("Expenditure")
let mauve = "D6B4D5", charcoal = "1C181D"
func color(_ hex: String) -> NSColor {
    let value = UInt32(hex, radix: 16)!
    return NSColor(srgbRed: CGFloat((value >> 16) & 255) / 255,
                   green: CGFloat((value >> 8) & 255) / 255,
                   blue: CGFloat(value & 255) / 255, alpha: 1)
}
func bitmap(_ width: Int, _ height: Int, alpha: Bool = false, draw: () -> Void) -> NSBitmapImageRep {
    let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
                            bytesPerRow: width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                            bitmapInfo: (alpha ? CGImageAlphaInfo.premultipliedLast : .noneSkipLast).rawValue)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
    draw()
    NSGraphicsContext.restoreGraphicsState()
    return NSBitmapImageRep(cgImage: context.makeImage()!)
}
func arrow(_ rect: CGRect, background: String, foreground: String, rounded: Bool) {
    let context = NSGraphicsContext.current!.cgContext
    context.saveGState()
    context.translateBy(x: rect.minX, y: rect.minY)
    context.scaleBy(x: rect.width / 64, y: rect.height / 64)
    context.setFillColor(color(background).cgColor)
    let bounds = CGRect(x: 0, y: 0, width: 64, height: 64)
    context.addPath(CGPath(roundedRect: bounds, cornerWidth: rounded ? 17 : 0, cornerHeight: rounded ? 17 : 0, transform: nil))
    context.fillPath()
    context.setStrokeColor(color(foreground).cgColor)
    context.setLineWidth(3)
    context.setLineCap(.round)
    context.setLineJoin(.round)
    context.move(to: CGPoint(x: 21, y: 21))
    context.addLine(to: CGPoint(x: 43, y: 43))
    context.move(to: CGPoint(x: 21, y: 43))
    context.addLine(to: CGPoint(x: 43, y: 43))
    context.addLine(to: CGPoint(x: 43, y: 21))
    context.strokePath()
    context.restoreGState()
}
func icon(_ size: Int, background: String, foreground: String, rounded: Bool = false, alpha: Bool = false) -> Data {
    bitmap(size, size, alpha: alpha) {
        color(background).setFill()
        NSRect(x: 0, y: 0, width: size, height: size).fill()
        arrow(CGRect(x: 0, y: 0, width: size, height: size), background: background, foreground: foreground, rounded: rounded)
    }.representation(using: .png, properties: [:])!
}
func write(_ data: Data, _ url: URL) throws { try data.write(to: url, options: .atomic) }
let nativeIcons = native.appendingPathComponent("Expenditure/Assets.xcassets/AppIcon.appiconset")
try write(icon(1024, background: mauve, foreground: charcoal), nativeIcons.appendingPathComponent("AppIcon.png"))
try write(icon(1024, background: charcoal, foreground: mauve), nativeIcons.appendingPathComponent("AppIcon-dark.png"))
try write(icon(1024, background: "1A1A1A", foreground: "D0D0D0"), nativeIcons.appendingPathComponent("AppIcon-tinted.png"))
for size in [192, 512] {
    try write(icon(size, background: mauve, foreground: charcoal), web.appendingPathComponent("public/icons/icon-\(size).png"))
}
try write(icon(512, background: mauve, foreground: charcoal), web.appendingPathComponent("public/icons/icon-maskable-512.png"))
try write(icon(180, background: mauve, foreground: charcoal), web.appendingPathComponent("src/app/apple-icon.png"))

func little<T: FixedWidthInteger>(_ value: T) -> Data {
    var number = value.littleEndian
    return withUnsafeBytes(of: &number) { Data($0) }
}
let sizes = [16, 32, 48]
let frames = sizes.map { icon($0, background: mauve, foreground: charcoal, alpha: true) }
var ico = little(UInt16(0)) + little(UInt16(1)) + little(UInt16(frames.count))
var offset = 6 + 16 * frames.count
for (size, frame) in zip(sizes, frames) {
    ico += Data([UInt8(size), UInt8(size), 0, 0]) + little(UInt16(1)) + little(UInt16(32))
    ico += little(UInt32(frame.count)) + little(UInt32(offset))
    offset += frame.count
}
frames.forEach { ico += $0 }
try write(ico, web.appendingPathComponent("src/app/favicon.ico"))

let fontURL = native.appendingPathComponent("Expenditure/Resources/SpaceGrotesk-Regular.ttf")
CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)
@discardableResult
func text(_ value: String, at point: CGPoint, size: CGFloat, hex: String) -> CGFloat {
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont(name: "SpaceGrotesk-Regular", size: size)!, .foregroundColor: color(hex),
    ]
    (value as NSString).draw(at: point, withAttributes: attributes)
    return (value as NSString).size(withAttributes: attributes).width
}
let social = bitmap(1200, 630) {
    color(charcoal).setFill()
    NSRect(x: 0, y: 0, width: 1200, height: 630).fill()
    arrow(CGRect(x: 80, y: 310, width: 96, height: 96), background: mauve, foreground: charcoal, rounded: true)
    let titleWidth = text("expenditure", at: CGPoint(x: 204, y: 295), size: 88, hex: "F3EDF3")
    text(".", at: CGPoint(x: 204 + titleWidth, y: 295), size: 88, hex: mauve)
    text("Expenses, budgets, and shared spending with Circles.", at: CGPoint(x: 80, y: 205), size: 32, hex: "C1B1C1")
    text("expenditure.tkkr.dev", at: CGPoint(x: 80, y: 52), size: 20, hex: "C1B1C1")
}
try write(social.representation(using: .png, properties: [:])!, web.appendingPathComponent("public/images/social-card.png"))
print("Exported Mauve native icons, web icons, favicon and social card.")
