/* EXAMPLE DOCUMENT SHAPE
{
    m_jobId: j89p2fnkjk3241543q5,
    m_eid: "001",
    m_study: "ukbiobank",
    [field]: {
        [instance]: { 0: 1212, 1: 1432, 3: 1234 }
    }
}
*/

import { UKBCSVDataCuratorBase, IDataEntryBase } from './UKBCuratorBaseClass';
import { IHeaderArrayElement } from '../models/curationUtils';

interface IDataEntry extends IDataEntryBase {
}

/* update should be audit trailed */
/* eid is not checked whether it is unique in the file: this is assumed to be enforced by database */
export class UKBCSVDataCurator extends UKBCSVDataCuratorBase<IDataEntry> {
    protected async processLineAndFormatEntry(originalEntry: IDataEntryBase, line: string[]): Promise<IDataEntry> {
        const entry: any = Object.assign(originalEntry);

        for (let i = 1; i < line.length; i++) {
            if (line[i] === '' || this._header[i] === null || line[i] === null || this._header[i] === undefined ) {
                continue;
            }

            const value: string | number | false = await this.processValue(this._header[i] as IHeaderArrayElement, line[i]);
            const fieldDescription: IHeaderArrayElement = this._header[i] as IHeaderArrayElement;

            /************************HERE IS THE MAIN DIFFERENCE BETWEEN IMPLEMENTATIONS ******/
            const { field: { instance, fieldId, array }, totalArrayNumber  } = this._header[i] as IHeaderArrayElement;
            if (entry[fieldId] === undefined) {
                entry[fieldId] = {};
            }

            /**
             * 1. check if entry[fieldId][instance] is defined
             * 2. check if entry[fieldId][instance][array] is defined
             *      if not then add the entry
             *      if yes then error
             */

            if (entry[fieldId][instance] === undefined) {
                entry[fieldId][instance] = { [array]: value };
                continue;
            } else if (entry[fieldId][instance][array] === undefined) {
                entry[fieldId][instance][array] = value;
            } else {
                throw Error; // duplicate value
            }
            /**********************************************************************************/
        }

        return entry;
    }
}