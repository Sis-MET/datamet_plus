const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { crearArchivo, carpetaRelativa, nombrePdf, validarPdf, hash } = require('./soporte.archivos');

const error = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const entero = (value, nullable = false) => {
  if (nullable && (value === '' || value === undefined)) return null;
  if (!/^\d{1,9}$/.test(String(value ?? ''))) throw error(400, 'La versión del documento no es válida.');
  return Number(value);
};
const metadatos = query => {
  if (!['true', 'false'].includes(query.borrador)) throw error(400, 'Indique si el PDF es un borrador.');
  return { carpeta: carpetaRelativa(query.carpeta), nombre: nombrePdf(query.nombre),
    revision: entero(query.revision), borrador: query.borrador === 'true', version: entero(query.version, true) };
};
const uuid = value => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value))) throw error(400, 'El documento no es válido.');
  return value;
};
const presentar = row => ({ id: row.id, nombre: row.nombre, carpeta: row.carpeta,
  revision: row.revision, borrador: Boolean(row.borrador), version: row.version_informe,
  bytes: row.bytes, guardadoPor: { usuario: row.guardado_por, nombre: row.guardado_nombre || null },
  guardadoEn: row.guardado_en instanceof Date ? row.guardado_en.toISOString() : row.guardado_en });

// Inyección del repositorio para comprobar disco/registro sin una BD operativa.
function crearServicio({ raiz, repositorio }) {
  const archivo = crearArchivo(raiz);
  return {
    async carpetas(carpeta, user) {
      await repositorio.autorizar(user);
      return archivo.listar(carpeta);
    },
    async listar(tipo, codigo, user) {
      await repositorio.contexto(tipo, codigo, user);
      if (!archivo.configurado) return { configurado: false, documentos: [] };
      return { configurado: true, nombreRaiz: path.basename(raiz), documentos: (await repositorio.listar(tipo, codigo)).map(presentar) };
    },
    async guardar(tipo, codigo, query, contenido, user) {
      const meta = metadatos(query);
      validarPdf(contenido);
      const destino = await archivo.resolver(meta.carpeta);
      const contenidoHuella = hash(contenido);
      const relativa = path.join(meta.carpeta, meta.nombre);
      const ubicacionHuella = hash(`${destino.raizHuella}:${process.platform === 'win32' ? relativa.toLowerCase() : relativa}`);
      let escrito = false;
      try {
        return await repositorio.transaccion(async request => {
          const actor = await repositorio.contexto(tipo, codigo, user, meta, request);
          const anterior = await repositorio.ubicacion(ubicacionHuella, request);
          if (anterior && (anterior.tipo !== tipo || anterior.codigo_registro !== codigo
            || anterior.revision !== meta.revision || Boolean(anterior.borrador) !== meta.borrador
            || (meta.borrador && anterior.version_informe !== meta.version) || anterior.contenido_huella !== contenidoHuella)) {
            throw error(409, 'Ese nombre ya pertenece a otro documento guardado. Cambie el nombre para conservar ambos.');
          }
          // Escritura exclusiva: un archivo ajeno nunca se reemplaza. Un
          // reintento del mismo contenido puede completar el registro pendiente.
          await archivo.guardar(meta.carpeta, meta.nombre, contenido);
          escrito = true;
          if (anterior) return presentar(anterior);
          const row = { id: randomUUID(), tipo, codigo_registro: codigo, revision: meta.revision,
            borrador: meta.borrador, version_informe: meta.version, nombre: meta.nombre, carpeta: meta.carpeta,
            raiz_huella: destino.raizHuella, ubicacion_huella: ubicacionHuella, contenido_huella: contenidoHuella,
            bytes: contenido.length, guardado_por: actor.usuario, guardado_nombre: actor.nombre };
          return presentar(await repositorio.insertar(row, request));
        });
      } catch (cause) {
        if (cause.statusCode || !escrito) throw cause;
        throw error(503, 'El PDF se escribió, pero no se pudo confirmar su registro. Reintente con la misma carpeta y nombre para completar el guardado.');
      }
    },
    async abrir(id, user) {
      await repositorio.autorizar(user);
      const row = await repositorio.buscar(uuid(id));
      if (!row) throw error(404, 'No se encontró el PDF guardado.');
      const destino = await archivo.resolver(row.carpeta);
      if (destino.raizHuella !== row.raiz_huella) throw error(409, 'La ubicación del archivo del área cambió. Solicite revisar la configuración del servidor.');
      const pdf = await archivo.leer(row.carpeta, row.nombre);
      if (pdf.huella !== row.contenido_huella) throw error(409, 'El PDF fue modificado fuera de DataMET+. Guarde una nueva copia desde su revisión para conservar la trazabilidad.');
      return { nombre: row.nombre, contenido: pdf.contenido };
    },
  };
}

