import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from 'react';
import logoMetrica from '../../../../assets/logoMetrica2.png';
import acreditado from '../../../../assets/certificado/acreditado-dta.jpg';
import { paginar } from '../../../soporte/domain/paginacion';
import { escalaBonita, marcasDe, tramos } from '../../domain/certificado';
import { NOMBRE_LADO, esquemaExcentricidad, posicionIndicador, posicionesPlataforma } from '../../domain/excentricidad';
import './profesional.css';

const DIRECCION = 'METRICA Ltda. · Pje. Gral. Donato Cardozo N° 715-B, Sopocachi, La Paz · www.metrica.com.bo · info@metrica.com.bo';
const VERIFICADOR = 'https://www.digicert.bo/herramientas/verificador-web/';
const FILAS_POR_TRAMO = 24;

// Textos del modelo sugerido (propuesta: los aprueba el laboratorio).
const DECLARACIONES = [
  'Este certificado documenta la trazabilidad metrológica de los resultados al Sistema Internacional de Unidades (SI) por medio de los patrones de METRICA Ltda., calibrados por laboratorios competentes (ver 1.3).',
  'Los resultados se refieren únicamente al instrumento calibrado y a las condiciones en que se realizó la calibración.',
  'Es responsabilidad del usuario recalibrar el instrumento a intervalos apropiados.',
];
const ACREDITACION = 'Laboratorio de calibración acreditado por DTA-IBMETRO según NB/ISO/IEC 17025:2018 (DTA-CET-041).';

function Cabecera({ c, pagina, total }) {
  return (
    <>
      <header className="cp-cabecera">
        <img className="cp-logo" src={logoMetrica} alt="METRICA Ltda." />
        <div>
          <div className="cp-tipo">Certificado de calibración</div>
          <div className="cp-num">{c.numero || 'SIN NÚMERO'}</div>
        </div>
        <div className="cp-marca">
          <div><strong>Emisión {c.emision}</strong></div>
          <div>DTA-CET-041</div>
          <div>Página {pagina} de {total}</div>
        </div>
      </header>
      <div className="cp-acento" aria-hidden="true" />
    </>
  );
}

function Hoja({ c, pagina, total, borrador, children }) {
  return (
    <section className="cp-pagina">
      <Cabecera c={c} pagina={pagina} total={total} />
      <div className="cp-cuerpo">{children}</div>
      {c.reemplaza && <p className="cp-reemplaza">{c.reemplaza}</p>}
      <footer className="cp-pie">
        <span>{DIRECCION}</span>
        <span className="cp-pagina-n">Página {pagina} de {total}</span>
      </footer>
      {borrador && <div className="cp-borrador" aria-hidden="true">BORRADOR</div>}
    </section>
  );
}

