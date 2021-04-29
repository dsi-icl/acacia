export interface IDataEntry {
    m_studyId: string;
    m_subjectId: string; // patient Id
    m_visitId: string; // visit Id
    m_versionId: string; // data version Id
    [field: number]: any,
    deleted: null | number
}

export interface IFieldDescriptionObject {
    fieldId: number;
    timepoint: number;
    measurement: number;
    datatype: 'c' | 'i' | 'd' | 'b' | 't';
}
