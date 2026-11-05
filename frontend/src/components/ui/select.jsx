import { cn } from "@/lib/utils"
import { Select as SelectPrimitive } from "radix-ui"
import Icono from "../Icono.jsx"

// Select de shadcn/ui (sobre Radix), con los colores y radios de la app.
// Se escribió a mano en lugar de "npx shadcn add select" para no sumar dependencias:
// usa el paquete radix-ui que ya está instalado.

function Select(props) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectValue(props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({ className, children, ...props }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-12 w-full items-center justify-between gap-2 rounded-xl border-[1.5px] border-niebla bg-superficie pr-3.5 pl-3.5 text-left text-body-lg text-texto",
        "focus-visible:border-bosque-hover focus-visible:ring-[3px] focus-visible:ring-hoja/25 focus-visible:outline-none",
        "data-[state=open]:border-bosque-hover [&>span]:truncate",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <Icono nombre="expand_more" className="shrink-0 text-texto-2" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

// La lista abierta: tarjeta blanca con borde, radio de 16 px y sombra nivel 2, del mismo ancho
// que el campo. Si no entra en la pantalla, se desplaza adentro.
function SelectContent({ className, children, ...props }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position="popper"
        sideOffset={6}
        className={cn(
          "z-50 max-h-[min(var(--radix-select-content-available-height),360px)] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-borde bg-superficie shadow-nivel-2",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

// Cada opción: 48 px de alto (zona táctil), fondo tonal al pasar o elegir con el teclado,
// y la elegida en verde bosque con un tilde (color + ícono, nunca solo color).
function SelectItem({ className, children, ...props }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-12 cursor-pointer items-center gap-2 rounded-xl py-2 pr-10 pl-3 text-body-lg text-texto outline-none select-none",
        "data-[highlighted]:bg-tonal data-[state=checked]:font-semibold data-[state=checked]:text-bosque",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-3 flex items-center">
        <Icono nombre="check" tamano="chico" className="text-bosque-hover" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
