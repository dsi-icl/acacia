import { ObjectStore } from '@itmat-broker/itmat-commons';
import { DBType } from '../database/database';
import { CoreError, IStudy, enumCoreErrors } from '@itmat-broker/itmat-types';
import { Filter } from 'mongodb';

export class TRPCStudyCore {
    db: DBType;
    objStore: ObjectStore;
    constructor(db: DBType, objStore: ObjectStore) {
        this.db = db;
        this.objStore = objStore;
    }
    /**
     * Get the info of a study.
     *
     * @param studyId - The id of the study.
     *
     * @return IStudy - The object of IStudy.
     */
    public async getStudies(studyId: string | null): Promise<IStudy[]> {
        const query: Filter<IStudy> = { 'life.deletedTime': null };
        if (studyId) {
            query.id = studyId;
        }
        const studies = await this.db.collections.studies_collection.find(query).toArray();
        if (studies.length === 0) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }
        return studies;
    }
}