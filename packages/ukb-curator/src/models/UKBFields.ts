export interface IFieldEntry {
    Path: string,
    Category: number,
    FieldID: number,
    Field: string,
    Participants?: number,
    Items?: number,
    Stability?: string,
    ValueType: string,
    Units?: string | null,
    ItemType?: string,
    Strata?: string
    Sexed?: string,
    Instances: number,
    Array: number,
    Coding?: number | null,
    Notes?: string | null,
    Link?: string
}

export interface IFieldMap {
    [fieldID: number]: IFieldEntry
}