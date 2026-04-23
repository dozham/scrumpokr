'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from './ThemeProvider'

export function ModernBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useTheme()
  const themeRef = useRef(theme)

  // Keep ref in sync with theme to avoid restarting the animation loop
  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = window.innerWidth
    let height = window.innerHeight

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    window.addEventListener('resize', resize)
    resize()

    // Indirect focal point target
    let targetX = width / 2
    let targetY = height / 2
    let currentX = width / 2
    let currentY = height / 2

    const onMouseMove = (e: MouseEvent) => {
      targetX = e.clientX
      targetY = e.clientY
    }
    window.addEventListener('mousemove', onMouseMove)

    let time = 0

    const render = () => {
      time += 0.002 // Slow natural drift

      // Lerp current position towards mouse target for "indirect" feeling
      currentX += (targetX - currentX) * 0.015
      currentY += (targetY - currentY) * 0.015

      ctx.clearRect(0, 0, width, height)

      const isDark = themeRef.current === 'dark'

      // Soft gradient colors that match the light/dark themes
      // Orb 1: Follows mouse indirectly (Sky blue)
      const orb1Color = isDark ? 'rgba(14, 165, 233, 0.08)' : 'rgba(14, 165, 233, 0.12)'
      // Orb 2: Drifts naturally (Purple/Violet)
      const orb2Color = isDark ? 'rgba(139, 92, 246, 0.07)' : 'rgba(139, 92, 246, 0.1)'
      // Orb 3: Another drifter to add complexity (Fuchsia/Pink)
      const orb3Color = isDark ? 'rgba(217, 70, 239, 0.05)' : 'rgba(217, 70, 239, 0.07)'

      const drawOrb = (x: number, y: number, radius: number, color: string) => {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      // Calculate drifting positions using sine waves for natural movement
      const driftX1 = width / 2 + Math.cos(time) * width * 0.3
      const driftY1 = height / 2 + Math.sin(time * 0.8) * height * 0.3

      const driftX2 = width / 2 + Math.sin(time * 1.2) * width * 0.35
      const driftY2 = height / 2 + Math.cos(time * 1.1) * height * 0.35

      // The base background color is handled by the canvas className (Tailwind classes)
      // We only draw the soft, glowing highlight orbs on top of it
      drawOrb(driftX1, driftY1, width * 0.6, orb2Color)
      drawOrb(driftX2, driftY2, width * 0.7, orb3Color)
      drawOrb(currentX, currentY, width * 0.5, orb1Color)

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 w-full h-full bg-sky-50 dark:bg-gray-950 transition-colors duration-700 pointer-events-none"
    />
  )
}