/** Portada: identificación, declaraciones, resumen de resultados y firmas. */
function Portada({ c, total }) {
  const i = c.instrumento;
  const r = c.resumen;
  const filas = [
    ['grupo', 'Instrumento'],
    ['Objeto', i.tipo || 'Instrumento de pesaje'],
    ['Fabricante', i.marca],
    ['Modelo', i.modelo],
    ['N.º de serie', i.serie],
    ['Código interno', i.codigoInterno],
    ['Identificación', i.idInstrumento],
    ['Capacidad y división', `Max ${i.max} ${i.unidad} · d ${i.d} ${i.unidad}${i.e ? ` · e ${i.e} ${i.unidad}` : ''}`],
    i.clase && ['Clase de exactitud', i.clase],
    ['grupo', 'Cliente'],
    ['Razón social', c.cliente.razonSocial],
    ['Dirección', c.cliente.direccion],
    ['grupo', 'Calibración'],
    ['Lugar', c.calibracion.lugar],
    ['Fecha de calibración', c.calibracion.fecha],
    ['Fecha de emisión', 'La de la firma digital de este documento'],
    ['Registro', c.calibracion.registro],
    ['N.º de páginas', String(total)],
  ].filter(Boolean);
  const conformidad = r?.conformidad;
  return (
    <>
      <div className="cp-titulo">
        <h1>Certificado de calibración</h1>
        <p>Instrumento de pesaje de funcionamiento no automático · {ACREDITACION}</p>
      </div>
      <div className="cp-portada">
        <dl className="cp-ident">
          {filas.map(([etiqueta, valor]) => (etiqueta === 'grupo'
            ? <div key={valor} className="cp-grupo"><dt>{valor}</dt><dd /></div>
            : <div key={etiqueta}><dt>{etiqueta}</dt><dd>{valor || '—'}</dd></div>))}
        </dl>
        <aside className="cp-declaraciones">
          {DECLARACIONES.map(texto => <p key={texto}>{texto}</p>)}
          <p>{c.leyenda?.[0]}</p>
          <img src={acreditado} alt="Laboratorio de calibración acreditado DTA-CET-041" />
        </aside>
      </div>
      {r && (
        <div className="cp-resumen">
          <div className="cp-kpi">
            <span>Error máximo encontrado</span>
            <strong>{r.errorMax || '—'}</strong>
            <small>{r.puntos} puntos de ensayo</small>
          </div>
          <div className="cp-kpi">
            <span>Incertidumbre expandida máxima</span>
            <strong>{r.UMax || '—'}</strong>
            <small>Probabilidad de cobertura ≈ 95,45 %</small>
          </div>
          <div className={conformidad === 'CONFORME' ? 'cp-kpi cp-ok' : conformidad === 'NO CONFORME' ? 'cp-kpi cp-mal' : 'cp-kpi'}>
            <span>Declaración de conformidad</span>
            <strong>{conformidad === 'SIN DECLARACIÓN' ? 'No solicitada' : conformidad}</strong>
            <small>{conformidad === 'SIN DECLARACIÓN' ? 'El cliente no pidió declarar conformidad' : `Regla de decisión ${String(r.regla || '').toLowerCase()} · ${r.evaluados} puntos evaluados`}</small>
          </div>
        </div>
      )}
      <div className="cp-firmas">
        <div className="cp-firma">
          <div>
            <strong>{c.elaboradoPor || '—'}</strong>
            <span>Elaborado por · Técnico de calibración</span>
          </div>
        </div>
        <div className="cp-firma">
          <div>
            <strong>{c.autorizadoPor || 'Firma digital'}</strong>
            <span>Autorizado por · Jefe del Laboratorio de Calibración</span>
          </div>
        </div>
      </div>
      <div className="cp-legal">
        <p>{c.leyenda?.[1]}</p>
        <p>Firma digital verificable en <a href={VERIFICADOR}>digicert.bo/herramientas/verificador-web</a>.</p>
      </div>
    </>
  );
}

/** Receptor de carga con sus posiciones (como ServiceMET). */
function Receptor({ e }) {
  const esquema = esquemaExcentricidad(e.plataforma, e.esquema, e.lecturas);
  if (!esquema) return null;
  const L = 100;
  const borde = { fill: '#f4f6f8', stroke: '#22272e', strokeWidth: 1.6 };
  const indicador = esquema.indicador ? posicionIndicador(esquema.forma, esquema.indicador) : null;
  return (
    <div className="cp-receptor">
      <svg viewBox={`0 0 ${L} ${L}`} role="img" aria-label="Receptor de carga con las posiciones">
        {esquema.forma === 'cuadrada' && <rect x={15} y={15} width={70} height={70} rx={3} {...borde} />}
        {esquema.forma === 'rectangular' && <rect x={12} y={25} width={76} height={50} rx={3} {...borde} />}
        {esquema.forma === 'circular' && <circle cx={50} cy={50} r={40} {...borde} />}
        {esquema.forma === 'triangular' && <path d="M50 10L90 90H10Z" strokeLinejoin="round" {...borde} />}
        {indicador && <rect x={indicador[0] * L - 10} y={indicador[1] * L - 4.5} width={20} height={9} rx={1.5} fill="#22272e" />}
        {posicionesPlataforma(esquema.forma, esquema.puntos).map(([x, y], index) => (
          <g key={index}>
            <circle cx={x * L} cy={y * L} r={6.5} fill="#22272e" />
            <text x={x * L} y={y * L} dy="0.36em" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#fff">{index + 1}</text>
          </g>
        ))}
      </svg>
      <p>Posiciones de carga{esquema.indicador ? ` · indicador ${NOMBRE_LADO[esquema.indicador]}` : ''}</p>
    </div>
  );
}

