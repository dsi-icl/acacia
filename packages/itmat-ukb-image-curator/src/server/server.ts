import { ServerBase, CustomError, IServerBaseConfig, Logger } from 'itmat-utils';
import { Database, IDatabaseConfig } from '../database/database';
import { ICodingMap, ICodingEntry } from '../models/UKBCoding';
import { IFieldMap, IFieldEntry } from '../models/UKBFields';
import { UKBImageCurator } from '../curation/UKBImageCuration';
import { Poller } from '../poller/poller';

interface IServerConfig extends IServerBaseConfig<IDatabaseConfig> {
    pollingInterval: number
}

export class Server extends ServerBase<IDatabaseConfig, Database, IServerConfig> {
    private _CODING_DICT?: ICodingMap;
    private _FIELD_DICT?: IFieldMap;

    protected async additionalChecks(): Promise<void> {
        /* Fetching field dictionary to memory for faster parsing later; refresh at will / periodically */
        Logger.log('Fetching UKB Field Info..');
        const fieldCursor = this.db.UKB_field_dictionary_collection!.find();
        const fieldDict: IFieldMap = {};
        await fieldCursor.forEach((doc: IFieldEntry) => {
            fieldDict[doc.FieldID] = doc;
        });
        this._FIELD_DICT = fieldDict;
        Logger.log('Finished fetching UKB fields');

        const curator = new UKBImageCurator(this._FIELD_DICT, this.db.UKB_data_collection!);
        const poller = new Poller(this.db.jobs_collection!, this.config.pollingInterval, curator.updateData);
        poller.setInterval();
        return;
    }

    public get CODING_DICT(): ICodingMap {
        return this._CODING_DICT!;
    }

    public get FIELD_DICT(): IFieldMap {
        return this._FIELD_DICT!;
    }
}