import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from 'react';
import logoMetrica from '../../../../assets/logoMetrica2.png';
import { decimalesInstrumento, rangosInstrumento } from '../../domain/calculos';
import { hojasDeFotos, textoPie } from '../../domain/informe';
import { paginar } from '../../domain/paginacion';
import { Bloque, EncabezadoInforme } from './bloques';

/** Membrete de las plantillas: logotipo y direcciones de La Paz y Santa Cruz. */
function Membrete() {
  return (
    <header className="st-membrete">
      <div className="st-membrete-logo">
        <img src={logoMetrica} alt="Métrica Ltda. Expertos en sistemas de pesaje" />
        <span>www.metrica.com.bo</span>
      </div>
      <div className="st-membrete-dir">
        <div className="st-dir-lp">
          <strong>LA PAZ ▼</strong>
          <span>Pje. Gral. Donato Cardozo N° 715-B</span>
          <span>Fernando Guachalla, Sopocachi</span>
          <span>591 2 2422060 - 591 2 2910878</span>
          <strong>* comercial@metrica.com.bo</strong>
        </div>
        <div className="st-dir-sc">
          <strong>▼ SANTA CRUZ</strong>
          <span>Prolongación Mutualista N° 6170</span>
          <span>Entre 6to y 7mo Anillo</span>
          <span>+591 67010001</span>
          <strong>* info@metrica.com.bo</strong>
        </div>
      </div>
    </header>
  );
}

/**
 * Pie de cada hoja (NB/ISO/IEC 17025, 7.8.2.1 y 7.8.8): informe, revisión,
 * quién la emitió y cuándo, a qué revisión reemplaza, número de hoja y el fin
 * del informe en la última.
 */
function Pie({ pie, pagina, total }) {
  if (!pie) return null;
  return (
    <footer className="st-pie">
      <span>{textoPie(pie)}</span>
      <span>
        Página {pagina} de {total}
        {pagina === total && <strong> · Fin del informe</strong>}
      </span>
    </footer>
  );
}

function Hoja({ borrador, pie, pagina, total, children }) {
  return (
    <section className="st-pagina">
      <Membrete />
      <div className="st-cuerpo">{children}</div>
      <Pie pie={pie} pagina={pagina} total={total} />
      {borrador && <div className="st-marca" aria-hidden="true">BORRADOR</div>}
    </section>
  );
}

function HojaFotos({ fotos, inicio, borrador, ...hoja }) {
  return (
    <Hoja borrador={borrador} {...hoja}>
      <div className="st-fotos">
        <div className="st-c st-barra">REGISTRO FOTOGRAFICO</div>
        <div className="st-fotos-grid">
          {Array.from({ length: 6 }, (_, index) => {
            const foto = fotos[index];
            return (
              <figure key={index} className="st-foto">
                <figcaption className="st-foto-titulo">Foto {inicio + index}</figcaption>
                <div className="st-foto-imagen">
                  {foto ? <img src={foto.url} alt={foto.descripcion || `Foto ${inicio + index}`} /> : <span>SIN FOTOGRAFIA</span>}
                </div>
                <div className="st-foto-desc">{foto?.descripcion || ''}</div>
              </figure>
            );
          })}
        </div>
      </div>
    </Hoja>
  );
}

const BLOQUE_REVISIONES = { tipo: 'texto', id: 'revisiones', titulo: 'Revisiones del informe:', campo: 'revisiones' };

/**
 * Informe completo como hojas A4, igual en pantalla y en el PDF. El mismo
 * componente sirve para la vista previa y para imprimir.
 */
export const InformeDocumento = forwardRef(function InformeDocumento(
  { plantilla, numero, valores, fotos = [], borrador = false, pie = null, notas = null },
  ref,
) {
  const medidorRef = useRef(null);
  const [paginas, setPaginas] = useState(null);

  const contexto = useMemo(() => ({
    rangos: rangosInstrumento(valores),
    decimales: decimalesInstrumento(valores),
    unidad: String(valores.unidades ?? '').trim(),
  }), [valores]);

  // Los bloques opcionales (p. ej. la conclusión del técnico) sin texto no se imprimen.
  const conTexto = (bloque) => !bloque.opcional || String(valores[bloque.campo] ?? '').trim() !== '';
  // Con reemisiones, el informe cierra con el motivo de cada revisión (7.8.8).
  const bloques = [
    { tipo: 'encabezado', id: 'encabezado' },
    ...plantilla.bloques.filter(conTexto),
    ...(notas ? [BLOQUE_REVISIONES] : []),
  ];

  const render = (bloque) => {
    if (bloque.tipo === 'encabezado') return <EncabezadoInforme titulo={plantilla.titulo} numero={numero} />;
    if (bloque === BLOQUE_REVISIONES) return <Bloque bloque={bloque} valores={{ [bloque.campo]: notas }} contexto={contexto} />;
    return <Bloque bloque={bloque} valores={valores} contexto={contexto} />;
  };

  // Medir en cada cambio de datos: el informe se pagina como se imprimirá.
  useLayoutEffect(() => {
    const medidor = medidorRef.current;
    if (!medidor) return undefined;
    const medir = () => {
      const cuerpo = medidor.querySelector('.st-cuerpo');
      const disponible = cuerpo?.clientHeight || 0;
      // Al imprimir el medidor queda oculto (y la app puede redibujarse por
      // el cambio de ancho): sin medidas válidas se conserva la paginación.
      if (disponible === 0) return;
      const alturas = [...medidor.querySelectorAll('[data-bloque]')].map(nodo => nodo.offsetHeight);
      const saltos = bloques.map(bloque => Boolean(bloque.nuevaPagina));
      const nuevas = paginar(alturas, disponible, saltos);
      setPaginas(actual => (JSON.stringify(actual) === JSON.stringify(nuevas) ? actual : nuevas));
    };
    medir();
    // Century Gothic puede cargar después: se vuelve a medir.
    let activo = true;
    document.fonts?.ready?.then(() => {
      if (activo) medir();
    });
    return () => {
      activo = false;
    };
  });

  const hojasFotos = hojasDeFotos(fotos);
  // Paginación de la medición anterior: solo índices que siguen existiendo.
  const hojas = (paginas || [bloques.map((_, index) => index)])
    .map(indices => indices.filter(index => index < bloques.length))
    .filter(indices => indices.length > 0);
  const total = hojas.length + hojasFotos.length;

  return (
    <>
      {/* Medidor fuera de pantalla, sin escala: una hoja con todos los bloques. */}
      <div className="st-doc st-medidor" aria-hidden="true" ref={medidorRef}>
        <section className="st-pagina">
          <Membrete />
          <div className="st-cuerpo">
            <div className="st-flujo">
              {bloques.map(bloque => (
                <div key={bloque.id} data-bloque className="st-bloque">{render(bloque)}</div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="st-doc" ref={ref}>
        {hojas.map((indices, numeroHoja) => (
          <Hoja key={`h${numeroHoja}`} borrador={borrador} pie={pie} pagina={numeroHoja + 1} total={total}>
            {indices.map(index => (
              <div key={bloques[index].id} className="st-bloque">{render(bloques[index])}</div>
            ))}
          </Hoja>
        ))}
        {hojasFotos.map((hoja, index) => (
          <HojaFotos
            key={`f${index}`}
            fotos={hoja}
            inicio={index * 6 + 1}
            borrador={borrador}
            pie={pie}
            pagina={hojas.length + index + 1}
            total={total}
          />
        ))}
      </div>
    </>
  );
});