/**
 * Errores de indicación con su incertidumbre (barras ±U) y la banda del emp o
 * la tolerancia, como los certificados de los laboratorios acreditados.
 */
function GraficoErrores({ asLeft, emp, unidad }) {
  const ancho = 680;
  const alto = 230;
  const area = { x: 66, y: 16, ancho: 600, alto: 172 };
  const ys = [...asLeft.flatMap(p => [Math.abs(p.y) + (p.U || 0)]), ...emp.map(p => Math.abs(p.y))];
  const limite = Math.max(...ys, 0) * 1.15 || 1;
  const ex = escalaBonita(0, Math.max(...asLeft.map(p => p.x), ...emp.map(p => p.x), 0), 6);
  const ey = escalaBonita(-limite, limite, 6);
  const x = (v) => area.x + ((v - ex.min) / (ex.max - ex.min)) * area.ancho;
  const y = (v) => area.y + area.alto - ((v - ey.min) / (ey.max - ey.min)) * area.alto;
  const banda = emp.length
    ? `M${emp.map(p => `${x(p.x).toFixed(1)} ${y(p.y).toFixed(1)}`).join(' L')} L${[...emp].reverse().map(p => `${x(p.x).toFixed(1)} ${y(-p.y).toFixed(1)}`).join(' L')} Z`
    : null;
  const puntos = [...asLeft].sort((a, b) => a.x - b.x);
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} className="cp-grafico" role="img" aria-label="Errores de indicación con su incertidumbre">
      {banda && <path d={banda} fill="#127a3a" fillOpacity="0.08" stroke="#127a3a" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="4 3" />}
      <g fontSize="10.5" fill="#5b6470">
        {marcasDe(ey).map(m => (
          <g key={`y${m.valor}`}>
            <line x1={area.x} x2={area.x + area.ancho} y1={y(m.valor)} y2={y(m.valor)} stroke={m.valor === 0 ? '#22272e' : '#e3e6ea'} strokeWidth={m.valor === 0 ? 1 : 0.7} />
            <text x={area.x - 6} y={y(m.valor)} dy="0.35em" textAnchor="end">{m.texto}</text>
          </g>
        ))}
        {marcasDe(ex).map(m => <text key={`x${m.valor}`} x={x(m.valor)} y={area.y + area.alto + 14} textAnchor="middle">{m.texto}</text>)}
        <text x={area.x + area.ancho / 2} y={alto - 4} textAnchor="middle" fill="#1c1f23" fontWeight="600">Carga ({unidad})</text>
        <text transform={`translate(14 ${area.y + area.alto / 2}) rotate(-90)`} textAnchor="middle" fill="#1c1f23" fontWeight="600">Error ({unidad})</text>
      </g>
      <path d={puntos.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)} ${y(p.y).toFixed(1)}`).join(' ')} fill="none" stroke="#22272e" strokeWidth="1.2" />
      {puntos.map(p => (
        <g key={p.x}>
          {p.U > 0 && (
            <>
              <line x1={x(p.x)} x2={x(p.x)} y1={y(p.y - p.U)} y2={y(p.y + p.U)} stroke="#0b5cad" strokeWidth="1.2" />
              <line x1={x(p.x) - 4} x2={x(p.x) + 4} y1={y(p.y - p.U)} y2={y(p.y - p.U)} stroke="#0b5cad" strokeWidth="1.2" />
              <line x1={x(p.x) - 4} x2={x(p.x) + 4} y1={y(p.y + p.U)} y2={y(p.y + p.U)} stroke="#0b5cad" strokeWidth="1.2" />
            </>
          )}
          <circle cx={x(p.x)} cy={y(p.y)} r={3.2} fill="#22272e" />
        </g>
      ))}
      <g fontSize="10" fill="#1c1f23">
        <circle cx={area.x + 12} cy={8} r={3} fill="#22272e" /><text x={area.x + 20} y={8} dy="0.35em">Error E</text>
        <line x1={area.x + 86} x2={area.x + 86} y1={3} y2={13} stroke="#0b5cad" strokeWidth="1.4" /><text x={area.x + 94} y={8} dy="0.35em">± U (k ≈ 2)</text>
        {banda && <><rect x={area.x + 172} y={3} width={16} height={10} fill="#127a3a" fillOpacity="0.15" stroke="#127a3a" strokeOpacity="0.5" strokeDasharray="3 2" /><text x={area.x + 194} y={8} dy="0.35em">emp o tolerancia</text></>}
      </g>
    </svg>
  );
}

const claseConformidad = (texto) => (texto === 'CONFORME' ? 'cp-ok' : texto === 'NO CONFORME' ? 'cp-mal' : undefined);

/** Bloques de las hojas de datos y resultados, en orden. */
const bloquesDe = (c) => {
  const bloques = [];
  const amb = c.ambiente;
  bloques.push({
    id: 'metodo',
    render: () => (
      <>
        <h2 className="cp-h2"><span>1</span> Datos de la calibración</h2>
        <h3 className="cp-h3">1.1 Método</h3>
        <p className="cp-texto">{c.calibracion.metodo}</p>
        {c.normas && <p className="cp-texto cp-suave">Documentos de referencia: {c.normas}.</p>}
        {c.calibracion.ajuste && <p className="cp-texto"><strong>Ajuste del instrumento:</strong> {c.calibracion.ajuste}</p>}
        <p className="cp-texto"><strong>Alcance de la calibración:</strong> {c.calibracion.alcance}. {c.calibracion.alcanceNota?.replace(/^\*/, '')}</p>
      </>
    ),
  });
  bloques.push({
    id: 'ambiente',
    render: () => (
      <>
        <h3 className="cp-h3">1.2 Condiciones ambientales</h3>
        {amb ? (
          <table className="cp-tabla">
            <thead><tr><th className="cp-izq">Momento</th><th>Hora</th><th>Temperatura (°C)</th><th>Humedad relativa (%)</th><th>Presión (hPa)</th></tr></thead>
            <tbody>
              <tr><td className="cp-izq">Inicio</td><td>{amb.inicio.hora}</td><td>{amb.inicio.t}</td><td>{amb.inicio.hr}</td><td>{amb.inicio.p}</td></tr>
              <tr><td className="cp-izq">Fin</td><td>{amb.fin.hora}</td><td>{amb.fin.t}</td><td>{amb.fin.hr}</td><td>{amb.fin.p}</td></tr>
            </tbody>
          </table>
        ) : <p className="cp-texto">{c.calibracion.condiciones}</p>}
        <p className="cp-texto cp-suave" style={{ marginTop: '1.2mm' }}>
          Valores medios corregidos: {c.calibracion.condiciones.replace('Presión Atmosférica', 'Presión')}{amb?.termohigrometro ? ` (termohigrómetro ${amb.termohigrometro})` : ''}.
        </p>
      </>
    ),
  });
  bloques.push({
    id: 'patrones',
    render: () => (
      <>
        <h3 className="cp-h3">1.3 Patrones de referencia</h3>
        {c.patronesDetalle?.length ? (
          <table className="cp-tabla">
            <thead><tr><th className="cp-izq">Código</th><th>Descripción</th><th>Alcance</th><th>Certificado de calibración</th><th>Fecha</th></tr></thead>
            <tbody>
              {c.patronesDetalle.map(p => (
                <tr key={p.codigo}><td className="cp-izq">{p.codigo}</td><td>Juego de pesas {p.clase}</td><td>{p.alcance}</td><td>{p.certificado}</td><td>{p.fecha}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <ul className="cp-lista">{c.calibracion.patrones.map(t => <li key={t}>{t}</li>)}</ul>}
      </>
    ),
  });

  bloques.push({ id: 'resultados', render: () => <h2 className="cp-h2" style={{ marginTop: '2mm' }}><span>2</span> Resultados de la medición</h2> });
  if (c.repetibilidad) {
    bloques.push({
      id: 'repetibilidad',
      render: () => (
        <>
          <h3 className="cp-h3">2.1 Repetibilidad</h3>
          <table className="cp-tabla">
            <thead><tr><th>Carga</th><th>Lecturas</th><th>Media</th><th>Desviación estándar s</th><th>Diferencia máxima</th></tr></thead>
            <tbody>
              {c.repetibilidad.filas.map(f => <tr key={f.carga}><td>{f.carga}</td><td>{f.n ?? c.repetibilidad.repeticiones}</td><td>{f.media || '—'}</td><td>{f.s}</td><td>{f.difMax}</td></tr>)}
            </tbody>
          </table>
          <p className="cp-texto cp-suave" style={{ marginTop: '1.2mm' }}>{c.repetibilidad.nota}</p>
        </>
      ),
    });
  }
  if (c.excentricidad) {
    bloques.push({
      id: 'excentricidad',
      render: () => (
        <>
          <h3 className="cp-h3">2.2 Excentricidad (carga de ensayo {c.excentricidad.carga})</h3>
          <div className="cp-dos">
            <table className="cp-tabla">
              <thead><tr><th>Posición</th><th>Diferencia respecto del centro</th></tr></thead>
              <tbody>{c.excentricidad.filas.map(f => <tr key={f.posicion}><td>{f.posicion}</td><td>{f.diferencia}</td></tr>)}</tbody>
            </table>
            <Receptor e={c.excentricidad} />
          </div>
        </>
      ),
    });
  }
  tramos(c.errores.filas, FILAS_POR_TRAMO).forEach((filas, index) => {
    bloques.push({
      id: `errores-${index}`,
      render: () => (
        <>
          {index === 0 && <h3 className="cp-h3">2.3 Error de indicación</h3>}
          <table className="cp-tabla">
            <thead>
              <tr>
                <th>Carga</th>
                <th>Masa de referencia<small>mref</small></th>
                <th>Indicación<small>I</small></th>
                <th>Error<small>E = I − mref</small></th>
                <th>Incertidumbre<small>U</small></th>
                <th>k</th>
                <th>{c.errores.encabezadoTolerancia.replace(/^EMP/, 'emp').replace('TOLERANCIA DEL CLIENTE', 'Tolerancia del cliente')}</th>
                <th>Conformidad</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => (
                <tr key={f.carga}>
                  <td>{f.carga}</td><td>{f.mref || '—'}</td><td>{f.indicacion || '—'}</td><td>{f.error}</td><td>{f.U}</td><td>{f.k}</td>
                  <td>{f.tolerancia === 'NO APLICA' ? '—' : f.tolerancia}</td>
                  <td className={claseConformidad(f.conformidad)}>{f.conformidad === 'NO APLICA' ? '—' : f.conformidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ),
    });
  });
  if (c.graficoErrores.asLeft.length) {
    bloques.push({ id: 'grafico', render: () => <GraficoErrores asLeft={c.graficoErrores.asLeft} emp={c.graficoErrores.emp} unidad={c.instrumento.unidad} /> });
  }
  if (c.antesDelAjuste) {
    bloques.push({
      id: 'antes',
      render: () => (
        <>
          <h3 className="cp-h3">2.4 Errores antes del ajuste</h3>
          <table className="cp-tabla">
            <thead><tr><th>Carga</th><th>Indicación</th><th>Error</th></tr></thead>
            <tbody>{c.antesDelAjuste.map(f => <tr key={f.carga}><td>{f.carga}</td><td>{f.indicacion}</td><td>{f.error}</td></tr>)}</tbody>
          </table>
        </>
      ),
    });
  }

  const n = c.notas;
  const incertidumbre = n.pruebas[n.pruebas.length - 1];
  bloques.push({
    id: 'declaraciones',
    render: () => (
      <>
        <h2 className="cp-h2" style={{ marginTop: '2mm' }}><span>3</span> Declaraciones</h2>
        <h3 className="cp-h3">3.1 Incertidumbre de medición</h3>
        <p className="cp-texto">{incertidumbre}</p>
        <h3 className="cp-h3">3.2 Pruebas realizadas</h3>
        <ul className="cp-lista">{n.pruebas.slice(0, -1).map(t => <li key={t}>{t}</li>)}</ul>
        <h3 className="cp-h3" style={{ marginTop: '2mm' }}>3.3 Regla de decisión</h3>
        <p className="cp-texto">{n.regla}</p>
        {n.datosCliente && <p className="cp-texto cp-suave">{n.datosCliente}</p>}
      </>
    ),
  });
  bloques.push({
    id: 'observaciones',
    render: () => (
      <>
        <h3 className="cp-h3">3.4 Observaciones</h3>
        <p className="cp-texto">{n.observaciones}</p>
        {n.revisiones?.length > 0 && (
          <>
            <h3 className="cp-h3" style={{ marginTop: '2mm' }}>3.5 Revisiones del certificado</h3>
            <table className="cp-tabla">
              <thead><tr><th>Emisión</th><th>Firmada</th><th className="cp-izq">Motivo</th></tr></thead>
              <tbody>{n.revisiones.map(r => <tr key={r.emision}><td>{r.emision}</td><td>{r.fecha || 'Esta emisión'}</td><td className="cp-izq">{r.motivo}</td></tr>)}</tbody>
            </table>
          </>
        )}
        <div className="cp-fin">
          <span>FIN DEL CERTIFICADO</span>
          <img src={acreditado} alt="Laboratorio de calibración acreditado DTA-CET-041" />
        </div>
      </>
    ),
  });
  // Anexo: información adicional, a pedido del cliente (no forma parte del certificado).
  const a = c.anexo;
  if (a) {
    bloques.push({
      id: 'anexo-uso',
      salto: true,
      render: () => (
        <>
          <div className="cp-anexo-aviso">
            <strong>Anexo — Información adicional</strong>
            <span>No forma parte del certificado de calibración</span>
          </div>
          <p className="cp-texto">{a.aviso}</p>
          <h2 className="cp-h2" style={{ marginTop: '3mm' }}><span>A.1</span> Incertidumbre de una pesada en uso</h2>
          <ul className="cp-lista">{a.supuestos.map(t => <li key={t}>{t}</li>)}</ul>
          <p className="cp-texto" style={{ marginTop: '1.5mm' }}>{a.explicacion}</p>
          <table className="cp-tabla" style={{ marginBottom: '3mm' }}>
            <thead><tr><th className="cp-izq">Rango</th><th>Con corrección del error</th><th>Sin corrección (global)</th></tr></thead>
            <tbody>{a.ecuaciones.map(e => <tr key={e.rango}><td className="cp-izq">{e.rango}</td><td>{e.U}</td><td>{e.Ugl}</td></tr>)}</tbody>
          </table>
          <table className="cp-tabla">
            <thead><tr><th>% de Max</th><th>Lectura R</th><th>U(W)</th><th>U(W) relativa</th><th>Ugl(W)</th><th>Ugl(W) relativa</th></tr></thead>
            <tbody>{a.tabla.map(f => <tr key={f.porcentaje}><td>{f.porcentaje}</td><td>{f.R}</td><td>{f.U}</td><td>{f.Urel}</td><td>{f.Ugl}</td><td>{f.Uglrel}</td></tr>)}</tbody>
          </table>
        </>
      ),
    });
    bloques.push({
      id: 'anexo-pesada',
      render: () => (
        <>
          <h2 className="cp-h2" style={{ marginTop: '2mm' }}><span>A.2</span> Pesada mínima</h2>
          <table className="cp-tabla">
            <thead>
              <tr><th rowSpan={2}>Tolerancia requerida</th><th colSpan={a.pesadaMinima.factores.length}>Factor de seguridad</th></tr>
              <tr>{a.pesadaMinima.factores.map(f => <th key={f}>{f}</th>)}</tr>
            </thead>
            <tbody>
              {a.pesadaMinima.filas.map(f => <tr key={f.exactitud}><td>{f.exactitud}</td>{f.valores.map((v, i) => <td key={i}>{v}</td>)}</tr>)}
            </tbody>
          </table>
          <p className="cp-texto cp-suave" style={{ marginTop: '1.5mm' }}>{a.pesadaMinima.nota}</p>
          <p className="cp-texto cp-suave">{a.responsabilidad}</p>
        </>
      ),
    });
  }
  return bloques;
};

/**
 * Modelo sugerido del certificado (propuesta): portada con la identificación,
 * el resumen y las firmas; después los datos, los resultados y las
 * declaraciones, repartidos en hojas según lo que ocupa cada bloque. Usa el
 * mismo contenido que el modelo actual.
 */
export const CertificadoProfesional = forwardRef(function CertificadoProfesional({ contenido, borrador = false }, ref) {
  const medidorRef = useRef(null);
  const [paginas, setPaginas] = useState(null);
  const bloques = useMemo(() => bloquesDe(contenido), [contenido]);

  useLayoutEffect(() => {
    const medidor = medidorRef.current;
    if (!medidor) return undefined;
    let activo = true;
    let intentos = 0;
    const medir = () => {
      const disponible = medidor.querySelector('.cp-cuerpo')?.clientHeight || 0;
      if (disponible === 0) {
        if (activo && intentos < 120) {
          intentos += 1;
          requestAnimationFrame(medir);
        }
        return;
      }
      const alturas = [...medidor.querySelectorAll('[data-bloque]')].map(nodo => nodo.offsetHeight);
      const nuevas = paginar(alturas, disponible, bloques.map(b => Boolean(b.salto)));
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

  return (
    <>
      <div className="cp-doc cp-medidor" aria-hidden="true" ref={medidorRef}>
        <section className="cp-pagina">
          <Cabecera c={contenido} pagina={1} total={1} />
          <div className="cp-cuerpo">
            <div>{bloques.map(b => <div key={b.id} data-bloque className="cp-bloque">{b.render()}</div>)}</div>
          </div>
          {contenido.reemplaza && <p className="cp-reemplaza">{contenido.reemplaza}</p>}
          <footer className="cp-pie"><span>{DIRECCION}</span></footer>
        </section>
      </div>
      <div className="cp-doc" ref={ref} data-paginado={paginas ? 'si' : 'no'}>
        <Hoja c={contenido} pagina={1} total={total} borrador={borrador}><Portada c={contenido} total={total} /></Hoja>
        {hojas.map((indices, index) => (
          <Hoja key={`h${index}`} c={contenido} pagina={index + 2} total={total} borrador={borrador}>
            {indices.map(i => <div key={bloques[i].id} className="cp-bloque">{bloques[i].render()}</div>)}
          </Hoja>
        ))}
      </div>
    </>
  );
});
