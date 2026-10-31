import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

// Ventana centrada para confirmar algo. Se cierra tocando el fondo o con la tecla Escape.
// Por dentro usa el Dialog de shadcn: también mantiene el foco del teclado adentro mientras está abierta.
export default function Modal({ abierto, titulo, onCerrar, children }) {
  return (
    <Dialog
      open={abierto}
      onOpenChange={(abrir) => {
        if (!abrir) onCerrar()
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="max-w-[400px] gap-0 rounded-2xl border-0 bg-superficie p-6 shadow-nivel-2 sm:max-w-[400px]"
      >
        <DialogTitle className="mb-4 text-headline-sm font-semibold text-texto">{titulo}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  )
}
