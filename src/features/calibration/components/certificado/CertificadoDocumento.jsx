import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from 'react';
import logoMetrica from '../../../../assets/certificado/logo-metrica.jpg';
import simboloMetrica from '../../../../assets/certificado/simbolo-metrica.jpg';
import acreditacion from '../../../../assets/certificado/acreditacion.jpg';
import { paginar } from '../../../soporte/domain/paginacion';
import { tramos } from '../../domain/certificado';
import { esquemaExcentricidad, posicionIndicador, posicionesPlataforma } from '../../domain/excentricidad';
import { GraficoDesviacion, GraficoErrores } from './GraficosCertificado';
import './certificado.css';

const DIRECCION = 'Pasaje Gral. Donato Cardozo N° 715- B, C/Fernando Guachalla, Sopocachi';
const VERIFICADOR = 'https://www.digicert.bo/herramientas/verificador-web/';
const FILAS_POR_TRAMO = 22;

function Encabezado({ numero }) {
  return (
    <header className="cc-encabezado">
      <div className="cc-titulo">
        <img src={logoMetrica} alt="Métrica Ltda." />
        <h1>METRICA LTDA.<br />CERTIFICADO DE CALIBRACIÓN</h1>
      </div>
      <div className="cc-linea">
        <a href="http://www.metrica.com.bo/">www.metrica.com.bo</a>
        <a href="mailto:info@metrica.com.bo">info@metrica.com.bo</a>
        <span className="cc-numero"><span>N°:</span>{numero || 'SIN NÚMERO'}</span>
      </div>
    </header>
  );
}

function Hoja({ numero, pagina, total, borrador, pie, children }) {
  return (
    <section className="cc-pagina">
      <div className="cc-agua" aria-hidden="true"><img src={simboloMetrica} alt="" /></div>
      <Encabezado numero={numero} />
      <div className="cc-cuerpo">{children}</div>
      {pie && <p className="cc-reemplaza">{pie}</p>}
      <footer className="cc-pie">
        <span>{DIRECCION}</span>
        <span>Página {pagina} de {total}</span>
      </footer>
      {borrador && <div className="cc-borrador" aria-hidden="true">BORRADOR</div>}
    </section>
  );
}

/** Hoja 1: cliente, calibrando, datos de la calibración, firmas y leyenda. */
function DatosGenerales({ c }) {
  const filas = [
    ['Lugar de calibración:', c.calibracion.lugar],
    ['Fecha de calibración:', c.calibracion.fecha],
    ['Fecha de emisión:', c.calibracion.fechaEmision],
    ['Condiciones ambientales:', c.calibracion.condiciones],
    ['Patrones de calibración:', c.calibracion.patrones.map(texto => <span key={texto} style={{ display: 'block' }}>{texto}</span>)],
    ['Trazabilidad:', c.calibracion.trazabilidad.map(texto => <span key={texto} style={{ display: 'block' }}>{texto}</span>)],
    ['Alcance de calibración:', <>{c.calibracion.alcance}<span className="cc-nota">{c.calibracion.alcanceNota}</span></>],
    ['Registro de calibración:', c.calibracion.registro],
    c.calibracion.ajuste && ['Ajuste del instrumento:', c.calibracion.ajuste],
    ['Método utilizado:', c.calibracion.metodo],
  ].filter(Boolean);
  const i = c.instrumento;
  return (
    <>
      <div className="cc-cliente-cabecera">
        <div className="cc-seccion">DATOS DEL CLIENTE</div>
        <div className="cc-emision" title="N.º de emisión">{c.emision}</div>
      </div>
      <dl className="cc-cliente">
        <dt>Razón social:</dt><dd>{c.cliente.razonSocial}</dd>
        <dt>Dirección:</dt><dd>{c.cliente.direccion}</dd>
      </dl>
      <div className="cc-seccion">DATOS DEL CALIBRANDO</div>
      <div className="cc-tipo">{i.tipo}</div>
      <div className="cc-calibrando">
        <span>MARCA:</span><span className="cc-v">{i.marca}</span><span>Max:</span><span className="cc-v">{i.max}</span>
        <span>MODELO:</span><span className="cc-v">{i.modelo}</span><span>d:</span><span className="cc-v">{i.d}{i.e ? `   (e: ${i.e})` : ''}</span>
        <span>SERIE:</span><span className="cc-v">{i.serie}</span><span>unid:</span><span className="cc-v">{i.unidad}</span>
        <span>CÓD. INT.:</span><span className="cc-v">{i.codigoInterno}</span><span>ID. INST.:</span><span className="cc-v">{i.idInstrumento}</span>
        {i.clase && <><span>CLASE:</span><span className="cc-v">{i.clase}</span><span /><span /></>}
      </div>
      <div className="cc-seccion">DATOS DE LA CALIBRACIÓN</div>
      <dl className="cc-calibracion">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} style={{ display: 'contents' }}>
            <dt>{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
      <div className="cc-firmas">
        <div>Elaborado por: {c.elaboradoPor}</div>
        <div>Autorizado por:{c.autorizadoPor ? ` ${c.autorizadoPor}` : ''}</div>
        <div className="cc-firma-espacio" />
      </div>
      <div className="cc-legal-bloque">
        <a className="cc-verificar" href={VERIFICADOR}>Verificar la firma digital</a>
        <div className="cc-legal">
          {c.leyenda.map(texto => <p key={texto}>{texto}</p>)}
        </div>
      </div>
    </>
  );
}

