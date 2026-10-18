export type WellRegistryFormState = {
  aquiferSector: string;
  casId: string;
  catchmentStatus: string;
  centroControlRut: string;
  codigoObra: string;
  datum: string;
  fieldContactEmail: string;
  fieldContactPhone: string;
  fieldContactRepresentative: string;
  flowmeterBrand: string;
  flowmeterDiameter: string;
  flowmeterInstallationDate: string;
  flowmeterModel: string;
  habilitationDiameter: string;
  huso: string;
  lat: string;
  levelProbeBrand: string;
  levelProbeDiameter: string;
  levelProbeInstallationDate: string;
  levelProbeInstallationDepth: string;
  locationReference: string;
  lng: string;
  name: string;
  observations: string;
  ownerContacts: {
    email: string;
    phone: string;
    representative: string;
    rut: string;
  }[];
  provider: string;
  pumpDepth: string;
  shac: string;
  shacSubsector: string;
  telemetryEnabled: string;
  utmEasting: string;
  utmNorthing: string;
  waterRights: {
    anio: string;
    authorizedFlowRate: string;
    authorizedVolume: string;
    cbr: string;
    fojas: string;
    holderName: string;
    holderRut: string;
    numero: string;
  }[];
  wellDepth: string;
};


export type WellMeasurementFormState = {
  wellId: string;
  companyRut: string;
  conductivity: string;
  flowRate: string;
  isOperating: string;
  measurementDate: string;
  measurementTime: string;
  observations: string;
  ph: string;
  pressure: string;
  totalizer: string;
  userRut: string;
  waterTableDepth: string;
  waterLevelCondition: string;
};
