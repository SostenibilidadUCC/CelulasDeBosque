import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

// Lista de preguntas que se abren al tocarlas. Por dentro usa el Accordion de shadcn (components/ui).
// items: [{ pregunta, respuesta }]. Se puede abrir una sola a la vez; tocarla de nuevo la cierra.
export default function Acordeon({ items }) {
  return (
    <Accordion type="single" collapsible className="rounded-2xl border border-borde bg-superficie px-4 shadow-nivel-1 sm:px-6">
      {items.map((item) => (
        <AccordionItem key={item.pregunta} value={item.pregunta} className="border-borde">
          <AccordionTrigger className="min-h-14 items-center py-4 text-headline-sm font-semibold text-texto hover:no-underline focus-visible:ring-hoja/40 [&>svg]:size-6 [&>svg]:text-bosque">
            {item.pregunta}
          </AccordionTrigger>
          <AccordionContent className="max-w-[65ch] pb-5 text-body-lg text-texto-2">{item.respuesta}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
