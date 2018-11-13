import { ServerBase, CustomError, IServerBaseConfig, Logger } from 'itmat-utils';
import { Database, IDatabaseConfig } from '../database/database';
import { ICodingMap, ICodingEntry } from '../models/UKBCoding';
import { IFieldMap, IFieldEntry } from '../models/UKBFields';

export class Server extends ServerBase<IDatabaseConfig, Database, IServerBaseConfig<IDatabaseConfig>> {
    private _CODING_DICT?: ICodingMap;
    private _FIELD_DICT?: IFieldMap;
    private firstTimeFetch: boolean = true;

    protected async additionalChecks(): Promise<void> {
        Logger.log('Fetching UKB codings..');
        const codingCursor = this.db.UKB_coding_collection!.find();
        const codingDict: ICodingMap = {};
        await codingCursor.forEach((doc: ICodingEntry) => {
            if (codingDict[doc.Coding]) {
                codingDict[doc.Coding][String(doc.Value)] = doc.Meaning;
            } else {
                codingDict[doc.Coding] = {};
                codingDict[doc.Coding][String(doc.Value)] = doc.Meaning;
            }
        });
        this._CODING_DICT = codingDict;
        Logger.log('Finished fetching UKB codings');

        /* Fetching field dictionary to memory for faster parsing later; refresh at will / periodically */
        Logger.log('Fetching UKB Field Info..');
        const fieldCursor = this.db.UKB_field_dictionary_collection!.find();
        const fieldDict: IFieldMap = {};
        await fieldCursor.forEach((doc: IFieldEntry) => {
            fieldDict[doc.FieldID] = doc;
        });
        this._FIELD_DICT = fieldDict;
        Logger.log('Finished fetching UKB fields');

        return;
    }

    // public setFetchCodingAndFieldsInterval

    public get CODING_DICT(): ICodingMap {
        return this._CODING_DICT!;
    }

    public get FIELD_DICT(): IFieldMap {
        return this._FIELD_DICT!;
    }
}