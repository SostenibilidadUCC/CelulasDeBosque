import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import Icono from './Icono.jsx'

// Panel que sube desde abajo (por ejemplo, al tocar una celda del plano en T12).
// Se cierra tocando el fondo, con la X o deslizándolo hacia abajo con el dedo.
// Por dentro usa el Drawer de shadcn (librería vaul), que ya resuelve el deslizar con el dedo.
export default function PanelInferior({ abierto, titulo, onCerrar, children }) {
  return (
    <Drawer
      open={abierto}
      onOpenChange={(abrir) => {
        if (!abrir) onCerrar()
      }}
    >
      <DrawerContent aria-describedby={undefined} className="mx-auto max-h-[85svh] max-w-[640px] rounded-t-2xl border-0 bg-superficie shadow-nivel-2">
        <div className="overflow-y-auto px-4 pt-3 pb-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <DrawerTitle className="text-headline-sm font-semibold text-texto">{titulo}</DrawerTitle>
            <DrawerClose
              className="flex size-12 shrink-0 items-center justify-center rounded-xl text-texto-2 hover:bg-gris-suave focus-visible:ring-[3px] focus-visible:ring-hoja/40 focus-visible:outline-none"
              aria-label="Cerrar"
            >
              <Icono nombre="close" />
            </DrawerClose>
          </div>
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
