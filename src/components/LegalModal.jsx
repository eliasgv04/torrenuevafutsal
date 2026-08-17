import React, { useState } from 'react'

const CONTACT_EMAIL = 'eliasgonzalezvaldepenas@gmail.com'
const RESPONSIBLE = 'Elías González Valdepeñas'
const APP_NAME = 'FutsalKit'

export default function LegalModal({ initialDoc = 'privacy', onClose }) {
  const [doc, setDoc] = useState(initialDoc)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-wide" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            className={doc === 'privacy' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ marginTop: 0, flex: 'none', padding: '8px 16px' }}
            onClick={() => setDoc('privacy')}
          >
            Política de privacidad
          </button>
          <button
            type="button"
            className={doc === 'legal' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ marginTop: 0, flex: 'none', padding: '8px 16px' }}
            onClick={() => setDoc('legal')}
          >
            Aviso legal
          </button>
        </div>

        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-dark)' }}>
          {doc === 'privacy' ? <PrivacyPolicy /> : <LegalNotice />}
        </div>

        <div className="modal-buttons" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <h4 style={{ margin: '0 0 6px', fontFamily: "'Poppins', sans-serif", fontSize: 15 }}>{title}</h4>
      {children}
    </section>
  )
}

function PrivacyPolicy() {
  return (
    <div>
      <p style={{ color: 'var(--text-light)', marginTop: 0 }}>Última actualización: agosto de 2026.</p>

      <Section title="1. Responsable del tratamiento">
        <p>
          <strong>{RESPONSIBLE}</strong>, como persona física responsable de {APP_NAME}, es quien
          decide las finalidades y los medios del tratamiento de los datos personales que se
          gestionan en esta aplicación.
          <br />Contacto: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>

      <Section title="2. Qué datos tratamos">
        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
          <li>Datos de las personas que solicitan acceso para su club: nombre, email de contacto, nombre del equipo y el mensaje que incluyan en el formulario.</li>
          <li>Datos de cuentas de acceso de entrenadores/as: email y contraseña (gestionada de forma cifrada por nuestro proveedor de autenticación).</li>
          <li>Datos de jugadores introducidos por el club: nombre, apellidos, dorsal, posición, fecha de nacimiento (opcional) y estadísticas deportivas (goles, minutos jugados, tarjetas, asistencia a entrenamientos, etc.).</li>
          <li>No recogemos datos de salud, biométricos, ni fotografías de personas.</li>
        </ul>
      </Section>

      <Section title="3. Datos de menores de edad">
        <p>
          Cuando un club da de alta en la aplicación a un jugador o jugadora menor de edad, el
          tratamiento de sus datos (nombre, apellidos, dorsal, posición y estadísticas) se basa en
          el <strong>consentimiento de su padre, madre o tutor/a legal</strong> (art. 8 del RGPD).
          Ese consentimiento lo recaba y custodia el club por sus propios medios (por ejemplo, en
          la ficha de inscripción del jugador); la aplicación no distingue a los jugadores menores
          de los mayores de edad, por lo que es responsabilidad del club disponer de dicho
          consentimiento antes de dar de alta a un jugador menor.
        </p>
      </Section>

      <Section title="4. Con qué finalidad y legitimación">
        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
          <li>Gestionar las solicitudes de acceso de nuevos clubes — <em>consentimiento</em> (art. 6.1.a RGPD), prestado al marcar la casilla del formulario.</li>
          <li>Gestionar el acceso a la aplicación y las cuentas de entrenadores/as — <em>ejecución de la relación</em> con el club (art. 6.1.b RGPD).</li>
          <li>Gestionar la plantilla, entrenamientos, partidos y estadísticas de cada equipo — <em>consentimiento</em> del club, y en el caso de menores, de su tutor/a legal (art. 6.1.a y art. 8 RGPD).</li>
        </ul>
      </Section>

      <Section title="5. Destinatarios y encargados del tratamiento">
        <p>
          Para poder ofrecer el servicio, algunos datos son accesibles por proveedores que actúan
          como encargados del tratamiento (art. 28 RGPD), bajo las garantías de sus propios
          contratos y políticas de protección de datos:
        </p>
        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
          <li><strong>Supabase</strong> — alojamiento de la base de datos, autenticación de usuarios y almacenamiento de archivos.</li>
          <li><strong>Resend</strong> — envío de correos electrónicos transaccionales (notificaciones de solicitudes de acceso, credenciales de cuenta).</li>
        </ul>
        <p>No cedemos datos a terceros con fines comerciales ni publicitarios.</p>
      </Section>

      <Section title="6. Plazo de conservación">
        <p>
          Los datos se conservan mientras el equipo o jugador esté activo en el club dentro de la
          aplicación. Las solicitudes de acceso rechazadas o resueltas se conservan durante un
          plazo razonable a efectos de trazabilidad, y pueden eliminarse antes si lo solicita la
          persona interesada.
        </p>
      </Section>

      <Section title="7. Tus derechos">
        <p>
          Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación
          del tratamiento y portabilidad escribiendo a{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, indicando el derecho que quieres
          ejercer y los datos necesarios para identificarte. Si consideras que el tratamiento de
          tus datos no se ajusta a la normativa, también tienes derecho a presentar una reclamación
          ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noreferrer">www.aepd.es</a>).
        </p>
      </Section>

      <Section title="8. Seguridad">
        <p>
          El acceso a los datos de cada equipo está restringido únicamente a las cuentas vinculadas
          a ese equipo, mediante control de acceso a nivel de base de datos. Las contraseñas de las
          cuentas no son visibles ni accesibles por nadie, incluido el responsable de la aplicación.
        </p>
      </Section>

      <Section title="9. Cookies y almacenamiento técnico">
        <p>
          {APP_NAME} solo utiliza el almacenamiento técnico estrictamente necesario para mantener tu
          sesión iniciada (token de autenticación). No usamos cookies de analítica, publicidad ni de
          terceros.
        </p>
      </Section>
    </div>
  )
}

function LegalNotice() {
  return (
    <div>
      <Section title="1. Datos identificativos">
        <p>
          En cumplimiento del deber de información de la Ley 34/2002, de Servicios de la Sociedad
          de la Información y Comercio Electrónico (LSSI-CE), se informa de que {APP_NAME} es una
          aplicación de gestión de equipos de fútbol sala cuyo titular es:
        </p>
        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
          <li><strong>Titular:</strong> {RESPONSIBLE}</li>
          <li><strong>Contacto:</strong> <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
        </ul>
      </Section>

      <Section title="2. Objeto">
        <p>
          Estas condiciones regulan el acceso y uso de {APP_NAME}, una herramienta para la gestión
          deportiva de equipos de fútbol sala (plantilla, entrenamientos, partidos y estadísticas),
          de acceso restringido a los clubes autorizados.
        </p>
      </Section>

      <Section title="3. Condiciones de acceso y uso">
        <p>
          El acceso a la aplicación requiere una cuenta autorizada. Cada club es responsable de la
          veracidad de los datos que introduce y de mantener la confidencialidad de sus credenciales
          de acceso. El uso de la aplicación para fines distintos a la gestión deportiva del propio
          club no está permitido.
        </p>
      </Section>

      <Section title="4. Propiedad intelectual">
        <p>
          El nombre {APP_NAME}, su diseño, código fuente y contenidos son propiedad del titular
          indicado en el apartado 1, salvo los contenidos aportados por cada club (nombres de
          jugadores, ejercicios, notas, etc.), que siguen siendo propiedad de dicho club.
        </p>
      </Section>

      <Section title="5. Responsabilidad">
        <p>
          El titular no garantiza la disponibilidad continua e ininterrumpida del servicio y no se
          responsabiliza de los daños derivados de un uso inadecuado de la aplicación. Se procurará
          notificar con antelación razonable cualquier interrupción programada.
        </p>
      </Section>

      <Section title="6. Legislación aplicable">
        <p>
          Estas condiciones se rigen por la legislación española. Para cualquier controversia
          relacionada con {APP_NAME}, las partes se someten a los juzgados y tribunales que
          correspondan conforme a derecho.
        </p>
      </Section>
    </div>
  )
}
