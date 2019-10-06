export interface IGenericResponse {
    successful: boolean;
    id?: string;
}

export function makeGenericReponse(id?: string): IGenericResponse {
    const res: IGenericResponse = { successful: true };
    if (id !== undefined) {
        res.id = id;
    }
    return res;
}
