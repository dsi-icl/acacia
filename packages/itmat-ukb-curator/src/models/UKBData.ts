export interface DataEntry {
    patientId: string,
    study: string,
    fieldId: number,
    instance: number,
    array: number,
    value: string | number
}


/* update should be audit trailed */ 

export class UKBData {

}