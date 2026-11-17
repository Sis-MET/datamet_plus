import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MousePointerClick } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { SIN_TECNICO, formatoDuracion, formatoHoras } from '../domain/tiempos';
import { SIN_DEPARTAMENTO, agruparPuntos, poligonosDepartamentos } from '../domain/ubicacion';

/*
 * Mapa base con calles y zonas. Con la clave de CARTO (VITE_CARTO_API_KEY,
 * en .env.local; no se sube al repositorio) usa sus estilos Voyager en claro y
 * Dark Matter en oscuro, que siguen al tema de la app. Sin clave, usa
 * OpenStreetMap atenuado o invertido con CSS (tiempos.css). La clave viaja en
 * las direcciones de las teselas: CARTO la da para usarse en el navegador.
 */
const CLAVE_CARTO = String(import.meta.env.VITE_CARTO_API_KEY || '').trim();
const OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const CARTO = {
  claro: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CLAVE_CARTO)}`,
  oscuro: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CLAVE_CARTO)}`,
};
const ATRIBUCION_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
const ATRIBUCION = CLAVE_CARTO
  ? `${ATRIBUCION_OSM} &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>`
  : ATRIBUCION_OSM;
const temaOscuro = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
const urlTeselas = () => (CLAVE_CARTO ? (temaOscuro() ? CARTO.oscuro : CARTO.claro) : OSM);
const BOLIVIA = L.latLngBounds([-22.95, -69.7], [-9.65, -57.45]);
/** Puntos a menos de esta distancia en pantalla se juntan en uno. */
const RADIO_GRUPO_PX = 26;

const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fechaCorta = iso => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const masFrecuentes = (valores, cuantos = 3) => {
  const cuenta = new Map();
  for (const valor of valores) if (valor) cuenta.set(valor, (cuenta.get(valor) || 0) + 1);
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, cuantos);
};

/** Intensidad 0–1 (raíz: los departamentos chicos no se pierden). */
const intensidad = (valor, maximo) => (maximo > 0 && valor > 0 ? Math.sqrt(valor / maximo) : 0);

const fila = (etiqueta, valor) => `<div class="mapa-fila"><span>${escapar(etiqueta)}</span><strong>${escapar(valor)}</strong></div>`;

const htmlDepartamento = (d) => `
  <p class="mapa-globo-titulo">${escapar(d.nombre)}</p>
  <p class="mapa-globo-sub">${d.parte} % del período · clic para filtrar</p>
  ${fila('Servicios', d.servicios)}${fila('Horas', formatoHoras(d.minutos))}${fila('Media', formatoDuracion(d.promedio))}${fila('Con GPS', d.conUbicacion)}`;

const htmlServicio = (s, orden, nombreGrupo) => `
  <p class="mapa-globo-titulo">${escapar(s.cliente || 'Sin cliente')}</p>
  <p class="mapa-globo-sub">${escapar([s.planta, s.equipo].filter(Boolean).join(' · '))}</p>
  ${fila('Fecha', fechaCorta(s.fecha))}${fila(orden, s.orden || '—')}${fila('Tipo', nombreGrupo(s.grupo))}
  ${fila('Técnico', s.tecnico || SIN_TECNICO)}${fila('Duración', formatoDuracion(s.minutos))}
  ${s.ubicacion?.precision != null ? `<p class="mapa-globo-nota">Ubicación aproximada (± ${escapar(s.ubicacion.precision)} m)</p>` : ''}`;

const htmlGrupo = (lista) => {
  const fechas = lista.map(s => s.fecha).filter(Boolean).sort();
  return `
    <p class="mapa-globo-titulo">${lista.length} servicios aquí</p>
    <p class="mapa-globo-sub">${fechas.length ? `${escapar(fechaCorta(fechas[0]))} – ${escapar(fechaCorta(fechas[fechas.length - 1]))}` : ''}</p>
    ${masFrecuentes(lista.map(s => s.cliente || 'Sin cliente')).map(([nombre, n]) => fila(nombre, n)).join('')}
    ${fila('Horas', formatoHoras(lista.reduce((suma, s) => suma + (s.minutos || 0), 0)))}
    <p class="mapa-globo-nota">${escapar(masFrecuentes(lista.map(s => s.tecnico || SIN_TECNICO), 3).map(([n]) => n).join(', '))} · clic para acercar</p>`;
};

/**
 * Mapa con calles de Bolivia: los departamentos se tiñen según su volumen y
 * encima van los lugares con GPS, juntos cuando están cerca. Se acerca con
 * Ctrl + rueda (o con la rueda sola si `ruedaLibre`, en el mapa ampliado) y con
 * los botones; pulsar un departamento lo filtra y lo encuadra.
 */
