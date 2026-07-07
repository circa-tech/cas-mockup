export type WellRegistryFormState = {
  aquiferSector: string;
  casId: string;
  centroControlRut: string;
  codigoObra: string;
  lat: string;
  lng: string;
  name: string;
  provider: string;
};


export type WellMeasurementFormState = {
  codigoObra: string;
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
