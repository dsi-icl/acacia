import { Request, Response, NextFunction } from 'express';
import * as Models from './models/index';
import { CustomError } from './error';

declare global {
    namespace Express {
        interface Request { // tslint:disable-line
            user?: any
        }
    }
}

/**
 * @class RequestValidationHelper
 * @description Contains the checks routinely needed in express.js request handlers
 */
export class RequestValidationHelper {
    /* USAGE IN CONTROLLERS:
    //each check returns the instance; but if check is not passed, this.allOkay is set to false
    //all the subsequent checks will not be performed since some might throw error (e.g. accessing a key on undefined)

    const validater = new RequestValidationHelper(req, res);
    if (validater.whateverMethod().whateverOtherMethod().checksFailed) {
        //res.send() would have been set here already.
        return;
    }
    const result = DoYouContollerStuffHere();
    if (validater.someMoreChecks(result).checksFailed) {
        //res.send() would have been set here already.
        return;
    }
    //seems like everything is in order!
    res.status(200).json(whatever);
    return;
    */

    public static bounceNotLoggedIn(req: Request, res: Response, next: NextFunction): void {  // statically used as a express middleware
        if (req.user === undefined || req.user.username === undefined) {
            res.status(401).json(new CustomError(Models.APIModels.Errors.notLoggedIn));
            return;
        }
        next();
    }

    public checksFailed: boolean;
    private readonly req: Request;
    private readonly res: Response;

    constructor(req: Request, res: Response) {
        this.req = req;
        this.res = res;
        this.checksFailed = false;
    }

    public checkForAdminPrivilege(): RequestValidationHelper {
        if (this.checksFailed) { return this; }   // if previous test fails there is no need to do more
        if (this.req.user.type === Models.UserModels.userTypes.ADMIN) {
            return this;
        }
        this.res.status(401).json(new CustomError(Models.APIModels.Errors.authorised));
        this.checksFailed = true;
        return this;
    }

    public checkForAdminPrivilegeOrSelf(): RequestValidationHelper {
        /* PRECONDITION: req.body.user must be defined (see request body interfaces in packages) */
        if (this.checksFailed) { return this; } // if previous test fails there is no need to do more
        if (this.req.user.type === Models.UserModels.userTypes.ADMIN || this.req.user.username === this.req.body.user /* Be careful this bit */) {
            return this;
        }
        this.res.status(401).json(new CustomError(Models.APIModels.Errors.authorised));
        this.checksFailed = true;
        return this;
    }

    public checkForInteger(numberToBeChecked: number, name: string): RequestValidationHelper {
        /* PRECONDITION: numberToBeChecked is checked beforehand to be defined */
        /* PRECONDITION: datatype has been validated (as number) */
        if (this.checksFailed) { return this; } // if previous test fails there is no need to do more
        if (Number.isInteger(numberToBeChecked)) {
            return this;
        }
        this.res.status(400).json(new CustomError(Models.APIModels.Errors.invalidDataType(name, 'interger')));
        this.checksFailed = true;
        return this;
    }

    public checkForValidDataTypeForValue(objToBeChecked: any, type: Models.Enums.JSDataType, name: string): RequestValidationHelper {
        /* PRECONDITION: objToBeChecked is checked beforehand to be defined */
        if (this.checksFailed) { return this; } // if previous test fails there is no need to do more
        if (typeof objToBeChecked === type) {
            return this;
        }
        this.res.status(400).json(new CustomError(Models.APIModels.Errors.invalidDataType(name, type)));
        this.checksFailed = true;
        return this;
    }

    public checkRequiredKeysArePresentIn<T>(where: Models.APIModels.Enums.PlaceToCheck, keys: (keyof T)[]): RequestValidationHelper {
        /* PRECONDITION: req.body and req.query doesn't have to be checked to be defined beforehand */
        if (this.checksFailed) { return this; } // if previous test fails there is no need to do more
        const { Enums: { PlaceToCheck } , Errors } = Models.APIModels;
        const errorMsg = where === PlaceToCheck.BODY ? Errors.missingRequestKey(PlaceToCheck.BODY, keys as string[]) : Errors.missingQueryString(keys as string[]);
        if (this.req[where]) {
            for (const each of keys) {
                if (this.req[where][each] === undefined) {
                    this.res.status(400).json(new CustomError(errorMsg));
                    this.checksFailed = true;
                    return this;
                }
            }
            return this;
        }
        this.res.status(400).json(new CustomError(errorMsg));
        this.checksFailed = true;
        return this;

    }

    ////
    ////
    //// unfinised
    public checkForDuplicatedQueryParams(): RequestValidationHelper {
        if (this.checksFailed) { return this; } // if previous test fails there is no need to do more
        return this;
    }

    public checkKeyForValidValue<T>(keyName: string, value: T, allowedValues: T[]): RequestValidationHelper {
        /// PRECONDITION: PLEASE CHECK THE KEY EXISTS BY checkRequiredKeysArePresentIn FIRST.
        if (this.checksFailed) { return this; } // if previous test fails there is no need to do more
        if (allowedValues.includes(value)) {
            return this;
        }
        this.res.status(400).json(new CustomError(Models.APIModels.Errors.invalidReqKeyValue(keyName, allowedValues)));
        this.checksFailed = true;
        return this;
    }

    public checkStringDoesNotHaveSpace(input: string, field: string): RequestValidationHelper {
        /// PRECONDITION: CHECK THE INPUT IS STRING TYPE FIRST.
        if (this.checksFailed) { return this; } // if previous test fails there is no need to do more
        if (input.indexOf(' ') === -1) {
            return this;
        }
        this.res.status(400).json(new CustomError(`Value of field '${field}' cannot have space in it.`));
        this.checksFailed = true;
        return this;
    }

    public checkStringDoesNotHaveSpaceOrDot(input: string, field: string): RequestValidationHelper {
        /// PRECONDITION: CHECK THE INPUT IS STRING TYPE FIRST.
        if (this.checksFailed) { return this; } // if previous test fails there is no need to do more
        if (input.indexOf(' ') === -1 && input.indexOf('.') === -1) {
            return this;
        }
        this.res.status(400).json(new CustomError(`Value of field '${field}' cannot have space or dot in it.`));
        this.checksFailed = true;
        return this;
    }

    public checkSearchResultIsNotDefinedNorNull(obj: any, entryName: string): RequestValidationHelper {
        if (this.checksFailed) { return this; } // if previous test fails there is no need to do more
        if (obj === null || obj === undefined) {
            this.res.status(404).json(new CustomError(`${entryName} not found`));
            this.checksFailed = true;
            return this;
        }
        return this;
    }

    public checkSearchResultIsOne(entryName: string, result: number): RequestValidationHelper {
        if (this.checksFailed) { return this; } // if previous test fails there is no need to do more
        switch (result) {
            case 1:
                return this;
            case 0:
                this.res.status(404).json(new CustomError(Models.APIModels.Errors.entryNotFound(entryName)));
                this.checksFailed = true;
                return this;
            default:
                // maybe log the error somewhere with the req and give a reference number. ==> new CustomError(APIErrorTypes.resultBiggerThanOne, e, ERRORID);
                this.res.status(500).json(new CustomError(Models.APIModels.Errors.resultBiggerThanOne));
                this.checksFailed = true;
                return this;
        }
    }
}