// Frozen COMB-2 persistence contract. Future changes require a new migration/version.
export const attendanceCombinedChecksV1 = {
  CHK_attendance_session_combined_configuration: `"mode" <> 'GEOLOCATION_QR' OR (
 "id_assistant_enrollment" IS NOT NULL
 AND ("opened_at" IS NULL OR (
 "latitude" IS NOT NULL AND "longitude" IS NOT NULL
 AND "radius_meters" IS NOT NULL AND "maximum_accepted_accuracy" IS NOT NULL
 AND "starts_at" IS NOT NULL AND "ends_at" IS NOT NULL)))`,
  CHK_attendance_session_combined_window: `"mode" <> 'GEOLOCATION_QR' OR (
 isfinite("date")
 AND ("starts_at" IS NULL OR isfinite("starts_at"))
 AND ("ends_at" IS NULL OR isfinite("ends_at"))
 AND ("opened_at" IS NULL OR isfinite("opened_at"))
 AND ("closed_at" IS NULL OR isfinite("closed_at"))
 AND ("cancelled_at" IS NULL OR isfinite("cancelled_at"))
 AND ("opened_at" IS NULL OR (
 "starts_at" IS NOT NULL AND "ends_at" IS NOT NULL
 AND "starts_at" < "ends_at" AND "opened_at" < "ends_at"
 AND "date" = ("starts_at" AT TIME ZONE 'America/La_Paz')::date
 AND ("cancelled_at" IS NULL OR (
 "cancelled_at" >= "opened_at" AND "cancelled_at" < "starts_at")))))`,
  CHK_attendance_combined_evidence: `"registration_method" <> 'GEOLOCATION_QR' OR (
 "status" = 'PRESENT' AND "id_attendance_session" IS NOT NULL AND "id_enrollment" IS NOT NULL
 AND "id_marked_by" IS NOT NULL AND "marked_at" IS NOT NULL AND isfinite("marked_at")
 AND "accuracy" IS NOT NULL AND "accuracy" >= 0 AND "accuracy" < 'Infinity'::numeric
 AND "distance_meters" IS NOT NULL AND "distance_meters" >= 0
 AND "distance_meters" < 'Infinity'::numeric)`,
  CHK_attendance_combined_authorization_hash: `octet_length("token_hash") = 32`,
  CHK_attendance_combined_authorization_time: `isfinite("qr_validated_at") AND isfinite("expires_at")
 AND "expires_at" > "qr_validated_at"
 AND "expires_at" <= "qr_validated_at" + interval '90 seconds'
 AND ("consumed_at" IS NULL OR (isfinite("consumed_at")
 AND "consumed_at" >= "qr_validated_at" AND "consumed_at" < "expires_at"))`,
  CHK_attendance_audit_operation: `"operation" IN ('CREATE', 'UPDATE')`,
  CHK_attendance_audit_state: `"session_state_at_operation" IN ('OPEN', 'CLOSED')`,
  CHK_attendance_audit_time: `isfinite("occurred_at")`,
  CHK_attendance_audit_transition: `("operation" = 'CREATE' AND "previous_status" IS NULL
 AND "previous_registration_method" IS NULL AND "previous_observation" IS NULL)
 OR ("operation" = 'UPDATE' AND "previous_status" IS NOT NULL
 AND "previous_registration_method" IS NOT NULL)`,
} as const;
