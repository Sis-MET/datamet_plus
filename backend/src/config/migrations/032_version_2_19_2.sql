-- ========================================================================
-- MIGRACIÓN 032: RIESGO DE LOS PUNTOS NO CONFORMES (VERSIÓN 2.19.2)
-- ========================================================================
-- Registra en Control de cambios (NB/ISO/IEC 17025, 7.11.2) lo que corrige
-- la versión 2.19.2 en el riesgo asociado de los puntos no conformes, tras
-- comparar con la planilla del laboratorio los certificados de GRUPO ALCOS
-- (0051-11-008) y DELTA (0089-11-015). Queda REGISTRADO: Sistemas lo valida
-- y el jefe de área de Calibración lo aprueba antes de desplegar la versión.
--
-- No cambia tablas. Es idempotente: no repite un título.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
BEGIN
  DECLARE @cambios TABLE (
    orden         INT,
    titulo        NVARCHAR(150),
    tipo          VARCHAR(20),
    modulos       NVARCHAR(200),
    descripcion   NVARCHAR(MAX),
    impacto       NVARCHAR(1000),
    referencias   NVARCHAR(1000),
    fecha_cambio  DATE
  );

  INSERT INTO @cambios VALUES
    (1, N'Calibración: en un punto no conforme el riesgo asociado es el de falso rechazo', 'CORRECCION', N'Calibración',
     N'Hasta la 2.19.1, en un punto NO CONFORME el riesgo asociado era la probabilidad de que el error real estuviera fuera de la tolerancia: en GRUPO ALCOS (0051-11-008), 35 000 g con E = 0,5 g, U = 0,36 g y EMP 0,3 g daba 71,07 %. El riesgo de una declaración de no conformidad es el de falso rechazo, la probabilidad de que el error real esté dentro de la tolerancia, 1 menos la anterior (ILAC G8; JCGM 106): 28,93 %. Es lo que imprime la planilla del laboratorio (DELTA, 0089-11-015, 5000 g: 33,19 % con E = −0,02 g, U = 0,023 g y EMP 0,01 g, igual en DataMET+). Vale para los dos métodos de riesgo («Normal con u = U/k» y «Como la planilla»). «Cómo se calcula» dice en cada punto si informa la probabilidad de estar fuera (conforme) o dentro (no conforme). Las demás diferencias con la planilla vienen de su celda CALC!H35, que usa una celda vacía como desviación del límite +T (con error positivo subestima el riesgo; con E = T suma 50 %), y no se copian: se informó al personal de Calibración para que la revise.',
     N'Cambia solo el riesgo impreso de los puntos no conformes, en la vista previa y en los certificados que se emitan; la decisión de conformidad y los puntos conformes no cambian. Los certificados ya emitidos guardan su contenido y no cambian. Rige para los registros que se recalculan.',
     N'motor/tolerancia.js (conformidad: riesgo y fuera), motor/index.js, ComoSeCalcula.jsx, domain/metodo.js (RIESGO); prueba con los casos de 0051-11-008 y 0089-11-015 en motor.reglas.test.js.', '2026-11-16');

  DECLARE @anio CHAR(4) = CONVERT(char(4), YEAR(DATEADD(hour, -4, SYSUTCDATETIME())));
  DECLARE @orden INT = 1;
  DECLARE @total INT = (SELECT MAX(orden) FROM @cambios);
  DECLARE @titulo NVARCHAR(150);
  DECLARE @ultimo INT;

  WHILE @orden <= @total
  BEGIN
    SELECT @titulo = titulo FROM @cambios WHERE orden = @orden;
    IF NOT EXISTS (SELECT 1 FROM dbo.APP_CAMBIOS WHERE titulo = @titulo)
    BEGIN
      SELECT @ultimo = ISNULL(MAX(CAST(RIGHT(codigo, 3) AS INT)), 0)
      FROM dbo.APP_CAMBIOS WITH (UPDLOCK, HOLDLOCK)
      WHERE codigo LIKE 'CC-' + @anio + '-[0-9][0-9][0-9]';

      INSERT INTO dbo.APP_CAMBIOS
        (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
         estado, a_posteriori, registrado_por)
      SELECT 'CC-' + @anio + '-' + RIGHT('00' + CAST(@ultimo + 1 AS varchar(10)), 3), N'2.19.2',
        titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
        'REGISTRADO', 0, N'migración 032'
      FROM @cambios WHERE orden = @orden;

      INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
      VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 032 (versión 2.19.2)', N'migración 032');
    END;
    SET @orden += 1;
  END;
END;
