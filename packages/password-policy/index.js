const maxPasswordBytes = 72;
const passwordRules = [
  {
    label: "Al menos 8 caracteres",
    validate: (value) => Array.from(value).length >= 8,
  },
  { label: "Una letra mayúscula", validate: (value) => /\p{Lu}/u.test(value) },
  { label: "Una letra minúscula", validate: (value) => /\p{Ll}/u.test(value) },
  { label: "Un número", validate: (value) => /\p{Nd}/u.test(value) },
  {
    label: "Un carácter especial",
    validate: (value) => /[\p{P}\p{S}]/u.test(value),
  },
];

function passwordPolicyError(value) {
  if (new TextEncoder().encode(value).length > maxPasswordBytes) {
    return "La nueva contraseña debe ocupar como máximo 72 bytes.";
  }
  if (!passwordRules.every(({ validate }) => validate(value))) {
    return "Revisa los requisitos de la nueva contraseña.";
  }
}

module.exports = { maxPasswordBytes, passwordRules, passwordPolicyError };
