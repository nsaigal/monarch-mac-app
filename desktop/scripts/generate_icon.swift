import AppKit
import Foundation

let desktopURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let assetsURL = desktopURL.appendingPathComponent("assets", isDirectory: true)
let iconsetURL = assetsURL.appendingPathComponent("app.iconset", isDirectory: true)
let icnsURL = assetsURL.appendingPathComponent("app-icon.icns")
let pngURL = assetsURL.appendingPathComponent("app-icon.png")

let iconFiles: [(name: String, size: Int)] = [
  ("icon_16x16.png", 16),
  ("icon_16x16@2x.png", 32),
  ("icon_32x32.png", 32),
  ("icon_32x32@2x.png", 64),
  ("icon_128x128.png", 128),
  ("icon_128x128@2x.png", 256),
  ("icon_256x256.png", 256),
  ("icon_256x256@2x.png", 512),
  ("icon_512x512.png", 512),
  ("icon_512x512@2x.png", 1024)
]

func color(_ hex: UInt32, alpha: CGFloat = 1.0) -> NSColor {
  let red = CGFloat((hex >> 16) & 0xff) / 255
  let green = CGFloat((hex >> 8) & 0xff) / 255
  let blue = CGFloat(hex & 0xff) / 255
  return NSColor(calibratedRed: red, green: green, blue: blue, alpha: alpha)
}

func roundedPath(_ rect: CGRect, radius: CGFloat) -> NSBezierPath {
  NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
}

func fill(_ path: NSBezierPath, gradient: NSGradient, angle: CGFloat) {
  NSGraphicsContext.saveGraphicsState()
  path.addClip()
  gradient.draw(in: path.bounds, angle: angle)
  NSGraphicsContext.restoreGraphicsState()
}

func savePNG(_ rep: NSBitmapImageRep, to url: URL) throws {
  guard let data = rep.representation(using: .png, properties: [:]) else {
    throw NSError(domain: "IconGeneration", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to encode PNG"])
  }

  try data.write(to: url)
}

func drawIcon(size: CGFloat) throws -> NSBitmapImageRep {
  guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: Int(size),
    pixelsHigh: Int(size),
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  ) else {
    throw NSError(domain: "IconGeneration", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to allocate bitmap"])
  }

  rep.size = NSSize(width: size, height: size)

  guard let context = NSGraphicsContext(bitmapImageRep: rep) else {
    throw NSError(domain: "IconGeneration", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to create graphics context"])
  }

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = context
  context.cgContext.setAllowsAntialiasing(true)
  context.cgContext.clear(CGRect(x: 0, y: 0, width: size, height: size))

  let canvas = CGRect(x: 0, y: 0, width: size, height: size)
  let outer = canvas.insetBy(dx: size * 0.06, dy: size * 0.06)
  let outerPath = roundedPath(outer, radius: size * 0.22)
  let outerGradient = NSGradient(colors: [color(0xF8FAF2), color(0xDCE8CA)])!
  fill(outerPath, gradient: outerGradient, angle: -90)
  color(0xC2D3B0, alpha: 0.9).setStroke()
  outerPath.lineWidth = max(1, size * 0.012)
  outerPath.stroke()

  let inner = outer.insetBy(dx: size * 0.085, dy: size * 0.085)
  let innerPath = roundedPath(inner, radius: size * 0.17)
  let innerGradient = NSGradient(colors: [color(0x1A3428), color(0x274637)])!
  fill(innerPath, gradient: innerGradient, angle: -90)

  let sheenRect = CGRect(
    x: inner.minX,
    y: inner.midY,
    width: inner.width,
    height: inner.height * 0.56
  )
  let sheenPath = roundedPath(sheenRect, radius: size * 0.17)
  let sheenGradient = NSGradient(colors: [
    color(0xFFFFFF, alpha: 0.14),
    color(0xFFFFFF, alpha: 0.0)
  ])!
  fill(sheenPath, gradient: sheenGradient, angle: -90)

  let rail = CGRect(
    x: inner.minX + inner.width * 0.18,
    y: inner.minY + inner.height * 0.14,
    width: inner.width * 0.64,
    height: inner.height * 0.07
  )
  let railPath = roundedPath(rail, radius: rail.height / 2)
  color(0xE9F3D6, alpha: 0.16).setFill()
  railPath.fill()

  let jewel = CGRect(
    x: inner.midX - inner.width * 0.065,
    y: inner.maxY - inner.height * 0.27,
    width: inner.width * 0.13,
    height: inner.width * 0.13
  )
  let jewelPath = roundedPath(jewel, radius: jewel.width / 2)
  let jewelGradient = NSGradient(colors: [color(0xF8FBF2), color(0xD5E3C5)])!
  fill(jewelPath, gradient: jewelGradient, angle: -90)

  let barsArea = CGRect(
    x: inner.minX + inner.width * 0.16,
    y: rail.maxY + inner.height * 0.025,
    width: inner.width * 0.68,
    height: inner.height * 0.48
  )
  let heights: [CGFloat] = [0.42, 0.72, 0.54, 0.72, 0.42]
  let gap = barsArea.width * 0.04
  let barWidth = (barsArea.width - gap * CGFloat(heights.count - 1)) / CGFloat(heights.count)
  let barGradient = NSGradient(colors: [color(0xD7F05A), color(0x91D85F)])!
  let barOverlay = NSGradient(colors: [color(0xFFFFFF, alpha: 0.16), color(0xFFFFFF, alpha: 0.0)])!

  for (index, fraction) in heights.enumerated() {
    let x = barsArea.minX + CGFloat(index) * (barWidth + gap)
    let height = max(barsArea.height * fraction, barWidth * 1.35)
    let rect = CGRect(x: x, y: barsArea.minY, width: barWidth, height: height)
    let path = roundedPath(rect, radius: min(barWidth * 0.48, size * 0.07))
    fill(path, gradient: barGradient, angle: -90)
    fill(path, gradient: barOverlay, angle: -90)
  }

  let insetStroke = roundedPath(inner.insetBy(dx: size * 0.01, dy: size * 0.01), radius: size * 0.16)
  color(0xFFFFFF, alpha: 0.1).setStroke()
  insetStroke.lineWidth = max(1, size * 0.007)
  insetStroke.stroke()

  NSGraphicsContext.restoreGraphicsState()
  return rep
}

do {
  let fileManager = FileManager.default
  try fileManager.createDirectory(at: assetsURL, withIntermediateDirectories: true, attributes: nil)
  try fileManager.createDirectory(at: iconsetURL, withIntermediateDirectories: true, attributes: nil)

  for iconFile in iconFiles {
    let rep = try drawIcon(size: CGFloat(iconFile.size))
    try savePNG(rep, to: iconsetURL.appendingPathComponent(iconFile.name))
  }

  let rep = try drawIcon(size: 1024)
  try savePNG(rep, to: pngURL)

  let process = Process()
  process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
  process.arguments = ["-c", "icns", iconsetURL.path, "-o", icnsURL.path]
  try process.run()
  process.waitUntilExit()

  guard process.terminationStatus == 0 else {
    throw NSError(
      domain: "IconGeneration",
      code: Int(process.terminationStatus),
      userInfo: [NSLocalizedDescriptionKey: "iconutil failed with exit code \(process.terminationStatus)"]
    )
  }

  print("Generated \(pngURL.path)")
  print("Generated \(icnsURL.path)")
} catch {
  fputs("Failed to generate icon: \(error.localizedDescription)\n", stderr)
  exit(1)
}
