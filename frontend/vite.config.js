import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// El sitio se publica en https://sud-austral.github.io/coipo_web_arbolizacion/
// `base` es lo único que separa un despliegue correcto de una página en blanco:
// todas las URLs de datos y fotos se construyen con import.meta.env.BASE_URL.
export default defineConfig({
  base: '/coipo_web_arbolizacion/',
  plugins: [react()],
})
