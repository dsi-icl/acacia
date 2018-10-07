import { Express, Request, Response, NextFunction } from 'express';
import { CustomError, APIErrorTypes, userTypes, PlaceToCheck } from 'itmat-utils';

export class RequestValidationHelper {
    public allOkay: boolean;

    constructor(private readonly req: Request, private readonly res: Response) {
        this.allOkay = true;
    }

    public checkForAdminPrivilege(): RequestValidationHelper {
        if (!this.allOkay) return this;    //if previous test fails there is no need to do more
        if (this.req.user.type === userTypes.ADMIN) {
            return this;
        }
        this.res.status(401).json(new CustomError(APIErrorTypes.authorised));
        this.allOkay = false;
        return this;;
    }

    public checkForAdminPrivilegeOrSelf(): RequestValidationHelper {
        if (!this.allOkay) return this; //if previous test fails there is no need to do more
        if (this.req.user.type === userTypes.ADMIN || this.req.user.username === this.req.body.user) {
            return this;
        }
        this.res.status(401).json(new CustomError(APIErrorTypes.authorised));
        this.allOkay = false;
        return this;
    }

    public checkRequiredKeysArePresentIn<T>(where: PlaceToCheck, keys: (keyof T)[]): RequestValidationHelper {
        if(!this.allOkay) return this; //if previous test fails there is no need to do more
        const errorMsg = where === PlaceToCheck.BODY ? APIErrorTypes.missingRequestKey(PlaceToCheck.BODY, keys as string[]) : APIErrorTypes.missingQueryString(keys as string[]);
        if (this.req[where]) {
            for (let each of keys) {
                if (this.req[where][each] === undefined) {
                    this.res.status(400).json(new CustomError(errorMsg));
                    this.allOkay = false;
                    return this;
                }
            }
            return this;
        }
        this.res.status(400).json(new CustomError(errorMsg));
        this.allOkay = false;
        return this;

    }

    public checkKeyForValidValue<T>(keyName: string, value: T, allowedValues: Array<T>): RequestValidationHelper {
        ///PRECONDITION: PLEASE CHECK THE KEY EXISTS BY checkRequiredKeysArePresentIn FIRST.
        if (!this.allOkay) return this; //if previous test fails there is no need to do more
        if (allowedValues.includes(value)) {
            return this;
        }
        this.res.status(400).json(new CustomError(APIErrorTypes.invalidReqKeyValue(keyName, allowedValues)));
        this.allOkay = false;
        return this;
    }

    public checkResultIsOne(entryName: string, result: number): RequestValidationHelper {
        if (!this.allOkay) return this; //if previous test fails there is no need to do more
        switch (result) {
            case 1:
                return this;
            case 0:
                this.res.status(404).json(new CustomError(APIErrorTypes.entryNotFound(entryName)));
                this.allOkay = false;
                return this;
            default:
                // maybe log the error somewhere with the req and give a reference number.
                this.res.status(500).json(new CustomError('Weird things happened... Please contact your admin'));
                this.allOkay = false;
                return this;
        }
    }
}