import { ItmatAPIReq } from '../server/requests';
import { Models, RequestValidationHelper, CustomError, OpenStackSwiftObjectStore, Logger } from 'itmat-utils';
import { Express, Request, Response, NextFunction } from 'express';
import mongodb from 'mongodb';
import uuidv4 from 'uuid/v4';
declare global {
    namespace Express {
        namespace Multer {
            interface File { // tslint:disable-line
                stream: NodeJS.ReadableStream;
                originalName: string;
            }
        }
    }
}

export class QueryController {
    constructor(private readonly queryCollection: mongodb.Collection) {
        this.createQuery = this.createQuery.bind(this);

    }

    public async createQuery(req: ItmatAPIReq<requests.CreateQueryBody>, res: Response, next: NextFunction): Promise<void> {
        const validator = new RequestValidationHelper(req, res);
        // TO_DO: check study exists, check no spaces in file name
        // TO_DO: change this to a dispatcher for different types of jobs
        if (validator
            .checkRequiredKeysArePresentIn<requests.CreateQueryBody>(Models.APIModels.Enums.PlaceToCheck.BODY, ['query'])
            .checksFailed) { return; }

        if (!this.queryObjectSyntaxIsValid(req.body.query)) {
            res.status(400).json(new CustomError('Query object syntax error.')); // TO_DO: elaborate later
            return;
        }

        const query = this.translateApiQueryObjToMongoQuery(req.body.query);
        const entryId = uuidv4();
        const entry: Models.Query.IQueryEntry = {
            id: entryId,
            queryString: JSON.stringify(query),
            study: req.body.query.study,
            requester: req.user!.username,
            status: 'CREATED',
            error: null,
            cancelled: false
        };

        try {
            await this.queryCollection.insertOne(entry);
            res.status(200).json({ queryId: entryId });
            return;
        } catch (e) {
            console.log(e);
            Logger.error(`Cannot create query by user ${req.user!.username}: ${JSON.stringify(req.body)}`);
            res.status(500).json(new CustomError('Server error.'));
            return;
        }

    }

    private queryObjectSyntaxIsValid(queryObj: object) {
        // queryObj.hasOwnProperty('study');
        // TO_DO: implement later
        // beware of inject attacks
        return true;
    }

    private translateApiQueryObjToMongoQuery(queryObj: object) {
       // TO_DO: implement later
        // beware of inject attacks
        return queryObj;         // TO_DO: implement later
    }
}