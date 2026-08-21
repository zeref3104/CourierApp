# Política de Privacidad — Courier (charmeurexpress)

**Última actualización:** 21 de agosto de 2026

Esta Política de Privacidad describe cómo la aplicación **Courier** (en adelante, "la App"),
operada por **[NOMBRE LEGAL DE LA EMPRESA]** (en adelante, "el Responsable"), recopila,
utiliza y protege la información de sus usuarios (clientes, destinatarios y personal de
logística). Al utilizar la App, aceptás las prácticas descritas en este documento.

> Nota para el Responsable: los textos entre corchetes `[...]` deben completarse con la
> información real de la empresa antes de publicar la URL en Google Play Console.

---

## 1. Responsable del tratamiento

- **Nombre/Razón social:** [Nombre legal de la empresa]
- **Dominio:** charmeurexpress.us
- **Contacto de privacidad:** privacy@charmeurexpress.us

## 2. Datos que recopilamos

### a) Datos de cuenta
- Correo electrónico.
- Código de cliente y, en su caso, nombre y número de teléfono.
- Contraseña: se almacena de forma segura (hash) en el servidor; **nunca** se guarda en
  texto plano. En el dispositivo, las credenciales de sesión se mantienen en almacenamiento
  seguro (Expo Secure Store / Keychain / Keystore).

### b) Datos de envíos y paquetes
- Datos del remitente y del destinatario (nombre, dirección, teléfono de contacto).
- Información del paquete (descripción, peso, estado, sucursal de retiro y monto a pagar).
- Historial de seguimiento y notificaciones asociadas.

### c) Datos del dispositivo y de uso
- **Token de notificaciones push** (necesario para enviar alertas de estado del envío).
- Idioma preferido del dispositivo.
- Datos de sesión (horarios de acceso, identificador de sesión).

## 3. Finalidad del tratamiento

- Crear y gestionar tu cuenta.
- Autenticar tu identidad (incluido el código OTP enviado por correo para registro/acceso).
- Registrar, seguir y entregar paquetes.
- Enviar notificaciones push sobre el estado de tus envíos.
- Brindar soporte y mejorar el servicio.

## 4. Base legal

Tratamos tus datos con base en (i) la ejecución de un contrato (prestación del servicio de
mensajería) y (ii) tu consentimiento para las comunicaciones y notificaciones.

## 5. Terceros y transferencias

Compartimos datos únicamente con los proveedores estrictamente necesarios:
- **Expo Push Service** (notificaciones push): procesa el token de dispositivo y el contenido
  de la notificación.
- **Proveedor de correo transaccional** (Resend): envía el código OTP de verificación.
- **Infraestructura de hosting** del backend de la App.

No vendemos ni cedemos tus datos personales a terceros con fines comerciales.

## 6. Seguridad

- Las comunicaciones entre la App y el servidor viajan cifradas por **HTTPS** (en tránsito).
- Las credenciales en el dispositivo se guardan en almacenamiento seguro del sistema operativo.
- Aplicamos controles de acceso y buenas prácticas de arquitectura en el backend.

## 7. Retención

Conservamos tus datos mientras tu cuenta esté activa y durante el tiempo necesario para
cumplir obligaciones legales y operativas. Puedes solicitar la eliminación de tu cuenta y
datos asociados en cualquier momento (ver Sección 8).

## 8. Tus derechos

Podés solicitar el acceso, rectificación, eliminación u oposición al tratamiento de tus datos
escribiendo a **privacy@charmeurexpress.us**. Atenderemos tu solicitud en los plazos legales
aplicables.

## 9. Menores

La App no está dirigida a menores de 13 años. Si detectamos la recopilación inadvertida de
datos de un menor, los eliminaremos.

## 10. Cambios

Esta política puede actualizarse. publicaremos la versión vigente en esta misma URL con la
fecha de la última actualización.

## 11. Contacto

Para cualquier duda sobre privacidad: **privacy@charmeurexpress.us**

---

## Anexo — Mapa para el formulario "Data Safety" de Google Play Console

(Completa esto en Play Console; no es un archivo aparte.)

- ** ¿Recopilás datos? ** Sí.
- **Datos recopilados:**
  - Correo electrónico (y, si aplica, nombre y teléfono).
  - Direcciones físicas (remitente/destinatario).
  - Datos de transacciones (monto a pagar del envío).
  - ID y datos del dispositivo (token de notificaciones push).
  - Datos de app activity (historial de envíos/seguimiento).
- **Cifrado en tránsito:** Sí (HTTPS).
- **¿Se comparten con terceros?** Sí — Expo Push Service (notificaciones) y proveedor de
  correo (OTP). Declaralo como "service providers".
- **¿Se puede eliminar?** Sí, bajo solicitud a privacy@charmeurexpress.us.
