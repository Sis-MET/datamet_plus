import { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { safeStorage } from '../../../shared/utils/storage';
import { API_BASE } from '../../../config/api';

const SOURCE_TAG = 'SalidaMET';

function getAutorFromToken(token) {
  try {
    const p = JSON.parse(atob(token.split('.')[1]));
    return p.nombre || p.usuario || 'Sistema';
  } catch {
    return 'Sistema';
  }
}

export function useDepartures() {
  const [departures, setDepartures] = useState([]);
  const [tecnicos,   setTecnicos]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState(null);

  const getToken = () => safeStorage.getItem('rimmet_token');

  // ─── Fetch tecnicos — excluye vehículos ───
  const fetchTecnicos = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/calendar/tecnicos`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setTecnicos(data.data.filter(t => t.area !== 'VEHÍCULOS'));
      }
    } catch (e) {
      console.error('useDepartures: fetchTecnicos error', e);
    }
  }, []);

  // ─── Fetch salidas del período ───
  const fetchDepartures = useCallback(async (startDate, endDate) => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr   = format(endDate,   'yyyy-MM-dd');

      const res = await fetch(
        `${API_BASE}/calendar/cronograma?start=${startStr}&end=${endStr}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
      );
      if (!res.ok) throw new Error('Error al cargar salidas');

      const json = await res.json();
      if (json.success) {
        const rows = (json.data || [])
          // Filtrar solo las filas que son del módulo de salidas
          .filter(r => r.creado_en === SOURCE_TAG)
          .map(r => ({
            id:         `sal_${r.id}`,
            rowId:      r.id,
            id_usuario: r.id_usuario,
            tecnicoId:  r.usuario || r.id_usuario,
            fecha:      new Date(r.fecha + 'T12:00:00'),
            tipoSalida: r.cotizacion || '',
            motivo:     r.descripcion || '',
            horaInicio: r.hora_inicio ? r.hora_inicio.substring(0, 5) : '',
            horaFin:    r.hora_fin    ? r.hora_fin.substring(0, 5)    : '',
            estado:     r.estado || 'Solicitud',
            color:      r.color  || '#7C3AED',
          }));
        setDepartures(rows);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Guarda la salida para MÚLTIPLES técnicos y MÚLTIPLES fechas.
   * Genera una fila en DATA_CRONOGRAMA por cada combinación (técnico × fecha).
   * 
   * @param {object} params
   * @param {string[]} params.tecnicoIds   - Array de IDs de técnicos seleccionados
   * @param {Date[]}   params.dates        - Array de fechas seleccionadas
   * @param {string}   params.tipoSalida
   * @param {string}   params.motivo
   * @param {string}   params.horaInicio
   * @param {string}   params.horaFin
   * @param {string}   params.estado       - 'Solicitud' por defecto
   * @param {string}   params.color
   */
  const saveDeparture = useCallback(async ({
    tecnicoIds, dates, tipoSalida, motivo, horaInicio, horaFin, estado, color
  }) => {
    const token = getToken();
    if (!token) throw new Error('No autenticado');

    setSaving(true);
    try {
      const autor = getAutorFromToken(token);

      // Por cada técnico seleccionado × cada fecha → una fila en el cronograma
      for (const tecnicoId of tecnicoIds) {
        for (const date of dates) {
          const dateStr = format(date, 'yyyy-MM-dd');

          const payloadObj = {
            cotizacion:  tipoSalida,
            morning:     tipoSalida,   // campo legacy del backend
            descripcion: motivo,
            colorAM:     color,
            estadoAM:    estado || 'Solicitud',
            horaInicio,
            horaFin,
            rowId:       null,         // null = INSERT, no UPDATE
            autor,
            creado_en:   SOURCE_TAG,
          };

          const res = await fetch(`${API_BASE}/calendar/cronograma`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ date: dateStr, resource: tecnicoId, payload: payloadObj }),
          });

          if (!res.ok) {
            let msg = 'Error al guardar salida';
            try { const d = await res.json(); if (d.message) msg = d.message; } catch {}
            throw new Error(msg);
          }
        }
      }
    } finally {
      setSaving(false);
    }
  }, []);

  // ─── Actualizar estado de una salida existente ───
  const updateDepartureState = useCallback(async (departure, newEstado) => {
    const token = getToken();
    if (!token) throw new Error('No autenticado');

    const autor = getAutorFromToken(token);

    const payloadObj = {
      cotizacion:  departure.tipoSalida,
      morning:     departure.tipoSalida,
      descripcion: departure.motivo,
      colorAM:     departure.color,
      estadoAM:    newEstado,
      horaInicio:  departure.horaInicio,
      horaFin:     departure.horaFin,
      rowId:       departure.rowId,   // UPDATE de fila existente
      autor,
      creado_en:   SOURCE_TAG,
    };

    const res = await fetch(`${API_BASE}/calendar/cronograma`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        date:     format(departure.fecha, 'yyyy-MM-dd'),
        resource: departure.tecnicoId,
        payload:  payloadObj,
      }),
    });

    if (!res.ok) {
      let msg = 'Error al actualizar estado';
      try { const d = await res.json(); if (d.message) msg = d.message; } catch {}
      throw new Error(msg);
    }
  }, []);

  useEffect(() => {
    fetchTecnicos();
  }, [fetchTecnicos]);

  return {
    departures,
    tecnicos,
    loading,
    saving,
    error,
    fetchDepartures,
    saveDeparture,
    updateDepartureState,
    refetch: fetchDepartures,
  };
}
