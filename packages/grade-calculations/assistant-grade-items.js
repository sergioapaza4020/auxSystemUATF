// Names are the only natural key in the current GradeItem catalog.
// Keep the historical plural "Asistencias" without renaming persisted records.
const ASSISTANT_ALLOWED_GRADE_ITEMS = Object.freeze({
  PRACTICAS: "Prácticas",
  LABORATORIO: "Laboratorio",
  ASISTENCIA: "Asistencia",
  ASISTENCIAS: "Asistencia",
  PARTICIPACION: "Participación",
});

function assistantGradeItemLabel(name) {
  const key = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  return Object.prototype.hasOwnProperty.call(
    ASSISTANT_ALLOWED_GRADE_ITEMS,
    key,
  )
    ? ASSISTANT_ALLOWED_GRADE_ITEMS[key]
    : undefined;
}

function isAssistantGradeItem(item) {
  return assistantGradeItemLabel(item.name) !== undefined;
}

module.exports = { assistantGradeItemLabel, isAssistantGradeItem };
