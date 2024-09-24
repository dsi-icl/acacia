export interface IGenericResponse {
    successful: boolean;
    id?: string;
    code?: string;
    description?: string;
}

export enum enumReservedKeys {
    STUDY_LEVEL_DATA = 'reserved_study_level_data'
}