export function MapaInteractivo({
  filas, servicios, departamento, onDepartamento, metrica, colores, nombreGrupo, orden, ruedaLibre = false, className,
}) {
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const capasRef = useRef({});
  const [listo, setListo] = useState(false);
  const [aviso, setAviso] = useState(false);
  // Lo último de cada prop, para los manejadores de Leaflet (se crean una vez).
  const actualRef = useRef({});
  useEffect(() => {
    actualRef.current = { onDepartamento, departamento, orden, nombreGrupo };
  });

  // Crear el mapa una sola vez.
  useEffect(() => {
    const nodo = contenedorRef.current;
    if (!nodo) return undefined;
    const mapa = L.map(nodo, {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
      minZoom: 4,
      maxZoom: 18,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      maxBounds: BOLIVIA.pad(0.8),
      worldCopyJump: false,
    });
    mapa.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'topright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(mapa);
    mapa.fitBounds(BOLIVIA, { padding: [8, 8] });
    const crearTeselas = () => L.tileLayer(urlTeselas(), { attribution: ATRIBUCION, maxZoom: 19 });
    let teselas = crearTeselas().addTo(mapa);
    const panelDepartamentos = mapa.createPane('departamentos');
    panelDepartamentos.style.zIndex = 410;
    // Al acercarse a nivel de ciudad el tinte se desvanece y se leen las calles.
    const atenuar = () => {
      const zoom = mapa.getZoom();
      panelDepartamentos.style.opacity = String(zoom <= 7 ? 1 : Math.max(0.18, 1 - (zoom - 7) * 0.2));
    };
    mapa.on('zoomend', atenuar);
    atenuar();
    capasRef.current = { departamentos: L.layerGroup().addTo(mapa), puntos: L.layerGroup().addTo(mapa) };
    mapaRef.current = mapa;
    // Las capas de datos se dibujan cuando el mapa ya está en pantalla.
    const cuadro = requestAnimationFrame(() => setListo(true));

    // Con CARTO, el estilo del mapa base sigue al tema claro u oscuro de la app.
    // Se cambia la capa entera: `setUrl` vuelve a pedir las teselas con el zoom
    // fraccionario (13,75) y el servidor no las tiene.
    const observador = new MutationObserver(() => {
      if (teselas._url === urlTeselas()) return;
      const anteriores = teselas;
      teselas = crearTeselas().addTo(mapa);
      // La anterior se quita cuando la nueva ya se ve (o a los 4 s), sin parpadeo.
      const quitar = () => mapa.hasLayer(anteriores) && mapa.removeLayer(anteriores);
      teselas.once('load', quitar);
      setTimeout(quitar, 4000);
    });
    if (CLAVE_CARTO) observador.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    // Al cambiar de tamaño (por ejemplo, al ampliar) Leaflet recalcula.
    const redimension = new ResizeObserver(() => mapa.invalidateSize({ pan: false }));
    redimension.observe(nodo);

    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      redimension.disconnect();
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  // Rueda: Ctrl (⌘) + rueda acerca alrededor del puntero; sola, deja bajar por la página y avisa.
  useEffect(() => {
    const nodo = contenedorRef.current;
    if (!nodo) return undefined;
    let temporizador = null;
    const alGirar = (evento) => {
      const mapa = mapaRef.current;
      if (!mapa) return;
      if (!ruedaLibre && !evento.ctrlKey && !evento.metaKey) {
        setAviso(true);
        clearTimeout(temporizador);
        temporizador = setTimeout(() => setAviso(false), 1400);
        return;
      }
      evento.preventDefault();
      const paso = Math.max(-1, Math.min(1, -evento.deltaY / 120)) * (evento.deltaMode === 1 ? 1 : 0.75);
      const zoom = Math.min(mapa.getMaxZoom(), Math.max(mapa.getMinZoom(), mapa.getZoom() + paso));
      mapa.setZoomAround(mapa.mouseEventToContainerPoint(evento), zoom, { animate: true });
      setAviso(false);
    };
    nodo.addEventListener('wheel', alGirar, { passive: false });
    return () => {
      nodo.removeEventListener('wheel', alGirar);
      clearTimeout(temporizador);
    };
  }, [ruedaLibre]);

  // Departamentos teñidos según la métrica.
  useEffect(() => {
    const capa = capasRef.current.departamentos;
    if (!listo || !capa) return;
    capa.clearLayers();
    const valor = metrica === 'horas' ? (f => f.minutos) : (f => f.servicios);
    const porId = new Map(filas.map(f => [f.id, f]));
    const reales = filas.filter(f => f.id !== SIN_DEPARTAMENTO);
    const maximo = Math.max(0, ...reales.map(valor));
    const total = filas.reduce((suma, f) => suma + valor(f), 0);
    for (const poligono of poligonosDepartamentos()) {
      const datos = porId.get(poligono.id);
      const nivel = intensidad(datos ? valor(datos) : 0, maximo);
      const elegido = departamento === poligono.id;
      const atenuado = departamento && !elegido;
      const capaPoligono = L.polygon(poligono.anillos, {
        pane: 'departamentos',
        className: cn('mapa-dep', nivel === 0 && 'is-vacio', elegido && 'is-elegido'),
        weight: elegido ? 3 : 1.4,
        opacity: atenuado ? 0.35 : 0.9,
        fillOpacity: atenuado ? 0.04 : nivel === 0 ? 0.05 : 0.1 + 0.42 * nivel,
        smoothFactor: 1,
      });
      if (datos) {
        capaPoligono.bindTooltip(htmlDepartamento({ ...datos, parte: total ? Math.round((valor(datos) / total) * 100) : 0 }), {
          sticky: true, direction: 'top', offset: [0, -10], className: 'mapa-globo', opacity: 1,
        });
      }
      capaPoligono.on('mouseover', () => capaPoligono.setStyle({ weight: elegido ? 3.5 : 2.6 }));
      capaPoligono.on('mouseout', () => capaPoligono.setStyle({ weight: elegido ? 3 : 1.4 }));
      capaPoligono.on('click', () => {
        const { onDepartamento: alElegir, departamento: actual } = actualRef.current;
        alElegir(actual === poligono.id ? '' : poligono.id);
      });
      capa.addLayer(capaPoligono);
    }
  }, [departamento, filas, listo, metrica]);

  // Encuadre: el departamento elegido o toda Bolivia.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!listo || !mapa) return;
    const poligono = poligonosDepartamentos().find(p => p.id === departamento);
    const destino = poligono ? L.latLngBounds(poligono.anillos.flat()) : BOLIVIA;
    mapa.flyToBounds(destino, { padding: [18, 18], duration: 0.7 });
  }, [departamento, listo]);

  // Lugares con GPS: se juntan según la distancia en pantalla y se rehacen al acercar.
  useEffect(() => {
    const mapa = mapaRef.current;
    const capa = capasRef.current.puntos;
    if (!listo || !mapa || !capa) return undefined;
    const conGps = servicios.filter(s => s.ubicacion && s.punto);
    const dibujar = () => {
      capa.clearLayers();
      const enPantalla = conGps.map((s) => {
        const p = mapa.latLngToLayerPoint([s.ubicacion.lat, s.ubicacion.lng]);
        return { ...s, punto: [p.x, p.y] };
      });
      const maximo = Math.max(1, ...agruparPuntos(enPantalla, RADIO_GRUPO_PX).map(g => g.servicios.length));
      for (const grupo of agruparPuntos(enPantalla, RADIO_GRUPO_PX)) {
        const n = grupo.servicios.length;
        const tamano = Math.round(n === 1 ? 14 : 22 + 16 * Math.sqrt(n / maximo));
        const latlng = mapa.layerPointToLatLng([grupo.x, grupo.y]);
        const color = colores.get(grupo.grupo) || 'rgb(var(--serie-otros))';
        const marcador = L.marker(latlng, {
          icon: L.divIcon({
            className: 'mapa-punto',
            html: `<span style="--punto:${color};width:${tamano}px;height:${tamano}px">${n > 1 ? n : ''}</span>`,
            iconSize: [tamano, tamano],
          }),
          keyboard: false,
          riseOnHover: true,
        });
        const { orden: textoOrden, nombreGrupo: nombre } = actualRef.current;
        marcador.bindTooltip(n === 1 ? htmlServicio(grupo.servicios[0], textoOrden, nombre) : htmlGrupo(grupo.servicios), {
          direction: 'top', offset: [0, -tamano / 2], className: 'mapa-globo', opacity: 1,
        });
        if (n > 1) {
          marcador.on('click', () => {
            const limites = L.latLngBounds(grupo.servicios.map(s => [s.ubicacion.lat, s.ubicacion.lng]));
            if (mapa.getZoom() >= mapa.getMaxZoom() - 1 || limites.getNorthEast().equals(limites.getSouthWest(), 1e-6)) return;
            mapa.flyToBounds(limites.pad(0.4), { maxZoom: 17, duration: 0.6 });
          });
        }
        capa.addLayer(marcador);
      }
    };
    dibujar();
    mapa.on('zoomend', dibujar);
    return () => {
      mapa.off('zoomend', dibujar);
    };
  }, [colores, listo, servicios]);

  return (
    <div className={cn('mapa-interactivo relative overflow-hidden', !CLAVE_CARTO && 'mapa-base-osm', className)}>
      <div ref={contenedorRef} className="absolute inset-0" role="application" aria-label="Mapa de servicios con calles. Ctrl más la rueda del ratón acerca o aleja." />
      {!ruedaLibre && (
        <div className={cn('mapa-aviso pointer-events-none absolute inset-0 z-[500] flex items-center justify-center', aviso && 'is-visible')} aria-hidden="true">
          <span className="glass flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold text-fg shadow-pop">
            <MousePointerClick className="h-4 w-4" />
            Usa <kbd className="kbd">Ctrl</kbd> + rueda para acercar el mapa
          </span>
        </div>
      )}
    </div>
  );
}