/** Figura del receptor de carga con las posiciones, en negro como en CERT. */
function Receptor({ excentricidad }) {
  const esquema = esquemaExcentricidad(excentricidad.plataforma, excentricidad.esquema, excentricidad.lecturas);
  if (!esquema) return null;
  const L = 100;
  const posiciones = posicionesPlataforma(esquema.forma, esquema.puntos);
  const indicador = esquema.indicador ? posicionIndicador(esquema.forma, esquema.indicador) : null;
  const borde = { fill: 'none', stroke: '#000', strokeWidth: 2.2 };
  return (
    <svg viewBox={`0 0 ${L} ${L}`} role="img" aria-label="Receptor de carga con las posiciones">
      {esquema.forma === 'cuadrada' && <rect x={15} y={15} width={70} height={70} {...borde} />}
      {esquema.forma === 'rectangular' && <rect x={12} y={25} width={76} height={50} {...borde} />}
      {esquema.forma === 'circular' && <circle cx={50} cy={50} r={40} {...borde} />}
      {esquema.forma === 'triangular' && <path d="M50 10L90 90H10Z" strokeLinejoin="round" {...borde} />}
      {indicador && <rect x={indicador[0] * L - 11} y={indicador[1] * L - 5} width={22} height={10} fill="#fff" stroke="#000" strokeWidth="1.8" />}
      {posiciones.map(([x, y], index) => (
        <g key={index}>
          <circle cx={x * L} cy={y * L} r={7} fill="#fff" stroke="#000" strokeWidth="1.4" />
          <text x={x * L} y={y * L} dy="0.36em" textAnchor="middle" fontSize="9" fill="#000">{index + 1}</text>
        </g>
      ))}
    </svg>
  );
}

