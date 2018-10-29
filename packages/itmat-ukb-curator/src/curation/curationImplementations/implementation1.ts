/* EXAMPLE DOCUMENT SHAPE
{
    m_jobId: j89p2fnkjk3241543q5,
    m_eid: "001",
    m_study: "ukbiobank",
    [instance]: {
        [field]: [value1, value2],
        [field]: value
    },
    [instance]: {
        [field]: [value1, value2, value3]
    }
}
*/

import csvparse from 'csv-parse';
import { Models } from 'itmat-utils';
import { UKBCSVDataCuratorBase, IDataEntryBase } from './UKBCuratorBaseClass';
import { UKBCurationDatabase } from '../../database/database';
import { IHeaderArrayElement } from '../../models/curationUtils';

interface IDataEntry extends IDataEntryBase {

}

/* update should be audit trailed */ 
/* eid is not checked whether it is unique in the file: this is assumed to be enforced by database */
export class UKBCSVDataCurator extends UKBCSVDataCuratorBase<IDataEntry>{
    protected async processLineAndFormatEntry<IDataEntry>(originalEntry: IDataEntryBase, line: string[]): Promise<IDataEntry> {
        const entry: any = Object.assign(originalEntry);

        for (let i = 1; i < line.length; i++) {
            if (line[i] === null || line[i] === '' || this._header[i] === undefined || this._header[i] === null) {
                continue;
            }

            const value: string | number | false = await this.processValue(this._header[i] as IHeaderArrayElement, line[i]);
            const fieldDescription: IHeaderArrayElement = this._header[i] as IHeaderArrayElement;

            /************************HERE IS THE MAIN DIFFERENCE BETWEEN IMPLEMENTATIONS ******/
            const { field: { instance, fieldId, array }, totalArrayNumber  } = this._header[i] as IHeaderArrayElement;
            if (entry[instance] === undefined) {
                entry[instance] = {};
            }

            /* WHAT VALUE TO UPLOAD FOR EACH FIELD? (SPECIFIC TO UKB)
                check whether the the fieldId field already exists
                    ┣ yes -> check if it's array
                    ┃       ┣ yes -> check if [][][arrayNum] already exists
                    ┃       ┃       ┣ yes -> ERROR!
                    ┃       ┃       ┗ no -> [][][arrayNum] = value;
                    ┃       ┗ no -> check if totalArraynumber === 1
                    ┃            ┣ yes -> ERROR!
                    ┃            ┗ no -> ERROR!
                    ┗ no -> check if totalArraynumber of field is 1
                        ┣ yes -> = value
                        ┗ no -> = []; [][][arrayNum] = value;
            */
            if (entry[instance][fieldId] !== undefined) {
                if (entry[instance][fieldId] instanceof Array) {
                    if (entry[instance][fieldId][array] !== undefined) {
                        console.log('error', this._header[i], this._numOfSubj);
                        // const error: string = Models.JobModels.jobTypes.UKB_CSV_UPLOAD.error.UNEVEN_FIELD_NUMBER(currentLineNum);
                        // await this.setJobStatusToError(error);
                        // (this.incomingWebStream as any).destroy();  //does this work?
                        throw Error;
                    } else {
                        entry[instance][fieldId][array] = value;
                    }
                } else {
                    // const error: string = Models.JobModels.jobTypes.UKB_CSV_UPLOAD.error.UNEVEN_FIELD_NUMBER(currentLineNum);
                    // await this.setJobStatusToError(error);
                    console.log('error2', this._header[i], this._numOfSubj);
                    // (this.incomingWebStream as any).destroy();  //does this work?
                    throw Error;
                }
            } else {
                if (totalArrayNumber === 1) {
                    entry[instance][fieldId] = value;
                } else {
                    entry[instance][fieldId] = [];
                    entry[instance][fieldId][array] = value;
                }
            }

            /**********************************************************************************/
        }

        return entry;
    }
}