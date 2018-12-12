export function makeGenericReponse(id?: string) {
    const res: any = { successful: true };
    if (id !== undefined) {
        res.id = id;
    }
    return res;
}