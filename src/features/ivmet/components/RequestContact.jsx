import React from 'react';
import { Mail, Phone } from 'lucide-react';

// Contacto que dejó la empresa: el correo con que se registró y el teléfono
// de la solicitud.
export function RequestContact({ request }) {
  return (
    <>
      {request.contactName}
      {request.contactEmail && (
        <small>
          <Mail size={12} /> {request.contactEmail}
        </small>
      )}
      {request.contactPhone && (
        <small>
          <Phone size={12} /> {request.contactPhone}
        </small>
      )}
    </>
  );
}
