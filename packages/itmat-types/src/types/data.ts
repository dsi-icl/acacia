export interface IDataEntry {
    id: string;
    m_studyId: string;
    m_subjectId: string; // patient Id
    m_visitId: string; // visit Id
    m_versionId: string | null; // data version Id
    m_fieldId: string;
    metadata?: {
        add?: string[];
        remove?: string[];
        [key: string]: unknown;
    };
    value: unknown;
    uploadedBy?: string;
    uploadedAt: number;
}

export interface IFieldDescriptionObject {
    fieldId: string;
    fieldName: string;
    timepoint: number;
    measurement: number;
    dataType: 'cat' | 'int' | 'dec' | 'bool' | 'file' | 'json' | 'str' | 'date';
}

export interface IGroupedData {
    [key: string]: {
        [key: string]: {
            [key: string]: unknown
        }
    }
}