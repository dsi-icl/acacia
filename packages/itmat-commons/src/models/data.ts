export interface IDataEntry {
    m_studyId: string;
    m_subjectId: string; // patient Id
    m_visitId: string; // visit Id
    m_versionId: string[]; // data version Id
    [field: string]: any,
    deleted: null | string
}

export interface IFieldDescriptionObject {
    fieldId: string;0
    timepoint: number;
    measurement: number;
    datatype: 'c' | 'i' | 'd' | 'b' | 't';
}
