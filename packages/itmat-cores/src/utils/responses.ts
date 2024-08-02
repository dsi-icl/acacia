export interface IGenericResponse {
    successful: boolean;
    id?: string;
    code?: string;
    description?: string;
}

export function makeGenericResponse(id?: string, successful?: boolean, code?: string, description?: string): IGenericResponse {
    const res: IGenericResponse = {
        id: id ?? undefined,
        successful: successful ?? true,
        code: code ?? undefined,
        description: description ?? undefined
    };
    return res;
}
