import { BrowserRouter, Routes, Route } from 'react-router'
import Layout from './components/Layout.jsx'
import RutaPrivada from './components/RutaPrivada.jsx'
import Login from './pages/Login/Login.jsx'
import Publico from './pages/Publico/Publico.jsx'
import Inicio from './pages/Inicio/Inicio.jsx'
import Celulas from './pages/Celulas/Celulas.jsx'
import NuevaCelula from './pages/NuevaCelula/NuevaCelula.jsx'
import Ficha from './pages/Ficha/Ficha.jsx'
import Isleta from './pages/Isleta/Isleta.jsx'
import Carga from './pages/Carga/Carga.jsx'
import Resultados from './pages/Resultados/Resultados.jsx'
import Datos from './pages/Datos/Datos.jsx'
import Usuarios from './pages/Usuarios/Usuarios.jsx'
import Lugares from './pages/Lugares/Lugares.jsx'
import Mas from './pages/Mas/Mas.jsx'
import Prueba from './pages/Prueba/Prueba.jsx'
import NoEncontrada from './pages/NoEncontrada/NoEncontrada.jsx'

// Archivo compartido: solo se AGREGAN rutas, nunca se borran las de otra persona.
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pantallas sin barra de navegación */}
        <Route path="/login" element={<Login />} />
        <Route path="/publico/:letra" element={<Publico />} />

        {/* Pantallas internas, con barra de navegación */}
        <Route element={<RutaPrivada><Layout /></RutaPrivada>}>
          <Route index element={<Inicio />} />
          <Route path="celulas" element={<Celulas />} />
          <Route path="celulas/nueva" element={<NuevaCelula />} />
          <Route path="celulas/:id" element={<Ficha />} />
          <Route path="isletas/:id" element={<Isleta />} />
          <Route path="cargar" element={<Carga />} />
          <Route path="cargar/:celulaId" element={<Carga />} />
          <Route path="resultados" element={<Resultados />} />
          <Route path="datos" element={<Datos />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="lugares" element={<Lugares />} />
          <Route path="mas" element={<Mas />} />
          <Route path="prueba" element={<Prueba />} />
          <Route path="*" element={<NoEncontrada />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}