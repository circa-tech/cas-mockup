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
  flowRate: string;
  measurementDate: string;
  measurementTime: string;
  totalizer: string;
  userRut: string;
  waterTableDepth: string;
};
