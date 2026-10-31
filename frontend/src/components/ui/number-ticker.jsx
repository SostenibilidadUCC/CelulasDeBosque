"use client";
import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react"

import { cn } from "@/lib/utils"

// Formato argentino: punto de miles y coma decimal (1.420 / 4,2).
function formatoArgentino(numero, decimales) {
  return Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(numero)
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}) {
  const ref = useRef(null)
  const motionValue = useMotionValue(direction === "down" ? value : startValue)
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  })
  const isInView = useInView(ref, { once: true, margin: "0px" })
  // Si el teléfono pide menos movimiento, se muestra el número final sin contar.
  const sinMovimiento = useReducedMotion()

  useEffect(() => {
    if (sinMovimiento && ref.current) {
      ref.current.textContent = formatoArgentino(direction === "down" ? startValue : value, decimalPlaces)
    }
  }, [sinMovimiento, value, startValue, direction, decimalPlaces])

  useEffect(() => {
    let timer = null

    if (isInView && !sinMovimiento) {
      timer = setTimeout(() => {
        motionValue.set(direction === "down" ? startValue : value)
      }, delay * 1000)
    }

    return () => {
      if (timer !== null) {
        clearTimeout(timer)
      }
    };
  }, [motionValue, isInView, sinMovimiento, delay, value, direction, startValue])

  useEffect(() =>
    springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = formatoArgentino(Number(latest.toFixed(decimalPlaces)), decimalPlaces)
      }
    }), [springValue, decimalPlaces])

  return (
    <span
      ref={ref}
      className={cn("inline-block tabular-nums", className)}
      {...props}>
      {formatoArgentino(startValue, decimalPlaces)}
    </span>
  );
}
