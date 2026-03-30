# Guía de Acceso a CronoMET 🚀

Esta guía detalla los pasos necesarios para configurar cualquier equipo de la red y permitir el acceso seguro a la aplicación de gestión de calendarios en la dirección: 

**🔗 URL oficial:** [https://cronomet.com.bo:3000](https://cronomet.com.bo:3000)

---

## Requisitos Previos
1.  Tener el archivo de certificado **`rootCA.pem`** (solicítalo al administrador).
2.  Permisos de **Administrador** en el equipo que se va a configurar.

---

## Paso 1: Configurar el Dominio Local (Hosts)
Este paso le dice a Windows que el nombre `cronomet.com.bo` se encuentra en la IP del servidor de Fátima (`192.168.1.60`).

1.  Busca **PowerShell** en el menú de inicio de Windows.
2.  Haz clic derecho y elige **"Ejecutar como administrador"**.
3.  Copia y pega este comando y presiona Enter:
    ```powershell
    Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "`n192.168.1.60`t`tcronomet.com.bo"
    ```

---

## Paso 2: Instalar el Certificado de Seguridad (SSL)
Este paso elimina el aviso de "Sitio no seguro" y activa el candado 🔒 de seguridad.

1.  En la misma ventana de **PowerShell (Administrador)**, ejecuta este comando:
    *(Asegúrate de cambiar la ruta a donde guardaste el archivo rootCA.pem)*.
    ```powershell
    Import-Certificate -FilePath "C:\RUTA\DONDE\ESTA\rootCA.pem" -CertStoreLocation "Cert:\LocalMachine\Root"
    ```
    *Ejemplo: Si está en Descargas sería `C:\Users\TU_USUARIO\Downloads\rootCA.pem`*

---

## Paso 3: Ajuste de Firefox (Solo si usas este navegador)
Firefox a veces ignora la configuración de Windows. Debes hacer esto:

1.  Abre Firefox y ve a **Ajustes** (Configuración).
2.  Busca la palabra **"DNS"**.
3.  En **Configuración de red**, haz clic en el botón **Configuración...**.
4.  Baja hasta el final y **DESMARCA** la opción **"Activar DNS sobre HTTPS"**.
5.  Pulsa Aceptar y reinicia el navegador.

---

## ¡Todo listo! 🎉
Ya puedes entrar al calendario sin problemas de seguridad.

> [!TIP]
> Si el servidor cambia de IP en el futuro (ej: a la `192.168.1.5`), el administrador debe avisar para repetir el Paso 1 con la nueva IP.
