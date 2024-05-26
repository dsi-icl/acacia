import { IBase } from './base';

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

export interface IData extends IBase {
    studyId: string;
    fieldId: string;
    dataVersion: string | null;
    value: unknown;
    properties: Record<string, unknown>;
}

export interface IGroupedData {
    [key: string]: {
        [key: string]: {
            [key: string]: unknown
        }
    }
}