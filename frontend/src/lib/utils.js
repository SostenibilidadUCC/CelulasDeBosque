import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge tiene que conocer los tamaños de texto propios (index.css). Si no, confunde
// "text-body-md" con un color y borra "text-white" (o al revés) al juntar clases.
const tamanosDeTexto = [
  'headline-xl',
  'headline-lg',
  'headline-md',
  'headline-sm',
  'body-lg',
  'body-md',
  'body-sm',
  'label-lg',
  'label-md',
  'label-sm',
  'code-tag',
]

const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: tamanosDeTexto },
    classGroups: { shadow: [{ shadow: ['nivel-1', 'nivel-2'] }] },
  },
})

// Junta clases de Tailwind. Si dos clases chocan (por ejemplo "h-9" y "h-12"), gana la última.
export function cn(...entradas) {
  return twMerge(clsx(entradas))
}