function repositorioSql() {
  const { getPool, sql } = require('../config/db');
  const informes = require('./soporte.informes');
  const { withTransaction } = require('./calibration.db');
  const request = factory => factory ? factory() : getPool().request();
  return {
    autorizar: informes.exigirEditor,
    contexto: (tipo, codigo, user, meta, factory) => informes.contextoArchivo(tipo, codigo, user, meta, factory),
    transaccion: withTransaction,
    async listar(tipo, codigo) {
      const result = await request().input('tipo', sql.VarChar(10), tipo).input('codigo', sql.NVarChar(100), codigo)
        .query('SELECT * FROM dbo.ST_INFORMES_DOCUMENTOS WHERE tipo = @tipo AND codigo_registro = @codigo ORDER BY guardado_en DESC, id;');
      return result.recordset;
    },
    async ubicacion(huella, factory) {
      const result = await request(factory).input('ubicacion', sql.Char(64), huella)
        .query('SELECT * FROM dbo.ST_INFORMES_DOCUMENTOS WITH (UPDLOCK, HOLDLOCK) WHERE ubicacion_huella = @ubicacion;');
      return result.recordset[0];
    },
    async buscar(id) {
      const result = await request().input('id', sql.UniqueIdentifier, id)
        .query('SELECT * FROM dbo.ST_INFORMES_DOCUMENTOS WHERE id = @id;');
      return result.recordset[0];
    },
    async insertar(row, factory) {
      const result = await request(factory)
        .input('id', sql.UniqueIdentifier, row.id).input('tipo', sql.VarChar(10), row.tipo)
        .input('codigo', sql.NVarChar(100), row.codigo_registro).input('revision', sql.Int, row.revision)
        .input('borrador', sql.Bit, row.borrador).input('version', sql.Int, row.version_informe)
        .input('nombre', sql.NVarChar(220), row.nombre).input('carpeta', sql.NVarChar(1200), row.carpeta)
        .input('raiz', sql.Char(64), row.raiz_huella).input('ubicacion', sql.Char(64), row.ubicacion_huella)
        .input('contenido', sql.Char(64), row.contenido_huella).input('bytes', sql.Int, row.bytes)
        .input('usuario', sql.NVarChar(50), row.guardado_por).input('actor', sql.NVarChar(120), row.guardado_nombre)
        .query(`INSERT INTO dbo.ST_INFORMES_DOCUMENTOS
          (id, tipo, codigo_registro, revision, borrador, version_informe, nombre, carpeta, raiz_huella,
           ubicacion_huella, contenido_huella, bytes, guardado_por, guardado_nombre)
          OUTPUT INSERTED.* VALUES (@id, @tipo, @codigo, @revision, @borrador, @version, @nombre, @carpeta,
            @raiz, @ubicacion, @contenido, @bytes, @usuario, @actor);`);
      return result.recordset[0];
    },
  };
}

let servicio;
const actual = () => {
  if (!servicio) servicio = crearServicio({ raiz: require('../config/env').soporte.documentosDir, repositorio: repositorioSql() });
  return servicio;
};
module.exports = { crearServicio, metadatos, presentar,
  carpetas: (...args) => actual().carpetas(...args), listar: (...args) => actual().listar(...args),
  guardar: (...args) => actual().guardar(...args), abrir: (...args) => actual().abrir(...args) };
