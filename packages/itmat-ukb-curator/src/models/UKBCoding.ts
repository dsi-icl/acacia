export interface ICodingEntry {
    Coding: number,
    Value: string,
    Meaning: string
}

export interface ICodingMap {
    [property: number]: {
        [property: string]: string
    }
}