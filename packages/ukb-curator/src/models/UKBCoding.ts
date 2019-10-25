export interface ICodingEntry {
    Coding: number;
    Value: string;
    Meaning: string;
}

export interface ICodingDictionaryForAField {
    [property: string]: string;
}

export interface ICodingMap {
    [property: number]: ICodingDictionaryForAField;
}
