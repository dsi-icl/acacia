export interface CodingEntry {
    Coding: number,
    Value: string,
    Meaning: string
}

export interface CodingMap {
    [property: number]: {
        [property: string]: string
    }
}