import { HttpStatus } from '@nestjs/common';

export const unexpectedHttpMessage = 'No pudimos completar la operación. Inténtalo nuevamente.';

const defaultMessages: ReadonlyMap<string, string> = new Map([
  ['Bad Request', 'Revisa los datos ingresados.'],
  ['Unauthorized', 'Inicia sesión para continuar.'],
  ['Forbidden', 'No tienes permiso para realizar esta acción.'],
  ['Forbidden resource', 'No tienes permiso para acceder a este recurso.'],
  ['Not Found', 'No encontramos el recurso solicitado.'],
  ['Conflict', 'La operación entra en conflicto con los datos actuales.'],
  ['Gone', 'El recurso solicitado ya no está disponible.'],
  ['Payload Too Large', 'El tamaño del archivo supera el límite permitido.'],
  ['File too large', 'El tamaño del archivo supera el límite permitido.'],
  ['Unexpected field', 'El archivo se envió en un campo incorrecto.'],
  ['Unsupported Media Type', 'El formato enviado no es compatible.'],
  ['Unprocessable Entity', 'Revisa los datos ingresados.'],
  ['Too Many Requests', 'Espera un momento antes de volver a intentarlo.'],
  ['Service Unavailable', 'El servicio no está disponible en este momento.'],
  ['Validation failed (numeric string is expected)', 'Ingresa un identificador numérico válido.'],
  ['Validation failed (uuid is expected)', 'La referencia de la operación no es válida.'],
  ['Validation failed (boolean string is expected)', 'Selecciona un valor verdadero o falso.'],
  ['an unknown value was passed to the validate function', 'Revisa los datos ingresados.'],
  ['Internal Server Error', unexpectedHttpMessage],
  ['Internal server error', unexpectedHttpMessage],
  [
    'Invalid career import context',
    'No pudimos abrir la vista previa de estudiantes de la carrera.',
  ],
  ['Invalid career import row', 'No pudimos leer una fila de la importación de estudiantes.'],
  ['Invalid enrollment import context', 'No pudimos abrir la vista previa de matrículas.'],
  ['Invalid student import preview data', 'No pudimos abrir la vista previa de estudiantes.'],
  [
    'Invalid student import preview student',
    'No pudimos leer los datos de un estudiante en la vista previa.',
  ],
  ['Invalid student import RU', 'No pudimos leer el RU de un estudiante en la vista previa.'],
  ['Invalid USER_IMPORT preview data', 'No pudimos abrir la vista previa de usuarios.'],
  ['SESSION_STRUCTURE_INVALID', 'No pudimos cargar la configuración de la sesión de asistencia.'],
  ['Unexpected end of form', 'El archivo se recibió incompleto. Vuelve a cargarlo.'],
]);

const validationMessages: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(.+) should not be empty$/, 'El campo «$1» es obligatorio.'],
  [/^(.+) should not be null or undefined$/, 'El campo «$1» es obligatorio.'],
  [/^(.+) must be (?:an email|a valid email)$/, 'Ingresa un correo electrónico válido en «$1».'],
  [
    /^(.+) must be (?:a valid ISO 8601 date string|ISO 8601 date string|a Date instance)$/,
    'Ingresa una fecha válida en «$1».',
  ],
  [/^(.+) must be (?:a UUID|a UUID string)$/, 'Ingresa una referencia válida en «$1».'],
  [/^(.+) must be a string$/, 'Ingresa texto en «$1».'],
  [/^(.+) must be an integer number$/, 'Ingresa un número entero en «$1».'],
  [
    /^(.+) must be a number conforming to the specified constraints$/,
    'Ingresa un número válido en «$1».',
  ],
  [/^(.+) must be a boolean value$/, 'Selecciona verdadero o falso en «$1».'],
  [/^(.+) must be an array$/, 'Envía una lista de valores en «$1».'],
  [/^(.+) should not be empty array$/, 'Agrega al menos un elemento en «$1».'],
  [
    /^(.+) must be (?:one of the following values|one of these values): (.+)$/,
    'Selecciona un valor permitido para «$1» ($2).',
  ],
  [/^(.+) must not be less than (.+)$/, 'El campo «$1» debe ser mayor o igual que $2.'],
  [/^(.+) must not be greater than (.+)$/, 'El campo «$1» debe ser menor o igual que $2.'],
  [/^(.+) must contain at least (\d+) elements?$/, 'Agrega al menos $2 elementos en «$1».'],
  [/^(.+) must contain no more than (\d+) elements?$/, 'Agrega como máximo $2 elementos en «$1».'],
  [/^All (.+)'s elements must be unique$/, 'Evita repetir elementos en «$1».'],
  [
    /^(.+) must be longer than or equal to (\d+) characters?(?: long)?$/,
    'Ingresa al menos $2 caracteres en «$1».',
  ],
  [
    /^(.+) must be shorter than or equal to (\d+) characters?(?: long)?$/,
    'Ingresa como máximo $2 caracteres en «$1».',
  ],
  [
    /^(.+) must be (?:longer than or equal to|shorter than or equal to) (\d+) and (?:shorter than or equal to|longer than or equal to) (\d+) characters?(?: long)?$/,
    'Revisa los límites de longitud de «$1» ($2 y $3 caracteres).',
  ],
  [/^(.+) must match .+ regular expression$/, 'Revisa el formato de «$1».'],
  [/^nested property (.+) must be either object or array$/, 'Revisa los datos del campo «$1».'],
];

export function toPublicHttpMessage(message: string, status: HttpStatus): string {
  const fallback = defaultMessages.get(message);
  if (fallback) return fallback;
  if (status === HttpStatus.NOT_FOUND && /^Cannot [A-Z]+ /.test(message)) {
    return 'No encontramos el recurso solicitado.';
  }
  if (status !== HttpStatus.BAD_REQUEST) return message;
  if (
    /^(?:Unexpected (?:token|end of JSON input|non-whitespace character)|Expected (?:property name|double-quoted property name|.* in JSON)|Unterminated string in JSON)|is not valid JSON$/.test(
      message,
    )
  ) {
    return 'Revisa el formato de los datos enviados.';
  }

  // class-validator adds this prefix when checking every item in a list.
  const eachValue = message.startsWith('each value in ');
  const constraint = eachValue ? message.slice('each value in '.length) : message;
  for (const [pattern, translation] of validationMessages) {
    if (pattern.test(constraint)) {
      return constraint.replace(
        pattern,
        eachValue ? 'Revisa cada elemento. ' + translation : translation,
      );
    }
  }
  return message;
}
