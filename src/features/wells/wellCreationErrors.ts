import { ApiRequestError, ApiTransportError } from "../../services/apiError";

const registryFields: Record<string, string> = {
  aquiferSector: "Sector acuífero",
  casId: "CAS",
  cas_id: "CAS",
  catchmentStatus: "Estado de la captación",
  centroControlRut: "RUT del centro de control",
  codigoObra: "Código de obra",
  datum: "Datum",
  fieldContactEmail: "Correo del contacto en terreno",
  fieldContactPhone: "Teléfono del contacto en terreno",
  fieldContactRepresentative: "Representante del contacto en terreno",
  flowmeterBrand: "Marca del caudalímetro",
  flowmeterDiameter: "Diámetro del caudalímetro",
  flowmeterInstallationDate: "Fecha de instalación del caudalímetro",
  flowmeterModel: "Modelo del caudalímetro",
  habilitationDiameter: "Diámetro habilitación",
  huso: "Huso",
  lat: "Latitud",
  levelProbeBrand: "Marca de la sonda de nivel",
  levelProbeDiameter: "Diámetro de la sonda de nivel",
  levelProbeInstallationDate: "Fecha de instalación de la sonda de nivel",
  levelProbeInstallationDepth: "Profundidad de instalación de la sonda de nivel",
  lng: "Longitud",
  locationReference: "Referencia ubicación",
  name: "Nombre",
  observations: "Observaciones",
  ownerContacts: "Contacto del titular",
  provider: "Proveedor de telemetría",
  pumpDepth: "Profundidad de la bomba",
  shac: "SHAC",
  shacSubsector: "Subsector SHAC",
  telemetryEnabled: "Telemetría",
  titularName: "Nombre o razón social del titular",
  titularRut: "RUT del titular del pozo",
  utmEasting: "Este (UTM)",
  utmNorthing: "Norte (UTM)",
  waterRights: "Derecho de aprovechamiento",
  wellDepth: "Profundidad del pozo",
};

const nestedFields: Record<string, Record<string, string>> = {
  waterRights: {
    anio: "Año",
    authorizedFlowRate: "Caudal autorizado",
    authorizedVolume: "Volumen anual autorizado",
    cbr: "CBR",
    fojas: "Fojas",
    holderName: "Nombre o razón social del titular",
    holderRut: "RUT del titular",
    numero: "Número",
  },
  ownerContacts: {
    email: "Correo",
    representative: "Representante",
    rut: "RUT",
    phone: "Teléfono",
  },
};

const getValidationMessage = (detail: unknown) => {
  const fields = new Set<string>();
  for (const issue of Array.isArray(detail) ? detail : []) {
    if (!issue || !Array.isArray(issue.loc) || issue.loc[0] !== "body") continue;
    const [, field, index, child] = issue.loc;
    if (typeof field !== "string" || !Object.hasOwn(registryFields, field)) continue;
    const label = registryFields[field];
    if (Object.hasOwn(nestedFields, field) && Number.isSafeInteger(index) && index >= 0) {
      const nested = nestedFields[field];
      const suffix = typeof child === "string" && Object.hasOwn(nested, child) ? ` (${nested[child]})` : "";
      fields.add(`${label} ${index + 1}${suffix}`);
    } else {
      fields.add(label);
    }
  }

  if (fields.has("Derecho de aprovechamiento")) {
    fields.delete("Derecho de aprovechamiento");
    const remaining = fields.size ? ` Revisa también ${[...fields].join(", ")}.` : "";
    return `Revisa los derechos de aprovechamiento. Ingresa al menos uno con caudal, volumen anual, nombre y RUT del titular.${remaining}`;
  }
  return fields.size
    ? `Revisa los datos de estos campos: ${[...fields].join(", ")}.`
    : "Hay datos inválidos. Revisa los campos obligatorios y el formato de los valores.";
};

const responseFailure = (error: ApiRequestError): { cause: string; message: string } => {
  switch (error.status) {
    case 401:
      return { cause: "invalid_session", message: "No pudimos validar tu sesión. Vuelve a iniciar sesión e inténtalo de nuevo." };
    case 403:
      return { cause: "permission_denied", message: "Tu cuenta no tiene permiso para crear pozos en esta CAS." };
    case 404:
      return { cause: "cas_not_found", message: "La CAS seleccionada ya no está disponible. Revisa la selección." };
    case 409:
      return { cause: "duplicate_work_code", message: "Este código de obra ya está registrado. Revisa el código o busca el pozo en el registro." };
    case 422:
      return { cause: "invalid_fields", message: getValidationMessage(error.rawDetail) };
    default:
      return error.status >= 500
        ? { cause: "service_error", message: "El servicio devolvió un error al crear el pozo. Revisa el registro antes de volver a intentarlo." }
        : { cause: "request_error", message: "El servicio rechazó la creación del pozo. Intenta nuevamente." };
  }
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const reportWellCreationFailure = (error: unknown, localId: string): string => {
  const response = error instanceof ApiRequestError ? error : null;
  const serverId = response?.diagnosticId;
  const diagnosticId = serverId && uuidPattern.test(serverId) ? serverId : localId;
  const { cause, message } = response
    ? responseFailure(response)
    : error instanceof ApiTransportError
      ? error.reason === "offline"
        ? { cause: "offline", message: "No se envió la solicitud. Recupera la conexión para guardar el pozo." }
        : { cause: "no_response", message: "No recibimos respuesta al intentar crear el pozo. Revisa tu conexión y confirma en el registro si se creó antes de volver a intentarlo." }
      : { cause: "client_error", message: "No pudimos confirmar la creación del pozo. Revisa el registro antes de volver a intentarlo." };

  console.warn("well_creation", {
    diagnosticId,
    method: "POST",
    route: "/api/v1/wells/registry",
    status: response?.status ?? null,
    cause,
  });
  return `${message} Referencia de diagnóstico: ${diagnosticId}`;
};
