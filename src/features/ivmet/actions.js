import { today, versionOf, effectiveState } from './format';
const input = (name, label, extra = {}) => ({ name, label, ...extra });
const select = (name, label, options, extra = {}) =>
  input(name, label, { type: 'select', options, ...extra });
const options = (items) => items.map(([value, label]) => ({ value, label }));
const reason = input('reason', 'Motivo / respaldo', {
  type: 'textarea',
  wide: true,
  maxLength: 1000,
});
const password = input('password', 'Contraseña temporal', {
  type: 'password',
  wide: true,
  hint: 'Mínimo 12 caracteres. Entrégala por un canal seguro; será obligatorio cambiarla al ingresar.',
});
export function actionConfig(
  action,
  { clientId, record = {}, workspace, plans = [] } = {}
) {
  const target = { clientId, id: record.id, version: versionOf(record) };
  const plants = (workspace?.plants || [])
    .filter((p) => p.activo)
    .map((p) => ({
      value: p.id,
      label: `${p.legacy_codigo_planta} · ${p.nombre || 'Planta'}`,
    }));
  const roles = options([
    ['cliente_operador', 'Operador'],
    ['cliente_jefe_calidad', 'Jefe de calidad'],
  ]);
  const configs = {
    'plan.save': () => ({
      title: record.id ? 'Editar plan comercial' : 'Nuevo plan comercial',
      description:
        'Los cupos ya contratados se conservan. Esta configuración aplica a nuevos contratos.',
      codeInfo: record.codigo || 'Se genera automáticamente al guardar',
      values: {
        ...(record.id ? { id: record.id, version: versionOf(record) } : {}),
        name: record.nombre || '',
        description: record.descripcion || '',
        seats: record.cuentas_incluidas || 5,
        graceDays: record.dias_gracia || 0,
        active: record.activo ?? true,
      },
      fields: [
        input('name', 'Nombre del plan', { wide: true }),
        input('seats', 'Cuentas incluidas', {
          type: 'integer',
          min: 1,
          max: 10000,
        }),
        input('graceDays', 'Días de gracia', {
          type: 'integer',
          min: 0,
          max: 90,
        }),
        input('description', 'Descripción', {
          type: 'textarea',
          wide: true,
          required: false,
        }),
        input('active', 'Disponible para contratar', {
          type: 'checkbox',
          hint: 'Plan activo',
        }),
      ],
    }),
    'price.create': () => ({
      title: 'Nueva tarifa',
      description: `${record.nombre} · La tarifa anterior se cerrará el día previo, conservando el historial.`,
      values: {
        planId: record.id,
        periodicity: 'MONTHLY',
        currency: 'BOB',
        amount: '',
        startsOn: today(),
      },
      fields: [
        select(
          'periodicity',
          'Periodicidad',
          options([
            ['MONTHLY', 'Mensual'],
            ['ANNUAL', 'Anual'],
          ])
        ),
        select(
          'currency',
          'Moneda',
          options([
            ['BOB', 'Bolivianos (BOB)'],
            ['USD', 'Dólares (USD)'],
          ])
        ),
        input('amount', 'Importe', { decimal: true }),
        input('startsOn', 'Vigente desde', { type: 'date' }),
      ],
    }),
    'contract.create': () => ({
      title: 'Registrar contrato firmado',
      submit: 'Registrar contrato y factura',
      description:
        'El contrato crea una suscripción pendiente. Las licencias se habilitan cuando registres el pago completo de la primera factura.',
      values: {
        clientId,
        number: '',
        invoiceNumber: '',
        signedOn: today(),
        startsOn: today(),
        endsOn: '',
        priceId: '',
        notes: '',
      },
      fields: [
        input('number', 'Número de contrato'),
        input('invoiceNumber', 'Número de factura / documento'),
        select(
          'priceId',
          'Plan y tarifa',
          plans
            .filter((p) => p.activo)
            .flatMap((p) =>
              p.prices
                .filter((v) => v.activo)
                .map((v) => ({
                  value: v.id,
                  label: `${p.nombre} · ${v.periodicidad === 'MONTHLY' ? 'Mensual' : 'Anual'} · ${v.moneda} ${v.importe} (desde ${v.vigente_desde})`,
                }))
            ),
          { wide: true }
        ),
        input('signedOn', 'Fecha de firma', { type: 'date' }),
        input('startsOn', 'Inicio del primer período', { type: 'date' }),
        input('endsOn', 'Fin del contrato', {
          type: 'date',
          hint: 'Debe cubrir al menos el primer mes o año contratado.',
        }),
        input('notes', 'Observaciones / referencia del contrato', {
          type: 'textarea',
          required: false,
          wide: true,
        }),
      ],
    }),
    'subscription.renew': () => ({
      title: 'Renovar período',
      submit: 'Generar factura de renovación',
      description:
        'La vigencia se amplía al completar el pago. Si renuevas antes del vencimiento no se interrumpe el período actual.',
      values: {
        ...target,
        priceId: record.precio_plan_id,
        invoiceNumber: '',
        seats: Math.max(0, Number(record.assigned) - Number(record.baseSeats)),
        additionalAmount: '0.00',
      },
      fields: [
        select(
          'priceId',
          'Tarifa',
          plans
            .filter((p) => p.id === record.plan_id)
            .flatMap((p) =>
              p.prices
                .filter(
                  (v) => v.activo && v.periodicidad === record.periodicidad
                )
                .map((v) => ({
                  value: v.id,
                  label: `${v.moneda} ${v.importe} · desde ${v.vigente_desde}`,
                }))
            )
        ),
        input('invoiceNumber', 'Número de factura / documento'),
        input('seats', 'Cupos adicionales del nuevo período', {
          type: 'integer',
          min: 0,
          max: 10000,
        }),
        input('additionalAmount', 'Importe adicional total', {
          decimal: true,
          hint: 'Además de la tarifa del plan. Usa 0.00 si no hay adicionales.',
        }),
      ],
    }),
    'seats.purchase': () => ({
      title: 'Agregar cupos',
      submit: 'Generar factura de cupos',
      description:
        'Los cupos se habilitan al registrar el pago completo y vencen con el período actual.',
      values: { ...target, seats: 1, amount: '', invoiceNumber: '' },
      fields: [
        input('seats', 'Cuentas adicionales', {
          type: 'integer',
          min: 1,
          max: 10000,
        }),
        input('amount', 'Importe total', { decimal: true }),
        input('invoiceNumber', 'Número de factura / documento', { wide: true }),
      ],
    }),
    'payment.record': () => ({
      title: 'Registrar pago recibido',
      submit: 'Confirmar pago registrado',
      description:
        'Registro administrativo únicamente: no se realiza ningún cobro ni transferencia bancaria.',
      values: {
        ...target,
        amount: String(record.saldo),
        paidOn: today(),
        method: 'TRANSFER',
        reference: '',
      },
      fields: [
        input('amount', `Importe (${record.moneda})`, {
          decimal: true,
          hint: `Saldo pendiente: ${record.saldo}`,
        }),
        input('paidOn', 'Fecha de pago', { type: 'date' }),
        select(
          'method',
          'Medio de pago',
          options([
            ['TRANSFER', 'Transferencia'],
            ['CASH', 'Efectivo'],
            ['OTHER', 'Otro'],
          ])
        ),
        input('reference', 'Referencia / comprobante'),
      ],
    }),
    'invoice.void': () => ({
      title: 'Anular factura sin pagos',
      danger: true,
      description:
        'No elimina la factura. Revoca sus cupos pendientes. Si es la factura inicial impagada, también cancela el contrato pendiente para permitir registrar uno corregido.',
      values: { ...target, reason: '' },
      fields: [reason],
    }),
    'subscription.state': () => ({
      title: 'Cambiar estado de suscripción',
      description:
        'Suspender bloquea el acceso sin borrar información. Cancelar revoca licencias y es definitivo.',
      values: {
        ...target,
        state: record.estado === 'PENDING' ? 'CANCELLED' : 'SUSPENDED',
        reason: '',
      },
      fields: [
        select(
          'state',
          'Nuevo estado',
          options(
            record.estado === 'PENDING'
              ? [['CANCELLED', 'Cancelar alta pendiente']]
              : [
                  ['SUSPENDED', 'Suspender acceso'],
                  ['ACTIVE', 'Reactivar período pagado'],
                  ['GRACE', 'Conceder gracia configurada'],
                  ['CANCELLED', 'Cancelar definitivamente'],
                ]
          )
        ),
        reason,
      ],
    }),
    'contract.extend': () => ({
      title: 'Ampliar contrato',
      description:
        'Registra la extensión acordada con el cliente. No renueva ni cobra automáticamente la suscripción.',
      values: { ...target, endsOn: '', reason: '' },
      fields: [input('endsOn', 'Nueva fecha final', { type: 'date' }), reason],
    }),
    'seat.revoke': () => ({
      title: 'Revocar cupos adicionales',
      danger: true,
      description:
        'Solo se permite si las licencias asignadas caben en los cupos restantes. No genera un reembolso.',
      values: { ...target, reason: '' },
      fields: [reason],
    }),
    'user.create': () => ({
      title: 'Crear usuario del cliente',
      submit: 'Crear cuenta',
      description:
        'La cuenta se crea sin licencia. Después podrás asignarle un cupo de la suscripción vigente.',
      values: {
        clientId,
        username: '',
        name: '',
        role: 'cliente_operador',
        plantIds: [],
        password: '',
      },
      fields: [
        input('username', 'Usuario', {
          hint: 'Letras, números, punto, guion o guion bajo.',
        }),
        input('name', 'Nombre completo'),
        select('role', 'Rol', roles),
        input('plantIds', 'Plantas autorizadas', {
          type: 'multi',
          options: plants,
          wide: true,
        }),
        password,
      ],
    }),
    'user.update': () => ({
      title: 'Editar acceso del usuario',
      description:
        'Desactivar la cuenta revoca su licencia y libera el cupo. No borra sus verificaciones históricas.',
      values: {
        ...target,
        name: record.nombre,
        role: record.rol,
        plantIds: record.plantIds,
        active: record.activo,
        reason: '',
      },
      fields: [
        input('name', 'Nombre completo'),
        select('role', 'Rol', roles),
        input('plantIds', 'Plantas autorizadas', {
          type: 'multi',
          options: plants,
          wide: true,
        }),
        input('active', 'Estado de la cuenta', {
          type: 'checkbox',
          hint: 'Usuario activo',
        }),
        {
          ...reason,
          required: false,
          hint: 'Obligatorio si desactivas el usuario.',
        },
      ],
    }),
    'user.reset': () => ({
      title: 'Restablecer contraseña',
      description:
        'El usuario deberá cambiar su contraseña temporal en el próximo ingreso. No se recuperan ni muestran contraseñas anteriores.',
      values: { ...target, password: '', reason: '' },
      fields: [password, reason],
    }),
    'license.assign': () => ({
      title: 'Asignar licencia',
      description:
        'La asignación ocupa un cupo. Se valida la vigencia y capacidad de la suscripción en el servidor.',
      values: { clientId, id: record.id, subscriptionId: '' },
      fields: [
        select(
          'subscriptionId',
          'Suscripción',
          (workspace?.subscriptions || [])
            .filter(
              (s) =>
                ['ACTIVE', 'GRACE'].includes(effectiveState(s)) &&
                Number(s.seats) > Number(s.assigned)
            )
            .map((s) => ({
              value: s.id,
              label: `${s.planName} · ${s.assigned}/${s.seats} cupos usados`,
            })),
          { wide: true }
        ),
      ],
    }),
    'license.revoke': () => ({
      title: 'Revocar licencia',
      danger: true,
      description:
        'El usuario pierde acceso a la operación de IvMET y se libera su cupo. El historial se conserva.',
      values: { clientId, id: record.id, reason: '' },
      fields: [reason],
    }),
    'area.save': () => ({
      title: record.id ? 'Editar área' : 'Nueva área',
      description: 'Organiza las balanzas por sectores de la planta.',
      values: {
        clientId,
        ...(record.id ? { id: record.id, version: versionOf(record) } : {}),
        plantId: record.planta_id || '',
        name: record.nombre || '',
        active: record.activa ?? true,
      },
      fields: [
        select(
          'plantId',
          'Planta',
          record.id
            ? plants.filter((p) => p.value === record.planta_id)
            : plants
        ),
        input('name', 'Nombre del área'),
        input('active', 'Estado', { type: 'checkbox', hint: 'Área activa' }),
      ],
    }),
    'pattern.save': () => ({
      title: record.id ? 'Editar patrón' : 'Nuevo patrón',
      description:
        'El patrón pertenece al cliente y solo se podrá utilizar en sus plantas autorizadas.',
      values: {
        clientId,
        ...(record.id ? { id: record.id, version: versionOf(record) } : {}),
        code: record.codigo || '',
        description: record.descripcion || '',
        type: record.tipo || 'Juego de pesas',
        class: record.clase || '',
        unit: record.unidad || 'kg',
        capacity: record.capacidad || '',
        plantIds: record.plantIds || [],
        active: record.activo ?? true,
      },
      fields: [
        input('code', 'Código', { readOnly: Boolean(record.id) }),
        input('description', 'Descripción'),
        input('type', 'Tipo'),
        input('class', 'Clase', { required: false }),
        input('unit', 'Unidad'),
        input('capacity', 'Capacidad nominal', {
          required: false,
          decimal: true,
        }),
        input('plantIds', 'Plantas autorizadas', {
          type: 'multi',
          options: plants,
          wide: true,
        }),
        input('active', 'Estado', { type: 'checkbox', hint: 'Patrón activo' }),
      ],
    }),
    'certificate.create': () => ({
      title: 'Registrar certificado',
      description: `Patrón ${record.codigo}. El certificado se conserva como evidencia histórica aunque posteriormente venza o se anule.`,
      values: {
        clientId,
        patternId: record.id,
        number: '',
        lab: '',
        calibratedOn: today(),
        expiresOn: '',
      },
      fields: [
        input('number', 'Número de certificado'),
        input('lab', 'Laboratorio'),
        input('calibratedOn', 'Fecha de calibración', { type: 'date' }),
        input('expiresOn', 'Vencimiento', { type: 'date' }),
      ],
    }),
    'certificate.annul': () => ({
      title: 'Anular certificado',
      danger: true,
      description:
        'El certificado deja de estar disponible para nuevas verificaciones. La evidencia anterior no se modifica.',
      values: { clientId, id: record.id, reason: '' },
      fields: [reason],
    }),
    'equipment.configure': () => ({
      title: `Disponibilidad de ${record.cod_metrica}`,
      description:
        'Habilita el equipo contratado con catálogo validado. El cliente valida su ficha y define áreas, patrones y planes desde la app.',
      values: {
        clientId,
        id: record.id,
        version: String(record.config_version),
        enabled: record.habilitado,
      },
      fields: [
        input('enabled', 'Disponibilidad en IvMET', {
          type: 'checkbox',
          hint: 'Permitir al cliente configurar esta balanza en su app',
        }),
      ],
    }),
  };
  return { ...configs[action](), action };
}
