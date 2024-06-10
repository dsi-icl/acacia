import { IUserWithoutToken } from '@itmat-broker/itmat-types';
import { DBType } from '../database/database';

export class TRPCPermissionCore {
    db: DBType;
    constructor(db: DBType) {
        this.db = db;
    }

    /**
     * Get the roles of a user.
     *
     * @param user
     * @param studyId
     * @returns
     */
    public async getRolesOfUser(user: IUserWithoutToken, studyId?: string) {
        return studyId ? await this.db.collections.roles_collection.find({ 'studyId': studyId, 'users': user.id, 'life.deletedTime': null }).toArray() :
            await this.db.collections.roles_collection.find({ 'users': user.id, 'life.deletedTime': null }).toArray();
    }
}