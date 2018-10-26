'use strict';
const { RequestValidationHelper } = require('../dist/validationHelper.js');
const { Errors: APIErrorTypes } = require('../dist/models/api/errors.js');
const { CustomError } = require('../dist/error.js');


function MockRes() {
    this.statusCode = undefined;
    this.response = undefined;
    this.status = (number) => { this.statusCode = number; return this; };
    this.json = (object) => { this.response = object; return; };
}

describe('RequestValidationHelper Class testing', () => {
    test('bounces non admin', () => {
        const req = { user: { type: 'STANDARD' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper.checkForAdminPrivilege().checksFailed;
        expect(checksFailed).toBe(true);
        expect(res.statusCode).toBe(401);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.authorised));
    });

    test('doesnt bounces admin', () => {
        const req = { user: { type: 'ADMIN' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper.checkForAdminPrivilege().checksFailed;

        expect(checksFailed).toBe(false);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('checkForAdminPrivilegeOrSelf doesnt bounce admin', () => {
        const req = { user: { type: 'ADMIN' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper.checkForAdminPrivilegeOrSelf().checksFailed;

        expect(checksFailed).toBe(false);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('checkForAdminPrivilegeOrSelf bounces non-self-non-admin', () => {
        const req = { user: { type: 'STANDARD', username: 'chon' }, body: { user: 'chonDouble' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper.checkForAdminPrivilegeOrSelf().checksFailed;

        expect(checksFailed).toBe(true);
        expect(res.statusCode).toBe(401);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.authorised));
    });

    test('checkForAdminPrivilegeOrSelf doesnt bounce non-admin self', () => {
        const req = { user: { type: 'STANDARD', username: 'chon' }, body: { user: 'chon' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper.checkForAdminPrivilegeOrSelf().checksFailed;

        expect(checksFailed).toBe(false);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('checkRequiredKeysArePresentIn body bounces for missing keys', () => {
        const req = { body: { username: 'chon', type: 'apple' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper.checkRequiredKeysArePresentIn('body', ['username', 'password']).checksFailed;

        expect(checksFailed).toBe(true);
        expect(res.statusCode).toBe(400);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.missingRequestKey('body', ['username', 'password'])));
    });

    test('checkRequiredKeysArePresentIn body doesnt bounce when all keys are present', () => {
        const req = { body: { username: 'chon', password: 'apple' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper.checkRequiredKeysArePresentIn('body', ['username', 'password']).checksFailed;

        expect(checksFailed).toBe(false);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('checkRequiredKeysArePresentIn query bounces for missing keys', () => {
        const req = { body: { username: 'chon', type: 'apple' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper.checkRequiredKeysArePresentIn('query', ['username', 'password']).checksFailed;

        expect(checksFailed).toBe(true);
        expect(res.statusCode).toBe(400);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.missingQueryString(['username', 'password'])));
    });

    test('checkRequiredKeysArePresentIn query doesnt bounce when all keys are present', () => {
        const req = { query: { username: 'chon', password: 'apple' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper.checkRequiredKeysArePresentIn('query', ['username', 'password']).checksFailed;

        expect(checksFailed).toBe(false);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('checkKeyForValidValue bounces wrong value', () => {
        const req = { body: { username: 'chon', type: 'apple' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper.checkKeyForValidValue('type', req.body.type, ['ADMIN', 'STANDARD']).checksFailed;

        expect(checksFailed).toBe(true);
        expect(res.statusCode).toBe(400);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.invalidReqKeyValue('type', ['ADMIN', 'STANDARD'])));
    });

    test('checkKeyForValidValue doesnt bounce allowed value', () => {
        const req = { body: { username: 'chon', type: 'STANDARD' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper.checkKeyForValidValue('type', req.body.type, ['ADMIN', 'STANDARD']).checksFailed;

        expect(checksFailed).toBe(false);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('checkSearchResultIsOne doesnt bounce 1', () => {
        const mongoResult = { modifiedCount: 1 };
        const req = { };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper.checkSearchResultIsOne('user', mongoResult.modifiedCount).checksFailed;

        expect(checksFailed).toBe(false);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('checkSearchResultIsOne bounces > 1', () => {
        const mongoResult = { modifiedCount: 2 };
        const req = { };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper.checkSearchResultIsOne('user', mongoResult.modifiedCount).checksFailed;

        expect(checksFailed).toBe(true);
        expect(res.statusCode).toBe(500);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.resultBiggerThanOne));
    });

    test('checkSearchResultIsOne bounces 0', () => {
        const mongoResult = { modifiedCount: 0 };
        const req = { };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper.checkSearchResultIsOne('user', mongoResult.modifiedCount).checksFailed;

        expect(checksFailed).toBe(true);
        expect(res.statusCode).toBe(404);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.entryNotFound('user')));
    });

    test('chaining multiple validations (case all pass)', () => {
        const req = { user: { type: 'STANDARD', username: 'chon' }, body: { user: 'chon' }, query: { username: 'chon', password: 'apple' } };
        const mongoResult = { modifiedCount: 1 };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper
            .checkForAdminPrivilegeOrSelf()
            .checkRequiredKeysArePresentIn('query', ['username', 'password'])
            .checkSearchResultIsOne('user', mongoResult.modifiedCount)
            .checksFailed;
        expect(checksFailed).toBe(false);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('chaining multiple validations (case one fail)', () => {
        const req = { user: { type: 'STANDARD', username: 'chon' }, body: { user: 'chonDouble' }, query: { username: 'chon', password: 'apple' } };
        const mongoResult = { modifiedCount: 1 };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const checksFailed = helper
            .checkForAdminPrivilegeOrSelf()
            .checkRequiredKeysArePresentIn('body', ['username', 'password'])
            .checkSearchResultIsOne('user', mongoResult.modifiedCount)
            .checksFailed;
        expect(checksFailed).toBe(true);
        expect(res.statusCode).toBe(401);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.authorised));
    });

    test('chaining multiple validations (case multiple fail => error message relates to first fail & the subsequent functions are not called)', () => {
        let secondFunctionLogicEvaled;
        const req = { user: { type: 'STANDARD', username: 'chon' }, body: { user: 'chonDouble' }, query: { username: 'chon', password: 'apple' } };
        const mongoResult = { modifiedCount: 1 };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);

        helper.checkRequiredKeysArePresentIn = function() {
            if (this.checksFailed === true) {
                return this;
            }
            secondFunctionLogicEvaled = true;
            return this;
        };

        const checksFailed = helper
            .checkForAdminPrivilegeOrSelf()
            .checkRequiredKeysArePresentIn('body', ['username', 'paddddssword'])
            .checkSearchResultIsOne('user', mongoResult.modifiedCount)
            .checksFailed;

        expect(checksFailed).toBe(true);
        expect(res.statusCode).toBe(401);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.authorised));
        expect(secondFunctionLogicEvaled).toBe(undefined);
    });
});