function Excentricidad({ e }) {
  return (
    <div className="cc-excentricidad">
      <table className="cc-tabla">
        <thead>
          <tr>
            <th colSpan={2} className="cc-tabla-titulo">EXCENTRICIDAD</th>
            <th className="cc-tabla-titulo cc-receptor">(CARGA: {e.carga})</th>
          </tr>
          <tr>
            <th>POSICIÓN</th>
            <th>DIFERENCIA AL PUNTO CENTRAL</th>
            <th>RECEPTOR DE CARGA</th>
          </tr>
        </thead>
        <tbody>
          {e.filas.map((fila, index) => (
            <tr key={fila.posicion}>
              <td>{fila.posicion}</td>
              <td>{fila.diferencia}</td>
              {index === 0 && <td rowSpan={e.filas.length} className="cc-receptor"><Receptor excentricidad={e} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Repetibilidad({ r }) {
  return (
    <div className="cc-repetibilidad">
      <div>
        <table className="cc-tabla">
          <thead>
            <tr><th colSpan={3} className="cc-tabla-titulo">REPETIBILIDAD</th></tr>
            <tr><th>CARGA APLICADA</th><th>DESVIACIÓN ESTÁNDAR</th><th>DIF. MÁX. LECTURAS</th></tr>
          </thead>
          <tbody>
            {r.filas.map(fila => (
              <tr key={fila.carga}><td>{fila.carga}</td><td>{fila.s}</td><td>{fila.difMax}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="cc-pequena">Se realizaron {r.repeticiones} repeticiones. {r.nota}</p>
      </div>
      {r.serie.length > 0 && <GraficoDesviacion serie={r.serie} escalaMinima={r.escalaMinima} decimales={r.decimales} />}
    </div>
  );
}

function Errores({ errores, filas, titulo }) {
  return (
    <table className="cc-tabla cc-errores">
      <thead>
        {titulo && <tr><th colSpan={7} className="cc-tabla-titulo">ERRORES DE INDICACIÓN</th></tr>}
        <tr>
          <th>CARGA APLICADA</th>
          <th>ERROR ENCONTRADO</th>
          <th>INCERTIDUMBRE EXPANDIDA</th>
          <th>FACTOR DE COBERTURA <span style={{ textTransform: 'none' }}>k</span></th>
          <th>{errores.encabezadoTolerancia}</th>
          <th>DECLARACIÓN DE CONFORMIDAD</th>
          <th>RIESGO ASOCIADO %</th>
        </tr>
      </thead>
      <tbody>
        {filas.map(fila => (
          <tr key={fila.carga}>
            <td>{fila.carga}</td>
            <td>{fila.error}</td>
            <td>{fila.U}</td>
            <td>{fila.k}</td>
            <td>{fila.tolerancia}</td>
            <td>{fila.conformidad}</td>
            <td>{fila.riesgo}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Errores antes del ajuste (as found), en horizontal para no ocupar una hoja más. */
function AntesDelAjuste({ filas }) {
  const filasTabla = [['CARGA APLICADA', 'carga'], ['INDICACIÓN', 'indicacion'], ['ERROR ENCONTRADO', 'error']];
  return (
    <table className="cc-tabla cc-antes">
      <thead>
        <tr><th colSpan={filas.length + 1} className="cc-tabla-titulo">ERRORES ANTES DEL AJUSTE</th></tr>
      </thead>
      <tbody>
        {filasTabla.map(([titulo, campo]) => (
          <tr key={campo}>
            <th>{titulo}</th>
            {filas.map((fila, index) => <td key={index}>{fila[campo]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Bloques de las hojas de resultados y de notas, en orden; `salto` empieza hoja. */
const bloquesDe = (c) => {
  const bloques = [{ id: 'resultados', salto: true, render: () => <div className="cc-seccion">RESULTADOS</div> }];
  if (c.excentricidad) bloques.push({ id: 'excentricidad', render: () => <Excentricidad e={c.excentricidad} /> });
  if (c.repetibilidad) bloques.push({ id: 'repetibilidad', render: () => <Repetibilidad r={c.repetibilidad} /> });
  tramos(c.errores.filas, FILAS_POR_TRAMO).forEach((filas, index) => {
    bloques.push({ id: `errores-${index}`, render: () => <Errores errores={c.errores} filas={filas} titulo={index === 0} /> });
  });
  if (c.antesDelAjuste) bloques.push({ id: 'antes', render: () => <AntesDelAjuste filas={c.antesDelAjuste} /> });
  if (c.graficoErrores.asLeft.length) {
    bloques.push({ id: 'grafico', render: () => <div className="cc-grafico-marco"><GraficoErrores {...c.graficoErrores} /></div> });
  }
  const n = c.notas;
  bloques.push({
    id: 'pruebas',
    notas: true,
    salto: true,
    render: () => (
      <div className="cc-notas">
        <h3>PRUEBAS REALIZADAS</h3>
        <ul>{n.pruebas.map(texto => <li key={texto}>{texto}</li>)}</ul>
      </div>
    ),
  });
  bloques.push({ id: 'regla', render: () => <div className="cc-notas"><p>- {n.regla}</p></div> });
  if (n.datosCliente) bloques.push({ id: 'cliente', render: () => <div className="cc-notas"><p>{n.datosCliente}</p></div> });
  bloques.push({ id: 'logos', render: () => <div className="cc-logos"><img src={acreditacion} alt="Métrica Ltda. — Laboratorio de calibración acreditado DTA-CET-041" /></div> });
  bloques.push({
    id: 'observaciones',
    render: () => <div className="cc-notas"><p className="cc-subtitulo">OBSERVACIONES:</p><p>{n.observaciones}</p></div>,
  });
  if (n.revisiones?.length) {
    bloques.push({
      id: 'revisiones',
      render: () => (
        <div className="cc-notas">
          <p className="cc-subtitulo">REVISIONES DEL CERTIFICADO:</p>
          <ul>{n.revisiones.map(r => <li key={r.emision}>Emisión {r.emision}{r.fecha ? ` (firmada el ${r.fecha})` : ' (esta emisión)'}: {r.motivo}</li>)}</ul>
        </div>
      ),
    });
  }
  bloques.push({ id: 'fin', render: () => <div className="cc-fin">FIN DEL CERTIFICADO.</div> });
  // Información adicional (a pedido del cliente): hoja aparte, no forma parte del certificado.
  const a = c.anexo;
  if (a) {
    bloques.push({
      id: 'anexo-uso',
      salto: true,
      render: () => (
        <div className="cc-notas">
          <div className="cc-anexo-titulo">INFORMACIÓN ADICIONAL — NO FORMA PARTE DEL CERTIFICADO DE CALIBRACIÓN</div>
          <p>{a.aviso}</p>
          <h3 style={{ marginTop: '2.5mm' }}>INCERTIDUMBRE EN USO</h3>
          <ul>{a.supuestos.map(t => <li key={t}>{t}</li>)}</ul>
          <p style={{ marginTop: '1.5mm' }}>{a.explicacion}</p>
          <table className="cc-tabla cc-resultados">
            <thead><tr><th>RANGO</th><th>INCERTIDUMBRE EN USO</th><th>INCERTIDUMBRE GLOBAL</th></tr></thead>
            <tbody>{a.ecuaciones.map(e => <tr key={e.rango}><td>{e.rango}</td><td>{e.U}</td><td>{e.Ugl}</td></tr>)}</tbody>
          </table>
          <table className="cc-tabla">
            <thead><tr><th>% DE MAX</th><th>LECTURA R</th><th>U(W)</th><th>U(W) RELATIVA</th><th>Ugl(W)</th><th>Ugl(W) RELATIVA</th></tr></thead>
            <tbody>{a.tabla.map(f => <tr key={f.porcentaje}><td>{f.porcentaje}</td><td>{f.R}</td><td>{f.U}</td><td>{f.Urel}</td><td>{f.Ugl}</td><td>{f.Uglrel}</td></tr>)}</tbody>
          </table>
        </div>
      ),
    });
    bloques.push({
      id: 'anexo-pesada',
      render: () => (
        <div className="cc-notas">
          <h3 style={{ marginTop: '3mm' }}>PESADA MÍNIMA</h3>
          <table className="cc-tabla cc-resultados">
            <thead>
              <tr><th rowSpan={2}>TOLERANCIA REQUERIDA</th><th colSpan={a.pesadaMinima.factores.length}>FACTOR DE SEGURIDAD</th></tr>
              <tr>{a.pesadaMinima.factores.map(f => <th key={f}>{f}</th>)}</tr>
            </thead>
            <tbody>
              {a.pesadaMinima.filas.map(f => <tr key={f.exactitud}><td>{f.exactitud}</td>{f.valores.map((v, i) => <td key={i}>{v}</td>)}</tr>)}
            </tbody>
          </table>
          <p>{a.pesadaMinima.nota}</p>
          <p style={{ marginTop: '1.5mm' }}>{a.responsabilidad}</p>
        </div>
      ),
    });
    // USP ⟨41⟩ (si el cliente la pidió) y condiciones, como la hoja INCO del libro.
    const u = a.usp;
    if (u) {
      bloques.push({
        id: 'anexo-usp-repetibilidad',
        render: () => (
          <div className="cc-notas">
            <h3 style={{ marginTop: '3mm' }}>{u.titulo}</h3>
            <p className="cc-subtitulo">REPETIBILIDAD</p>
            <table className="cc-tabla">
              <tbody>{u.repetibilidad.map(f => <tr key={f.dato}><td style={{ textAlign: 'left' }}>{f.dato}</td><td>{f.destacado ? <strong>{f.valor}</strong> : f.valor}</td></tr>)}</tbody>
            </table>
          </div>
        ),
      });
      bloques.push({
        id: 'anexo-usp-exactitud',
        render: () => (
          <div className="cc-notas">
            <p className="cc-subtitulo" style={{ marginTop: '2mm' }}>EXACTITUD Y ADECUACIÓN DE LAS PESAS</p>
            <p>{u.exactitud.rango}</p>
            {u.exactitud.vacia ? <p>{u.exactitud.vacia}</p> : (
              <table className="cc-tabla cc-resultados">
                <thead><tr><th>CARGA</th><th>ERROR</th><th>TOLERANCIA</th><th>EXACTITUD</th><th>U PESAS</th><th>LÍMITE PESAS</th><th>PESAS</th></tr></thead>
                <tbody>
                  {u.exactitud.filas.map(f => <tr key={f.carga}><td>{f.carga}</td><td>{f.error}</td><td>{f.limite}</td><td>{f.resultado}</td><td>{f.Upesas}</td><td>{f.limitePesas}</td><td>{f.pesas}</td></tr>)}
                </tbody>
              </table>
            )}
          </div>
        ),
      });
      bloques.push({
        id: 'anexo-usp-peso',
        render: () => (
          <div className="cc-notas">
            <p className="cc-subtitulo" style={{ marginTop: '2mm' }}>PESO MÍNIMO DE MUESTRA</p>
            <table className="cc-tabla cc-resultados">
              <thead>
                <tr><th rowSpan={2}>EXACTITUD REQUERIDA</th><th colSpan={u.pesoMinimo.factores.length}>FACTOR DE SEGURIDAD</th></tr>
                <tr>{u.pesoMinimo.factores.map(f => <th key={f}>{f}</th>)}</tr>
              </thead>
              <tbody>{u.pesoMinimo.filas.map(f => <tr key={f.exactitud}><td>{f.exactitud}</td>{f.valores.map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody>
            </table>
            <p>{u.pesoMinimo.nota}</p>
          </div>
        ),
      });
    }
    if (a.condiciones) {
      bloques.push({
        id: 'anexo-condiciones',
        render: () => (
          <div className="cc-notas">
            <h3 style={{ marginTop: '3mm' }}>OBSERVACIONES Y CONDICIONES DEL INSTRUMENTO Y LA INSTALACIÓN</h3>
            <table className="cc-tabla">
              <thead><tr><th>CONDICIÓN</th><th>ESTADO</th><th>OBSERVACIÓN</th></tr></thead>
              <tbody>{a.condiciones.map(f => <tr key={f.condicion}><td style={{ textAlign: 'left' }}>{f.condicion}</td><td>{f.estado}</td><td style={{ textAlign: 'left' }}>{f.observacion}</td></tr>)}</tbody>
            </table>
          </div>
        ),
      });
    }
    bloques.push({ id: 'anexo-fin', render: () => <div className="cc-fin">FIN DE LA INFORMACIÓN ADICIONAL.</div> });
  }
  return bloques;
};

/**
 * Certificado completo como hojas A4, igual en pantalla y en el PDF: la hoja
 * de datos generales y, a continuación, las de resultados y de notas,
 * repartidas según lo que ocupa cada bloque (una tabla larga sigue en otra
 * hoja con su cabecera).
 */
export const CertificadoDocumento = forwardRef(function CertificadoDocumento({ contenido, borrador = false, pie = null }, ref) {
  const medidorRef = useRef(null);
  const [paginas, setPaginas] = useState(null);
  const bloques = useMemo(() => bloquesDe(contenido), [contenido]);

  // Medir en cada cambio: se pagina como se imprimirá.
  useLayoutEffect(() => {
    const medidor = medidorRef.current;
    if (!medidor) return undefined;
    let activo = true;
    let intentos = 0;
    const medir = () => {
      const disponible = medidor.querySelector('.cc-cuerpo')?.clientHeight || 0;
      // Sin medidas (montado fuera del documento, p. ej. el PDF antes de
      // agregarse a la página): se vuelve a intentar en el cuadro siguiente.
      if (disponible === 0) {
        if (activo && intentos < 120) {
          intentos += 1;
          requestAnimationFrame(medir);
        }
        return;
      }
      const alturas = [...medidor.querySelectorAll('[data-bloque]')].map(nodo => nodo.offsetHeight);
      // Las notas van en hoja aparte, como en CERT, salvo que los resultados
      // ya ocupen más de una hoja: entonces siguen en la última de ellos.
      const inicioNotas = bloques.findIndex(b => b.notas);
      const hojasResultados = paginar(alturas.slice(0, inicioNotas), disponible, bloques.slice(0, inicioNotas).map(b => Boolean(b.salto))).length;
      const saltos = bloques.map((b, i) => (i === inicioNotas ? hojasResultados === 1 : Boolean(b.salto)));
      const nuevas = paginar(alturas, disponible, saltos);
      setPaginas(actual => (JSON.stringify(actual) === JSON.stringify(nuevas) ? actual : nuevas));
    };
    medir();
    document.fonts?.ready?.then(() => { if (activo) medir(); });
    return () => { activo = false; };
  });

  const hojas = (paginas || [bloques.map((_, index) => index)])
    .map(indices => indices.filter(index => index < bloques.length))
    .filter(indices => indices.length > 0);
  const total = hojas.length + 1;
  // En una reemisión, el pie dice a qué emisión reemplaza (7.8.8).
  const comun = { numero: contenido.numero, total, borrador, pie: pie || contenido.reemplaza || null };

  return (
    <>
      <div className="cc-doc cc-medidor" aria-hidden="true" ref={medidorRef}>
        <section className="cc-pagina">
          <Encabezado numero={contenido.numero} />
          <div className="cc-cuerpo">
            <div>
              {bloques.map(bloque => <div key={bloque.id} data-bloque className="cc-bloque">{bloque.render()}</div>)}
            </div>
          </div>
          <footer className="cc-pie"><span>{DIRECCION}</span></footer>
        </section>
      </div>

      <div className="cc-doc" ref={ref} data-paginado={paginas ? 'si' : 'no'}>
        <Hoja pagina={1} {...comun}><DatosGenerales c={contenido} /></Hoja>
        {hojas.map((indices, index) => (
          <Hoja key={`h${index}`} pagina={index + 2} {...comun}>
            {indices.map(i => <div key={bloques[i].id} className="cc-bloque">{bloques[i].render()}</div>)}
          </Hoja>
        ))}
      </div>
    </>
  );
});
