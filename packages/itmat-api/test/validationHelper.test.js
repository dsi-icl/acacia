'use strict';
const { RequestValidationHelper } = require('../dist/controllers/validationHelper.js');
const { APIErrorTypes, CustomError } = require('itmat-utils');

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
        const allOkay = helper.checkForAdminPrivilege().allOkay;

        expect(allOkay).toBe(false);
        expect(res.statusCode).toBe(401);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.authorised));
    });

    test('doesnt bounces admin', () => {
        const req = { user: { type: 'ADMIN' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const allOkay = helper.checkForAdminPrivilege().allOkay;

        expect(allOkay).toBe(true);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('checkForAdminPrivilegeOrSelf doesnt bounce admin', () => {
        const req = { user: { type: 'ADMIN' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const allOkay = helper.checkForAdminPrivilegeOrSelf().allOkay;

        expect(allOkay).toBe(true);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('checkForAdminPrivilegeOrSelf bounces non-self-non-admin', () => {
        const req = { user: { type: 'STANDARD', username: 'chon' }, body: { user: 'chonDouble' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const allOkay = helper.checkForAdminPrivilegeOrSelf().allOkay;

        expect(allOkay).toBe(false);
        expect(res.statusCode).toBe(401);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.authorised));
    });

    test('checkForAdminPrivilegeOrSelf doesnt bounce non-admin self', () => {
        const req = { user: { type: 'STANDARD', username: 'chon' }, body: { user: 'chon' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const allOkay = helper.checkForAdminPrivilegeOrSelf().allOkay;

        expect(allOkay).toBe(true);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('checkRequiredKeysArePresentIn body bounces for missing keys', () => {
        const req = { body: { username: 'chon', type: 'apple' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const allOkay = helper.checkRequiredKeysArePresentIn('body', ['username', 'password']).allOkay;

        expect(allOkay).toBe(false);
        expect(res.statusCode).toBe(400);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.missingRequestKey('body', ['username', 'password'])));
    });

    test('checkRequiredKeysArePresentIn body doesnt bounce when all keys are present', () => {
        const req = { body: { username: 'chon', password: 'apple' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const allOkay = helper.checkRequiredKeysArePresentIn('body', ['username', 'password']).allOkay;

        expect(allOkay).toBe(true);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('checkRequiredKeysArePresentIn query bounces for missing keys', () => {
        const req = { body: { username: 'chon', type: 'apple' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const allOkay = helper.checkRequiredKeysArePresentIn('query', ['username', 'password']).allOkay;

        expect(allOkay).toBe(false);
        expect(res.statusCode).toBe(400);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.missingQueryString(['username', 'password'])));
    });

    test('checkRequiredKeysArePresentIn query doesnt bounce when all keys are present', () => {
        const req = { query: { username: 'chon', password: 'apple' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const allOkay = helper.checkRequiredKeysArePresentIn('query', ['username', 'password']).allOkay;

        expect(allOkay).toBe(true);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('checkKeyForValidValue bounces wrong value', () => {
        const req = { body: { username: 'chon', type: 'apple' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const allOkay = helper.checkKeyForValidValue('type', req.body.type, ['ADMIN', 'STANDARD']).allOkay;

        expect(allOkay).toBe(false);
        expect(res.statusCode).toBe(400);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.invalidReqKeyValue('type', ['ADMIN', 'STANDARD'])));
    });

    test('checkKeyForValidValue doesnt bounce allowed value', () => {
        const req = { body: { username: 'chon', type: 'STANDARD' } };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const allOkay = helper.checkKeyForValidValue('type', req.body.type, ['ADMIN', 'STANDARD']).allOkay;

        expect(allOkay).toBe(true);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('checkResultIsOne doesnt bounce 1', () => {
        const mongoResult = { modifiedCount: 1 };
        const req = { };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const allOkay = helper.checkResultIsOne('user', mongoResult.modifiedCount).allOkay;

        expect(allOkay).toBe(true);
        expect(res.statusCode).toBe(undefined);
        expect(res.response).toEqual(undefined);
    });

    test('checkResultIsOne bounces > 1', () => {
        const mongoResult = { modifiedCount: 2 };
        const req = { };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const allOkay = helper.checkResultIsOne('user', mongoResult.modifiedCount).allOkay;

        expect(allOkay).toBe(false);
        expect(res.statusCode).toBe(500);
        expect(res.response).toEqual(new CustomError('Weird things happened... Please contact your admin'));
    });

    test('checkResultIsOne bounces 0', () => {
        const mongoResult = { modifiedCount: 0 };
        const req = { };
        const res = new MockRes();
        const helper = new RequestValidationHelper(req, res);
        const allOkay = helper.checkResultIsOne('user', mongoResult.modifiedCount).allOkay;

        expect(allOkay).toBe(false);
        expect(res.statusCode).toBe(404);
        expect(res.response).toEqual(new CustomError(APIErrorTypes.entryNotFound('user')));
    });
});